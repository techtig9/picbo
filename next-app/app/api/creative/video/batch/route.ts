import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {queueVideoRender} from "@/app/create/video/render-actions";

/**
 * Batch-queues render variations. Previously did a raw multi-row insert
 * into render_jobs directly — bypassing credit reservation entirely (any
 * authenticated user could POST here and get free renders, no UI link
 * needed to exploit a live API route) and never verifying videoProjectId
 * belonged to the caller's workspace. Fixed by routing each variation
 * through the same queueVideoRender() used by the single-render path,
 * which correctly reserves credits and validates ownership.
 */
export async function POST(req:Request){
  try{
    const ws=await getCurrentWorkspace();
    if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
    const body=await req.json();
    const variations=Array.isArray(body.variations)?body.variations:[];
    if(!variations.length)return NextResponse.json({error:"VARIATIONS_REQUIRED"},{status:400});
    if(variations.length>10)return NextResponse.json({error:"MAX_10_VARIATIONS"},{status:400});
    if(!body.videoProjectId)return NextResponse.json({error:"videoProjectId is required"},{status:400});

    const baseIdempotency=String(body.idempotencyKey||crypto.randomUUID());
    const results=[];
    for(let i=0;i<variations.length;i++){
      const v=variations[i];
      const manifest={...(body.baseManifest||{}),...(v.manifest||{}),variationName:v.name||`Variation ${i+1}`};
      try{
        const r=await queueVideoRender(body.videoProjectId,`${baseIdempotency}:${i}`,manifest);
        results.push(r);
      }catch(e:any){
        results.push({error:e.message,variationName:v.name||`Variation ${i+1}`});
      }
    }
    return NextResponse.json({jobs:results});
  }catch(e:any){
    return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:e?.message==="UNAUTHENTICATED"?401:500});
  }
}
