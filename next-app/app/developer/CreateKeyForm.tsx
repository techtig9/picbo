"use client";
import {useState,useTransition} from "react";
import {createApiKey} from "./actions";

export function CreateKeyForm(){
  const [isPending,startTransition]=useTransition();
  const [name,setName]=useState("");
  const [plaintext,setPlaintext]=useState("");
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);

  function submit(){
    if(!name.trim())return;
    setError("");setPlaintext("");setCopied(false);
    startTransition(async()=>{
      try{
        const r=await createApiKey(name);
        setPlaintext(r.plaintext);
        setName("");
      }catch(e:any){setError(e.message)}
    });
  }

  return <div>
    <div className="form">
      <label>Key name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Zapier integration"/></label>
      <button className="btn primary" onClick={submit} disabled={isPending||!name.trim()}>{isPending?"Creating…":"Create API key"}</button>
    </div>
    {error&&<div className="notice" style={{marginTop:10}}>{error}</div>}
    {plaintext&&<div className="notice" style={{marginTop:10}}>
      This is the only time you'll see the full key — copy it now.
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input readOnly value={plaintext} style={{flex:1,fontSize:12,fontFamily:"monospace"}}/>
        <button type="button" className="btn" onClick={()=>{navigator.clipboard.writeText(plaintext);setCopied(true)}}>{copied?"Copied":"Copy"}</button>
      </div>
    </div>}
  </div>;
}
