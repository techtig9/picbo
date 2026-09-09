import {AIProviderError,type GenerationRequest,type ProviderModel,type ProviderName,type ProviderResult} from "../types";
import {classifyProviderHttpError} from "../provider-errors";

const REQUEST_TIMEOUT_MS=30000;

/**
 * Shared client for providers that expose an OpenAI-compatible
 * `/chat/completions` endpoint (Groq, Cerebras, OpenRouter). Each adapter
 * just supplies its own base URL, API key and default model.
 */
export async function callOpenAICompatibleChat(opts:{
  providerName:ProviderName;
  baseUrl:string;
  apiKey:string;
  model:string;
  request:GenerationRequest;
  extraHeaders?:Record<string,string>;
}):Promise<ProviderResult>{
  const {providerName,baseUrl,apiKey,model,request,extraHeaders}=opts;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  const started=Date.now();
  try{
    const res=await fetch(`${baseUrl.replace(/\/$/,"")}/chat/completions`,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":`Bearer ${apiKey}`,
        ...(extraHeaders||{})
      },
      body:JSON.stringify({
        model,
        messages:[{role:"user",content:request.prompt||""}],
        temperature:request.quality==="pro"?0.4:0.7
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
      throw new AIProviderError(raw?.error?.message||`${providerName} request failed (${res.status})`,code,retryable,res.status);
    }
    const text=raw?.choices?.[0]?.message?.content||"";
    if(!text)throw new AIProviderError(`${providerName} returned no text`,"EMPTY_OUTPUT",true);
    return {
      provider:providerName,
      model,
      requestId:raw?.id||crypto.randomUUID(),
      output:text,
      raw,
      latencyMs
    };
  }catch(e:any){
    if(e instanceof AIProviderError)throw e;
    if(e?.name==="AbortError")throw new AIProviderError(`${providerName} request timed out`,"TIMEOUT",true);
    throw new AIProviderError(e?.message||`${providerName} request failed`,"TEMPORARY_UNAVAILABLE",true);
  }finally{
    clearTimeout(timeout);
  }
}
