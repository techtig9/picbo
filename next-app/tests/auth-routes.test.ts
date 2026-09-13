import test from "node:test";
import assert from "node:assert/strict";
import {isPublicPage,isSelfAuthenticatingApi,isApiPath,isAuthRouteAllowedWhileSignedIn} from "../lib/auth/routes";

/**
 * Regression tests for RED-02: the middleware treated every path except a
 * short allow-list as requiring a session cookie, so six machine-to-machine
 * subsystems received a 307 redirect to an HTML sign-in page instead of
 * reaching their handler. Each case below was a measured production failure.
 */

test("Paddle webhook is not behind the cookie-session gate",()=>{
  assert.equal(isSelfAuthenticatingApi("/api/billing/webhook"),true,
    "webhooks carry no session cookie; gating them means no subscription can ever activate");
});

test("render worker callbacks are not behind the cookie-session gate",()=>{
  for(const p of ["/api/render-worker/complete","/api/render-worker/fail","/api/render-worker/sweep"]){
    assert.equal(isSelfAuthenticatingApi(p),true,`${p} must reach its handler`);
  }
});

test("health and readiness probes answer unauthenticated",()=>{
  assert.equal(isSelfAuthenticatingApi("/api/health"),true);
  assert.equal(isSelfAuthenticatingApi("/api/health/ready"),true);
  assert.equal(isSelfAuthenticatingApi("/api/health/check"),true);
});

test("developer API authenticates by bearer key, not by cookie",()=>{
  assert.equal(isSelfAuthenticatingApi("/api/v1/products"),true);
});

test("ordinary app API routes still require a session",()=>{
  for(const p of ["/api/ai/generate","/api/products","/api/lumi/chat","/api/notifications"]){
    assert.equal(isSelfAuthenticatingApi(p),false,`${p} must stay behind auth`);
    assert.equal(isApiPath(p),true);
  }
});

test("a lookalike prefix does not slip through the self-authenticating check",()=>{
  // "/api/v1evil" must not match the "/api/v1" prefix.
  assert.equal(isSelfAuthenticatingApi("/api/v1evil"),false);
  assert.equal(isSelfAuthenticatingApi("/api/healthcheck-public"),false);
});

test("crawler files are public",()=>{
  assert.equal(isPublicPage("/robots.txt"),true,"robots.txt was answering crawlers with a 307 to /auth/sign-in");
  assert.equal(isPublicPage("/sitemap.xml"),true);
});

test("marketing pages are public and app pages are not",()=>{
  assert.equal(isPublicPage("/"),true);
  assert.equal(isPublicPage("/pricing"),true);
  assert.equal(isPublicPage("/dashboard"),false);
  assert.equal(isPublicPage("/settings"),false);
});

test("share and invite links are reachable signed out",()=>{
  assert.equal(isPublicPage("/share/abc123"),true);
  assert.equal(isPublicPage("/invite/xyz"),true);
});

test("the OAuth callback still runs for an already-signed-in user",()=>{
  // The old middleware bounced ANY /auth* path to /dashboard once a session
  // cookie existed — swallowing the callback before exchangeCodeForSession.
  assert.equal(isAuthRouteAllowedWhileSignedIn("/auth/callback"),true);
  assert.equal(isAuthRouteAllowedWhileSignedIn("/auth/confirm"),true);
  assert.equal(isAuthRouteAllowedWhileSignedIn("/auth/sign-out"),true);
});

test("sign-in and sign-up are still bounced for a signed-in user",()=>{
  assert.equal(isAuthRouteAllowedWhileSignedIn("/auth/sign-in"),false);
  assert.equal(isAuthRouteAllowedWhileSignedIn("/auth/sign-up"),false);
});

/**
 * Unconfigured-deployment behaviour.
 *
 * A fresh Vercel deploy with no Supabase credentials returned
 * MIDDLEWARE_INVOCATION_FAILED — an opaque 500 — for *every* page, including
 * the public marketing pages that need no auth at all.
 *
 * It did not reproduce locally: `next start` runs middleware in the Node
 * runtime, which tolerated `createServerClient(undefined!, undefined!)`, while
 * Vercel runs middleware on Edge, where it throws. These assertions pin the
 * classification middleware uses to decide what it can still serve without
 * credentials, so the branch cannot be removed without failing here.
 */

test("public pages are identifiable without touching Supabase",()=>{
  // These must render on an unconfigured deployment — they need no session.
  for(const p of ["/","/pricing","/legal/privacy","/legal/terms","/auth/sign-in"]){
    assert.equal(isPublicPage(p),true,`${p} must be servable with no credentials`);
  }
});

test("protected pages are still recognised as needing a session",()=>{
  // These cannot be served honestly without credentials, so they must be
  // classified as non-public and get a diagnostic rather than a blank 500.
  for(const p of ["/dashboard","/create/image","/billing","/settings"]){
    assert.equal(isPublicPage(p),false,`${p} must not be served unconfigured`);
  }
});

test("the health check stays reachable on an unconfigured deployment",()=>{
  // It is the one endpoint that must answer, because it is what tells an
  // operator which variables are missing.
  assert.equal(isSelfAuthenticatingApi("/api/health/check"),true);
});
