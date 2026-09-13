import {AIProviderError,type AIProvider,GenerationRequest,ProviderModel,ProviderResult} from "../types";

const MAX_IMAGES=4;

/** Fetches each reference image and returns Gemini `inline_data` parts (base64). Best-effort: a failed fetch is skipped, not fatal. */
async function imagePartsFor(imageUrls?:string[]){
 if(!imageUrls?.length)return [];
 const parts:any[]=[];
 for(const url of imageUrls.slice(0,MAX_IMAGES)){
  try{
   const res=await fetch(url,{cache:"no-store"});
   if(!res.ok)continue;
   const mimeType=res.headers.get("content-type")||"image/jpeg";
   const buf=Buffer.from(await res.arrayBuffer());
   parts.push({inline_data:{mime_type:mimeType,data:buf.toString("base64")}});
  }catch{ /* skip unreachable reference image, don't fail the whole analysis */ }
 }
 return parts;
}

export class GeminiProvider implements AIProvider{
 readonly name="gemini" as const;
 supports(r:GenerationRequest,m:ProviderModel){return m.provider==="gemini"&&m.tasks.includes(r.task)&&!!process.env.GEMINI_API_KEY}
 async generate(r:GenerationRequest,m:ProviderModel):Promise<ProviderResult>{
  if(!process.env.GEMINI_API_KEY)throw new AIProviderError("GEMINI_API_KEY is not configured","MISSING_KEY",false);
  if(!["chat","copy","analysis"].includes(r.task))throw new AIProviderError("This Gemini adapter is currently text/analysis only","UNSUPPORTED_TASK",false);
  const started=Date.now();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m.model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const imageParts=await imagePartsFor(r.imageUrls);
  if(r.imageUrls?.length&&imageParts.length===0)throw new AIProviderError("None of the reference images could be fetched for analysis","UPSTREAM_ERROR",true);
  const body={contents:[{role:"user",parts:[...imageParts,{text:r.prompt||""}]}]};
  const res=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const latencyMs=Date.now()-started;
  const raw=await res.json().catch(()=>null);
  if(!res.ok)throw new AIProviderError(raw?.error?.message||`Gemini request failed (${res.status})`,res.status===429?"RATE_LIMIT":"UPSTREAM_ERROR",res.status===429||res.status>=500,res.status);
  const text=raw?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";
  if(!text)throw new AIProviderError("Gemini returned no text","EMPTY_OUTPUT",true);
  return {provider:"gemini",model:m.model,requestId:raw?.responseId||crypto.randomUUID(),output:text,raw,latencyMs};
 }
}
