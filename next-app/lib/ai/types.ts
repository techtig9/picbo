export type TaskKind="chat"|"copy"|"analysis"|"image"|"image_edit"|"background_remove"|"upscale"|"video"|"voice"|"render";
export type QualityTier="fast"|"balanced"|"pro";
export type ProviderName="gemini"|"fal"|"groq"|"cerebras"|"openrouter"|"anthropic";
export interface GenerationRequest{task:TaskKind;quality:QualityTier;prompt?:string;negativePrompt?:string;imageUrls?:string[];aspectRatio?:string;durationSeconds?:number;productId?:string;workspaceId?:string;metadata?:Record<string,unknown>}
export interface ProviderModel{provider:ProviderName;model:string;tasks:TaskKind[];quality:QualityTier[];estimatedCostUsd?:number;freeEligible?:boolean;visionCapable?:boolean}
export interface ProviderResult{provider:ProviderName;model:string;requestId:string;output?:unknown;assetUrls?:string[];raw?:unknown;latencyMs?:number}
export interface AIProvider{readonly name:ProviderName;supports(request:GenerationRequest,model:ProviderModel):boolean;generate(request:GenerationRequest,model:ProviderModel):Promise<ProviderResult>}
export class AIProviderError extends Error{constructor(message:string,public code="PROVIDER_ERROR",public retryable=true,public status?:number){super(message);this.name="AIProviderError"}}
/** One resolved or failed attempt against a single provider/model, for usage/cost/latency tracking. */
export interface ProviderAttempt{provider:ProviderName;model:string;attemptNo:number;status:"succeeded"|"failed";requestId?:string;errorCode?:string;errorMessage?:string;costUsd?:number;latencyMs:number}
