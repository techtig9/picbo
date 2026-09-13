"use client";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/app-shell";
import {RenderStatus} from "@/components/render/RenderStatus";

const HOOK_TEMPLATES=[
  "STOP THE SCROLL","Wait for it…","POV: you finally found it","The secret nobody tells you","Before vs after","3 reasons this sold out"
];

export default function ShortsStudio(){
  const [products,setProducts]=useState<any[]>([]);
  const [productId,setProductId]=useState("");
  const [hook,setHook]=useState(HOOK_TEMPLATES[0]);
  const [cta,setCta]=useState("Shop now");
  const [captions,setCaptions]=useState(true);
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  const [projectId,setProjectId]=useState("");
  const [renderBusy,setRenderBusy]=useState(false);
  const [renderJobId,setRenderJobId]=useState("");

  useEffect(()=>{fetch("/api/products").then(r=>r.json()).then(x=>setProducts(x.products||[])).catch(()=>{})},[]);

  async function create(){
    setBusy(true);setMsg("Building your short…");
    try{
      const r=await fetch("/api/creative/video",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        productId,objective:"social_short",aspectRatio:"9:16",durationSeconds:15,captions,cta
      })});
      const j=await r.json();
      if(r.ok){setProjectId(j.videoProjectId);setMsg(`Short ${j.videoProjectId} storyboarded with ${j.sceneCount} scenes. Estimated credits: ${j.estimatedCredits}.`)}
      else setMsg(`Error: ${j.error}`);
    }catch(e:any){setMsg(e.message)}finally{setBusy(false)}
  }

  async function render(){
    if(!projectId)return;
    setRenderBusy(true);setMsg("Queueing render…");
    try{
      const r=await fetch("/api/creative/video/render",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({videoProjectId:projectId,idempotencyKey:crypto.randomUUID()})});
      const j=await r.json();
      setMsg(r.ok?`Render queued: ${j.renderJobId}. Estimated credits: ${j.estimatedCredits}.`:`Render error: ${j.error}`);
      if(r.ok)setRenderJobId(j.renderJobId);
    }finally{setRenderBusy(false)}
  }

  return <AppShell><div className="content">
    <div className="eyebrow">VERTICAL VIDEO</div>
    <h1 className="title">Shorts, Reels &amp; TikTok Studio</h1>
    <p className="muted">A focused 9:16, 15-second workflow built on the same storyboard-to-render pipeline as Video Studio — tuned for hooks, captions and fast scroll-stopping openers.</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>Product</h3>
        <select className="search" value={productId} onChange={e=>setProductId(e.target.value)}>
          <option value="">Choose product</option>
          {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <p className="muted" style={{marginTop:10}}>No products yet? <a href="/products">Add one first</a>.</p>
      </div>

      <div className="card">
        <h3>Hook</h3>
        <div className="chips">
          {HOOK_TEMPLATES.map(h=>(
            <button className="chip" key={h} style={{color:hook===h?"#fff":"#9aa1b2"}} onClick={()=>setHook(h)}>{h}</button>
          ))}
        </div>
        <label style={{display:"block",marginTop:14}}>Custom hook
          <input value={hook} onChange={e=>setHook(e.target.value)} style={{width:"100%",marginTop:6,background:"#0b0d12",border:"1px solid #303645",borderRadius:11,padding:12,color:"#fff"}}/>
        </label>
      </div>

      <div className="card">
        <h3>Finishing</h3>
        <label>CTA<input value={cta} onChange={e=>setCta(e.target.value)}/></label>
        <label><input type="checkbox" checked={captions} onChange={e=>setCaptions(e.target.checked)}/> Auto captions (on by default for Shorts)</label>
        <button className="btn primary" disabled={!productId||busy} style={{marginTop:12}} onClick={create}>{busy?"Building…":"Create 15-second short"}</button>
      </div>
    </div>

    {msg&&<div className="notice" style={{marginTop:16}}>{msg}</div>}

    {projectId&&<div className="card" style={{marginTop:16}}>
      <h3>Render</h3>
      <p className="muted">Storyboard is saved — render when you're ready. The finished MP4 is stored privately with a short-lived download URL.</p>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button className="btn" disabled={renderBusy} onClick={render}>{renderBusy?"Queueing…":"Render short"}</button>
        <a className="btn" href={`/create/video/${projectId}/edit`}>Open in editor</a>
      </div>
      {renderJobId&&<RenderStatus renderJobId={renderJobId}/>}
    </div>}
  </div></AppShell>;
}
