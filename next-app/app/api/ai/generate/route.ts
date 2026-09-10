import {NextResponse} from "next/server";
import {submitGenerationJob,runTextGenerationJob,JobSubmissionError} from "@/lib/ai/jobs";
import type {GenerationRequest,TaskKind,QualityTier} from "@/lib/ai/types";
import {creditCostForTask} from "@/lib/billing/credits";

const VALID_TASKS:ReadonlySet<string>=new Set([
  "chat","copy","analysis","image","image_edit","background_remove","upscale","video","voice","render"
]);
const TEXT_TASKS:ReadonlySet<string>=new Set(["chat","copy","analysis"]);
const VALID_QUALITY:ReadonlySet<string>=new Set(["fast","balanced","pro"]);

const MAX_PROMPT_LENGTH=12_000;
const MAX_SOURCE_IMAGES=4;

/**
 * Submits a generation.
 *
 * Media tasks return 202 with a job id immediately; the client polls
 * /api/ai/jobs/[id]. They used to run inline, holding the request open for the
 * whole provider round trip and losing the job entirely on a function timeout.
 *
 * The credit price is derived server-side from the task. It was previously
 * read from the request body, so a client could request a 10-credit video and
 * charge itself 1.
 */
export async function POST(req:Request){
  let body:any;
  try{body=await req.json()}
  catch{return NextResponse.json({error:"INVALID_JSON",message:"Request body must be JSON."},{status:400})}

  const task=String(body.task||"");
  if(!VALID_TASKS.has(task)){
    return NextResponse.json({error:"INVALID_TASK",message:`Unknown task "${task}".`},{status:400});
  }

  const quality=VALID_QUALITY.has(String(body.quality))?String(body.quality):"fast";
  const prompt=body.prompt==null?undefined:String(body.prompt);
  if(prompt&&prompt.length>MAX_PROMPT_LENGTH){
    return NextResponse.json(
      {error:"PROMPT_TOO_LONG",message:`Prompt must be under ${MAX_PROMPT_LENGTH} characters.`},
      {status:400}
    );
  }

  const imageUrls=Array.isArray(body.imageUrls)?body.imageUrls.filter((u:unknown)=>typeof u==="string").slice(0,MAX_SOURCE_IMAGES):undefined;

  const request:GenerationRequest={
    task:task as TaskKind,
    quality:quality as QualityTier,
    prompt,
    negativePrompt:body.negativePrompt==null?undefined:String(body.negativePrompt),
    imageUrls,
    aspectRatio:body.aspectRatio==null?undefined:String(body.aspectRatio),
    durationSeconds:body.durationSeconds==null?undefined:Number(body.durationSeconds),
    productId:body.productId==null?undefined:String(body.productId),
    metadata:typeof body.metadata==="object"&&body.metadata?body.metadata:undefined
  };

  try{
    if(TEXT_TASKS.has(task)){
      const result=await runTextGenerationJob(request);
      return NextResponse.json({
        jobId:result.jobId,status:"completed",
        provider:result.provider,model:result.model,output:result.result.output,
        creditCost:creditCostForTask(request.task)
      });
    }

    const submitted=await submitGenerationJob(request);
    return NextResponse.json(
      {
        jobId:submitted.jobId,
        status:submitted.status,
        creditCost:submitted.creditCost,
        deduplicated:submitted.deduplicated,
        pollUrl:`/api/ai/jobs/${submitted.jobId}`
      },
      {status:202}
    );
  }catch(e:any){
    return NextResponse.json(
      {error:e?.code||"GENERATION_FAILED",message:e?.message||"Generation failed."},
      {status:statusForError(e)}
    );
  }
}

function statusForError(e:any):number{
  if(e?.message==="UNAUTHENTICATED")return 401;
  const code=e instanceof JobSubmissionError?e.code:e?.code;
  if(code==="INSUFFICIENT_CREDITS")return 402;
  if(code==="MODERATION_BLOCKED")return 422;
  if(code==="WORKSPACE_REQUIRED")return 400;
  if(code==="TASK_REQUIRES_ASYNC_JOB")return 400;
  return 500;
}
