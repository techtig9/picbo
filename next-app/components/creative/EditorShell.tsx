"use client";
import React from "react";
import type {EditorState,EditorTab} from "@/lib/ui/editor-model";

export function EditorShell({state,onTab,onPlay,onExport,children}:{state:EditorState;onTab:(t:EditorTab)=>void;onPlay:()=>void;onExport:()=>void;children?:React.ReactNode}){
  const tabs:Array<[EditorTab,string]>=[["assets","Assets"],["scenes","Scenes"],["text","Text"],["brand","Brand"],["audio","Audio"],["captions","Captions"],["export","Export"]];
  return <div style={{display:"flex",minHeight:720,flexDirection:"column",overflow:"hidden",borderRadius:18,border:"1px solid var(--line)",background:"var(--panel)"}}>
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--line)",padding:"12px 16px"}}>
      <div>
        <div style={{fontWeight:700}}>{state.title||"Untitled Ad"}</div>
        <div style={{fontSize:11,opacity:.6}}>{state.aspect} · {state.dirty?"Unsaved changes":"Saved"}</div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onPlay} className="btn">{state.playing?"Pause":"Preview"}</button>
        <button onClick={onExport} className="btn primary">Export</button>
      </div>
    </header>
    <div style={{display:"flex",minHeight:0,flex:1}}>
      <aside style={{width:96,borderRight:"1px solid var(--line)",padding:8}}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>onTab(id)}
           style={{
            marginBottom:4,width:"100%",borderRadius:10,padding:"10px 8px",fontSize:11,textAlign:"center",
            background:state.activeTab===id?"#1b1e28":"transparent",
            color:state.activeTab===id?"#fff":"#9aa1b2",
            border:"none",cursor:"pointer",fontWeight:state.activeTab===id?700:400
           }}>{label}</button>
        ))}
      </aside>
      <main style={{minWidth:0,flex:1}}>{children}</main>
    </div>
  </div>;
}
