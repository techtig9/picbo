import {MODEL_REGISTRY} from "./models";
import type {ProviderName,TaskKind} from "./types";

/**
 * Real provider/model status derived from the actual registry and which
 * API keys are configured in this environment — replaces the previous
 * hardcoded demo provider list (gemini-free/configured-free/standard-ai/
 * premium-video) that never reflected real availability.
 */
const PROVIDER_ENV_KEY:Record<ProviderName,string>={
  groq:"GROQ_API_KEY",
  cerebras:"CEREBRAS_API_KEY",
  openrouter:"OPENROUTER_API_KEY",
  anthropic:"ANTHROPIC_API_KEY",
  gemini:"GEMINI_API_KEY",
  fal:"FAL_KEY"
};

// Priority reflects the required chain: Groq -> Cerebras -> OpenRouter -> optional Claude,
// with Gemini/fal as additional fallbacks already present in the codebase.
const PROVIDER_PRIORITY:Record<ProviderName,number>={
  groq:10,cerebras:20,openrouter:30,anthropic:40,gemini:50,fal:60
};

export interface ProviderStatus{
  id:ProviderName;
  label:string;
  configured:boolean;
  models:string[];
  tasks:TaskKind[];
  priority:number;
  estimatedCostUsd:number;
}

const LABELS:Record<ProviderName,string>={
  groq:"Groq",cerebras:"Cerebras",openrouter:"OpenRouter",anthropic:"Anthropic (Claude, optional)",gemini:"Gemini",fal:"fal.ai"
};

export function listProviderStatus():ProviderStatus[]{
  const byProvider=new Map<ProviderName,ProviderStatus>();
  for(const m of MODEL_REGISTRY){
    const existing=byProvider.get(m.provider);
    if(existing){
      existing.models.push(m.model);
      for(const t of m.tasks)if(!existing.tasks.includes(t))existing.tasks.push(t);
    }else{
      byProvider.set(m.provider,{
        id:m.provider,
        label:LABELS[m.provider],
        configured:Boolean(process.env[PROVIDER_ENV_KEY[m.provider]]),
        models:[m.model],
        tasks:[...m.tasks],
        priority:PROVIDER_PRIORITY[m.provider],
        estimatedCostUsd:m.estimatedCostUsd||0
      });
    }
  }
  return [...byProvider.values()].sort((a,b)=>a.priority-b.priority);
}

/** First configured provider (in priority order) that can serve a task, or null. */
export function firstAvailableProviderForTask(task:TaskKind):ProviderStatus|null{
  return listProviderStatus().find(p=>p.configured&&p.tasks.includes(task))||null;
}
