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

  let response=NextResponse.next({request});
  const supabase=createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
