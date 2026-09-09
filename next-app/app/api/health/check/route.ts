import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {verifyRenderWorkerSecret} from "@/lib/render/worker-auth";

interface SubsystemCheck{service:string;status:"ok"|"degraded"|"error";metadata:Record<string,unknown>}

async function checkDatabase(supabase:ReturnType<typeof createAdminClient>):Promise<SubsystemCheck>{
  try{
    const started=Date.now();
    const {error}=await supabase.from("workspaces").select("id").limit(1);
    if(error)throw error;
    return {service:"database",status:"ok",metadata:{latencyMs:Date.now()-started}};
  }catch(e:any){
    return {service:"database",status:"error",metadata:{error:e.message}};
  }
}

async function checkRenderQueue(supabase:ReturnType<typeof createAdminClient>):Promise<SubsystemCheck>{
  const [{count:queued},{count:processing},{count:deadLetter24h}]=await Promise.all([
    supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","queued"),
    supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","processing"),
    supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","dead_letter").gte("created_at",new Date(Date.now()-86400000).toISOString())
  ]);
  // No real worker is deployed in this environment (see PICBO_FINAL_REPORT.md),
  // so any queued/processing job is expected to eventually be swept — that's
  // "degraded" (known, explained), not a false "ok".
  const status=(queued||0)+(processing||0)>0?"degraded":"ok";
  return {service:"render_queue",status,metadata:{queued:queued||0,processing:processing||0,deadLetterLast24h:deadLetter24h||0}};
}

async function checkAiProviders():Promise<SubsystemCheck>{
  const configured=["GROQ_API_KEY","CEREBRAS_API_KEY","OPENROUTER_API_KEY","ANTHROPIC_API_KEY","GEMINI_API_KEY","FAL_KEY"]
    .filter(k=>Boolean(process.env[k]));
  const requiredChainConfigured=["GROQ_API_KEY","CEREBRAS_API_KEY","OPENROUTER_API_KEY"].some(k=>process.env[k]);
  return {
    service:"ai_providers",
    status:requiredChainConfigured?"ok":"error",
    metadata:{configuredProviders:configured.length,requiredChainHasAtLeastOne:requiredChainConfigured}
  };
}

/**
 * Snapshots multiple subsystems and writes the result to system_health_events
 * so there's a real historical record, not just a point-in-time response.
 * This is monitoring (data collection) — it deliberately does not page
 * anyone, since no alerting destination (Slack/PagerDuty/email) is
 * configured in this environment. Call periodically (cron) alongside the
 * render sweep, or hit it directly for a point-in-time check.
 */
export async function GET(req:Request){
  const supabase=createAdminClient();
  const [db,renderQueue,providers]=await Promise.all([checkDatabase(supabase),checkRenderQueue(supabase),checkAiProviders()]);
  const checks=[db,renderQueue,providers];
  const overall=checks.some(c=>c.status==="error")?"error":checks.some(c=>c.status==="degraded")?"degraded":"ok";

  // Only persist a history row when called with the worker secret (i.e. from
  // the periodic cron), not on every ad-hoc/public GET — keeps the table from
  // filling with noise from uptime pingers hitting this for a simple check.
  if(verifyRenderWorkerSecret(req)){
    for(const c of checks){
      await supabase.from("system_health_events").insert({service:c.service,status:c.status,metadata:c.metadata});
    }
  }

  return NextResponse.json({status:overall,checks,timestamp:new Date().toISOString()},{status:overall==="error"?503:200});
}
