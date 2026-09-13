import {AIProviderError,type AIProvider,GenerationRequest,ProviderModel,ProviderResult} from "../types";

const IMAGE_UTIL_TASKS=["background_remove","upscale"];

export class FalProvider implements AIProvider{
 readonly name="fal" as const;
 supports(r:GenerationRequest,m:ProviderModel){return m.provider==="fal"&&m.tasks.includes(r.task)&&!!process.env.FAL_KEY}
 async generate(r:GenerationRequest,m:ProviderModel):Promise<ProviderResult>{
  if(!process.env.FAL_KEY)throw new AIProviderError("FAL_KEY is not configured","MISSING_KEY",false);
  if(![...IMAGE_UTIL_TASKS,"image","image_edit"].includes(r.task))throw new AIProviderError("This fal adapter currently handles image generation/editing and background-removal/upscale","UNSUPPORTED_TASK",false);

  const started=Date.now();
  let body:Record<string,unknown>;
  if(IMAGE_UTIL_TASKS.includes(r.task)){
   if(!r.imageUrls?.length)throw new AIProviderError(`${r.task} requires a source image`,"UNSUPPORTED_TASK",false);
   body={image_url:r.imageUrls[0]}; // BiRefNet / Clarity Upscaler both take a single image_url, not the generation-style payload below
  }else{
   body={prompt:r.prompt,negative_prompt:r.negativePrompt,image_urls:r.imageUrls,aspect_ratio:r.aspectRatio};
  }

  const res=await fetch(`https://fal.run/${m.model}`,{method:"POST",headers:{"Authorization":`Key ${process.env.FAL_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const latencyMs=Date.now()-started;
  const raw=await res.json().catch(()=>null);
  if(!res.ok)throw new AIProviderError(raw?.detail||raw?.error||`fal request failed (${res.status})`,res.status===429?"RATE_LIMIT":"UPSTREAM_ERROR",res.status===429||res.status>=500,res.status);

  // Image-util endpoints return a single `image` object; generation endpoints return an `images` array.
  const urls=IMAGE_UTIL_TASKS.includes(r.task)
   ?[raw?.image?.url].filter(Boolean)
   :[...(raw?.images||[])].map((x:any)=>x?.url).filter(Boolean);
  return {provider:"fal",model:m.model,requestId:raw?.request_id||crypto.randomUUID(),assetUrls:urls,output:raw,raw,latencyMs};
 }
}
