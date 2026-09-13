import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {signAssetPaths} from "@/lib/generation/persist-output";

/**
 * Job status for the studio to poll.
 *
 * Signed URLs are minted per request rather than stored on the job, because
 * they expire within the hour — persisting them would leave the job history
 * full of dead links a day later.
 *
 * Reads through the user-scoped client so RLS enforces workspace isolation:
 * a job id from another workspace returns 404, not someone else's output.
 */
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;

  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});

  const supabase=await createClient();
  const {data:job,error}=await supabase.from("ai_jobs")
    .select("id,task,quality,status,progress,prompt,result,error_code,error_message,created_at,started_at,completed_at")
    .eq("id",id).eq("workspace_id",ws.workspace_id).maybeSingle();

  if(error)return NextResponse.json({error:"JOB_LOOKUP_FAILED",message:error.message},{status:500});
  if(!job)return NextResponse.json({error:"JOB_NOT_FOUND"},{status:404});

  const result=(job.result||{}) as any;
  const assets=Array.isArray(result.assets)?result.assets:[];
  const signed=assets.length?await signAssetPaths(assets.map((a:any)=>a.storagePath)):{};

  const {data:attempts}=await supabase.from("ai_job_attempts")
    .select("provider,model,attempt_no,status,error_code,created_at")
    .eq("job_id",id).order("attempt_no",{ascending:true});

  return NextResponse.json({
    jobId:job.id,
    task:job.task,
    quality:job.quality,
    status:job.status,
    progress:job.progress,
    prompt:job.prompt,
    provider:result.provider??null,
    model:result.model??null,
    latencyMs:result.latencyMs??null,
    output:result.output??null,
    assets:assets.map((a:any)=>({
      assetId:a.assetId,
      url:signed[a.storagePath]||null,
      mimeType:a.mimeType,
      sizeBytes:a.sizeBytes,
      width:a.width,
      height:a.height
    })),
    error:job.error_code?{code:job.error_code,message:job.error_message}:null,
    attempts:attempts||[],
    createdAt:job.created_at,
    startedAt:job.started_at,
    completedAt:job.completed_at
  });
}
