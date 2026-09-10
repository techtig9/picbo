import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {getCurrentWorkspace,requireUser} from "@/lib/auth";
import {creditCostForTask} from "@/lib/billing/credits";
import type {TaskKind} from "@/lib/ai/types";
import {log} from "@/lib/observability/logger";

/**
 * Cancels a job that has not finished, and refunds its credits.
 *
 * Only `queued` is cancellable. Once a job is `running` the provider call is
 * already in flight and we are being billed for it, so cancelling would refund
 * the user for spend we cannot recover; `validating` is past the point of no
 * return too. Saying "cancel" and meaning it only for queued jobs is honest;
 * pretending to cancel a running one is not.
 *
 * The refund reuses the `job:<id>:refund` ledger idempotency key, so a job
 * that is cancelled and then also fails cannot be refunded twice.
 */
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;

  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});

  const supabase=await createClient();
  const {data:job}=await supabase.from("ai_jobs")
    .select("id,task,status").eq("id",id).eq("workspace_id",ws.workspace_id).maybeSingle();

  if(!job)return NextResponse.json({error:"JOB_NOT_FOUND"},{status:404});

  if(job.status!=="queued"){
    const finished=["completed","failed","cancelled"].includes(job.status);
    return NextResponse.json(
      {
        error:finished?"JOB_ALREADY_FINISHED":"JOB_ALREADY_RUNNING",
        message:finished
          ? `This job already ${job.status}.`
          : "This job is already running and can't be cancelled — the provider request is in flight."
      },
      {status:409}
    );
  }

  const admin=createAdminClient();

  // Conditional update: if the background processor claimed the job between
  // our read and this write, it wins and we do not refund.
  const {data:cancelled}=await admin.from("ai_jobs")
    .update({status:"cancelled",error_code:"CANCELLED_BY_USER",error_message:"Cancelled before it started.",completed_at:new Date().toISOString()})
    .eq("id",id).eq("status","queued").select("id");

  if(!cancelled||cancelled.length===0){
    return NextResponse.json(
      {error:"JOB_ALREADY_RUNNING",message:"This job started before the cancellation reached it."},
      {status:409}
    );
  }

  await admin.rpc("refund_credits",{
    wid:ws.workspace_id,
    amount_to_refund:creditCostForTask(job.task as TaskKind),
    idem:`job:${id}:refund`,
    ref:id
  });

  log("info","generation.cancelled",{job_id:id,workspace_id:ws.workspace_id,user_id:user.id});
  return NextResponse.json({jobId:id,status:"cancelled",refunded:true});
}
