"use client";
import React from "react";
import {totalDuration,type EditorState} from "@/lib/ui/editor-model";

export function Timeline({state,onSelect,onSeek}:{state:EditorState;onSelect:(id:string)=>void;onSeek:(ms:number)=>void}){
 const total=Math.max(1,totalDuration(state));
 return <div style={{borderTop:"1px solid var(--line)",padding:14}}>
  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)",marginBottom:8}}>
   <span>Timeline</span><span>{(total/1000).toFixed(1)}s</span>
  </div>
  <div style={{position:"relative",display:"flex",height:80,gap:6,overflowX:"auto",borderRadius:11,background:"#151821",padding:6}}>
   {state.scenes.map(s=>(
    <button key={s.id} onClick={()=>onSelect(s.id)}
     className="chip"
     style={{
      height:"100%",flexShrink:0,textAlign:"left",padding:8,
      width:`${Math.max(80,s.durationMs/total*260)}px`,
      borderColor:state.selectedSceneId===s.id?"var(--accent)":"var(--line)",
      color:state.selectedSceneId===s.id?"#fff":"#9aa1b2"
     }}>
     {s.id}<br/><span style={{opacity:.6}}>{(s.durationMs/1000).toFixed(1)}s</span>
    </button>
   ))}
  </div>
  <input aria-label="Timeline seek" style={{width:"100%",marginTop:12}} type="range" min="0" max={total} onChange={e=>onSeek(Number(e.target.value))}/>
 </div>;
}
