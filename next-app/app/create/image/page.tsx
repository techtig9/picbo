"use client";
import {useState} from "react";
import {AppShell} from "@/components/app-shell";

const IMAGE_MODES=["generate","edit","outpaint","background_remove","upscale"] as const;
type ImageMode=typeof IMAGE_MODES[number];
const MODE_LABEL:Record<ImageMode,string>={generate:"Generate",edit:"Edit / Inpaint",outpaint:"Outpaint",background_remove:"Remove background",upscale:"Upscale"};
const NEEDS_SOURCE_IMAGE=new Set<ImageMode>(["edit","outpaint","background_remove","upscale"]);
const TASK_FOR_MODE:Record<ImageMode,string>={generate:"image",edit:"image_edit",outpaint:"image_edit",background_remove:"background_remove",upscale:"upscale"};

export default function ImageStudio(){
  const [prompt,setPrompt]=useState("");
  const [ratio,setRatio]=useState("1:1");
  const [mode,setMode]=useState<ImageMode>("generate");
  const [sourceImageUrl,setSourceImageUrl]=useState("");
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);

  async function run(){
    setBusy(true);setMsg("Submitting image job…");
    try{
      const r=await fetch("/api/ai/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        task:TASK_FOR_MODE[mode],quality:"balanced",prompt,aspectRatio:ratio,
        imageUrls:NEEDS_SOURCE_IMAGE.has(mode)&&sourceImageUrl?[sourceImageUrl]:undefined,
        creditCost:1,metadata:{idempotencyKey:crypto.randomUUID(),mode}
      })});
      const j=await r.json();
      setMsg(r.ok?`Job ${j.jobId} completed. Results are returned by the configured provider.`:`Error: ${j.error}`);
    }catch(e:any){setMsg(e.message)}finally{setBusy(false)}
  }

  const ready=mode==="generate"?prompt.trim().length>0:sourceImageUrl.trim().length>0;

  return <AppShell><div className="content">
    <div className="eyebrow">AI IMAGE ENGINE</div>
    <h1 className="title">Image Studio</h1>
    <p className="muted">Generate, edit, remove backgrounds and build production-ready creative variants.</p>

    <div className="chips">
      {IMAGE_MODES.map(m=><button key={m} className="chip" style={{color:mode===m?"#fff":"#9aa1b2"}} onClick={()=>setMode(m)}>{MODE_LABEL[m]}</button>)}
    </div>

    <div className="hero">
      {NEEDS_SOURCE_IMAGE.has(mode)&&
        <label style={{display:"block",marginBottom:12}}>
          Source image URL (from Assets — right-click an image there to copy its link)
          <input value={sourceImageUrl} onChange={e=>setSourceImageUrl(e.target.value)} placeholder="https://…" style={{width:"100%",marginTop:6,background:"#0b0d12",border:"1px solid #303645",borderRadius:11,padding:12,color:"#fff"}}/>
        </label>
      }
      {(mode==="generate"||mode==="edit"||mode==="outpaint")&&
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Premium studio product image, soft shadows, luxury editorial lighting…"/>
      }
      <div className="chips">
        {mode==="generate"&&["1:1","4:5","3:4","9:16","16:9"].map(x=><button className="chip" style={{color:ratio===x?"#fff":"#9aa1b2"}} onClick={()=>setRatio(x)} key={x}>{x}</button>)}
        <button className="btn primary" disabled={!ready||busy} onClick={run}>{busy?"Working…":MODE_LABEL[mode]}</button>
      </div>
      {msg&&<div className="notice">{msg}</div>}
    </div>

    <div className="grid three" style={{marginTop:16}}>
      <div className="card"><h3>Product fidelity</h3><p className="muted">Logo, packaging, text, shape, colors and proportions are protected when a Product Identity is attached.</p></div>
      <div className="card"><h3>Variations</h3><p className="muted">The generation architecture supports repeatable variants and version lineage.</p></div>
      <div className="card"><h3>Production pipeline</h3><p className="muted">AI job → provider → validation → asset → version → project.</p></div>
    </div>
  </div></AppShell>;
}
