import type {ProviderModel,TaskKind} from "./types";

const TEXT_TASKS:TaskKind[]=["chat","copy","analysis"];

const groqModels=(process.env.GROQ_MODELS?.split(",").map(x=>x.trim()).filter(Boolean)??["openai/gpt-oss-120b"])
  .map((model,i)=>({provider:"groq" as const,model,tasks:TEXT_TASKS,quality:["fast","balanced","pro"] as any,freeEligible:i===0,estimatedCostUsd:0.0002}));

const cerebrasModels=(process.env.CEREBRAS_MODELS?.split(",").map(x=>x.trim()).filter(Boolean)??["gpt-oss-120b"])
  .map((model,i)=>({provider:"cerebras" as const,model,tasks:TEXT_TASKS,quality:["fast","balanced","pro"] as any,freeEligible:i===0,estimatedCostUsd:0.0002}));

const openrouterModels=(process.env.OPENROUTER_MODELS?.split(",").map(x=>x.trim()).filter(Boolean)??["meta-llama/llama-3.3-70b-instruct"])
  .map((model,i)=>({provider:"openrouter" as const,model,tasks:TEXT_TASKS,quality:["fast","balanced","pro"] as any,freeEligible:false,estimatedCostUsd:0.001}));

// Claude is explicitly optional and sits last in the required chain
// (Groq -> Cerebras -> OpenRouter -> optional Claude). It only ever
// becomes reachable if ANTHROPIC_API_KEY is configured (see AnthropicProvider.supports).
const anthropicModels=(process.env.ANTHROPIC_MODELS?.split(",").map(x=>x.trim()).filter(Boolean)??["claude-haiku-4-5-20251001"])
  .map(model=>({provider:"anthropic" as const,model,tasks:TEXT_TASKS,quality:["fast","balanced","pro"] as any,freeEligible:false,estimatedCostUsd:0.003,visionCapable:true}));

// Gemini is preserved as an additional fallback beyond the required chain
// (existing working architecture retained, per project rule: don't destroy
// working functionality unnecessarily).
const geminiModels=(process.env.PICBO_GEMINI_MODELS?.split(",").map(x=>x.trim()).filter(Boolean)??["gemini-2.5-flash-lite","gemini-2.5-flash"])
  .map((model,i)=>({provider:"gemini" as const,model,tasks:TEXT_TASKS,quality:["fast","balanced"] as any,freeEligible:i===0,estimatedCostUsd:0,visionCapable:true}));

export const MODEL_REGISTRY:ProviderModel[]=[
 // Required text-task priority chain: Groq -> Cerebras -> OpenRouter -> optional Claude
 ...groqModels,
 ...cerebrasModels,
 ...openrouterModels,
 ...anthropicModels,
 // Extra fallback beyond the required chain (preserved existing capability)
 ...geminiModels,
 {provider:"fal",model:process.env.PICBO_FAL_IMAGE_MODEL||"fal-ai/flux/schnell",tasks:["image","image_edit"] as TaskKind[],quality:["balanced","pro"] as any,freeEligible:false,estimatedCostUsd:0.01},
 {provider:"fal",model:process.env.PICBO_FAL_BG_REMOVE_MODEL||"fal-ai/birefnet/v2",tasks:["background_remove"] as TaskKind[],quality:["fast","balanced","pro"] as any,freeEligible:false,estimatedCostUsd:0.002},
 {provider:"fal",model:process.env.PICBO_FAL_UPSCALE_MODEL||"fal-ai/clarity-upscaler",tasks:["upscale"] as TaskKind[],quality:["fast","balanced","pro"] as any,freeEligible:false,estimatedCostUsd:0.03}
];
export function candidates(task:TaskKind,quality:"fast"|"balanced"|"pro"){return MODEL_REGISTRY.filter(m=>m.tasks.includes(task)&&m.quality.includes(quality as any))}

