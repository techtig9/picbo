import {createAdminClient} from "@/lib/supabase/admin";
import {hashApiKey} from "./api-keys";

const RATE_LIMIT_WINDOW_MS=60_000;
const RATE_LIMIT_MAX_REQUESTS=60; // per key per minute

export interface ApiAuthResult{
  ok:boolean;
  workspaceId?:string;
  apiKeyId?:string;
  error?:string;
  status?:number;
}

/**
 * Verifies a bearer API key against api_keys (by hash, never plaintext
 * comparison), rejects revoked keys, and enforces a real per-key rate limit
 * using api_request_logs as the source of truth (no in-memory counter that
 * would reset on every serverless cold start and silently stop limiting).
 * Uses the service-role client since public API requests carry no Supabase
 * session — the key itself IS the authentication.
 */
export async function verifyApiKey(rawKey:string|null):Promise<ApiAuthResult>{
  if(!rawKey)return {ok:false,error:"MISSING_API_KEY",status:401};
  const hash=hashApiKey(rawKey);
  const supabase=createAdminClient();

  const {data:key,error}=await supabase.from("api_keys").select("id,workspace_id,revoked_at").eq("key_hash",hash).maybeSingle();
  if(error)return {ok:false,error:"AUTH_LOOKUP_FAILED",status:500};
  if(!key)return {ok:false,error:"INVALID_API_KEY",status:401};
  if(key.revoked_at)return {ok:false,error:"API_KEY_REVOKED",status:401};

  const since=new Date(Date.now()-RATE_LIMIT_WINDOW_MS).toISOString();
  const {count}=await supabase.from("api_request_logs").select("id",{count:"exact",head:true}).eq("api_key_id",key.id).gte("created_at",since);
  if((count||0)>=RATE_LIMIT_MAX_REQUESTS){
    return {ok:false,error:"RATE_LIMIT_EXCEEDED",status:429};
  }

  await supabase.from("api_keys").update({last_used_at:new Date().toISOString()}).eq("id",key.id);
  return {ok:true,workspaceId:key.workspace_id,apiKeyId:key.id};
}

export async function logApiRequest(apiKeyId:string,workspaceId:string,method:string,path:string,statusCode:number){
  const supabase=createAdminClient();
  await supabase.from("api_request_logs").insert({api_key_id:apiKeyId,workspace_id:workspaceId,method,path,status_code:statusCode});
}
