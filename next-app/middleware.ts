import {NextResponse,type NextRequest} from "next/server";
import {createServerClient} from "@supabase/ssr";
import {isPublicPage,isSelfAuthenticatingApi,isApiPath,isAuthRouteAllowedWhileSignedIn} from "@/lib/auth/routes";
import {DEFAULT_SIGNED_IN_DESTINATION} from "@/lib/auth/safe-redirect";

export async function middleware(request:NextRequest){
  const path=request.nextUrl.pathname;

  // Endpoints that authenticate themselves (webhook signature, worker secret,
  // bearer API key) must never sit behind the cookie-session gate. Short
  // circuit before touching Supabase so a health probe stays cheap and a
  // Paddle webhook is not delayed by an auth round-trip it can never satisfy.
  if(isSelfAuthenticatingApi(path))return NextResponse.next();

  /**
   * Degrade cleanly when Supabase is not configured.
   *
   * Without this, `createServerClient(undefined!, undefined!)` throws and
   * Vercel returns an opaque `MIDDLEWARE_INVOCATION_FAILED` 500 for **every**
   * page — including the public marketing pages, which need no auth at all.
   *
   * This does not reproduce on a local `next start`: middleware runs in the
   * Node runtime there and tolerated the undefined values, but Vercel runs
   * middleware on Edge, where it throws. The failure only appears once
   * deployed, which is the worst place to discover it.
   *
   * Public pages are let through so a freshly-deployed, not-yet-configured
   * app is still browsable. Anything requiring a session cannot be served
   * honestly, so it gets a clear diagnostic instead of a blank 500 — and
   * `GET /api/health/check` names exactly which variables are missing.
   */
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if(!supabaseUrl||!supabaseAnonKey){
    if(isPublicPage(path))return NextResponse.next();
    if(isApiPath(path)){
      return NextResponse.json(
        {
          error:"SUPABASE_NOT_CONFIGURED",
          message:"This deployment has no Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy."
        },
        {status:503}
      );
    }
    const setup=new URL("/auth/auth-error",request.url);
    setup.searchParams.set("reason","not_configured");
    return NextResponse.redirect(setup);
  }

  let response=NextResponse.next({request});
  const supabase=createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies:{
        getAll(){return request.cookies.getAll()},
        setAll(items){
          items.forEach(({name,value})=>request.cookies.set(name,value));
          response=NextResponse.next({request});
          items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
        }
      }
    }
  );

  const {data:{user}}=await supabase.auth.getUser();

  if(!user&&!isPublicPage(path)){
    // An API client asking for JSON must get JSON. Redirecting it to an HTML
    // sign-in page produces a 307 that fetch()/SDKs follow and then fail to
    // parse, turning "not signed in" into an unrelated-looking crash.
    if(isApiPath(path)){
      return NextResponse.json({error:"UNAUTHENTICATED",message:"Sign in to access this endpoint."},{status:401});
    }
    const signIn=new URL("/auth/sign-in",request.url);
    if(path&&path!=="/")signIn.searchParams.set("next",path+request.nextUrl.search);
    return NextResponse.redirect(signIn);
  }

  // A signed-in user has no reason to see the sign-in/sign-up forms — but the
  // OAuth callback, email confirm and sign-out MUST still run for them. The
  // previous blanket startsWith("/auth") bounce swallowed the callback before
  // the authorization code was ever exchanged.
  if(user&&path.startsWith("/auth")&&!isAuthRouteAllowedWhileSignedIn(path)){
    return NextResponse.redirect(new URL(DEFAULT_SIGNED_IN_DESTINATION,request.url));
  }

  // The root layout no longer blanket-noindexes the site (that also hid the
  // landing and pricing pages from search). Private routes are instead marked
  // here, centrally, so a new authenticated page cannot be shipped indexable
  // by forgetting a per-page `robots` export.
  if(!isPublicPage(path)){
    response.headers.set("x-robots-tag","noindex, nofollow");
  }

  return response;
}

export const config={
  matcher:[
    /**
     * Skip Next internals and any request for a file with an extension
     * (robots.txt, sitemap.xml, favicon, images, fonts). Running the session
     * check on those was both wasteful and actively harmful: /robots.txt was
     * answering crawlers with a 307 redirect to /auth/sign-in.
     */
    "/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"
  ]
};
