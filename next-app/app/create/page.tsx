"use client";
import {useState} from "react";
import {AppShell} from "@/components/app-shell";
import Link from "next/link";

export default function CreativeDirector(){
  const [description,setDescription]=useState("");
  const [busy,setBusy]=useState(false);
  const [plan,setPlan]=useState<any>(null);
  const [copySource,setCopySource]=useState<"ai"|"template"|null>(null);
  const [msg,setMsg]=useState("");

  async function generate(){
    if(!description.trim())return;
    setBusy(true);setMsg("");setPlan(null);
    try{
      const r=await fetch("/api/creative/ai/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        name:description.split(".")[0].slice(0,60)||"Product",
        description
      })});
      const j=await r.json();
      if(r.ok){setPlan(j.plan);setCopySource(j.copySource)}
      else setMsg(`Error: ${j.error}`);
    }catch(e:any){setMsg(e.message)}finally{setBusy(false)}
  }

  return <AppShell><div className="content">
    <div className="eyebrow">WORKSPACE</div>
    <h1 className="title">AI Creative Director</h1>
    <p className="muted">Describe what you want to launch — get a shot list and ad copy, then jump into the right studio to produce it.</p>

    <div style={{marginTop:22}}>
      <div className="hero">
        <div className="eyebrow">ONE INPUT → COMPLETE WORKFLOW</div>
        <h2>Tell Picbo what you want to launch.</h2>
        <p className="muted">Describe the product and goal — the Creative Director drafts a shot list and copy, then you pick the studio to execute it in.</p>
        <textarea
          value={description}
          onChange={e=>setDescription(e.target.value)}
          placeholder="Create a premium product launch campaign for my new skincare bottle…"
        />
        <div className="chips">
          <button className="btn primary" disabled={!description.trim()||busy} onClick={generate}>{busy?"Thinking…":"Generate plan"}</button>
          <Link className="chip" href="/create/photoshoot">Product → Photoshoot</Link>
          <Link className="chip" href="/create/ads">Product → Ads</Link>
          <Link className="chip" href="/create/video">Product → 15-sec video</Link>
          <Link className="chip" href="/create/shorts">Product → Shorts</Link>
        </div>
      </div>
    </div>

    {msg&&<div className="notice" style={{marginTop:16}}>{msg}</div>}

    {plan&&<div className="grid three" style={{marginTop:16}}>
      <div className="card">
        <h3>Copy {copySource==="template"&&<span className="status" style={{marginLeft:8}}>Template fallback</span>}</h3>
        <p className="muted"><strong>{plan.copy.hook}</strong></p>
        <p className="muted">{plan.copy.headline}</p>
        <p className="muted">{plan.copy.body}</p>
        <p className="muted">CTA: {plan.copy.cta}</p>
        {copySource==="template"&&<p className="muted" style={{marginTop:8}}>No AI provider is configured yet, so this is a starter template — connect Groq, Cerebras, OpenRouter or Claude for real AI-written copy.</p>}
      </div>
      <div className="card">
        <h3>Shot list</h3>
        <div className="chips">
          {plan.shots.map((s:any)=><span className="chip" key={s.id}>{s.purpose}: {s.camera}/{s.motion}</span>)}
        </div>
      </div>
      <div className="card">
        <h3>Next step</h3>
        <p className="muted">Pick a product in Photoshoot, Ads or Video Studio and use this brief as your starting point.</p>
        <div className="chips">
          <Link className="btn" href="/create/photoshoot">Open Photoshoot</Link>
          <Link className="btn" href="/create/ads">Open Ad Studio</Link>
        </div>
      </div>
    </div>}
  </div></AppShell>;
}
