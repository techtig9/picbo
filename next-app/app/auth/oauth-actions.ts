"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {getAppOrigin} from "@/lib/auth/app-url";
import {safeNextPath} from "@/lib/auth/safe-redirect";
import {log} from "@/lib/observability/logger";

/**
 * Starts a real Supabase Google OAuth flow.
 *
 * Run server-side on purpose: the @supabase/ssr server client writes the PKCE
 * code verifier into an httpOnly cookie, which is what /auth/callback later
 * needs to complete exchangeCodeForSession(). Starting the flow in the browser
 * would put the verifier in localStorage, where the server callback cannot
 * reach it — a common cause of "code exchange failed" loops.
 *
 * This replaces nothing in the production app (there was no OAuth at all). It
 * explicitly does NOT resemble the legacy static prototype's Google button,
 * which was `window.location.href='dashboard.html'` — a mock with no auth.
 */
export async function signInWithGoogle(formData:FormData){
  const next=safeNextPath(String(formData.get("next")||""),"/dashboard");
  const origin=await getAppOrigin();
  const supabase=await createClient();

  const {data,error}=await supabase.auth.signInWithOAuth({
    provider:"google",
    options:{
      redirectTo:`${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams:{
        // Ask Google for a refresh token and always show the account chooser,
        // so a user with several Google accounts is never silently signed in
        // as the wrong one.
        access_type:"offline",
        prompt:"select_account"
      }
    }
  });

  if(error||!data?.url){
    log("error","auth.oauth.start_failed",{message:error?.message});
    redirect(`/auth/auth-error?reason=provider_error&detail=${encodeURIComponent(error?.message||"Could not start Google sign-in")}`);
  }

  redirect(data.url);
}
