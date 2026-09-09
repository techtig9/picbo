import type {PhotoshootRequest} from "./types";
export function buildProductShootPrompt(r:PhotoshootRequest,identity?:{promptContext?:string;negativeConstraints?:string}){
 // Prefer the real, product-specific analysis (Phase 3's Product Identity
 // feature) when available; fall back to the generic instruction otherwise
 // — still better than nothing when no analysis has been run yet.
 const identityLine=identity?.promptContext
  ?`Product identity (from analysis): ${identity.promptContext}`
  :r.preserveProductIdentity?"Preserve the exact product identity: logo, packaging, readable text, shape, proportions and colors. Do not invent or redesign the product.":"";
 const negativeLine=identity?.negativeConstraints?`Avoid: ${identity.negativeConstraints}`:"";
 const shots=r.shotTypes.join(", ");
 return [identityLine,negativeLine,`Commercial product photography. Shot types: ${shots}.`,`Aspect ratio: ${r.aspectRatio}.`,`Background: ${r.background}.`,r.backgroundPrompt&&`Background direction: ${r.backgroundPrompt}.`,r.scenePrompt&&`Scene: ${r.scenePrompt}.`,r.lighting&&`Lighting: ${r.lighting}.`,r.cameraAngle&&`Camera angle: ${r.cameraAngle}.`,`Create a polished advertising-ready result.`].filter(Boolean).join("\n");
}
