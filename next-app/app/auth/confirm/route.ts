import {NextResponse} from "next/server";
import {type EmailOtpType} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/server";
import {safeNextPath} from "@/lib/auth/safe-redirect";
import {log} from "@/lib/observability/logger";

/**
 * Verifies an emailed one-time token: signup confirmation, email change, and
 * password recovery.
 *
 * Supabase sends these as ?token_hash=...&type=... (the PKCE-safe form). The
 * app previously had no route to receive them, so a confirmation link landed
 * on a 404 — the same blank-page failure as the missing OAuth callback.
 */
const VALID_TYPES:EmailOtpType[]=["signup","invite","magiclink","recovery","email_change","email"];

export async function GET(request:Request){
  const url=new URL(request.url);
  const tokenHash=url.searchParams.get("token_hash");
  const type=url.searchParams.get("type") as EmailOtpType|null;

  // A recovery link must land on the set-a-new-password form, not the
  // dashboard: the user came here specifically because they cannot sign in.
  const defaultNext=type==="recovery"?"/auth/reset-password":"/dashboard";
  const next=safeNextPath(url.searchParams.get("next"),defaultNext);

  if(!tokenHash||!type||!VALID_TYPES.includes(type)){
    log("warn","auth.confirm.invalid_request",{type});
    return NextResponse.redirect(new URL("/auth/auth-error?reason=missing_code",url.origin));
  }

  const supabase=await createClient();
  const {error}=await supabase.auth.verifyOtp({type,token_hash:tokenHash});

  if(error){
    log("warn","auth.confirm.verify_failed",{type,message:error.message});
    const target=new URL("/auth/auth-error",url.origin);
    target.searchParams.set("reason","exchange_failed");
    target.searchParams.set("detail",error.message.slice(0,300));
    return NextResponse.redirect(target);
  }

  log("info","auth.confirm.success",{type});
  return NextResponse.redirect(new URL(next,url.origin));
}
