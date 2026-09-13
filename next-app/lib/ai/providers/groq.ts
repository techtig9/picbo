import {AIProviderError,type AIProvider,GenerationRequest,ProviderModel,ProviderResult} from "../types";
import {callOpenAICompatibleChat} from "./openai-compatible";

const TEXT_TASKS=["chat","copy","analysis"];

/**
 * Groq — fast open-weight inference (Llama / GPT-OSS on Groq's LPU stack).
 * First provider in the required fallback chain (Groq -> Cerebras -> OpenRouter -> optional Claude).
 * https://api.groq.com/openai/v1 is OpenAI-compatible.
 */
export class GroqProvider implements AIProvider{
  readonly name="groq" as const;
  supports(r:GenerationRequest,m:ProviderModel){return m.provider==="groq"&&m.tasks.includes(r.task)&&!r.imageUrls?.length&&!!process.env.GROQ_API_KEY}
  async generate(r:GenerationRequest,m:ProviderModel):Promise<ProviderResult>{
    if(!process.env.GROQ_API_KEY)throw new AIProviderError("GROQ_API_KEY is not configured","MISSING_KEY",false);
    if(!TEXT_TASKS.includes(r.task))throw new AIProviderError("Groq adapter currently handles text tasks only (chat/copy/analysis)","UNSUPPORTED_TASK",false);
    return callOpenAICompatibleChat({
      providerName:"groq",
      baseUrl:"https://api.groq.com/openai/v1",
      apiKey:process.env.GROQ_API_KEY,
      model:m.model,
      request:r
    });
  }
}
