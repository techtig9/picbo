import {after} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {generateWithFallback} from "./router";
import type {GenerationRequest,ProviderAttempt,TaskKind} from "./types";
import {classifyPromptSafety,logModerationFlag} from "@/lib/moderation/policy";
import {persistGenerationOutput,NoOutputError,type StoredAsset} from "@/lib/generation/persist-output";
import {MediaValidationError} from "@/lib/generation/media-validation";
import {creditCostForTask} from "@/lib/billing/credits";
import {log} from "@/lib/observability/logger";

/**
 * Durable generation jobs.
 *
 * Previously runGenerationJob() did everything inline in one HTTP request:
 * insert the job, charge credits, call the provider, and mark it completed —
 * all before responding. Three consequences, all of which bit:
 *
 *   1. A slow generation held the request open until the serverless function
 *      timed out, and the job row was orphaned mid-flight with credits spent.
 *   2. There was no way to poll, cancel, or resume.
 *   3. The provider's output was written to ai_jobs.result as raw JSON and
 *      never persisted or shown — the user paid and saw nothing.
 *
 * Split into submit (fast, authenticated, RLS-scoped) and process (background,
 * service-role). The ai_jobs row is the source of truth at every step, so a
 * process that dies leaves a resumable record rather than a silent loss.
 */

export interface SubmitResult{
  jobId:string;
  status:string;
  creditCost:number;
  /** True when an existing job was returned instead of a new one being created. */
  deduplicated:boolean;
}

export class JobSubmissionError extends Error{
  constructor(message:string,public code:string){super(message);this.name="JobSubmissionError"}
}

/**
 * Creates a job, reserves credits, and schedules processing. Returns as soon
 * as the job is durably recorded — it does not wait for the provider.
 */
export async function submitGenerationJob(request:GenerationRequest):Promise<SubmitResult>{
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new JobSubmissionError("You need a workspace before generating.","WORKSPACE_REQUIRED");

  const supabase=await createClient();
  const idempotencyKey=String(request.metadata?.idempotencyKey||crypto.randomUUID());
  const creditCost=creditCostForTask(request.task);

  if(request.prompt){
    const moderation=await classifyPromptSafety(request.prompt);
    if(moderation.flagged){
      await logModerationFlag({
        workspaceId:ws.workspace_id,task:request.task,promptExcerpt:request.prompt,
        category:moderation.category,reason:moderation.reason
      });
      throw new JobSubmissionError("This request was blocked by our content policy.","MODERATION_BLOCKED");
    }
  }

  // Idempotent resubmit: a retried POST (double click, network retry) must
  // return the original job rather than charging again. ai_jobs has a
  // unique(workspace_id, idempotency_key) constraint backing this.
  const {data:existing}=await supabase.from("ai_jobs")
    .select("id,status").eq("workspace_id",ws.workspace_id).eq("idempotency_key",idempotencyKey).maybeSingle();
  if(existing){
    return {jobId:existing.id,status:existing.status,creditCost,deduplicated:true};
  }

  const {data:job,error}=await supabase.from("ai_jobs").insert({
    workspace_id:ws.workspace_id,
    created_by:user.id,
    task:request.task,
    quality:request.quality,
    status:"queued",
    prompt:request.prompt||null,
    request,
    idempotency_key:idempotencyKey
  }).select("id").single();
  if(error)throw new JobSubmissionError(error.message,"JOB_CREATE_FAILED");

  // Reserve credits before any provider spend. reserve_credits() takes a
  // per-workspace advisory lock, so concurrent submissions cannot both pass
  // the balance check (see migration 202609090002).
  const {error:chargeError}=await supabase.rpc("reserve_credits",{
    wid:ws.workspace_id,amount_to_charge:creditCost,idem:`job:${job.id}:charge`,ref:job.id
  });
  if(chargeError){
    await supabase.from("ai_jobs").update({
      status:"failed",error_code:"INSUFFICIENT_CREDITS",error_message:chargeError.message
    }).eq("id",job.id);
    throw new JobSubmissionError(
      chargeError.message.includes("INSUFFICIENT_CREDITS")
        ? `This generation costs ${creditCost} credit${creditCost===1?"":"s"} and your workspace doesn't have enough. Top up in Billing to continue.`
        : chargeError.message,
      "INSUFFICIENT_CREDITS"
    );
  }

  log("info","generation.submitted",{
    job_id:job.id,workspace_id:ws.workspace_id,task:request.task,credit_cost:creditCost
  });

  // Hand processing to the background so the response returns immediately.
  // The job row already exists and credits are already reserved, so if this
  // process dies the sweep endpoint can pick the job up — nothing is lost.
  const jobId=job.id;
  const workspaceId=ws.workspace_id;
  const userId=user.id;
  after(async()=>{
    try{
      await processGenerationJob(jobId,{workspaceId,userId});
    }catch(e:any){
      log("error","generation.background_failed",{job_id:jobId,message:e?.message});
    }
  });

  return {jobId,status:"queued",creditCost,deduplicated:false};
}

export interface ProcessContext{workspaceId:string;userId:string}

/**
 * Runs one job to completion. Service-role only: no request cookie is
 * available here. Safe to call more than once for the same job — it claims
 * the row by transitioning queued -> running and bails if someone else
 * already did.
 */
export async function processGenerationJob(jobId:string,ctx?:ProcessContext):Promise<void>{
  const supabase=createAdminClient();

  const {data:job,error:loadError}=await supabase.from("ai_jobs")
    .select("id,workspace_id,created_by,task,quality,status,request").eq("id",jobId).single();
  if(loadError||!job){
    log("error","generation.job_not_found",{job_id:jobId});
    return;
  }
  if(job.status!=="queued"){
    log("info","generation.already_claimed",{job_id:jobId,status:job.status});
    return;
  }

  const workspaceId=ctx?.workspaceId||job.workspace_id;
  const userId=ctx?.userId||job.created_by;
  const creditCost=creditCostForTask(job.task as TaskKind);

  // Claim: only one worker may move queued -> running.
  const {data:claimed}=await supabase.from("ai_jobs")
    .update({status:"running",progress:10,started_at:new Date().toISOString()})
    .eq("id",jobId).eq("status","queued").select("id");
  if(!claimed||claimed.length===0){
    log("info","generation.claim_lost",{job_id:jobId});
    return;
  }

  const request=job.request as GenerationRequest;

  try{
    const result=await generateWithFallback({...request,workspaceId},{
      onAttempt:async(attempt:ProviderAttempt)=>{
        await supabase.from("ai_job_attempts").insert({
          job_id:jobId,provider:attempt.provider,model:attempt.model,attempt_no:attempt.attemptNo,
          status:attempt.status,request_id:attempt.requestId||null,
          error_code:attempt.errorCode||null,error_message:attempt.errorMessage||null,
          cost_usd:attempt.costUsd??null
        });
      }
    });

    // Validating is a real state, not decoration: the provider's output is
    // downloaded and its bytes checked before the job is called completed.
    await supabase.from("ai_jobs").update({status:"validating",progress:80}).eq("id",jobId);

    const stored:StoredAsset[]=await persistGenerationOutput({
      jobId,workspaceId,userId,task:job.task,result,
      productId:request.productId||null
    });

    await supabase.from("ai_jobs").update({
      status:"completed",
      progress:100,
      completed_at:new Date().toISOString(),
      result:{
        provider:result.provider,
        model:result.model,
        requestId:result.requestId,
        latencyMs:result.latencyMs??null,
        // Store paths, not signed URLs: signed URLs expire within the hour,
        // so persisting them would leave dead links in the job history.
        assets:stored.map(a=>({
          assetId:a.assetId,storagePath:a.storagePath,mimeType:a.mimeType,
          sizeBytes:a.sizeBytes,width:a.width??null,height:a.height??null
        })),
        // Text tasks have no media; keep the model's text output.
        output:stored.length===0?result.output:undefined
      }
    }).eq("id",jobId);

    log("info","generation.completed",{
      job_id:jobId,provider:result.provider,model:result.model,assets:stored.length
    });
  }catch(e:any){
    await failJob(supabase,jobId,workspaceId,creditCost,e);
  }
}

/**
 * Marks a job failed and refunds its credits.
 *
 * The refund is idempotent (`job:<id>:refund` as the ledger idempotency key),
 * so a retried failure path cannot refund twice.
 */
async function failJob(
  supabase:ReturnType<typeof createAdminClient>,
  jobId:string,workspaceId:string,creditCost:number,e:any
){
  const {code,message}=classifyJobFailure(e);

  await supabase.rpc("refund_credits",{
    wid:workspaceId,amount_to_refund:creditCost,idem:`job:${jobId}:refund`,ref:jobId
  });

  await supabase.from("ai_jobs").update({
    status:"failed",error_code:code,error_message:message,completed_at:new Date().toISOString()
  }).eq("id",jobId);

  log("error","generation.failed",{job_id:jobId,error_code:code,message});
}

/**
 * Turns an internal error into something a user can act on. Provider stack
 * traces and "ALL_PROVIDERS_FAILED: groq/... | cerebras/..." strings are for
 * the logs, not for the studio.
 */
export function classifyJobFailure(e:any):{code:string;message:string}{
  if(e instanceof NoOutputError){
    return {code:"NO_OUTPUT",message:"The AI provider finished but didn't return an image. Your credits have been refunded — try again, or adjust the prompt."};
  }
  if(e instanceof MediaValidationError){
    return {code:e.code,message:`${e.message} Your credits have been refunded.`};
  }
  const raw=String(e?.message||"");
  if(e?.code==="ALL_PROVIDERS_FAILED"||raw.includes("ALL_PROVIDERS_FAILED")){
    return {code:"ALL_PROVIDERS_FAILED",message:"Every configured AI provider failed to handle this request. Your credits have been refunded — please try again shortly."};
  }
  if(e?.code==="NO_PROVIDER"||raw.includes("No configured provider")){
    return {code:"NO_PROVIDER",message:"No AI provider is configured for this kind of generation yet. Your credits have been refunded."};
  }
  if(raw.includes("STORAGE_QUOTA_EXCEEDED")){
    return {code:"STORAGE_QUOTA_EXCEEDED",message:`${raw.replace("STORAGE_QUOTA_EXCEEDED: ","")} Your credits have been refunded.`};
  }
  return {code:e?.code||"GENERATION_FAILED",message:"The generation failed. Your credits have been refunded — please try again."};
}

const TEXT_TASKS:ReadonlySet<string>=new Set(["chat","copy","analysis"]);

export interface TextJobResult{jobId:string;result:{provider:string;model:string;output:unknown};provider:string;model:string}

/**
 * Runs a text/copy/analysis job inline and returns its output.
 *
 * Text generation is fast (seconds) and every caller — Lumi, ad copy, UGC
 * scripts, product-identity analysis — needs the text in the same request to
 * render a reply. Media tasks must not use this: they go through
 * submitGenerationJob() so a slow render cannot hold a request open past the
 * function timeout.
 *
 * Credits are still reserved before provider spend and refunded on failure,
 * with the same idempotency keys as the async path.
 */
export async function runTextGenerationJob(request:GenerationRequest):Promise<TextJobResult>{
  if(!TEXT_TASKS.has(request.task)){
    throw new JobSubmissionError(
      `${request.task} produces media and must be submitted as a background job.`,
      "TASK_REQUIRES_ASYNC_JOB"
    );
  }

  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new JobSubmissionError("You need a workspace before generating.","WORKSPACE_REQUIRED");

  const supabase=await createClient();
  const creditCost=creditCostForTask(request.task);
  const idempotencyKey=String(request.metadata?.idempotencyKey||crypto.randomUUID());

  if(request.prompt){
    const moderation=await classifyPromptSafety(request.prompt);
    if(moderation.flagged){
      await logModerationFlag({
        workspaceId:ws.workspace_id,task:request.task,promptExcerpt:request.prompt,
        category:moderation.category,reason:moderation.reason
      });
      throw new JobSubmissionError("This request was blocked by our content policy.","MODERATION_BLOCKED");
    }
  }

  const {data:job,error}=await supabase.from("ai_jobs").insert({
    workspace_id:ws.workspace_id,created_by:user.id,task:request.task,quality:request.quality,
    status:"running",prompt:request.prompt||null,request,idempotency_key:idempotencyKey,
    started_at:new Date().toISOString(),progress:10
  }).select("id").single();
  if(error)throw new JobSubmissionError(error.message,"JOB_CREATE_FAILED");

  const {error:chargeError}=await supabase.rpc("reserve_credits",{
    wid:ws.workspace_id,amount_to_charge:creditCost,idem:`job:${job.id}:charge`,ref:job.id
  });
  if(chargeError){
    await supabase.from("ai_jobs").update({
      status:"failed",error_code:"INSUFFICIENT_CREDITS",error_message:chargeError.message
    }).eq("id",job.id);
    throw new JobSubmissionError(chargeError.message,"INSUFFICIENT_CREDITS");
  }

  try{
    const result=await generateWithFallback({...request,workspaceId:ws.workspace_id},{
      onAttempt:async(attempt:ProviderAttempt)=>{
        await supabase.from("ai_job_attempts").insert({
          job_id:job.id,provider:attempt.provider,model:attempt.model,attempt_no:attempt.attemptNo,
          status:attempt.status,request_id:attempt.requestId||null,
          error_code:attempt.errorCode||null,error_message:attempt.errorMessage||null,
          cost_usd:attempt.costUsd??null
        });
      }
    });

    await supabase.from("ai_jobs").update({
      status:"completed",progress:100,completed_at:new Date().toISOString(),
      result:{provider:result.provider,model:result.model,requestId:result.requestId,output:result.output}
    }).eq("id",job.id);

    return {
      jobId:job.id,
      result:{provider:result.provider,model:result.model,output:result.output},
      provider:result.provider,
      model:result.model
    };
  }catch(e:any){
    await supabase.rpc("refund_credits",{
      wid:ws.workspace_id,amount_to_refund:creditCost,idem:`job:${job.id}:refund`,ref:job.id
    });
    const {code,message}=classifyJobFailure(e);
    await supabase.from("ai_jobs").update({
      status:"failed",error_code:code,error_message:message,completed_at:new Date().toISOString()
    }).eq("id",job.id);
    throw e;
  }
}
