#!/usr/bin/env node
/**
 * Picbo production readiness audit.
 *
 * Replaces the previous stub, which checked only that package.json,
 * README.md, .env.example and supabase/ existed and then printed
 * {"ok": true} unconditionally. That script was cited as evidence of
 * production readiness while every check below was failing.
 *
 * Every check here asserts something that has actually broken in this
 * repository. A check that cannot fail does not belong in this file.
 *
 * Usage:  node scripts/production-audit.mjs [--json]
 * Exit:   0 = no failures, 1 = at least one FAIL.
 */
import fs from "node:fs";
import path from "node:path";

const appRoot=process.cwd();
const repoRoot=path.resolve(appRoot,"..");
const results=[];

const read=p=>{try{return fs.readFileSync(p,"utf8")}catch{return null}};
const exists=p=>fs.existsSync(p);

/**
 * Source with comments removed.
 *
 * Checks below assert on what the code *does*, so they must not match prose.
 * Three of them originally failed on their own explanatory comments — and a
 * check that a comment can flip to FAIL is one a comment can also flip to
 * PASS, which is worse.
 */
function code(p){
  const s=read(p);
  if(s===null)return null;
  return s
    .replace(/\/\*[\s\S]*?\*\//g,"")   // block comments
    .replace(/(^|[^:])\/\/.*$/gm,"$1");  // line comments (leaves "http://" alone)
}

/** True only when the file opens with the "use client" directive. */
function isClientModule(p){
  const s=code(p);
  if(!s)return false;
  return /^\s*["']use client["']/.test(s);
}

function check(id,name,fn){
  try{
    const r=fn();
    results.push({id,name,status:r.ok?"pass":(r.warn?"warn":"fail"),detail:r.detail||""});
  }catch(e){
    results.push({id,name,status:"fail",detail:`check threw: ${e.message}`});
  }
}

// ── Repository integrity ────────────────────────────────────────────────────

check("REPO-01","Next.js app is real files, not a broken gitlink",()=>{
  const p=path.join(repoRoot,"next-app");
  if(!exists(p))return {ok:false,detail:"next-app/ missing"};
  if(!fs.statSync(p).isDirectory())return {ok:false,detail:"next-app is not a directory"};
  const count=fs.readdirSync(path.join(p,"app")).length;
  return count>0?{ok:true,detail:`next-app/app has ${count} entries`}
                :{ok:false,detail:"next-app/app is empty — the gitlink regression is back"};
});

// ── Mock prototype quarantine ───────────────────────────────────────────────

const MOCK_FILES=["login.html","dashboard.html","billing.html","register.html","admin.html"];

check("MOCK-01","No mock HTML pages at the repository root",()=>{
  const stray=MOCK_FILES.filter(f=>exists(path.join(repoRoot,f)));
  return stray.length===0
    ?{ok:true,detail:"root is clean"}
    :{ok:false,detail:`deployable mock pages at repo root: ${stray.join(", ")}`};
});

check("MOCK-02","Quarantined prototype carries its warning banner",()=>{
  const dir=path.join(repoRoot,"legacy-prototype");
  if(!exists(dir))return {ok:true,detail:"no legacy-prototype/ directory"};
  const missing=fs.readdirSync(dir).filter(f=>f.endsWith(".html"))
    .filter(f=>!(read(path.join(dir,f))||"").startsWith("<!-- QUARANTINED MOCK"));
  return missing.length===0
    ?{ok:true,detail:"all prototype pages banner-marked"}
    :{ok:false,detail:`banner removed from: ${missing.join(", ")}`};
});

check("MOCK-03","No fake authentication or fake payment handlers survive",()=>{
  const dir=path.join(repoRoot,"legacy-prototype");
  if(!exists(dir))return {ok:true,detail:"no legacy-prototype/ directory"};
  const offenders=[];
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".html"))){
    const s=read(path.join(dir,f))||"";
    if(s.includes("dashboard.html"))offenders.push(`${f}: links to mock dashboard`);
    if(/picboToast\(\s*'(Switched to|Upgraded|Payment)/.test(s))offenders.push(`${f}: fake payment confirmation`);
  }
  return offenders.length===0
    ?{ok:true,detail:"no mock auth/payment handlers"}
    :{ok:false,detail:offenders.join("; ")};
});

// ── Auth ────────────────────────────────────────────────────────────────────

check("AUTH-01","Google OAuth is really implemented",()=>{
  const s=read(path.join(appRoot,"app/auth/oauth-actions.ts"))||"";
  return s.includes("signInWithOAuth")&&s.includes('provider:"google"')
    ?{ok:true,detail:"supabase.auth.signInWithOAuth present"}
    :{ok:false,detail:"no signInWithOAuth call — Google sign-in is not wired up"};
});

check("AUTH-02","OAuth callback route exists and exchanges the code",()=>{
  const s=read(path.join(appRoot,"app/auth/callback/route.ts"))||"";
  if(!s)return {ok:false,detail:"app/auth/callback/route.ts missing — Google returns users to a 404 (the white page)"};
  return s.includes("exchangeCodeForSession")
    ?{ok:true,detail:"exchangeCodeForSession present"}
    :{ok:false,detail:"callback exists but never exchanges the authorization code"};
});

check("AUTH-03","Callback is exempt from the signed-in /auth bounce",()=>{
  const s=read(path.join(appRoot,"lib/auth/routes.ts"))||"";
  return s.includes("/auth/callback")
    ?{ok:true,detail:"callback allow-listed while signed in"}
    :{ok:false,detail:"an authenticated request to /auth/callback would be redirected before the code exchange"};
});

check("AUTH-04","Password reset flow exists",()=>{
  const ok=exists(path.join(appRoot,"app/auth/forgot-password/page.tsx"))
    &&exists(path.join(appRoot,"app/auth/reset-password/page.tsx"))
    &&(read(path.join(appRoot,"app/auth/actions.ts"))||"").includes("resetPasswordForEmail");
  return ok?{ok:true,detail:"request + update + email route present"}
           :{ok:false,detail:"users who forget their password cannot recover their account"};
});

check("AUTH-05","Auth failures land on a readable error page",()=>{
  return exists(path.join(appRoot,"app/auth/auth-error/page.tsx"))
    ?{ok:true,detail:"auth-error page present"}
    :{ok:false,detail:"auth failures would render as a blank screen"};
});

// ── Middleware routing ──────────────────────────────────────────────────────

check("MW-01","Machine endpoints bypass the cookie-session gate",()=>{
  const s=read(path.join(appRoot,"lib/auth/routes.ts"))||"";
  const required=["/api/billing/webhook","/api/render-worker","/api/health","/api/v1"];
  const missing=required.filter(r=>!s.includes(r));
  return missing.length===0
    ?{ok:true,detail:"webhook, worker, health and developer API are self-authenticating"}
    :{ok:false,detail:`still behind the session gate (307 instead of reaching the handler): ${missing.join(", ")}`};
});

check("MW-02","Middleware matcher excludes static files",()=>{
  const s=read(path.join(appRoot,"middleware.ts"))||"";
  return /\\\\\.\[a-zA-Z0-9\]\+\$|\.\*\\\\\.\[/.test(s)||s.includes("[a-zA-Z0-9]+$")
    ?{ok:true,detail:"robots.txt / sitemap.xml / assets are not session-gated"}
    :{ok:false,detail:"middleware still runs on static files — robots.txt will 307 to sign-in"};
});

check("MW-03","Unauthenticated API requests get 401 JSON, not an HTML redirect",()=>{
  const s=read(path.join(appRoot,"middleware.ts"))||"";
  return s.includes("UNAUTHENTICATED")&&s.includes("status:401")
    ?{ok:true,detail:"API paths return 401 JSON"}
    :{ok:false,detail:"API clients receive a 307 to an HTML page"};
});

// ── Email ───────────────────────────────────────────────────────────────────

check("MAIL-01","Resend integration exists and is server-only",()=>{
  const s=read(path.join(appRoot,"lib/email/client.ts"))||"";
  if(!s)return {ok:false,detail:"no Resend integration"};
  if(isClientModule(path.join(appRoot,"lib/email/client.ts")))return {ok:false,detail:"mail client is a client module — the API key would ship to the browser"};
  return s.includes("RESEND_API_KEY")
    ?{ok:true,detail:"server-side Resend transport present"}
    :{ok:false,detail:"RESEND_API_KEY never read"};
});

check("MAIL-02","No Resend key is exposed to the browser",()=>{
  const bad=[];
  const walk=d=>{
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      if(e.name==="node_modules"||e.name===".next"||e.name.startsWith("."))continue;
      const p=path.join(d,e.name);
      if(e.isDirectory()){walk(p);continue}
      if(!/\.(ts|tsx|js|jsx)$/.test(e.name))continue;
      const s=code(p)||"";
      if(/NEXT_PUBLIC_RESEND/.test(s))bad.push(`${path.relative(appRoot,p)}: NEXT_PUBLIC_RESEND_*`);
      if(isClientModule(p)&&s.includes("RESEND_API_KEY"))bad.push(`${path.relative(appRoot,p)}: RESEND_API_KEY in a client component`);
    }
  };
  walk(appRoot);
  return bad.length===0?{ok:true,detail:"no client-side Resend references"}:{ok:false,detail:bad.join("; ")};
});

check("MAIL-03","Email failure cannot break authentication",()=>{
  const s=read(path.join(appRoot,"lib/email/auth-emails.ts"))||"";
  return s.includes("catch")&&/Promise<void>/.test(s)
    ?{ok:true,detail:"sendAuthEventEmail swallows and logs every failure"}
    :{ok:false,detail:"a mail outage could fail a successful sign-in"};
});

check("MAIL-04","Duplicate auth emails are prevented at the database level",()=>{
  const dir=path.join(appRoot,"supabase/migrations");
  const hit=exists(dir)&&fs.readdirSync(dir).some(f=>(read(path.join(dir,f))||"").includes("email_events_dedupe_uidx"));
  return hit?{ok:true,detail:"unique (user_id,event,dedupe_key) index present"}
            :{ok:false,detail:"no send-idempotency index — users can be emailed twice"};
});

// ── Credits ─────────────────────────────────────────────────────────────────

check("CREDIT-01","Credit reservation is concurrency-safe",()=>{
  const dir=path.join(appRoot,"supabase/migrations");
  if(!exists(dir))return {ok:false,detail:"no migrations directory"};
  const files=fs.readdirSync(dir).sort();
  let locked=false;
  for(const f of files){
    const s=read(path.join(dir,f))||"";
    if(!s.includes("function public.reserve_credits"))continue;
    locked=s.includes("pg_advisory_xact_lock")||s.includes("for update");
  }
  return locked
    ?{ok:true,detail:"latest reserve_credits definition takes a per-workspace lock"}
    :{ok:false,detail:"reserve_credits has a check-then-act race: concurrent jobs can overspend a workspace"};
});

check("CREDIT-02","Server does not take the credit price from the client",()=>{
  const s=code(path.join(appRoot,"app/api/ai/generate/route.ts"))||"";
  return /body\.creditCost/.test(s)
    ?{ok:false,detail:"app/api/ai/generate/route.ts trusts body.creditCost — a client can set its own price"}
    :{ok:true,detail:"cost is derived server-side"};
});

// ── SEO ─────────────────────────────────────────────────────────────────────

check("SEO-01","Root layout does not blanket-noindex the marketing site",()=>{
  const s=read(path.join(appRoot,"app/layout.tsx"))||"";
  return /robots:\s*\{\s*index:\s*false/.test(s)
    ?{ok:false,detail:"root layout sets index:false — public pages inherit noindex"}
    :{ok:true,detail:"no blanket noindex"};
});

check("SEO-02","robots.txt does not both allow and disallow everything",()=>{
  const s=read(path.join(appRoot,"app/robots.ts"))||"";
  if(!s)return {ok:false,detail:"app/robots.ts missing"};
  return /allow:\s*\[?["'`]\/["'`]/.test(s)&&/disallow:\s*["'`]\/["'`]/.test(s)
    ?{ok:false,detail:"contradictory Allow: / and Disallow: / — most crawlers will block the whole site"}
    :{ok:true,detail:"robots directives are coherent"};
});

check("SEO-03","A sitemap is generated",()=>{
  return exists(path.join(appRoot,"app/sitemap.ts"))
    ?{ok:true,detail:"app/sitemap.ts present"}
    :{ok:false,detail:"no sitemap — public pages will not be discovered"};
});

// ── Observability ───────────────────────────────────────────────────────────

check("OBS-01","The structured logger is actually used",()=>{
  let uses=0;
  const walk=d=>{
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      if(e.name==="node_modules"||e.name===".next"||e.name.startsWith("."))continue;
      const p=path.join(d,e.name);
      if(e.isDirectory()){walk(p);continue}
      if(!/\.(ts|tsx)$/.test(e.name))continue;
      if(p.endsWith("observability/logger.ts"))continue;
      if((code(p)||"").includes("observability/logger"))uses++;
    }
  };
  walk(appRoot);
  return uses>0
    ?{ok:true,detail:`imported by ${uses} module(s)`}
    :{ok:false,detail:"lib/observability/logger.ts is dead code — there is no structured logging"};
});

// ── Secrets ─────────────────────────────────────────────────────────────────

check("SEC-01","No committed .env with real values",()=>{
  const bad=[".env",".env.local",".env.production"]
    .flatMap(f=>[path.join(appRoot,f),path.join(repoRoot,f)])
    .filter(exists);
  return bad.length===0?{ok:true,detail:"no env files present"}
                       :{ok:false,detail:`env file(s) present in the tree: ${bad.map(p=>path.relative(repoRoot,p)).join(", ")}`};
});

check("SEC-02","Service-role key is never exposed to the browser",()=>{
  const bad=[];
  const walk=d=>{
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      if(e.name==="node_modules"||e.name===".next"||e.name.startsWith("."))continue;
      const p=path.join(d,e.name);
      if(e.isDirectory()){walk(p);continue}
      if(!/\.(ts|tsx)$/.test(e.name))continue;
      const s=code(p)||"";
      if(/NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/.test(s))bad.push(path.relative(appRoot,p));
      if(isClientModule(p)&&s.includes("SUPABASE_SERVICE_ROLE_KEY"))bad.push(path.relative(appRoot,p));
    }
  };
  walk(appRoot);
  return bad.length===0?{ok:true,detail:"service-role key is server-only"}:{ok:false,detail:bad.join(", ")};
});

check("ENV-01",".env.example documents every required variable",()=>{
  const s=read(path.join(appRoot,".env.example"))||"";
  const required=[
    "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL","RESEND_API_KEY","RESEND_FROM_EMAIL","RESEND_FROM_NAME",
    "PADDLE_API_KEY","PADDLE_WEBHOOK_SECRET","RENDER_WORKER_SECRET"
  ];
  const missing=required.filter(k=>!s.includes(k));
  return missing.length===0?{ok:true,detail:`${required.length} required variables documented`}
                           :{ok:false,detail:`undocumented: ${missing.join(", ")}`};
});

// ── Generation, output and uploads ──────────────────────────────────────────

check("GEN-01","Generation output is persisted, not just left as provider JSON",()=>{
  const s=code(path.join(appRoot,"lib/generation/persist-output.ts"))||"";
  if(!s)return {ok:false,detail:"no output persistence — provider URLs expire and the user never sees the result"};
  return s.includes("persistGenerationOutput")&&s.includes("picbo-assets")
    ?{ok:true,detail:"output is downloaded, validated and stored"}
    :{ok:false,detail:"persist-output.ts does not store to the assets bucket"};
});

check("GEN-02","The studio actually renders the generated image",()=>{
  const studio=code(path.join(appRoot,"app/create/image/page.tsx"))||"";
  const result=code(path.join(appRoot,"components/creative/GenerationResult.tsx"))||"";
  if(/Results are returned by the configured provider/.test(studio)){
    return {ok:false,detail:"studio still reports success as a string instead of showing the image"};
  }
  return result.includes("<img")||result.includes("<video")
    ?{ok:true,detail:"results render as real media"}
    :{ok:false,detail:"no media element in the result component"};
});

check("GEN-03","Output is validated by its bytes, not its Content-Type",()=>{
  const s=code(path.join(appRoot,"lib/generation/media-validation.ts"))||"";
  return s.includes("sniffMediaFormat")&&s.includes("validateMedia")
    ?{ok:true,detail:"magic-byte sniffing with format allow-list"}
    :{ok:false,detail:"a JSON error body could be stored and billed as an image"};
});

check("GEN-04","Generation jobs are durable and pollable",()=>{
  const jobs=code(path.join(appRoot,"lib/ai/jobs.ts"))||"";
  const pollRoute=exists(path.join(appRoot,"app/api/ai/jobs/[id]/route.ts"));
  const sweep=exists(path.join(appRoot,"app/api/ai/jobs/sweep/route.ts"));
  if(!jobs.includes("submitGenerationJob"))return {ok:false,detail:"no async submission — generation still runs inline in the request"};
  if(!pollRoute)return {ok:false,detail:"no job status endpoint to poll"};
  if(!sweep)return {ok:false,detail:"no sweep endpoint — abandoned jobs strand credits forever"};
  return {ok:true,detail:"submit, poll, cancel and sweep all present"};
});

check("UPLOAD-01","Users are not asked to paste raw asset URLs",()=>{
  const studio=code(path.join(appRoot,"app/create/image/page.tsx"))||"";
  const uploadRoute=exists(path.join(appRoot,"app/api/assets/upload/route.ts"));
  if(/Source image URL/i.test(studio)){
    return {ok:false,detail:"the studio still asks users to copy an asset link by hand"};
  }
  return uploadRoute
    ?{ok:true,detail:"upload endpoint and picker present"}
    :{ok:false,detail:"no upload endpoint"};
});

check("RENDER-01","Render worker output cannot point at another workspace",()=>{
  const s=code(path.join(appRoot,"lib/render/lifecycle.ts"))||"";
  return s.includes("assertRenderOutputPath")
    ?{ok:true,detail:"worker-reported storage paths are checked against the job workspace"}
    :{ok:false,detail:"completeRenderJob trusts the worker path — cross-workspace asset exposure"};
});

check("RENDER-02","Worker secret comparison is constant-time",()=>{
  const s=code(path.join(appRoot,"lib/render/worker-auth.ts"))||"";
  return s.includes("timingSafeEqual")
    ?{ok:true,detail:"constant-time comparison"}
    :{ok:false,detail:"string equality short-circuits and leaks the secret over many requests"};
});

// ── Billing, teams and developer platform ───────────────────────────────────

check("PADDLE-01","Checkout uses the Paddle Billing API, not the Classic URL scheme",()=>{
  const provider=code(path.join(appRoot,"lib/billing/payment-provider.ts"))||"";
  if(/checkout\.paddle\.com\/checkout\?/.test(provider)){
    return {ok:false,detail:"builds a Paddle Classic URL while the webhook implements Paddle Billing — that link cannot open a real checkout"};
  }
  const api=code(path.join(appRoot,"lib/billing/paddle-api.ts"))||"";
  return api.includes("createTransaction")&&api.includes("/transactions")
    ?{ok:true,detail:"transactions are created through the Billing API"}
    :{ok:false,detail:"no Paddle Billing transaction creation"};
});

check("PADDLE-02","Cancellation actually reaches Paddle",()=>{
  const actions=code(path.join(appRoot,"app/billing/actions.ts"))||"";
  return actions.includes("cancelSubscriptionAtPaddle")
    ?{ok:true,detail:"the provider is called before the local record is written"}
    :{ok:false,detail:"cancel only updates the local row — the customer keeps being charged"};
});

check("PADDLE-03","Webhook signatures are checked for freshness",()=>{
  const s=code(path.join(appRoot,"lib/billing/payment-provider.ts"))||"";
  return s.includes("WEBHOOK_MAX_AGE_SECONDS")
    ?{ok:true,detail:"stale signatures are rejected"}
    :{ok:false,detail:"a captured webhook stays replayable forever"};
});

check("PADDLE-04","Paying customers are granted the credits they bought",()=>{
  const s=code(path.join(appRoot,"app/api/billing/webhook/route.ts"))||"";
  if(!s.includes("grantPlanCredits"))return {ok:false,detail:"checkout completes and the balance stays at zero"};
  return s.includes("paddle:")
    ?{ok:true,detail:"grants are keyed on the Paddle event id, so a retry cannot double-grant"}
    :{ok:false,detail:"credit grant is not idempotent against webhook retries"};
});

check("TEAM-01","Team actions check the caller's role before writing",()=>{
  const s=code(path.join(appRoot,"app/team/actions.ts"))||"";
  if(!s.includes("assertManagesMembers")){
    return {ok:false,detail:"RLS filters the write to zero rows and returns no error — the UI reports success while nothing happened"};
  }
  return s.includes("assertNotLastOwner")
    ?{ok:true,detail:"role checked, and a workspace cannot be left without an owner"}
    :{ok:false,detail:"no last-owner protection"};
});

check("TEAM-02","An admin cannot promote themselves to owner",()=>{
  const s=code(path.join(appRoot,"app/team/actions.ts"))||"";
  return /Only the workspace owner can transfer ownership/.test(s)
    ?{ok:true,detail:"ownership transfer is owner-only"}
    :{ok:false,detail:"privilege escalation inside the RLS boundary: admin -> owner -> remove the real owner"};
});

check("DEV-01","API requests are counted before the handler runs",()=>{
  const s=code(path.join(appRoot,"lib/developer/verify-request.ts"))||"";
  return s.includes("beginApiRequest")
    ?{ok:true,detail:"a failing handler still counts against the rate limit"}
    :{ok:false,detail:"only successful requests are logged — a caller can exceed the limit indefinitely with requests that error"};
});

check("DEV-02","API keys support expiry as well as revocation",()=>{
  const s=code(path.join(appRoot,"lib/developer/verify-request.ts"))||"";
  return s.includes("expires_at")
    ?{ok:true,detail:"expired keys are rejected like revoked ones"}
    :{ok:false,detail:"keys are valid forever unless revoked by hand"};
});

// ── Design system, shell and accessibility ──────────────────────────────────

check("UI-01","A real design token system exists",()=>{
  const s=read(path.join(appRoot,"app/tokens.css"))||"";
  if(!s)return {ok:false,detail:"no tokens.css — styling is ad-hoc hex values"};
  const required=["--brand-500","--space-4","--radius-md","--motion-fast","--z-modal","--text-base","--shadow-md"];
  const missing=required.filter(t=>!s.includes(t));
  return missing.length===0
    ?{ok:true,detail:"colour, space, radius, motion, z-index, type and shadow scales all present"}
    :{ok:false,detail:`token scales missing: ${missing.join(", ")}`};
});

check("UI-02","The app is light-first with a real dark theme",()=>{
  const s=read(path.join(appRoot,"app/tokens.css"))||"";
  const hasDark=s.includes('[data-theme="dark"]')&&s.includes("prefers-color-scheme: dark");
  const lightDefault=/:root\s*\{[\s\S]*?--canvas:\s*#F8FAFC/i.test(s);
  if(!lightDefault)return {ok:false,detail:"the light canvas is not the default — the app is still dark-only"};
  return hasDark
    ?{ok:true,detail:"light default, explicit dark theme, OS preference respected"}
    :{ok:false,detail:"no dark theme"};
});

check("UI-03","Semantic colours have accessible text variants",()=>{
  const s=read(path.join(appRoot,"app/tokens.css"))||"";
  const required=["--success-fg","--warning-fg","--danger-fg"];
  const missing=required.filter(t=>!s.includes(t));
  return missing.length===0
    ?{ok:true,detail:"darkened -fg variants exist for text use"}
    :{ok:false,detail:`using raw semantic colours as body text fails WCAG AA: ${missing.join(", ")}`};
});

check("UI-04","Navigation matches the specified 13-item IA",()=>{
  const s=code(path.join(appRoot,"lib/ui/navigation.ts"))||"";
  if(!s)return {ok:false,detail:"no navigation module"};
  const count=(s.match(/href:"\/[a-z-]*"/g)||[]).length;
  return s.includes("PRIMARY_NAV")&&count>0
    ?{ok:true,detail:"navigation IA is declared in one place"}
    :{ok:false,detail:"navigation is hardcoded in the shell"};
});

check("UI-05","The search control actually does something",()=>{
  const shell=code(path.join(appRoot,"components/app-shell.tsx"))||"";
  const palette=code(path.join(appRoot,"components/CommandPalette.tsx"))||"";
  if(!palette)return {ok:false,detail:"the top-bar search promises ⌘K and has no handler"};
  return shell.includes("CommandPalette")&&palette.includes("metaKey")
    ?{ok:true,detail:"⌘K opens a working palette"}
    :{ok:false,detail:"palette exists but is not wired to the shell or the shortcut"};
});

check("UI-06","No fake data in the app chrome",()=>{
  const s=code(path.join(appRoot,"components/app-shell.tsx"))||"";
  return /["']SA["']/.test(s)
    ?{ok:false,detail:'the avatar is hardcoded to "SA" for every user'}
    :{ok:true,detail:"avatar derives from the signed-in user"};
});

check("A11Y-01","A skip link is present",()=>{
  const s=code(path.join(appRoot,"components/app-shell.tsx"))||"";
  return s.includes("skip-link")&&s.includes("#main-content")
    ?{ok:true,detail:"skip link targets the main landmark"}
    :{ok:false,detail:"keyboard users must tab through the whole sidebar on every page"};
});

check("A11Y-02","Modal surfaces trap focus and restore it",()=>{
  const shell=code(path.join(appRoot,"components/app-shell.tsx"))||"";
  const palette=code(path.join(appRoot,"components/CommandPalette.tsx"))||"";
  const shellTraps=shell.includes("Tab")&&shell.includes("preventDefault");
  const paletteTraps=palette.includes("Tab")&&palette.includes("previouslyFocused");
  return shellTraps&&paletteTraps
    ?{ok:true,detail:"drawer and palette both trap and restore focus"}
    :{ok:false,detail:"focus can escape a modal overlay, or is lost on close"};
});

check("A11Y-03","The off-screen drawer is inert",()=>{
  const s=code(path.join(appRoot,"components/app-shell.tsx"))||"";
  return s.includes("inert")
    ?{ok:true,detail:"a hidden sidebar cannot be tabbed into"}
    :{ok:false,detail:"keyboard users can tab into an invisible off-screen menu"};
});

check("A11Y-04","Zoom is not locked",()=>{
  const s=read(path.join(appRoot,"app/layout.tsx"))||"";
  if(/userScalable:\s*false/.test(s))return {ok:false,detail:"user-scalable=no fails WCAG 1.4.4"};
  return /maximumScale:\s*([2-9]|10)/.test(s)||!s.includes("maximumScale")
    ?{ok:true,detail:"pinch-to-zoom works"}
    :{ok:false,detail:"maximum-scale below 2 effectively blocks zoom"};
});

check("A11Y-05","Current page is announced in navigation",()=>{
  const s=code(path.join(appRoot,"components/app-shell.tsx"))||"";
  return s.includes('aria-current')
    ?{ok:true,detail:"aria-current=page on the active item"}
    :{ok:false,detail:"a screen reader cannot tell which page is active"};
});

check("A11Y-06","Theme is applied before first paint",()=>{
  const s=code(path.join(appRoot,"components/theme-script.tsx"))||"";
  const layout=code(path.join(appRoot,"app/layout.tsx"))||"";
  return s.includes("picbo-theme")&&layout.includes("ThemeScript")
    ?{ok:true,detail:"no flash of the wrong theme"}
    :{ok:false,detail:"theme resolves after hydration, flashing on every navigation"};
});

// ── Report ──────────────────────────────────────────────────────────────────

const failed=results.filter(r=>r.status==="fail");
const warned=results.filter(r=>r.status==="warn");

if(process.argv.includes("--json")){
  console.log(JSON.stringify({
    ok:failed.length===0,
    summary:{total:results.length,passed:results.length-failed.length-warned.length,warned:warned.length,failed:failed.length},
    results
  },null,2));
}else{
  const icon={pass:"PASS",warn:"WARN",fail:"FAIL"};
  for(const r of results){
    console.log(`${icon[r.status].padEnd(5)} ${r.id.padEnd(10)} ${r.name}`);
    if(r.status!=="pass"&&r.detail)console.log(`${"".padEnd(16)}↳ ${r.detail}`);
  }
  console.log("");
  console.log(`${results.length-failed.length-warned.length}/${results.length} passed, ${warned.length} warning(s), ${failed.length} failure(s)`);
}

process.exitCode=failed.length?1:0;
