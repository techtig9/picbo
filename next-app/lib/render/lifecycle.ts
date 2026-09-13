import {createAdminClient} from "@/lib/supabase/admin";
import {assertRenderOutputPath} from "./output-path";

const BACKOFF_BASE_MS=30_000; // 30s
const BACKOFF_CAP_MS=10*60_000; // 10min
const QUEUE_TIMEOUT_MS=Number(process.env.RENDER_QUEUE_TIMEOUT_MS||15*60_000); // 15min default

/** Exponential backoff before a failed job becomes eligible for re-claim. */
export function renderBackoffMs(attempts:number){
  return Math.min(BACKOFF_BASE_MS*Math.pow(2,Math.max(0,attempts-1)),BACKOFF_CAP_MS);
}

export interface RenderOutput{storagePath:string;mimeType:string;sizeBytes:number}

/** Called by the render worker on success. */
export async function completeRenderJob(jobId:string,output:RenderOutput){
  const supabase=createAdminClient();
  const {data:job,error}=await supabase.from("render_jobs").select("id,workspace_id,video_project_id,created_by").eq("id",jobId).maybeSingle();
  if(error)throw error;
  if(!job)throw new Error("RENDER_JOB_NOT_FOUND");

  // The worker is external and reports its own output location. Never create
  // an asset row for a path outside this job's workspace: doing so would hand
  // this workspace a signed URL to another tenant's object.
  assertRenderOutputPath(output.storagePath,job.workspace_id);

  const {data:asset,error:assetErr}=await supabase.from("assets").insert({
    workspace_id:job.workspace_id,kind:"render_output",status:"ready",
    mime_type:output.mimeType,storage_path:output.storagePath,size_bytes:output.sizeBytes
  }).select("id").single();
  if(assetErr)throw assetErr;

  await supabase.from("render_jobs").update({
    status:"completed",progress:100,completed_at:new Date().toISOString(),
    output_storage_path:output.storagePath,output_mime_type:output.mimeType,output_size_bytes:output.sizeBytes,
    output_manifest:{assetId:asset.id}
  }).eq("id",jobId);

  await supabase.from("render_media").insert({render_job_id:jobId,asset_id:asset.id});
  await supabase.from("render_events").insert({render_job_id:jobId,stage:"completed",progress:100,message:"Render finished"});
  await supabase.from("notifications").insert({
    workspace_id:job.workspace_id,user_id:job.created_by,type:"render_completed",
    title:"Your video is ready",body:"Render finished successfully.",link:`/create/video/${job.video_project_id}/edit`
  });
  return {assetId:asset.id};
}

/**
 * Called by the render worker on failure. Retries with exponential backoff
 * up to max_attempts (reusing claim_render_job's own attempts<max_attempts
 * check — a backoff-delayed job stays "processing" with a future
 * lease_expires_at so it's simply not yet eligible for re-claim). Once
 * attempts are exhausted, moves to dead_letter and refunds the workspace —
 * credits reserved for a render that will never finish must not be lost.
 */
export async function failRenderJob(jobId:string,errorCode:string,errorMessage:string){
  const supabase=createAdminClient();
  const {data:job,error}=await supabase.from("render_jobs").select("id,workspace_id,attempts,max_attempts,input_manifest,created_by,video_project_id").eq("id",jobId).maybeSingle();
  if(error)throw error;
  if(!job)throw new Error("RENDER_JOB_NOT_FOUND");

  await supabase.from("render_job_attempts").insert({
    render_job_id:jobId,attempt:job.attempts,status:"failed",error_code:errorCode,error_message:errorMessage,finished_at:new Date().toISOString()
  });

  const exhausted=job.attempts>=job.max_attempts;
  if(!exhausted){
    const delayMs=renderBackoffMs(job.attempts);
    await supabase.from("render_jobs").update({
      status:"processing", // stays "processing" so claim_render_job's expired-lease branch will pick it back up once the backoff window passes
      worker_id:null,
      lease_expires_at:new Date(Date.now()+delayMs).toISOString(),
      error_code:errorCode,error_message:errorMessage
    }).eq("id",jobId);
    await supabase.from("render_events").insert({render_job_id:jobId,stage:"retrying",progress:0,message:`Attempt ${job.attempts} failed: ${errorMessage}. Retrying in ${Math.round(delayMs/1000)}s.`});
    return {status:"retrying" as const,delayMs};
  }

  // Dead letter: no more retries. Refund whatever was reserved for this render.
  const estimatedCredits=Number((job.input_manifest as any)?.estimatedCredits||0);
  await supabase.from("render_jobs").update({
    status:"dead_letter",completed_at:new Date().toISOString(),error_code:errorCode,error_message:errorMessage
  }).eq("id",jobId);
  await supabase.from("render_events").insert({render_job_id:jobId,stage:"dead_letter",progress:0,message:`Permanently failed after ${job.attempts} attempts: ${errorMessage}`});

  if(estimatedCredits>0){
    const {error:refundErr}=await supabase.rpc("refund_credits",{
      wid:job.workspace_id,amount_to_refund:estimatedCredits,idem:`render:${jobId}:refund`,ref:jobId
    });
    if(refundErr){
      // Refund itself failing is worth surfacing to platform ops — log it, don't throw
      // (the job is already correctly marked dead_letter; we shouldn't mask that).
      await supabase.from("system_health_events").insert({service:"render_refund",status:"error",metadata:{jobId,error:refundErr.message}});
    }
  }
  await supabase.from("notifications").insert({
    workspace_id:job.workspace_id,user_id:job.created_by,type:"render_failed",
    title:"A video render failed",body:`${errorMessage} Your credits were refunded.`,link:`/create/video/${job.video_project_id}/edit`
  });
  return {status:"dead_letter" as const,refunded:estimatedCredits};
}

/**
 * Sweeps jobs that will never resolve on their own:
 *  - queued too long (no worker ever claimed them)
 *  - processing with an expired lease AND attempts already exhausted
 *    (claim_render_job's own attempts<max_attempts filter means these would
 *    otherwise sit unclaimed forever, never reaching a terminal state)
 * Call periodically (e.g. a cron hitting /api/render-worker/sweep).
 */
export async function sweepStaleRenderJobs(){
  const supabase=createAdminClient();
  const staleQueuedCutoff=new Date(Date.now()-QUEUE_TIMEOUT_MS).toISOString();

  const {data:staleQueued}=await supabase.from("render_jobs").select("id").eq("status","queued").lt("created_at",staleQueuedCutoff);
  const {data:starvedProcessing}=await supabase.from("render_jobs").select("id,attempts,max_attempts,lease_expires_at")
    .eq("status","processing").lt("lease_expires_at",new Date().toISOString());

  const toDeadLetter=[
    ...(staleQueued||[]).map((j:any)=>j.id),
    ...(starvedProcessing||[]).filter((j:any)=>j.attempts>=j.max_attempts).map((j:any)=>j.id)
  ];

  const results=[];
  for(const jobId of toDeadLetter){
    try{
      results.push(await failRenderJob(jobId,"TIMEOUT","No worker claimed this render in time"));
    }catch(e:any){
      results.push({status:"sweep_error" as const,jobId,error:e.message});
    }
  }
  return {swept:toDeadLetter.length,results};
}
