import {PRODUCT_IDENTITY_REQUIREMENTS} from "@/lib/product-intelligence";

export function buildIdentityAnalysisPrompt(productName:string,brand?:string|null){
  return `You are a product-identity analyst for an AI product photography platform. Study the attached reference image(s) of "${productName}"${brand?` (brand: ${brand})`:""}.

Your job is to describe exactly what must be preserved so future AI-generated photos of this product remain recognizable and accurate. Requirements to capture: ${PRODUCT_IDENTITY_REQUIREMENTS.join("; ")}.

Respond with ONLY a single JSON object (no markdown fences, no commentary) matching this shape:
{
  "logo": {"present": boolean, "description": string, "placement": string},
  "packaging": {"description": string, "materials": string[]},
  "text": {"visibleText": string[], "mustPreserve": boolean},
  "shape": {"description": string, "category": string},
  "color": {"primaryColors": string[], "notes": string},
  "proportions": {"description": string},
  "confidence": number,
  "promptContext": string,
  "negativeConstraints": string
}
"confidence" is 0-1, how certain you are the description is accurate and complete enough to guide generation. "promptContext" is a short paragraph to prepend to future generation prompts. "negativeConstraints" lists what must NOT change (e.g. "do not alter logo color or shape").`;
}

export interface ParsedIdentity{
  logoRules:Record<string,unknown>;
  packagingRules:Record<string,unknown>;
  textRules:Record<string,unknown>;
  shapeRules:Record<string,unknown>;
  colorRules:Record<string,unknown>;
  proportionRules:Record<string,unknown>;
  promptContext:string;
  negativeConstraints:string;
  confidence:number;
}

/**
 * Best-effort JSON parse of the model's analysis output. Models occasionally wrap
 * JSON in markdown fences or add stray text — strip those before parsing. Returns
 * null (never throws) if the output genuinely isn't parseable, so the caller can
 * fall back to "needs_review" instead of pretending the analysis succeeded.
 */
export function parseIdentityAnalysis(raw:string):ParsedIdentity|null{
  const cleaned=raw.trim().replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
  const start=cleaned.indexOf("{");
  const end=cleaned.lastIndexOf("}");
  if(start===-1||end===-1||end<start)return null;
  try{
    const parsed=JSON.parse(cleaned.slice(start,end+1));
    return {
      logoRules:parsed.logo||{},
      packagingRules:parsed.packaging||{},
      textRules:parsed.text||{},
      shapeRules:parsed.shape||{},
      colorRules:parsed.color||{},
      proportionRules:parsed.proportions||{},
      promptContext:String(parsed.promptContext||""),
      negativeConstraints:String(parsed.negativeConstraints||""),
      confidence:Number(parsed.confidence)||0
    };
  }catch{
    return null;
  }
}
