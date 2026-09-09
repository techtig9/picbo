"use client";
import React from "react";
export function PreviewCanvas({aspect="9:16",children}:{aspect?:string;children?:React.ReactNode}){
 const ratio=aspect==="16:9"?16/9:aspect==="4:5"?4/5:aspect==="1:1"?1:9/16;
 return <div style={{display:"flex",height:"100%",alignItems:"center",justifyContent:"center",background:"#0b0d12",padding:24}}>
  <div style={{aspectRatio:String(ratio),height:"min(70vh,700px)",overflow:"hidden",borderRadius:14,border:"1px solid var(--line)",background:"#000",boxShadow:"0 20px 80px #0008",position:"relative"}}>
   {children||<div style={{display:"flex",height:"100%",alignItems:"center",justifyContent:"center",fontSize:13,color:"#ffffff99"}}>Preview</div>}
  </div>
 </div>;
}
