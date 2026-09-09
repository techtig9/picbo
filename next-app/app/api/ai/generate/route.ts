import {NextResponse} from "next/server";import {runGenerationJob} from "@/lib/ai/jobs";import type {GenerationRequest} from "@/lib/ai/types";import {creditCostForTask} from "@/lib/billing/credits";
export async function POST(req:Request){
 try{
  const body=await req.json();const request:GenerationRequest={task:body.task,quality:body.quality||"fast",prompt:body.prompt,negativePrompt:body.negativePrompt,imageUrls:body.imageUrls,aspectRatio:body.aspectRatio,durationSeconds:body.durationSeconds,productId:body.productId,metadata:body.metadata};
  if(!request.task) return NextResponse.json({error:"task is required"},{status:400});
  if(request.prompt && request.prompt.length>12000)return NextResponse.json({error:"prompt too long"},{status:400});
  // The credit price is derived server-side from the task. It used to be read
  // from body.creditCost, which let a client charge itself 1 credit for a
  // 10-credit video generation.
  const cost=creditCostForTask(request.task);
  const result=await runGenerationJob(request,cost);return NextResponse.json(result);
 }catch(e:any){const status=e?.message==="UNAUTHENTICATED"?401:e?.message?.includes("INSUFFICIENT")?402:500;return NextResponse.json({error:e?.message||"Generation failed"},{status});}
}
