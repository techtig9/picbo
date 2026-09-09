import {NextResponse} from "next/server";
import {verifyRenderWorkerSecret} from "@/lib/render/worker-auth";
import {completeRenderJob} from "@/lib/render/lifecycle";

/** Called by the external render worker (FFmpeg container/service) on success. Not a user-facing route. */
export async function POST(req:Request){
  if(!verifyRenderWorkerSecret(req))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  try{
    const body=await req.json();
    if(!body.jobId||!body.storagePath||!body.mimeType)return NextResponse.json({error:"MISSING_FIELDS"},{status:400});
    const result=await completeRenderJob(body.jobId,{storagePath:body.storagePath,mimeType:body.mimeType,sizeBytes:Number(body.sizeBytes||0)});
    return NextResponse.json({ok:true,...result});
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
