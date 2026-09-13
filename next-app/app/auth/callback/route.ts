import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {safeNextPath,DEFAULT_SIGNED_IN_DESTINATION} from "@/lib/auth/safe-redirect";
import {sendAuthEventEmail} from "@/lib/email/auth-emails";
import {log} from "@/lib/observability/logger";

/**
 * OAuth / PKCE callback.
 *
 * This route is the fix for the "Google sign-in shows a white page" bug. There
 * was previously no /auth/callback at all: Google redirected the user back to a
 * route that returned 404, which rendered as a blank dark screen. Three things
 * are required for the flow to work and all three were missing —
 *   1. this route existing,
 *   2. exchangeCodeForSession() actually being called on the ?code parameter,
 *   3. middleware NOT bouncing an already-authenticated request away from
 *      /auth/* before the exchange runs (see lib/auth/routes.ts).
 *
 * Every failure path below redirects to a real, readable error page. A user
 * must never again be shown a blank screen because auth failed.
 */
export async function GET(request:Request){
  const url=new URL(request.url);
  const code=url.searchParams.get("code");
  const next=safeNextPath(url.searchParams.get("next"));

  // The provider itself refused or the user cancelled the consent screen.
  // Supabase/Google send these back as query params, not as an exception.
  const providerError=url.searchParams.get("error");
  const providerErrorDescription=url.searchParams.get("error_description");
  if(providerError){
    const reason=providerError==="access_denied"?"cancelled":"provider_error";
    log("warn","auth.oauth.provider_error",{provider_error:providerError,description:providerErrorDescription});
    return NextResponse.redirect(errorUrl(url,reason,providerErrorDescription));
  }

  // Landing here with no code at all means the callback was opened directly,
  // the link was truncated, or an implicit-flow token was returned in the URL
  // fragment (which never reaches the server). All are user-visible errors.
  if(!code){
    log("warn","auth.oauth.missing_code",{});
    return NextResponse.redirect(errorUrl(url,"missing_code"));
  }

  const supabase=await createClient();
  const {data,error}=await supabase.auth.exchangeCodeForSession(code);

  if(error||!data?.session){
    // Most commonly: the code already got exchanged (double-clicked link,
    // browser prefetch), or it expired, or the PKCE verifier cookie is gone
    // because the flow started in a different browser/profile.
    log("error","auth.oauth.exchange_failed",{message:error?.message});
    return NextResponse.redirect(errorUrl(url,"exchange_failed",error?.message));
  }

  const user=data.session.user;

  // A brand-new OAuth identity has created_at === last_sign_in_at on its first
  // callback; treat that as a sign-up, anything later as a sign-in. Email
  // delivery is fire-and-forget and must never block or fail the redirect.
  const isNewUser=Boolean(user.created_at&&user.last_sign_in_at&&
    Math.abs(new Date(user.last_sign_in_at).getTime()-new Date(user.created_at).getTime())<5000);

  await sendAuthEventEmail({
    event:isNewUser?"signup":"signin",
    userId:user.id,
    email:user.email||"",
    name:(user.user_metadata?.full_name as string|undefined)||(user.user_metadata?.name as string|undefined),
    method:"google",
    ip:request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||null,
    userAgent:request.headers.get("user-agent")
  });

  log("info","auth.oauth.success",{user_id:user.id,method:"google",is_new_user:isNewUser});
  return NextResponse.redirect(new URL(next||DEFAULT_SIGNED_IN_DESTINATION,url.origin));
}

function errorUrl(base:URL,reason:string,detail?:string|null){
  const target=new URL("/auth/auth-error",base.origin);
  target.searchParams.set("reason",reason);
  if(detail)target.searchParams.set("detail",detail.slice(0,300));

  // Sanitise before forwarding. Carrying the raw `next` through to the error
  // page would hand an attacker-controlled destination to the "Try signing in
  // again" link, re-opening the open redirect one hop later.
  const rawNext=base.searchParams.get("next");
  if(rawNext){
    const safe=safeNextPath(rawNext,"");
    if(safe)target.searchParams.set("next",safe);
  }
  return target;
}
