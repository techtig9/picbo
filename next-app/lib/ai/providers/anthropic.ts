import {AIProviderError,type AIProvider,GenerationRequest,ProviderModel,ProviderResult} from "../types";
import {classifyProviderHttpError} from "../provider-errors";

const TEXT_TASKS=["chat","copy","analysis"];
const REQUEST_TIMEOUT_MS=30000;
const MAX_IMAGES=4;

/** Fetches each reference image and returns Claude Messages API image content blocks (base64). Best-effort. */
async function imageBlocksFor(imageUrls?:string[]){
  if(!imageUrls?.length)return [];
  const blocks:any[]=[];
  for(const url of imageUrls.slice(0,MAX_IMAGES)){
    try{
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok)continue;
      const mediaType=res.headers.get("content-type")||"image/jpeg";
      const buf=Buffer.from(await res.arrayBuffer());
      blocks.push({type:"image",source:{type:"base64",media_type:mediaType,data:buf.toString("base64")}});
    }catch{ /* skip unreachable reference image, don't fail the whole analysis */ }
  }
  return blocks;
}

/**
 * Anthropic/Claude — OPTIONAL, last-resort provider. If ANTHROPIC_API_KEY is
 * absent, `supports()` returns false and this provider is skipped entirely;
 * the app must keep working with only Groq/Cerebras/OpenRouter configured.
 * Uses the native Messages API (not OpenAI-compatible), so it has its own client.
 * Also serves as a vision fallback (alongside Gemini) for image-analysis tasks
 * such as Product Identity, since Claude natively supports image content blocks.
 */
export class AnthropicProvider implements AIProvider{
  readonly name="anthropic" as const;
  supports(r:GenerationRequest,m:ProviderModel){return m.provider==="anthropic"&&m.tasks.includes(r.task)&&!!process.env.ANTHROPIC_API_KEY}
  async generate(r:GenerationRequest,m:ProviderModel):Promise<ProviderResult>{
    if(!process.env.ANTHROPIC_API_KEY)throw new AIProviderError("ANTHROPIC_API_KEY is not configured (Claude is optional)","MISSING_KEY",false);
    if(!TEXT_TASKS.includes(r.task))throw new AIProviderError("Anthropic adapter currently handles text tasks only (chat/copy/analysis)","UNSUPPORTED_TASK",false);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    const started=Date.now();
    try{
      const imageBlocks=await imageBlocksFor(r.imageUrls);
      if(r.imageUrls?.length&&imageBlocks.length===0)throw new AIProviderError("None of the reference images could be fetched for analysis","UPSTREAM_ERROR",true);
      const content=imageBlocks.length?[...imageBlocks,{type:"text",text:r.prompt||""}]:(r.prompt||"");
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "content-type":"application/json",
          "x-api-key":process.env.ANTHROPIC_API_KEY,
          "anthropic-version":"2023-06-01"
        },
        body:JSON.stringify({
          model:m.model,
          max_tokens:1024,
          messages:[{role:"user",content}]
        }),
        cache:"no-store",
        signal:controller.signal
      });
      const latencyMs=Date.now()-started;
      const rawText=await res.text();
      let raw:any=null;
      try{raw=rawText?JSON.parse(rawText):null}catch{raw=null}
      if(!res.ok){
        const {code,retryable}=classifyProviderHttpError(res.status,raw?.error?.message||rawText);
        throw new AIProviderError(raw?.error?.message||`Anthropic request failed (${res.status})`,code,retryable,res.status);
      }
      const text=(raw?.content||[]).map((b:any)=>b?.text||"").join("");
      if(!text)throw new AIProviderError("Anthropic returned no text","EMPTY_OUTPUT",true);
      return {provider:"anthropic",model:m.model,requestId:raw?.id||crypto.randomUUID(),output:text,raw,latencyMs};
    }catch(e:any){
      if(e instanceof AIProviderError)throw e;
      if(e?.name==="AbortError")throw new AIProviderError("Anthropic request timed out","TIMEOUT",true);
      throw new AIProviderError(e?.message||"Anthropic request failed","TEMPORARY_UNAVAILABLE",true);
    }finally{
      clearTimeout(timeout);
    }
  }
}
