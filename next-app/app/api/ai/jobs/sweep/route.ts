import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {verifyRenderWorkerSecret} from "@/lib/render/worker-auth";
import {processGenerationJob} from "@/lib/ai/jobs";
import {creditCostForTask} from "@/lib/billing/credits";
import type {TaskKind} from "@/lib/ai/types";
import {log} from "@/lib/observability/logger";

/**
 * Recovers generation jobs that lost their processor.
 *
 * Background processing runs in the same serverless invocation that accepted
 * the submission. If that invocation is killed — deploy, OOM, timeout — the
 * job row is left `queued` (never started) or `running` (started, abandoned)
 * with credits already reserved. Without this endpoint those jobs sit forever
 * and the user is out of credits with nothing to show.
 *
 * Called on a schedule (cron), authenticated with RENDER_WORKER_SECRET — the
 * same shared secret the render worker uses. Never reachable by a browser.
 *
 *   queued  and stale -> re-process (idempotent: processGenerationJob claims
 *                        the row and no-ops if someone else already has it)
 *   running and stale -> dead-letter as failed, and refund
 */

const STALE_QUEUED_MS=2*60*1000;    // never picked up within 2 minutes
const STALE_RUNNING_MS=15*60*1000;  // started but silent for 15 minutes
const MAX_PER_SWEEP=20;

export async function POST(req:Request){
  if(!verifyRenderWorkerSecret(req)){
    return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  }

  const supabase=createAdminClient();
  const now=Date.now();
  const requeued:string[]=[];
  const deadLettered:string[]=[];

  const {data:stuckQueued}=await supabase.from("ai_jobs")
    .select("id")
    .eq("status","queued")
    .lt("created_at",new Date(now-STALE_QUEUED_MS).toISOString())
    .limit(MAX_PER_SWEEP);

  for(const job of stuckQueued||[]){
    try{
      await processGenerationJob(job.id);
      requeued.push(job.id);
    }catch(e:any){
      log("error","generation.sweep_reprocess_failed",{job_id:job.id,message:e?.message});
    }
  }

  const {data:stuckRunning}=await supabase.from("ai_jobs")
    .select("id,task,workspace_id")
    .in("status",["running","validating"])
    .lt("started_at",new Date(now-STALE_RUNNING_MS).toISOString())
    .limit(MAX_PER_SWEEP);

  for(const job of stuckRunning||[]){
    // Refund first: if the status update succeeds and the refund does not,
    // the user is silently out of credits. The ledger's idempotency key makes
    // a repeated refund a no-op, so refund-then-mark is the safe order.
    await supabase.rpc("refund_credits",{
      wid:job.workspace_id,
      amount_to_refund:creditCostForTask(job.task as TaskKind),
      idem:`job:${job.id}:refund`,
      ref:job.id
    });
    await supabase.from("ai_jobs").update({
      status:"failed",
      error_code:"WORKER_LOST",
      error_message:"This generation stopped unexpectedly and was recovered. Your credits have been refunded.",
      completed_at:new Date().toISOString()
    }).eq("id",job.id).in("status",["running","validating"]);
    deadLettered.push(job.id);
  }

  if(requeued.length||deadLettered.length){
    log("info","generation.sweep",{requeued:requeued.length,dead_lettered:deadLettered.length});
  }

  return NextResponse.json({
    requeued:requeued.length,
    deadLettered:deadLettered.length,
    jobIds:{requeued,deadLettered}
  });
}
