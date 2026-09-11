import {createAdminClient} from "@/lib/supabase/admin";
import {hashApiKey} from "./api-keys";
import {log} from "@/lib/observability/logger";

const RATE_LIMIT_WINDOW_MS=60_000;
const RATE_LIMIT_MAX_REQUESTS=60; // per key per minute

export interface ApiAuthResult{
  ok:boolean;
  workspaceId?:string;
  apiKeyId?:string;
  error?:string;
  status?:number;
  /** Set on a successful check so the caller can return standard headers. */
  rateLimit?:{limit:number;remaining:number;resetSeconds:number};
}

/**
 * Verifies a bearer API key and enforces a per-key rate limit.
 *
 * Keys are matched by SHA-256 hash — plaintext is never stored or compared.
 * Uses the service-role client because a public API request carries no
 * Supabase session: the key itself is the authentication.
 *
 * Rate limiting is counted in the database rather than in memory, because a
 * serverless instance's in-process counter resets on every cold start and
 * would silently stop limiting. The count is recorded up front (see below) so
 * the limit holds even for requests whose handler throws.
 */
export async function verifyApiKey(rawKey:string|null):Promise<ApiAuthResult>{
  if(!rawKey)return {ok:false,error:"MISSING_API_KEY",status:401};

  const hash=hashApiKey(rawKey);
  const supabase=createAdminClient();

  const {data:key,error}=await supabase.from("api_keys")
    .select("id,workspace_id,revoked_at,expires_at").eq("key_hash",hash).maybeSingle();
  if(error){
    log("error","developer.key_lookup_failed",{message:error.message});
    return {ok:false,error:"AUTH_LOOKUP_FAILED",status:500};
  }
  if(!key)return {ok:false,error:"INVALID_API_KEY",status:401};
  if(key.revoked_at)return {ok:false,error:"API_KEY_REVOKED",status:401};
  if(key.expires_at&&new Date(key.expires_at)<new Date()){
    return {ok:false,error:"API_KEY_EXPIRED",status:401};
  }

  const since=new Date(Date.now()-RATE_LIMIT_WINDOW_MS).toISOString();
  const {count}=await supabase.from("api_request_logs")
    .select("id",{count:"exact",head:true}).eq("api_key_id",key.id).gte("created_at",since);

  const used=count||0;
  if(used>=RATE_LIMIT_MAX_REQUESTS){
    log("warn","developer.rate_limited",{api_key_id:key.id,workspace_id:key.workspace_id});
    return {
      ok:false,error:"RATE_LIMIT_EXCEEDED",status:429,
      rateLimit:{limit:RATE_LIMIT_MAX_REQUESTS,remaining:0,resetSeconds:RATE_LIMIT_WINDOW_MS/1000}
    };
  }

  await supabase.from("api_keys").update({last_used_at:new Date().toISOString()}).eq("id",key.id);

  return {
    ok:true,
    workspaceId:key.workspace_id,
    apiKeyId:key.id,
    rateLimit:{
      limit:RATE_LIMIT_MAX_REQUESTS,
      remaining:Math.max(0,RATE_LIMIT_MAX_REQUESTS-used-1),
      resetSeconds:RATE_LIMIT_WINDOW_MS/1000
    }
  };
}

/**
 * Records a request against its key.
 *
 * Call this at the *start* of handling, not only on the way out. The previous
 * placement logged after the handler returned, so any request whose handler
 * threw was never counted — a caller could exceed the limit indefinitely just
 * by sending requests that error. `statusCode` is updated afterwards via
 * `finishApiRequest` when the outcome is known.
 */
export async function beginApiRequest(
  apiKeyId:string,workspaceId:string,method:string,path:string
):Promise<string|null>{
  try{
    const supabase=createAdminClient();
    const {data}=await supabase.from("api_request_logs").insert({
      api_key_id:apiKeyId,workspace_id:workspaceId,method,path,status_code:0
    }).select("id").single();
    return data?.id||null;
  }catch(e:any){
    // Never fail a request because logging failed; the limit is best-effort
    // in that case, which is preferable to a hard outage on the public API.
    log("error","developer.request_log_failed",{message:e?.message});
    return null;
  }
}

export async function finishApiRequest(logId:string|null,statusCode:number){
  if(!logId)return;
  try{
    const supabase=createAdminClient();
    await supabase.from("api_request_logs").update({status_code:statusCode}).eq("id",logId);
  }catch{
    // Outcome-only update; a failure here loses a status code, nothing more.
  }
}

/** Kept for callers that log a completed request in one step. */
export async function logApiRequest(
  apiKeyId:string,workspaceId:string,method:string,path:string,statusCode:number
){
  const supabase=createAdminClient();
  await supabase.from("api_request_logs").insert({
    api_key_id:apiKeyId,workspace_id:workspaceId,method,path,status_code:statusCode
  });
}

export const RATE_LIMIT={windowMs:RATE_LIMIT_WINDOW_MS,maxRequests:RATE_LIMIT_MAX_REQUESTS};
