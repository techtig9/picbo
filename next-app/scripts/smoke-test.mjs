#!/usr/bin/env node
/**
 * HTTP smoke tests against a running Picbo server.
 *
 * These assert the behaviours that static analysis cannot see and that unit
 * tests cannot reach — every case below is a measured production failure from
 * the Phase 0 audit, where a route returned 307 to /auth/sign-in instead of
 * doing its job.
 *
 * Usage:
 *   npm run build && npx next start -p 3111 &
 *   BASE_URL=http://127.0.0.1:3111 node scripts/smoke-test.mjs
 *
 * Runs unauthenticated on purpose: that is the state a webhook, a render
 * worker, a health probe and a crawler all arrive in.
 */

const BASE=process.env.BASE_URL||"http://127.0.0.1:3111";
const results=[];

async function probe(method,path,init={}){
  const {full,...fetchInit}=init;
  const res=await fetch(`${BASE}${path}`,{method,redirect:"manual",...fetchInit});
  const location=res.headers.get("location");
  let body="";
  // HTML pages are capped to keep failure output readable; asset bundles are
  // read whole, because the interesting rules live at the end of the file.
  try{const text=await res.text();body=full?text:text.slice(0,20000)}catch{}
  const headers={};
  res.headers.forEach((v,k)=>{headers[k.toLowerCase()]=v});
  return {status:res.status,location,body,headers,contentType:res.headers.get("content-type")||""};
}

function expect(name,condition,detail){
  results.push({name,ok:Boolean(condition),detail});
}

const redirectsToSignIn=r=>(r.status===307||r.status===302||r.status===303)&&(r.location||"").includes("/auth/sign-in");

async function run(){
  // ── RED-02: machine endpoints must reach their handler ────────────────────

  {
    const r=await probe("POST","/api/billing/webhook",{
      headers:{"content-type":"application/json","paddle-signature":"ts=1;h1=deadbeef"},
      body:JSON.stringify({event_id:"evt_smoke"})
    });
    expect("Paddle webhook reaches its handler",
      !redirectsToSignIn(r),
      `got ${r.status}${r.location?` -> ${r.location}`:""}; a 307 to sign-in means no subscription can ever activate`);
    expect("Paddle webhook rejects a bad signature",
      [401,503].includes(r.status),
      `expected 401 (bad signature) or 503 (provider not configured), got ${r.status}`);
  }

  for(const path of ["/api/render-worker/complete","/api/render-worker/fail"]){
    const r=await probe("POST",path,{headers:{"content-type":"application/json"},body:"{}"});
    expect(`${path} reaches its handler`,
      !redirectsToSignIn(r),
      `got ${r.status}${r.location?` -> ${r.location}`:""}`);
    expect(`${path} rejects a missing worker secret with 401`,
      r.status===401,
      `expected 401, got ${r.status}`);
  }

  {
    const r=await probe("GET","/api/health");
    expect("Liveness probe answers unauthenticated",r.status===200,`expected 200, got ${r.status}`);
    expect("Liveness probe returns JSON",r.contentType.includes("json"),`content-type was ${r.contentType}`);
  }

  {
    const r=await probe("GET","/api/v1/products");
    expect("Developer API reaches its handler",!redirectsToSignIn(r),`got ${r.status}${r.location?` -> ${r.location}`:""}`);
    expect("Developer API rejects a missing bearer key with 401",r.status===401,`expected 401, got ${r.status}`);
  }

  // ── RED-02: crawler files must not redirect ───────────────────────────────

  {
    const r=await probe("GET","/robots.txt");
    expect("robots.txt is served, not redirected",r.status===200,`got ${r.status}${r.location?` -> ${r.location}`:""}`);
    expect("robots.txt advertises a sitemap",/Sitemap:/i.test(r.body),"no Sitemap: line");
    expect("robots.txt is not self-contradictory",
      !(/^Allow: \/$/m.test(r.body)&&/^Disallow: \/$/m.test(r.body)),
      "emits both Allow: / and Disallow: / — most crawlers block the whole site");
  }

  {
    const r=await probe("GET","/sitemap.xml");
    expect("sitemap.xml is served",r.status===200,`got ${r.status}`);
    expect("sitemap.xml contains the landing page",r.body.includes("<loc>"),"no <loc> entries");
  }

  // ── RED-02: app API routes answer 401 JSON, not an HTML redirect ──────────

  {
    const r=await probe("POST","/api/ai/generate",{
      headers:{"content-type":"application/json"},
      body:JSON.stringify({task:"image",prompt:"x"})
    });
    expect("Unauthenticated app API returns 401, not a redirect",
      r.status===401,
      `got ${r.status}${r.location?` -> ${r.location}`:""}`);
    expect("Unauthenticated app API returns JSON",
      r.contentType.includes("json"),
      `content-type was ${r.contentType} — an SDK would try to parse HTML`);
  }

  // ── RED-03: the Google white-page bug ─────────────────────────────────────

  {
    const r=await probe("GET","/auth/callback?code=invalid-smoke-code");
    expect("OAuth callback route exists (was 404 — the white page)",
      r.status!==404,
      `got ${r.status}; Google returns users here and a 404 renders as a blank screen`);
    expect("A failed code exchange redirects to a readable error page",
      (r.location||"").includes("/auth/auth-error"),
      `expected a redirect to /auth/auth-error, got ${r.status} -> ${r.location||"(no location)"}`);
  }

  {
    const r=await probe("GET","/auth/callback");
    expect("Callback with no code shows an error, never a blank page",
      (r.location||"").includes("/auth/auth-error"),
      `got ${r.status} -> ${r.location||"(no location)"}`);
  }

  {
    const r=await probe("GET","/auth/callback?error=access_denied&error_description=User%20denied");
    expect("A cancelled Google consent screen is explained to the user",
      (r.location||"").includes("reason=cancelled"),
      `got ${r.status} -> ${r.location||"(no location)"}`);
  }

  {
    const r=await probe("GET","/auth/auth-error?reason=exchange_failed");
    expect("The auth error page renders real content",
      r.status===200&&r.body.length>200,
      `status ${r.status}, body ${r.body.length} bytes — an almost-empty body IS the white page`);
  }

  // ── RED-03: open-redirect defence on the callback ─────────────────────────

  {
    const r=await probe("GET","/auth/callback?code=x&next=%2F%2Fevil.example");
    const target=r.location||"";
    expect("Callback never redirects off-site",
      !target.includes("evil.example"),
      `redirect target was ${target}`);
  }

  // ── RED-03/15: the auth pages a user actually needs ───────────────────────

  for(const [path,label] of [
    ["/auth/sign-in","Sign-in page"],
    ["/auth/sign-up","Sign-up page"],
    ["/auth/forgot-password","Password reset request page"],
    ["/auth/reset-password","Set-new-password page"]
  ]){
    const r=await probe("GET",path);
    expect(`${label} loads`,r.status===200,`got ${r.status}`);
  }

  {
    const r=await probe("GET","/auth/sign-in");
    expect("Sign-in page offers real Google OAuth",
      /oauth-actions|Sign in with Google/i.test(r.body)||r.body.includes("Google"),
      "no Google sign-in control rendered");
  }

  // ── Public pages still work; private pages still protected ────────────────

  for(const path of ["/","/pricing"]){
    const r=await probe("GET",path);
    expect(`Public page ${path} loads signed out`,r.status===200,`got ${r.status}`);
  }

  {
    const r=await probe("GET","/dashboard");
    expect("Private page still requires a session",
      redirectsToSignIn(r),
      `expected a redirect to sign-in, got ${r.status} -> ${r.location||"(none)"}`);
    expect("Sign-in redirect preserves the requested destination",
      (r.location||"").includes("next="),
      `no next= parameter in ${r.location||"(none)"}`);
  }


  // ── Phase 2: generation jobs, uploads and assets ──────────────────────────

  {
    const r=await probe("POST","/api/ai/jobs/sweep",{headers:{"content-type":"application/json"}});
    expect("Job sweep reaches its handler (cron, worker secret)",
      !redirectsToSignIn(r),
      `got ${r.status}${r.location?` -> ${r.location}`:""}`);
    expect("Job sweep rejects a missing worker secret with 401",
      r.status===401,
      `expected 401, got ${r.status}`);
  }

  {
    const r=await probe("GET","/api/ai/jobs/00000000-0000-0000-0000-000000000000");
    expect("Job status endpoint requires a session (401 JSON)",
      r.status===401&&r.contentType.includes("json"),
      `got ${r.status} ${r.contentType}`);
  }

  {
    const r=await probe("POST","/api/ai/jobs/00000000-0000-0000-0000-000000000000/cancel");
    expect("Job cancel requires a session (401 JSON)",
      r.status===401&&r.contentType.includes("json"),
      `got ${r.status} ${r.contentType}`);
  }

  {
    const r=await probe("POST","/api/assets/upload");
    expect("Upload endpoint requires a session (401 JSON)",
      r.status===401&&r.contentType.includes("json"),
      `got ${r.status} ${r.contentType}`);
  }

  {
    const r=await probe("GET","/api/assets");
    expect("Asset listing requires a session (401 JSON)",
      r.status===401&&r.contentType.includes("json"),
      `got ${r.status} ${r.contentType}`);
  }

  {
    // Validation must happen before authentication is even relevant to the
    // shape of the error — an unknown task is a 400/401, never a 500.
    const r=await probe("POST","/api/ai/generate",{
      headers:{"content-type":"application/json"},
      body:JSON.stringify({task:"definitely-not-a-task",prompt:"x"})
    });
    expect("An unknown task is rejected cleanly, not with a 500",
      r.status<500,
      `got ${r.status}`);
  }

  {
    const r=await probe("GET","/create/image");
    expect("Image Studio requires a session",
      redirectsToSignIn(r),
      `got ${r.status} -> ${r.location||"(none)"}`);
  }


  // ── Phase 4: design system, shell and accessibility ───────────────────────

  {
    const r=await probe("GET","/auth/sign-in");
    expect("Theme is applied before first paint",
      r.body.includes("picbo-theme"),
      "no inline theme script — the page will flash the wrong theme on load");
    expect("Zoom is not locked",
      !/user-scalable\s*=\s*no/i.test(r.body)&&!/maximum-scale=1[,"]/.test(r.body),
      "viewport locks zoom, which fails WCAG 1.4.4");
    expect("Viewport meta is present",
      /name="viewport"/i.test(r.body),
      "no viewport meta — mobile renders at desktop width");
  }

  {
    const r=await probe("GET","/");
    expect("The landing page declares a language",
      /<html[^>]+lang=/i.test(r.body),
      "no lang attribute — screen readers guess the pronunciation");
    expect("Open Graph metadata is present on public pages",
      /property="og:/i.test(r.body),
      "no OG tags — links unfurl as bare URLs");
    expect("Twitter card metadata is present",
      /name="twitter:card"/i.test(r.body),
      "no Twitter card");
  }

  {
    // The stylesheet is the design system; if it did not load, every route is
    // unstyled and no amount of markup correctness matters.
    const page=await probe("GET","/auth/sign-in");
    const cssHref=(page.body.match(/href="(\/_next\/static\/css\/[^"]+)"/)||[])[1];
    expect("A stylesheet is linked",Boolean(cssHref),"no CSS bundle referenced");

    if(cssHref){
      const css=await probe("GET",cssHref,{full:true});
      expect("Design tokens are in the built CSS",
        css.body.includes("--brand-500")&&css.body.includes("--motion-fast"),
        "token custom properties are missing from the bundle");
      expect("Dark theme ships in the bundle",
        /data-theme=["']?dark["']?/.test(css.body),
        "no dark theme block");
      expect("Reduced motion is honoured",
        css.body.includes("prefers-reduced-motion"),
        "animation plays regardless of the OS accessibility setting");
      expect("A skip link exists in the design system",
        css.body.includes("skip-link"),
        "no skip link styling");
      expect("Focus-visible styling is global",
        css.body.includes("focus-visible"),
        "keyboard focus may be invisible");
    }
  }


  // ── Phase 5: hardening ────────────────────────────────────────────────────

  {
    const r=await probe("GET","/");
    const h=r.headers||{};
    expect("Content-Security-Policy is sent",
      Boolean(h["content-security-policy"]),"no CSP header");
    expect("CSP blocks framing",
      (h["content-security-policy"]||"").includes("frame-ancestors 'none'"),
      "the app can be framed by an attacker's page");
    expect("MIME sniffing is disabled",
      h["x-content-type-options"]==="nosniff","no nosniff header");
    expect("Referrer policy is set",
      Boolean(h["referrer-policy"]),"no referrer policy");
    expect("HSTS is set",
      Boolean(h["strict-transport-security"]),"no HSTS header");
    expect("Framework version is not advertised",
      !h["x-powered-by"],"x-powered-by exposes the framework version to scanners");
  }

  {
    const r=await probe("GET","/api/health");
    expect("API responses are not cacheable",
      (r.headers?.["cache-control"]||"").includes("no-store"),
      "per-user JSON and signed URLs could be held in a shared cache");
  }

  for(const [path,label] of [
    ["/legal/privacy","Privacy policy"],
    ["/legal/terms","Terms of service"]
  ]){
    const r=await probe("GET",path);
    expect(`${label} loads signed out`,r.status===200,`got ${r.status}`);
    expect(`${label} is indexable`,
      !/noindex/i.test(r.body),"legal pages must be crawlable");
  }

  {
    const r=await probe("GET","/sitemap.xml");
    expect("Legal pages are in the sitemap",
      r.body.includes("/legal/privacy")&&r.body.includes("/legal/terms"),
      "legal pages are not discoverable");
  }

  {
    const r=await probe("GET","/api/me/export");
    expect("Data export requires a session",
      r.status===401,`got ${r.status} — an unauthenticated export would leak an account`);
  }

  {
    const r=await probe("GET","/api/me/shell");
    expect("Shell context requires a session",r.status===401,`got ${r.status}`);
  }

  {
    const r=await probe("GET","/api/health/check");
    expect("Deep health check answers unauthenticated",
      r.status===200||r.status===503,`got ${r.status}`);
    expect("Deep health check does not leak secrets",
      !/eyJ|service_role|sk-|pdl_/.test(r.body),
      "health output contains something secret-shaped");
    expect("Queue depth is withheld from anonymous callers",
      !r.body.includes("aiQueued"),
      "internal queue depth exposed publicly");
  }

  // ── Report ────────────────────────────────────────────────────────────────

  const failed=results.filter(r=>!r.ok);
  for(const r of results){
    console.log(`${r.ok?"PASS":"FAIL"}  ${r.name}`);
    if(!r.ok&&r.detail)console.log(`      ↳ ${r.detail}`);
  }
  console.log(`\n${results.length-failed.length}/${results.length} passed, ${failed.length} failure(s)`);
  process.exitCode=failed.length?1:0;
}

run().catch(e=>{
  console.error(`smoke test could not run: ${e.message}`);
  console.error(`Is a server listening on ${BASE}?`);
  process.exitCode=1;
});
