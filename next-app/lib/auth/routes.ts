/**
 * Single source of truth for which paths are reachable without a Supabase
 * session cookie. Kept in one module so middleware, tests and future route
 * handlers can never drift apart.
 *
 * The distinction that matters: a *machine* endpoint is not "public" — it
 * authenticates itself (webhook signature, shared worker secret, bearer API
 * key). Sending it through the cookie-session gate is what silently broke
 * Paddle billing, the render worker, health probes and the developer API:
 * every one of them received a 307 redirect to an HTML sign-in page instead
 * of reaching its handler.
 */

/** Public marketing/auth pages a signed-out browser must be able to load. */
export const PUBLIC_PAGE_PREFIXES=["/auth","/invite/","/share/"] as const;
export const PUBLIC_PAGE_EXACT=["/","/pricing"] as const;

/** Files crawlers and browsers fetch directly — never redirect these. */
export const PUBLIC_FILE_EXACT=["/robots.txt","/sitemap.xml","/manifest.webmanifest","/favicon.ico"] as const;

/**
 * API routes that perform their own authentication and must therefore bypass
 * the session gate entirely. Each entry names the mechanism that protects it.
 */
export const SELF_AUTHENTICATING_API_PREFIXES=[
  "/api/auth",              // Supabase auth helpers
  "/api/billing/webhook",   // Paddle-Signature HMAC verification
  "/api/render-worker",     // x-render-worker-secret shared secret
  "/api/health",            // liveness/readiness probes — must answer unauthenticated
  "/api/v1"                 // developer platform: Bearer API key
] as const;

/**
 * Auth routes that must run even when a session cookie already exists.
 * `/auth/callback` is the critical one: bouncing an authenticated request to
 * /dashboard *before* exchangeCodeForSession runs is what made Google sign-in
 * fail intermittently and land users on a blank page.
 */
export const AUTH_ROUTES_ALLOWED_WHILE_SIGNED_IN=["/auth/callback","/auth/confirm","/auth/sign-out","/auth/auth-error"] as const;

export function isPublicPage(path:string):boolean{
  return (PUBLIC_PAGE_EXACT as readonly string[]).includes(path)
    ||(PUBLIC_FILE_EXACT as readonly string[]).includes(path)
    ||(PUBLIC_PAGE_PREFIXES as readonly string[]).some(p=>path===p.replace(/\/$/,"")||path.startsWith(p));
}

export function isSelfAuthenticatingApi(path:string):boolean{
  return (SELF_AUTHENTICATING_API_PREFIXES as readonly string[]).some(p=>path===p||path.startsWith(p+"/"));
}

export function isApiPath(path:string):boolean{
  return path==="/api"||path.startsWith("/api/");
}

export function isAuthRouteAllowedWhileSignedIn(path:string):boolean{
  return (AUTH_ROUTES_ALLOWED_WHILE_SIGNED_IN as readonly string[]).some(p=>path===p||path.startsWith(p+"/"));
}
