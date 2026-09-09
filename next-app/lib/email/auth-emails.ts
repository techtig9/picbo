import {createAdminClient} from "@/lib/supabase/admin";
import {getAppOrigin} from "@/lib/auth/app-url";
import {sendEmail,isEmailConfigured} from "./client";
import {signupTemplate,signinTemplate} from "./templates";
import {log} from "@/lib/observability/logger";

export type AuthEmailEvent="signup"|"signin";

export interface AuthEventEmailInput{
  event:AuthEmailEvent;
  userId:string;
  email:string;
  name?:string|null;
  method:"password"|"google";
  ip?:string|null;
  userAgent?:string|null;
}

/**
 * Sends the only two transactional emails Picbo is allowed to send on auth:
 * account created, and account signed in. The master spec is explicit that
 * users must NOT be emailed for ordinary in-app actions, so there is no
 * generic "notify" helper here — adding an event means adding it deliberately.
 *
 * Two invariants:
 *
 * 1. This function never throws. Authentication has already succeeded by the
 *    time it runs; a Resend outage, a bad key, a network timeout or a missing
 *    email_events table must not turn a successful sign-in into an error page.
 *    Every failure is caught and logged.
 *
 * 2. Sends are deduplicated through email_events' unique (user_id, event,
 *    dedupe_key) index. The claim is inserted BEFORE the send, so two
 *    concurrent callbacks race on the database rather than both emailing the
 *    user. dedupe_key buckets sign-ins into 5-minute windows, which collapses
 *    the duplicate callbacks a double-clicked OAuth link produces without
 *    suppressing a genuine second sign-in later in the day.
 */
export async function sendAuthEventEmail(input:AuthEventEmailInput):Promise<void>{
  try{
    if(!input.email)return;
    if(!isEmailConfigured()){
      log("info","email.auth_event.skipped_not_configured",{event:input.event,user_id:input.userId});
      return;
    }

    const dedupeKey=input.event==="signup"
      ? "once"                                            // exactly one welcome email, ever
      : String(Math.floor(Date.now()/(5*60*1000)));       // one sign-in email per 5-minute window

    const claimed=await claimSend(input.userId,input.event,dedupeKey);
    if(!claimed){
      log("info","email.auth_event.deduplicated",{event:input.event,user_id:input.userId});
      return;
    }

    const appUrl=await getAppOrigin();
    const template=input.event==="signup"
      ? signupTemplate({name:input.name,appUrl})
      : signinTemplate({name:input.name,appUrl,method:input.method,ip:input.ip,userAgent:input.userAgent,when:new Date()});

    const result=await sendEmail({
      to:input.email,
      subject:template.subject,
      html:template.html,
      text:template.text,
      tag:`auth.${input.event}`
    });

    await recordOutcome(input.userId,input.event,dedupeKey,result.ok,result.error,result.id);
  }catch(e:any){
    // Deliberately swallowed: see invariant 1 above.
    log("error","email.auth_event.unhandled",{event:input.event,user_id:input.userId,message:e?.message});
  }
}

/**
 * Inserts the pending send row. Returns false when the unique index rejects
 * it, meaning another request already owns this send.
 */
async function claimSend(userId:string,event:AuthEmailEvent,dedupeKey:string):Promise<boolean>{
  try{
    const supabase=createAdminClient();
    const {error}=await supabase.from("email_events").insert({
      user_id:userId,event,dedupe_key:dedupeKey,status:"pending"
    });
    if(error){
      // 23505 = unique_violation: an expected, non-error outcome here.
      if((error as any).code==="23505")return false;
      log("warn","email.claim_failed",{event,message:error.message});
      // The log table is unavailable but the email itself is still wanted;
      // better a possible duplicate than a silently dropped security notice.
      return true;
    }
    return true;
  }catch(e:any){
    log("warn","email.claim_error",{event,message:e?.message});
    return true;
  }
}

async function recordOutcome(userId:string,event:AuthEmailEvent,dedupeKey:string,ok:boolean,error?:string,providerId?:string){
  try{
    const supabase=createAdminClient();
    await supabase.from("email_events").update({
      status:ok?"sent":"failed",
      provider_message_id:providerId||null,
      error:error?error.slice(0,500):null,
      completed_at:new Date().toISOString()
    }).eq("user_id",userId).eq("event",event).eq("dedupe_key",dedupeKey);
  }catch(e:any){
    log("warn","email.outcome_record_failed",{event,message:e?.message});
  }
}
