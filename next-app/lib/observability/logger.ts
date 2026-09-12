import {headers} from "next/headers";

export type LogLevel="debug"|"info"|"warn"|"error";

/**
 * Structured logging.
 *
 * This module existed before but was imported by **zero** files — an
 * observability story that was a file rather than a system. It is now on the
 * auth, email, billing, generation, rate-limit and health paths.
 *
 * Two things make these logs actually usable:
 *
 * 1. **Request correlation.** Every line carries a request id, so one user's
 *    failing generation can be followed across submission, provider attempts,
 *    output validation and storage — instead of being interleaved with every
 *    other request in the same instance.
 *
 * 2. **Redaction.** Metadata is scrubbed before it is written. A caller who
 *    logs an error object containing an Authorization header, an API key or a
 *    signed URL should not thereby publish it to the log drain, and relying on
 *    every caller to remember that is not a plan.
 */

const REDACTED="[redacted]";

/** Key names whose values are never safe to write out. */
const SENSITIVE_KEY=/(^|_)(password|secret|token|key|authorization|cookie|credential|api_?key)($|_)/i;

/** Value shapes that are secrets regardless of what the key is called. */
const SENSITIVE_VALUE=[
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\bsk-[A-Za-z0-9]{16,}/,
  /\bpk_live_[A-Za-z0-9_-]{16,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,  // JWT
  /\bpdl_[a-z]+_[A-Za-z0-9]{16,}/i
];

/** Signed storage URLs grant access to the object; the path alone does not. */
const SIGNED_URL=/([?&](token|signature|X-Amz-Signature)=)[^&\s"]+/gi;

export function redact(value:unknown,depth=0):unknown{
  if(depth>6)return "[depth-limit]";
  if(value==null)return value;

  if(typeof value==="string"){
    let out=value;
    for(const pattern of SENSITIVE_VALUE){
      if(pattern.test(out))return REDACTED;
    }
    out=out.replace(SIGNED_URL,`$1${REDACTED}`);
    // Bound the line length: a stack trace or a base64 image in a log line
    // costs money and hides the useful fields.
    return out.length>2000?out.slice(0,2000)+"…[truncated]":out;
  }

  if(typeof value==="number"||typeof value==="boolean")return value;

  if(Array.isArray(value)){
    return value.slice(0,50).map(v=>redact(v,depth+1));
  }

  if(value instanceof Error){
    return {name:value.name,message:redact(value.message,depth+1),stack:undefined};
  }

  if(typeof value==="object"){
    const out:Record<string,unknown>={};
    for(const [k,v] of Object.entries(value as Record<string,unknown>)){
      out[k]=SENSITIVE_KEY.test(k)?REDACTED:redact(v,depth+1);
    }
    return out;
  }

  return String(value);
}

/**
 * Correlation id for the current request.
 *
 * Read from the incoming `x-request-id` when a proxy supplies one, so a trace
 * spans the edge and the application. Returns undefined outside a request
 * context (background jobs, scripts) rather than throwing.
 */
export async function currentRequestId():Promise<string|undefined>{
  try{
    const h=await headers();
    return h.get("x-request-id")||h.get("x-vercel-id")||undefined;
  }catch{
    return undefined;
  }
}

export interface LogEntry{
  timestamp:string;
  level:LogLevel;
  event:string;
  [key:string]:unknown;
}

/**
 * Writes one structured line. Never throws: a logging failure must not become
 * an application failure.
 */
export function log(level:LogLevel,event:string,metadata:Record<string,unknown>={}):void{
  try{
    const entry:LogEntry={
      timestamp:new Date().toISOString(),
      level,
      event,
      ...(redact(metadata) as Record<string,unknown>)
    };
    const line=JSON.stringify(entry);
    if(level==="error")console.error(line);
    else if(level==="warn")console.warn(line);
    else console.log(line);
  }catch{
    // Circular metadata, a getter that throws — the event is still worth
    // recording even when its context cannot be serialised.
    try{console.error(JSON.stringify({timestamp:new Date().toISOString(),level,event,meta:"[unserialisable]"}))}catch{}
  }
}

/**
 * Records an unexpected error.
 *
 * Deliberately a single choke point. There is no error-tracking service
 * configured (Sentry or equivalent is listed in PICBO_REMAINING_ISSUES.md), so
 * this writes a structured line today — but every call site is already
 * correct, and wiring a real tracker means editing this function alone rather
 * than hunting through the codebase.
 */
export function captureError(event:string,error:unknown,metadata:Record<string,unknown>={}):void{
  const err=error instanceof Error?error:new Error(String(error));
  log("error",event,{
    ...metadata,
    error_name:err.name,
    error_message:err.message,
    // Stacks are kept here (unlike in redact()) because this is the path where
    // they are the point. They are still scrubbed for embedded secrets.
    stack:typeof err.stack==="string"?(redact(err.stack) as string):undefined
  });
}
