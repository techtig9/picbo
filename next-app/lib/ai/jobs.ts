import {createClient} from "@/lib/supabase/server";import {requireUser,getCurrentWorkspace} from "@/lib/auth";import {generateWithFallback} from "./router";import type {GenerationRequest,ProviderAttempt} from "./types";
import {classifyPromptSafety,logModerationFlag} from "@/lib/moderation/policy";
export async function runGenerationJob(request:GenerationRequest,creditCost=1){
 const user=await requireUser();const ws=await getCurrentWorkspace();if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
 const supabase=await createClient();const idem=String(request.metadata?.idempotencyKey||crypto.randomUUID());

 if(request.prompt){
  const moderation=await classifyPromptSafety(request.prompt);
  if(moderation.flagged){
   await logModerationFlag({workspaceId:ws.workspace_id,task:request.task,promptExcerpt:request.prompt,category:moderation.category,reason:moderation.reason});
   throw new Error("This request was blocked by our content policy.");
  }
 }

 const {data:job,error}=await supabase.from("ai_jobs").insert({workspace_id:ws.workspace_id,created_by:user.id,task:request.task,quality:request.quality,status:"queued",prompt:request.prompt||null,request,idempotency_key:idem}).select("id").single();
 if(error)throw error;
 const {error:charge}=await supabase.rpc("reserve_credits",{wid:ws.workspace_id,amount_to_charge:creditCost,idem:`job:${job.id}:charge`,ref:job.id});
 if(charge){await supabase.from("ai_jobs").update({status:"failed",error_code:"INSUFFICIENT_CREDITS",error_message:charge.message}).eq("id",job.id);throw new Error(charge.message)}
 await supabase.from("ai_jobs").update({status:"running",progress:10,started_at:new Date().toISOString()}).eq("id",job.id);
 try{
  const result=await generateWithFallback({...request,workspaceId:ws.workspace_id},{
   onAttempt:async(attempt:ProviderAttempt)=>{
    await supabase.from("ai_job_attempts").insert({
     job_id:job.id,provider:attempt.provider,model:attempt.model,attempt_no:attempt.attemptNo,
     status:attempt.status,request_id:attempt.requestId||null,error_code:attempt.errorCode||null,
     error_message:attempt.errorMessage||null,cost_usd:attempt.costUsd??null
    });
   }
  });
  await supabase.from("ai_jobs").update({status:"validating",progress:90,result}).eq("id",job.id);
  await supabase.from("ai_jobs").update({status:"completed",progress:100,completed_at:new Date().toISOString()}).eq("id",job.id);
  return {jobId:job.id,result,provider:result.provider,model:result.model};
 }catch(e:any){
  await supabase.rpc("refund_credits",{wid:ws.workspace_id,amount_to_refund:creditCost,idem:`job:${job.id}:refund`,ref:job.id});
  await supabase.from("ai_jobs").update({status:"failed",error_code:e?.code||"AI_FAILED",error_message:e?.message||"AI generation failed"}).eq("id",job.id);
  throw e;
 }
}
