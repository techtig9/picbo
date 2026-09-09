import type {MotionPreset,TransitionType} from "@/lib/video/types";
export type EditorTab="assets"|"scenes"|"text"|"brand"|"audio"|"captions"|"export";
export interface EditorScene{
  id:string; assetUrl?:string; durationMs:number;
  motion:MotionPreset;
  transition:TransitionType;
  text?:string;
}
export interface EditorState{
  projectId:string; title:string; aspect:"9:16"|"4:5"|"1:1"|"16:9";
  activeTab:EditorTab; scenes:EditorScene[]; selectedSceneId?:string;
  zoom:number; playing:boolean; currentTimeMs:number; dirty:boolean;
}
export function totalDuration(s:EditorState){return s.scenes.reduce((n,x)=>n+Math.max(0,x.durationMs),0)}
export function clampTime(s:EditorState,t:number){return Math.max(0,Math.min(totalDuration(s),t))}
