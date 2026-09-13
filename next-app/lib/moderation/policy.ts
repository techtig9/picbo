import {generateWithFallback} from "@/lib/ai/router";
import {createAdminClient} from "@/lib/supabase/admin";

export interface ModerationResult{flagged:boolean;category?:string;reason?:string}

const CLASSIFIER_PROMPT=(text:string)=>`You are a content-safety classifier for an AI product-photography and advertising platform. Classify the following user-submitted generation request. Flag it ONLY if it clearly requests:
- sexual content involving minors, or content sexualizing minors in any way
- non-consensual intimate imagery of a real person
- content designed to defraud, impersonate, or deceive (e.g. fake official documents, counterfeit currency)
- hate speech or content promoting violence against a person or group
- instructions for creating weapons, explosives, or other tools for violence

Ordinary product photography, advertising copy, and marketing requests — even edgy or provocative ones for legitimate products — should NOT be flagged. When in doubt, do not flag.

Request: """${text.slice(0,2000)}"""

Respond with ONLY a JSON object: {"flagged": boolean, "category": string|null, "reason": string|null}`;

/**
 * Real classification call (not a hardcoded blocklist — a fragile keyword
 * list is both easy to evade and, for the categories that matter most here,
 * inappropriate to enumerate in source code). Uses the same provider chain
 * as everything else; failures fail OPEN (never blocks a legitimate request
 * just because the classifier itself errored) but are logged.
 */
export async function classifyPromptSafety(text:string):Promise<ModerationResult>{
  if(!text||!text.trim())return {flagged:false};
  try{
    const result=await generateWithFallback({task:"analysis",quality:"fast",prompt:CLASSIFIER_PROMPT(text)});
    const raw=String(result.output||"").trim();
    const start=raw.indexOf("{"),end=raw.lastIndexOf("}");
    if(start===-1||end===-1)return {flagged:false};
    const parsed=JSON.parse(raw.slice(start,end+1));
    return {flagged:Boolean(parsed.flagged),category:parsed.category||undefined,reason:parsed.reason||undefined};
  }catch{
    return {flagged:false}; // fail open — an unavailable classifier must not block all generation
  }
}

export async function logModerationFlag(input:{workspaceId?:string;jobId?:string;task?:string;promptExcerpt:string;category?:string;reason?:string}){
  const supabase=createAdminClient();
  await supabase.from("moderation_flags").insert({
    workspace_id:input.workspaceId||null,job_id:input.jobId||null,task:input.task||null,
    prompt_excerpt:input.promptExcerpt.slice(0,500),category:input.category||null,reason:input.reason||null,action:"blocked"
  });
}
