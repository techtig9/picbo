"use client";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/app-shell";

const ANGLES=["authentic first impression","before vs after","unboxing reaction","why I switched","daily routine feature"];

export default function UgcStudio(){
  const [products,setProducts]=useState<any[]>([]);
  const [productId,setProductId]=useState("");
  const [angle,setAngle]=useState(ANGLES[0]);
  const [script,setScript]=useState("");
  const [scriptBusy,setScriptBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const [avatarStatus,setAvatarStatus]=useState<{configured:boolean;avatars:any[]}|null>(null);

  useEffect(()=>{
    fetch("/api/products").then(r=>r.json()).then(x=>setProducts(x.products||[])).catch(()=>{});
    fetch("/api/creative/ugc/avatars").then(r=>r.json()).then(setAvatarStatus).catch(()=>setAvatarStatus({configured:false,avatars:[]}));
  },[]);

  async function generateScript(){
    if(!productId)return;
    setScriptBusy(true);setMsg("");
    try{
      const r=await fetch("/api/creative/ugc/script",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({productId,angle})});
      const j=await r.json();
      if(r.ok)setScript(j.script);
      else setMsg(`Error: ${j.error}`);
    }catch(e:any){setMsg(e.message)}finally{setScriptBusy(false)}
  }

  return <AppShell><div className="content">
    <div className="eyebrow">TALKING-HEAD VIDEO</div>
    <h1 className="title">UGC &amp; Avatar Studio</h1>
    <p className="muted">Write a real, AI-generated UGC script for your product. Avatar rendering and lip-sync need an external avatar provider — status below.</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>Product</h3>
        <select className="search" value={productId} onChange={e=>setProductId(e.target.value)}>
          <option value="">Choose product</option>
          {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <h3 style={{marginTop:16}}>Angle</h3>
        <div className="chips">
          {ANGLES.map(a=><button className="chip" key={a} style={{color:angle===a?"#fff":"#9aa1b2"}} onClick={()=>setAngle(a)}>{a}</button>)}
        </div>
        <button className="btn primary" disabled={!productId||scriptBusy} style={{marginTop:14}} onClick={generateScript}>{scriptBusy?"Writing…":"Generate script"}</button>
      </div>

      <div className="card">
        <h3>Script</h3>
        {script?
          <textarea value={script} onChange={e=>setScript(e.target.value)} style={{minHeight:180}}/>
        :
          <p className="muted">Pick a product and angle, then generate a script — it's real AI output you can edit before recording or rendering.</p>
        }
      </div>

      <div className="card">
        <h3>Avatar &amp; render</h3>
        {avatarStatus===null?
          <p className="muted">Checking avatar provider…</p>
        :avatarStatus.configured?
          <>
            <p className="muted">{avatarStatus.avatars.length} avatars available.</p>
            <div className="chips">{avatarStatus.avatars.map((a:any)=><span className="chip" key={a.id}>{a.label}</span>)}</div>
          </>
        :
          <>
            <span className="status">Not connected</span>
            <p className="muted" style={{marginTop:10}}>No avatar/lip-sync provider is configured yet (e.g. HeyGen, Synthesia, D-ID). Once one is connected, this panel will let you pick an avatar and render the script above into video — no other part of this workflow needs to change.</p>
          </>
        }
      </div>
    </div>
    {msg&&<div className="notice" style={{marginTop:16}}>{msg}</div>}
  </div></AppShell>;
}
