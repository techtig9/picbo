import type {VideoBrief} from "./types";
export interface RenderPlan{durationSeconds:number;aspectRatio:string;scenes:VideoBrief["scenes"];requiresVideoProvider:boolean;audio:{music:boolean;voice:boolean;captions:boolean}}
export function buildRenderPlan(b:VideoBrief):RenderPlan{
 return {durationSeconds:b.durationSeconds,aspectRatio:b.aspectRatio,scenes:b.scenes,audio:{music:Boolean(b.musicId),voice:Boolean(b.voiceId),captions:b.captions},requiresVideoProvider:true};
}
export function estimateVideoCredits(b:VideoBrief){return Math.max(3,Math.ceil(b.durationSeconds/5)*Math.max(1,b.scenes.length));}
