import {AIProviderError,type AIProvider,GenerationRequest,ProviderModel,ProviderResult} from "../types";
import {callOpenAICompatibleChat} from "./openai-compatible";

const TEXT_TASKS=["chat","copy","analysis"];

/**
 * Cerebras — ultra-fast wafer-scale inference. Second provider in the
 * required fallback chain, used when Groq is unavailable or rate-limited.
 * https://api.cerebras.ai/v1 is OpenAI-compatible.
 */
export class CerebrasProvider implements AIProvider{
  readonly name="cerebras" as const;
  supports(r:GenerationRequest,m:ProviderModel){return m.provider==="cerebras"&&m.tasks.includes(r.task)&&!r.imageUrls?.length&&!!process.env.CEREBRAS_API_KEY}
  async generate(r:GenerationRequest,m:ProviderModel):Promise<ProviderResult>{
    if(!process.env.CEREBRAS_API_KEY)throw new AIProviderError("CEREBRAS_API_KEY is not configured","MISSING_KEY",false);
    if(!TEXT_TASKS.includes(r.task))throw new AIProviderError("Cerebras adapter currently handles text tasks only (chat/copy/analysis)","UNSUPPORTED_TASK",false);
    return callOpenAICompatibleChat({
      providerName:"cerebras",
      baseUrl:"https://api.cerebras.ai/v1",
      apiKey:process.env.CEREBRAS_API_KEY,
      model:m.model,
      request:r
    });
  }
}
