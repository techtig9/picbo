import {NextResponse} from "next/server";
import {verifyRenderWorkerSecret} from "@/lib/render/worker-auth";
import {sweepStaleRenderJobs} from "@/lib/render/lifecycle";

/**
 * Call periodically (cron) to dead-letter and refund jobs no worker ever
 * claimed or finished — the safety net that keeps credits from being
 * permanently stuck if a worker crashes or (as in this environment) doesn't
 * exist yet at all.
 */
export async function POST(req:Request){
  if(!verifyRenderWorkerSecret(req))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  try{
    const result=await sweepStaleRenderJobs();
    return NextResponse.json({ok:true,...result});
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
