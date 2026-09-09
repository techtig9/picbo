import {log} from "@/lib/observability/logger";

/**
 * Server-only Resend transport.
 *
 * Deliberately a thin fetch wrapper rather than the `resend` npm package: one
 * less dependency, and it makes the "never expose the key to the browser"
 * guarantee auditable in ten lines. RESEND_API_KEY is read at call time from
 * process.env and is never referenced from a "use client" module, never
 * prefixed NEXT_PUBLIC_, and never returned in a response body.
 *
 * Import this only from server code. It has no client entry point.
 */

const RESEND_ENDPOINT="https://api.resend.com/emails";

export interface EmailMessage{
  to:string;
  subject:string;
  html:string;
  text:string;
  /** Correlates the send with the auth event that triggered it, for log tracing. */
  tag?:string;
}

export interface EmailSendResult{
  ok:boolean;
  id?:string;
  skipped?:"not_configured";
  error?:string;
}

export function isEmailConfigured():boolean{
  return Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL);
}

function fromHeader():string{
  const email=process.env.RESEND_FROM_EMAIL||"";
  const name=process.env.RESEND_FROM_NAME||"Picbo";
  return name?`${name} <${email}>`:email;
}

/**
 * Sends one email. NEVER throws — a mail outage must not be able to fail an
 * authentication that already succeeded. Callers get a result object and are
 * expected to ignore it.
 */
export async function sendEmail(message:EmailMessage):Promise<EmailSendResult>{
  if(!isEmailConfigured()){
    // Not an error: a developer environment without Resend credentials should
    // sign in normally. Logged so it is visible rather than silent.
    log("info","email.skipped_not_configured",{tag:message.tag,subject:message.subject});
    return {ok:false,skipped:"not_configured"};
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);

  try{
    const res=await fetch(RESEND_ENDPOINT,{
      method:"POST",
      headers:{
        authorization:`Bearer ${process.env.RESEND_API_KEY}`,
        "content-type":"application/json"
      },
      body:JSON.stringify({
        from:fromHeader(),
        to:[message.to],
        subject:message.subject,
        html:message.html,
        text:message.text
      }),
      signal:controller.signal
    });

    const body=await res.json().catch(()=>({}));

    if(!res.ok){
      // Log the provider's message but never the API key or the full request.
      log("error","email.send_failed",{tag:message.tag,status:res.status,message:body?.message||body?.error||"unknown"});
      return {ok:false,error:String(body?.message||body?.error||`HTTP ${res.status}`)};
    }

    log("info","email.sent",{tag:message.tag,id:body?.id});
    return {ok:true,id:body?.id};
  }catch(e:any){
    const reason=e?.name==="AbortError"?"timeout":(e?.message||"network_error");
    log("error","email.send_error",{tag:message.tag,reason});
    return {ok:false,error:reason};
  }finally{
    clearTimeout(timeout);
  }
}
