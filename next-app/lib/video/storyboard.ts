import type {VideoScene,VideoBrief} from "./types";
export function makeProductAdStoryboard():VideoScene[]{
 return [
  {order:1,durationMs:2500,motion:"push_in",transition:"cut",text:"STOP THE SCROLL",visualPrompt:"strong product hero opening"},
  {order:2,durationMs:3000,motion:"slow_zoom",transition:"crossfade",text:"Meet the product",visualPrompt:"clean product beauty shot"},
  {order:3,durationMs:3000,motion:"parallax",transition:"zoom",text:"Why it stands out",visualPrompt:"feature-focused product scene"},
  {order:4,durationMs:3000,motion:"pan_right",transition:"crossfade",text:"Made for your routine",visualPrompt:"lifestyle use scene"},
  {order:5,durationMs:3500,motion:"push_in",transition:"fade",text:"Shop now",visualPrompt:"final hero + CTA"}
 ];
}
export function normalizeStoryboard(b:VideoBrief):VideoScene[]{
 const total=b.scenes.reduce((n,s)=>n+s.durationMs,0)||1;
 const target=b.durationSeconds*1000;
 return b.scenes.map(s=>({...s,durationMs:Math.max(500,Math.round(s.durationMs*target/total))}));
}
