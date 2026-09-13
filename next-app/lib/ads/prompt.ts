import type {AdBrief} from "./types";
export function buildAdCopyPrompt(b:AdBrief,productName:string){return `You are a senior performance advertising creative director. Create ${b.variants} distinct ad concepts for ${productName}.
Objective: ${b.objective}. Platforms: ${b.platforms.join(", ")}. Format: ${b.format}.
Audience: ${b.audience||"define a sensible target audience"}. Tone: ${b.tone||"clear, premium, persuasive"}. Language: ${b.language||"English"}.
Offer: ${b.offer||"none specified"}. Hook preference: ${b.hook||"strong benefit-led hook"}. CTA: ${b.cta||"Shop Now"}.
Return structured concepts with: hook, headline, primaryText, shortDescription, CTA, visualDirection, urgencyLevel. Avoid unsupported claims, fake testimonials, guaranteed outcomes, and invented product facts.`}
