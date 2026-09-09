"use client";
import React from "react";
import {SOCIAL_PRESETS} from "@/lib/social/platform-presets";

export function ExportPanel({onExport}:{onExport:(platform:string)=>void}){
 const platforms=Object.values(SOCIAL_PRESETS);
 return <div style={{padding:20}}>
  <div style={{marginBottom:16}}>
   <h2 style={{fontSize:18,fontWeight:700,margin:"0 0 4px"}}>Export ad</h2>
   <p className="muted">Choose a platform and generate a ready-to-publish MP4.</p>
  </div>
  <div className="grid" style={{gridTemplateColumns:"repeat(2,1fr)"}}>
   {platforms.map(p=>(
    <button key={p.id} onClick={()=>onExport(p.id)} className="card" style={{textAlign:"left",cursor:"pointer"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{fontWeight:600,fontSize:14}}>{p.label}</div>
      {p.recommended&&<span className="status">Recommended</span>}
     </div>
     <div className="muted" style={{fontSize:11,marginTop:4}}>{p.width}×{p.height} · up to {Math.round(p.maxDurationMs/1000)}s</div>
    </button>
   ))}
  </div>
 </div>;
}
