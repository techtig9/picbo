import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {verifyRenderWorkerSecret} from "@/lib/render/worker-auth";
import {
  probeAllProviders,probeDatabase,probeStorage,probeTaskCapability,
  probeConfiguration,rollup,type ProbeResult
} from "@/lib/health/probes";
import {log} from "@/lib/observability/logger";

/**
 * Deep health check.
 *
 * The previous version called the AI chain healthy whenever one of three
 * environment variables was a non-empty string, without ever contacting a
 * provider — so a revoked key reported GREEN. It also destructured `count`
 * from queue queries without handling failure, meaning a failing query
 * produced `null` and silently reported `ok`.
 *
 * Every dependency here is actually contacted, and the distinct failure modes
 * the spec asks for are reported separately: not_configured, unreachable,
 * unauthenticated, quota_exhausted, degraded, ok.
 *
 * Public (it must answer an unauthenticated load balancer), so it deliberately
 * exposes no secrets, no queue contents and no customer data — only service
 * names, states, latencies and HTTP status codes. Queue depth is included only
 * for an authenticated caller.
 */
export async function GET(req:Request){
  const isTrusted=verifyRenderWorkerSecret(req);

  const [database,storage,providers]=await Promise.all([
    probeDatabase(),
    probeStorage(),
    probeAllProviders()
  ]);

  const checks:ProbeResult[]=[
    probeConfiguration(),
    database,
    storage,
    probeTaskCapability(),
    ...providers
  ];

  if(isTrusted){
    checks.push(await probeQueues());
  }

  const status=rollup(checks);

  // History is recorded only for the authenticated cron caller, so an uptime
  // pinger cannot fill the table.
  if(isTrusted){
    try{
      const supabase=createAdminClient();
      await supabase.from("system_health_events").insert(
        checks.map(c=>({
          service:c.service,
          status:c.state==="ok"?"ok":c.state==="degraded"?"degraded":"error",
          metadata:{state:c.state,latencyMs:c.latencyMs??null,detail:c.detail??null,...c.metadata}
        }))
      );
    }catch(e:any){
      log("error","health.history_write_failed",{message:e?.message});
    }
  }

  if(status!=="ok"){
    log(status==="error"?"error":"warn","health.degraded",{
      status,
      failing:checks.filter(c=>c.state!=="ok"&&c.state!=="not_configured").map(c=>`${c.service}:${c.state}`)
    });
  }

  return NextResponse.json(
    {status,checks,timestamp:new Date().toISOString()},
    {
      status:status==="error"?503:200,
      headers:{"cache-control":"no-store"}
    }
  );
}

/**
 * Queue depth. Errors are reported as errors rather than silently reading as
 * an empty queue — the previous version treated a failed count query and a
 * genuinely empty queue identically.
 */
async function probeQueues():Promise<ProbeResult>{
  try{
    const supabase=createAdminClient();
    const dayAgo=new Date(Date.now()-86_400_000).toISOString();

    const [renderQueued,renderProcessing,renderDead,aiQueued,aiRunning]=await Promise.all([
      supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","queued"),
      supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","processing"),
      supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","dead_letter").gte("created_at",dayAgo),
      supabase.from("ai_jobs").select("id",{count:"exact",head:true}).eq("status","queued"),
      supabase.from("ai_jobs").select("id",{count:"exact",head:true}).eq("status","running")
    ]);

    const failed=[renderQueued,renderProcessing,renderDead,aiQueued,aiRunning].find(r=>r.error);
    if(failed?.error){
      return {service:"queues",state:"error",detail:`Queue depth unavailable: ${failed.error.message}`};
    }

    const metadata={
      renderQueued:renderQueued.count||0,
      renderProcessing:renderProcessing.count||0,
      renderDeadLetterLast24h:renderDead.count||0,
      aiQueued:aiQueued.count||0,
      aiRunning:aiRunning.count||0
    };

    // A backlog means work is arriving faster than it is being served. Jobs
    // stuck long enough to matter are separately dead-lettered by the sweep.
    const backlog=metadata.renderQueued+metadata.aiQueued;
    const state=metadata.renderDeadLetterLast24h>10?"degraded":backlog>50?"degraded":"ok";

    return {
      service:"queues",
      state,
      detail:state==="degraded"?"Queue backlog or elevated dead-letter rate":undefined,
      metadata
    };
  }catch(e:any){
    return {service:"queues",state:"error",detail:e?.message||"Could not read queue depth"};
  }
}
