import {candidates} from "./models";
import {GeminiProvider} from "./providers/gemini";
import {FalProvider} from "./providers/fal";
import {GroqProvider} from "./providers/groq";
import {CerebrasProvider} from "./providers/cerebras";
import {OpenRouterProvider} from "./providers/openrouter";
import {AnthropicProvider} from "./providers/anthropic";
import {AIProviderError,type GenerationRequest,type ProviderAttempt,ProviderResult,ProviderModel} from "./types";
import {isRetryableProviderError,backoffDelayMs,sleep} from "./provider-errors";

// Error codes that indicate the *provider/credential* itself is broken,
// not just the specific model — no point trying a sibling model on the
// same provider with the same bad key.
const PROVIDER_LEVEL_ERROR_CODES=new Set(["AUTH_ERROR","MISSING_KEY","INSUFFICIENT_BALANCE"]);

const providers={
 gemini:new GeminiProvider(),
 fal:new FalProvider(),
 groq:new GroqProvider(),
 cerebras:new CerebrasProvider(),
 openrouter:new OpenRouterProvider(),
 anthropic:new AnthropicProvider()
};

// Max attempts against the SAME model before moving to the next candidate in the chain.
const MAX_ATTEMPTS_PER_MODEL=2;

function ordered(request:GenerationRequest){let list=candidates(request.task,request.quality);
 if(request.task==="image"||request.task==="image_edit")list=list.sort((a,b)=>Number(b.freeEligible)-Number(a.freeEligible));
 // A request that includes reference images (e.g. product-identity analysis) can only
 // be served by a model that actually accepts image input — never silently hand it to
 // a text-only model, which would hallucinate an "analysis" it never actually saw.
 if(request.imageUrls?.length)list=list.filter(m=>m.visionCapable===true);
 return list;
}

export interface GenerateOptions{
  /** Called after every attempt (success or failure) so callers can persist usage/cost/latency. */
  onAttempt?:(attempt:ProviderAttempt)=>void|Promise<void>;
}

/**
 * Runs a request through the provider priority chain:
 * Groq -> Cerebras -> OpenRouter -> optional Claude -> (extra) Gemini -> (image) fal.
 * Within a single model, retryable errors (rate limit, timeout, 5xx, overloaded,
 * quota) get up to MAX_ATTEMPTS_PER_MODEL tries with exponential backoff before
 * moving on. Permanent errors (missing/invalid key, auth failure, unsupported
 * task, model unavailable) skip straight to the next model — no wasted retries.
 */
export async function generateWithFallback(request:GenerationRequest,options:GenerateOptions={}):Promise<ProviderResult>{
 const models=ordered(request);
 if(!models.length)throw new AIProviderError(`No configured provider can perform ${request.task}`,"NO_PROVIDER",false);
 const errors:string[]=[];
 const deadProviders=new Set<string>();
 let globalAttemptNo=0;

 for(const model of models){
  if(deadProviders.has(model.provider))continue;
  const provider=providers[model.provider];
  if(!provider.supports(request,model))continue;

  for(let attempt=0;attempt<MAX_ATTEMPTS_PER_MODEL;attempt++){
   globalAttemptNo++;
   const attemptStarted=Date.now();
   try{
    const result=await provider.generate(request,model);
    await options.onAttempt?.({
     provider:model.provider,model:model.model,attemptNo:globalAttemptNo,status:"succeeded",
     requestId:result.requestId,costUsd:model.estimatedCostUsd,latencyMs:result.latencyMs??(Date.now()-attemptStarted)
    });
    return result;
   }catch(e:any){
    const err=e instanceof AIProviderError?e:new AIProviderError(e?.message||"failed","UNKNOWN",true);
    const latencyMs=Date.now()-attemptStarted;
    await options.onAttempt?.({
     provider:model.provider,model:model.model,attemptNo:globalAttemptNo,status:"failed",
     errorCode:err.code,errorMessage:err.message,latencyMs
    });
    errors.push(`${model.provider}/${model.model} (attempt ${attempt+1}): ${err.message}`);
    if(PROVIDER_LEVEL_ERROR_CODES.has(err.code))deadProviders.add(model.provider);
    const retryable=err.retryable&&isRetryableProviderError(err.code)&&!deadProviders.has(model.provider);
    if(!retryable)break; // permanent (model- or provider-level) error: stop retrying, move on
    if(attempt<MAX_ATTEMPTS_PER_MODEL-1)await sleep(backoffDelayMs(attempt));
   }
  }
 }
 throw new AIProviderError(`All eligible AI providers failed: ${errors.join(" | ")}`,"ALL_PROVIDERS_FAILED",false);
}

export function explainRouting(task:string){
 if(["chat","copy","analysis"].includes(task))return "Groq first, then Cerebras, then OpenRouter, then optional Claude if configured; existing Gemini integration remains as an extra fallback.";
 if(["image","image_edit"].includes(task))return "Configured low-cost image model first; additional eligible providers can be added without changing product code.";
 return "Task is routed only to a provider that explicitly supports it.";
}
