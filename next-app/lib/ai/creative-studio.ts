export interface ProductProfile {
  name:string;
  category:string;
  description:string;
  benefits:string[];
  audience:string[];
  price?:string;
  brandVoice:"minimal"|"luxury"|"playful"|"bold"|"professional";
  colors?:string[];
}

export interface ShotPlan {
  id:string;
  purpose:"hero"|"detail"|"lifestyle"|"feature"|"offer"|"cta";
  prompt:string;
  durationMs:number;
  camera:"closeup"|"medium"|"wide"|"macro";
  motion:"static"|"zoom-in"|"zoom-out"|"pan-left"|"pan-right";
  background:"studio"|"lifestyle"|"gradient"|"solid";
}

export interface AdCopy {
  hook:string;
  headline:string;
  body:string;
  cta:string;
  caption:string;
  hashtags:string[];
}

export interface CreativePlan {
  product:ProductProfile;
  shots:ShotPlan[];
  copy:AdCopy;
  aspect:"9:16"|"4:5"|"1:1"|"16:9";
  durationMs:15000;
}

export function normalizeProduct(input:any):ProductProfile{
  return {
    name:String(input?.name||"Product"),
    category:String(input?.category||""),
    description:String(input?.description||""),
    benefits:Array.isArray(input?.benefits)?input.benefits.map(String).slice(0,10):[],
    audience:Array.isArray(input?.audience)?input.audience.map(String).slice(0,10):[],
    price:input?.price?String(input.price):undefined,
    brandVoice:["minimal","luxury","playful","bold","professional"].includes(input?.brandVoice)?input.brandVoice:"professional",
    colors:Array.isArray(input?.colors)?input.colors.map(String).slice(0,6):[]
  };
}

export function buildShotPlan(product:ProductProfile):ShotPlan[]{
  return [
    {id:"hero",purpose:"hero",prompt:`Premium hero product photo of ${product.name}. ${product.description}`,durationMs:3500,camera:"medium",motion:"zoom-in",background:"studio"},
    {id:"detail",purpose:"detail",prompt:`Macro detail shot highlighting the strongest visual detail of ${product.name}`,durationMs:2500,camera:"macro",motion:"pan-right",background:"studio"},
    {id:"lifestyle",purpose:"lifestyle",prompt:`Lifestyle product photography showing ${product.name} naturally in use by the target customer`,durationMs:3500,camera:"wide",motion:"pan-left",background:"lifestyle"},
    {id:"feature",purpose:"feature",prompt:`Clean product feature shot of ${product.name} emphasizing ${product.benefits[0]||"the main benefit"}`,durationMs:2500,camera:"closeup",motion:"zoom-out",background:"gradient"},
    {id:"cta",purpose:"cta",prompt:`Clean premium product end card for ${product.name}`,durationMs:3000,camera:"medium",motion:"static",background:"solid"}
  ];
}

export function buildCopy(product:ProductProfile):AdCopy{
  const benefit=product.benefits[0]||"Made to fit your everyday needs";
  return {
    hook:`Meet ${product.name}.`,
    headline:benefit,
    body:product.description||`Discover what makes ${product.name} different.`,
    cta:"Shop now",
    caption:`Discover ${product.name} — ${benefit}.`,
    hashtags:["#new","#product","#shopnow"]
  };
}

export function buildCreativePlan(input:any):CreativePlan{
  const product=normalizeProduct(input);
  return {product,shots:buildShotPlan(product),copy:buildCopy(product),aspect:input?.aspect==="16:9"?"16:9":input?.aspect==="4:5"?"4:5":input?.aspect==="1:1"?"1:1":"9:16",durationMs:15000};
}

export function buildAiCopyPrompt(product:ProductProfile){
  return `You are a senior direct-response copywriter for a premium product photography platform. Write ad copy for "${product.name}" (${product.category||"product"}).
Description: ${product.description||"not provided"}. Key benefits: ${product.benefits.join(", ")||"not specified"}. Audience: ${product.audience.join(", ")||"general consumers"}. Brand voice: ${product.brandVoice}.

Respond with ONLY a single JSON object (no markdown fences, no commentary):
{"hook": string, "headline": string, "body": string, "cta": string, "caption": string, "hashtags": string[]}
Avoid unsupported claims, fake testimonials, guaranteed outcomes, or invented product facts.`;
}

/** Best-effort JSON parse of the AI copy response. Returns null (never throws) if unparseable. */
export function parseAiCopy(raw:string):AdCopy|null{
  const cleaned=raw.trim().replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
  const start=cleaned.indexOf("{");
  const end=cleaned.lastIndexOf("}");
  if(start===-1||end===-1||end<start)return null;
  try{
    const p=JSON.parse(cleaned.slice(start,end+1));
    if(!p.hook||!p.headline)return null;
    return {
      hook:String(p.hook),headline:String(p.headline),body:String(p.body||""),
      cta:String(p.cta||"Shop now"),caption:String(p.caption||p.headline),
      hashtags:Array.isArray(p.hashtags)?p.hashtags.map(String).slice(0,8):[]
    };
  }catch{
    return null;
  }
}
