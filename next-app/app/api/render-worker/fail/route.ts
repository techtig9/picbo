import {NextResponse} from "next/server";
import {verifyRenderWorkerSecret} from "@/lib/render/worker-auth";
import {failRenderJob} from "@/lib/render/lifecycle";

/** Called by the external render worker on failure — handles retry/backoff/dead-letter/refund. */
export async function POST(req:Request){
  if(!verifyRenderWorkerSecret(req))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  try{
    const body=await req.json();
    if(!body.jobId||!body.errorCode)return NextResponse.json({error:"MISSING_FIELDS"},{status:400});
    const result=await failRenderJob(body.jobId,body.errorCode,String(body.errorMessage||"Render failed"));
    return NextResponse.json({ok:true,...result});
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
