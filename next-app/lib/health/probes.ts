import {createAdminClient} from "@/lib/supabase/admin";
import {MODEL_REGISTRY} from "@/lib/ai/models";
import type {ProviderName,TaskKind} from "@/lib/ai/types";

/**
 * Real dependency health.
 *
 * The previous check reported the AI chain as `ok` when any one of
 * GROQ_API_KEY / CEREBRAS_API_KEY / OPENROUTER_API_KEY was a non-empty string.
 * It never called a provider. A revoked, expired or quota-exhausted key
 * reported GREEN, which is worse than no health check at all — it actively
 * tells you the thing that is broken is fine.
 *
 * The master spec asks for these to be distinguished, so they are modelled
 * explicitly rather than collapsed into one boolean:
 *
 *   not_configured  no credential present — expected in some environments
 *   unreachable     network/DNS failure
 *   unauthenticated credential present and rejected  ← the case that used to read "ok"
 *   quota_exhausted authenticated but out of quota
 *   degraded        working, but slow or partially available
 *   ok              reachable, authenticated, and able to serve its task
 */

export type ProbeState=
  |"ok"|"degraded"|"unauthenticated"|"quota_exhausted"|"unreachable"|"not_configured"|"error";

export interface ProbeResult{
  service:string;
  state:ProbeState;
  latencyMs?:number;
  detail?:string;
  metadata?:Record<string,unknown>;
}

/** A probe that hangs is a probe that takes the health endpoint down with it. */
const PROBE_TIMEOUT_MS=5_000;

/** Slower than this and the dependency is working but not healthy. */
const DEGRADED_LATENCY_MS=2_000;

async function timed<T>(fn:(signal:AbortSignal)=>Promise<T>):Promise<{value:T;latencyMs:number}>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),PROBE_TIMEOUT_MS);
  const started=Date.now();
  try{
    const value=await fn(controller.signal);
    return {value,latencyMs:Date.now()-started};
  }finally{
    clearTimeout(timer);
  }
}

/**
 * Maps an HTTP status from a provider to a health state.
 *
 * 401/403 is the important one: the credential exists and is being rejected.
 * That is precisely the condition the old check called healthy.
 */
export function stateForStatus(status:number):ProbeState{
  if(status===401||status===403)return "unauthenticated";
  if(status===402||status===429)return "quota_exhausted";
  if(status>=500)return "unreachable";
  if(status>=200&&status<300)return "ok";
  return "degraded";
}

interface ProviderProbeSpec{
  name:ProviderName;
  envKey:string;
  /** A cheap authenticated endpoint — never one that costs money to call. */
  url:string;
  headers:(key:string)=>Record<string,string>;
}

/**
 * Each probe hits a list/models endpoint rather than a generation endpoint.
 * A health check must never spend money or consume quota to answer.
 */
const PROVIDER_PROBES:ProviderProbeSpec[]=[
  {name:"groq",envKey:"GROQ_API_KEY",url:"https://api.groq.com/openai/v1/models",
   headers:k=>({authorization:`Bearer ${k}`})},
  {name:"cerebras",envKey:"CEREBRAS_API_KEY",url:"https://api.cerebras.ai/v1/models",
   headers:k=>({authorization:`Bearer ${k}`})},
  {name:"openrouter",envKey:"OPENROUTER_API_KEY",url:"https://openrouter.ai/api/v1/key",
   headers:k=>({authorization:`Bearer ${k}`})},
  {name:"anthropic",envKey:"ANTHROPIC_API_KEY",url:"https://api.anthropic.com/v1/models?limit=1",
   headers:k=>({"x-api-key":k,"anthropic-version":"2023-06-01"})},
  {name:"gemini",envKey:"GEMINI_API_KEY",url:"https://generativelanguage.googleapis.com/v1beta/models",
   headers:k=>({"x-goog-api-key":k})},
  {name:"fal",envKey:"FAL_KEY",url:"https://rest.alpha.fal.ai/tokens/",
   headers:k=>({authorization:`Key ${k}`})}
];

export async function probeProvider(spec:ProviderProbeSpec):Promise<ProbeResult>{
  const key=process.env[spec.envKey];
  if(!key){
    return {service:`ai:${spec.name}`,state:"not_configured",detail:`${spec.envKey} is not set`};
  }

  try{
    const {value:res,latencyMs}=await timed(signal=>
      fetch(spec.url,{headers:spec.headers(key),signal,cache:"no-store"})
    );

    const state=stateForStatus(res.status);
    return {
      service:`ai:${spec.name}`,
      state:state==="ok"&&latencyMs>DEGRADED_LATENCY_MS?"degraded":state,
      latencyMs,
      detail:state==="ok"
        ? (latencyMs>DEGRADED_LATENCY_MS?`Responding slowly (${latencyMs}ms)`:undefined)
        : `Provider returned HTTP ${res.status}`,
      // The status code is safe to surface; the key never is.
      metadata:{status:res.status}
    };
  }catch(e:any){
    const aborted=e?.name==="AbortError";
    return {
      service:`ai:${spec.name}`,
      state:"unreachable",
      detail:aborted?`No response within ${PROBE_TIMEOUT_MS}ms`:"Network error reaching the provider"
    };
  }
}

export async function probeAllProviders():Promise<ProbeResult[]>{
  return Promise.all(PROVIDER_PROBES.map(probeProvider));
}

/** Real connectivity: a query that must touch the database to answer. */
export async function probeDatabase():Promise<ProbeResult>{
  try{
    const supabase=createAdminClient();
    const started=Date.now();
    const {error}=await supabase.from("workspaces").select("id").limit(1);
    const latencyMs=Date.now()-started;
    if(error)return {service:"database",state:"error",latencyMs,detail:error.message};
    return {
      service:"database",
      state:latencyMs>DEGRADED_LATENCY_MS?"degraded":"ok",
      latencyMs
    };
  }catch(e:any){
    return {service:"database",state:"unreachable",detail:e?.message||"Could not reach the database"};
  }
}

/** Storage is where every generated asset lives; a failure here is user-visible. */
export async function probeStorage():Promise<ProbeResult>{
  try{
    const supabase=createAdminClient();
    const started=Date.now();
    const {error}=await supabase.storage.from("picbo-assets").list("",{limit:1});
    const latencyMs=Date.now()-started;
    if(error)return {service:"storage",state:"error",latencyMs,detail:error.message};
    return {service:"storage",state:latencyMs>DEGRADED_LATENCY_MS?"degraded":"ok",latencyMs};
  }catch(e:any){
    return {service:"storage",state:"unreachable",detail:e?.message||"Could not reach storage"};
  }
}

/**
 * Whether the router can actually serve each task kind with a *configured*
 * provider. "A key exists" is not capability: a workspace with only a text
 * key configured cannot generate an image, and the health endpoint should say
 * so rather than reporting a green chain.
 */
export function probeTaskCapability():ProbeResult{
  const configured=new Set<ProviderName>();
  for(const spec of PROVIDER_PROBES){
    if(process.env[spec.envKey])configured.add(spec.name);
  }

  const CORE_TASKS:TaskKind[]=["chat","image","image_edit","video"];
  const servable:Record<string,boolean>={};
  for(const task of CORE_TASKS){
    servable[task]=MODEL_REGISTRY.some(m=>m.tasks.includes(task)&&configured.has(m.provider));
  }

  const missing=Object.entries(servable).filter(([,ok])=>!ok).map(([task])=>task);
  if(missing.length===0){
    return {service:"task_capability",state:"ok",metadata:{servable}};
  }
  // Text is the floor: without it Lumi, ad copy and prompt enhancement all fail.
  const state=missing.includes("chat")?"error":"degraded";
  return {
    service:"task_capability",
    state,
    detail:`No configured provider can serve: ${missing.join(", ")}`,
    metadata:{servable}
  };
}

/** Configuration presence — reported separately, never as health. */
export function probeConfiguration():ProbeResult{
  const required=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"];
  const optional={
    email:["RESEND_API_KEY","RESEND_FROM_EMAIL"],
    billing:["PADDLE_API_KEY","PADDLE_WEBHOOK_SECRET"],
    render_worker:["RENDER_WORKER_SECRET"]
  };

  const missingRequired=required.filter(k=>!process.env[k]);
  const disabled=Object.entries(optional)
    .filter(([,keys])=>keys.some(k=>!process.env[k]))
    .map(([feature])=>feature);

  return {
    service:"configuration",
    state:missingRequired.length?"error":"ok",
    detail:missingRequired.length?`Missing required: ${missingRequired.join(", ")}`:undefined,
    // Naming which features are off is useful; naming a value never is.
    metadata:{featuresDisabled:disabled}
  };
}

/** Overall status. Anything a user would experience as broken is unhealthy. */
export function rollup(results:ProbeResult[]):"ok"|"degraded"|"error"{
  const blocking=results.filter(r=>
    r.service==="database"||r.service==="configuration"||r.service==="task_capability"
  );
  if(blocking.some(r=>r.state==="error"||r.state==="unreachable"))return "error";
  if(results.some(r=>r.state==="unauthenticated"||r.state==="quota_exhausted"))return "degraded";
  if(results.some(r=>r.state==="degraded"||r.state==="error"||r.state==="unreachable"))return "degraded";
  return "ok";
}
