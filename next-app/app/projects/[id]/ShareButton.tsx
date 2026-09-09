"use client";
import {useState,useTransition} from "react";

export function ShareButton({projectId}:{projectId:string}){
  const [isPending,startTransition]=useTransition();
  const [link,setLink]=useState("");
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);

  function share(){
    setError("");setLink("");setCopied(false);
    startTransition(async()=>{
      try{
        const r=await fetch("/api/growth/share",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId,permission:"view"})});
        const j=await r.json();
        if(!r.ok)throw new Error(j.error||"Failed to create share link");
        setLink(`${window.location.origin}/share/${j.token}`);
      }catch(e:any){setError(e.message)}
    });
  }

  return <div>
    <button className="btn" onClick={share} disabled={isPending}>{isPending?"Creating link…":"Share (view-only)"}</button>
    {error&&<div className="notice" style={{marginTop:10}}>{error}</div>}
    {link&&<div className="notice" style={{marginTop:10}}>
      Anyone with this link can view this project — no sign-in required.
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input readOnly value={link} style={{flex:1,fontSize:12}}/>
        <button type="button" className="btn" onClick={()=>{navigator.clipboard.writeText(link);setCopied(true)}}>{copied?"Copied":"Copy"}</button>
      </div>
    </div>}
  </div>;
}
