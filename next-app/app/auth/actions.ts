"use server";
import {redirect} from "next/navigation";
import {headers} from "next/headers";
import {createClient} from "@/lib/supabase/server";
import {safeNextPath} from "@/lib/auth/safe-redirect";
import {getAppOrigin} from "@/lib/auth/app-url";
import {sendAuthEventEmail} from "@/lib/email/auth-emails";
import {log} from "@/lib/observability/logger";

/** Client IP + user agent, for the sign-in security notification. */
async function requestContext(){
  const h=await headers();
  return {
    ip:h.get("x-forwarded-for")?.split(",")[0]?.trim()||h.get("x-real-ip")||null,
    userAgent:h.get("user-agent")
  };
}

export async function signIn(formData:FormData){
  const email=String(formData.get("email")||"").trim();
  const password=String(formData.get("password")||"");
  const rawNext=String(formData.get("next")||"");
  const safeNext=safeNextPath(rawNext);

  const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword({email,password});

  if(error){
    log("warn","auth.signin.failed",{reason:error.message});
    redirect("/auth/sign-in?error="+encodeURIComponent(error.message)+(rawNext?`&next=${encodeURIComponent(rawNext)}`:""));
  }

  if(data.user){
    const ctx=await requestContext();
    // Never blocks or fails the sign-in — see lib/email/auth-emails.ts.
    await sendAuthEventEmail({
      event:"signin",
      userId:data.user.id,
      email:data.user.email||email,
      name:(data.user.user_metadata?.full_name as string|undefined)||null,
      method:"password",
      ip:ctx.ip,
      userAgent:ctx.userAgent
    });
    log("info","auth.signin.success",{user_id:data.user.id,method:"password"});
  }

  redirect(safeNext);
}

export async function signUp(formData:FormData){
  const email=String(formData.get("email")||"").trim();
  const password=String(formData.get("password")||"");
  const name=String(formData.get("name")||"").trim();
  const origin=await getAppOrigin();

  const supabase=await createClient();
  const {data,error}=await supabase.auth.signUp({
    email,
    password,
    options:{
      data:name?{full_name:name}:undefined,
      emailRedirectTo:`${origin}/auth/confirm`
    }
  });

  if(error){
    log("warn","auth.signup.failed",{reason:error.message});
    redirect("/auth/sign-up?error="+encodeURIComponent(error.message));
  }

  // With email confirmation enabled Supabase returns a user but no session.
  // The welcome email is still correct to send: the account now exists.
  if(data.user){
    await sendAuthEventEmail({
      event:"signup",
      userId:data.user.id,
      email:data.user.email||email,
      name:name||null,
      method:"password"
    });
    log("info","auth.signup.success",{user_id:data.user.id,method:"password"});
  }

  redirect("/auth/sign-in?message="+encodeURIComponent("Check your email to confirm your account"));
}

export async function signOut(){
  const supabase=await createClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}

/**
 * Sends a password-reset link.
 *
 * Always reports success, whatever Supabase returns. Telling an anonymous
 * caller "no account with that email" turns this form into an account
 * enumeration oracle; the generic response is the standard mitigation.
 */
export async function requestPasswordReset(formData:FormData){
  const email=String(formData.get("email")||"").trim();
  if(email){
    const origin=await getAppOrigin();
    const supabase=await createClient();
    const {error}=await supabase.auth.resetPasswordForEmail(email,{
      redirectTo:`${origin}/auth/reset-password`
    });
    if(error)log("warn","auth.password_reset.request_failed",{reason:error.message});
    else log("info","auth.password_reset.requested",{});
  }
  redirect("/auth/forgot-password?sent=1");
}

/**
 * Completes a password reset. Runs only for a request that already carries the
 * recovery session established by /auth/confirm, so the recovery token itself
 * is verified before this action is reachable.
 */
export async function updatePassword(formData:FormData){
  const password=String(formData.get("password")||"");
  const confirm=String(formData.get("confirmPassword")||"");

  if(password.length<8)redirect("/auth/reset-password?error="+encodeURIComponent("Password must be at least 8 characters"));
  if(password!==confirm)redirect("/auth/reset-password?error="+encodeURIComponent("Passwords don't match"));

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){
    redirect("/auth/auth-error?reason=exchange_failed&detail="+encodeURIComponent("Your password reset link has expired. Request a new one."));
  }

  const {error}=await supabase.auth.updateUser({password});
  if(error){
    log("warn","auth.password_reset.update_failed",{reason:error.message});
    redirect("/auth/reset-password?error="+encodeURIComponent(error.message));
  }

  log("info","auth.password_reset.completed",{user_id:user?.id});
  redirect("/auth/sign-in?message="+encodeURIComponent("Your password has been updated. Sign in with your new password."));
}
