import {AIProviderError,type AIProvider,GenerationRequest,ProviderModel,ProviderResult} from "../types";
import {callOpenAICompatibleChat} from "./openai-compatible";

const TEXT_TASKS=["chat","copy","analysis"];

/**
 * OpenRouter — unified proxy to 300+ models across providers. Third provider
 * in the required fallback chain, used when both Groq and Cerebras fail.
 * https://openrouter.ai/api/v1 is OpenAI-compatible.
 */
export class OpenRouterProvider implements AIProvider{
  readonly name="openrouter" as const;
  supports(r:GenerationRequest,m:ProviderModel){return m.provider==="openrouter"&&m.tasks.includes(r.task)&&!r.imageUrls?.length&&!!process.env.OPENROUTER_API_KEY}
  async generate(r:GenerationRequest,m:ProviderModel):Promise<ProviderResult>{
    if(!process.env.OPENROUTER_API_KEY)throw new AIProviderError("OPENROUTER_API_KEY is not configured","MISSING_KEY",false);
    if(!TEXT_TASKS.includes(r.task))throw new AIProviderError("OpenRouter adapter currently handles text tasks only (chat/copy/analysis)","UNSUPPORTED_TASK",false);
    return callOpenAICompatibleChat({
      providerName:"openrouter",
      baseUrl:"https://openrouter.ai/api/v1",
      apiKey:process.env.OPENROUTER_API_KEY,
      model:m.model,
      request:r,
      extraHeaders:{
        "HTTP-Referer":process.env.NEXT_PUBLIC_APP_URL||"https://picbo.ai",
        "X-Title":"Picbo.ai"
      }
    });
  }
}
