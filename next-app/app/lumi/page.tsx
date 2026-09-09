"use client";
import {useState,useRef,useEffect} from "react";
import {AppShell} from "@/components/app-shell";
import Link from "next/link";

interface Message{role:"user"|"assistant";content:string;actions?:{label:string;href:string}[]}

export default function Lumi(){
  const [messages,setMessages]=useState<Message[]>([
    {role:"assistant",content:"Hi, I'm Lumi. Ask me what to create, how credits work, or where to find something — I can point you to the right studio."}
  ]);
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const endRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[messages]);

  async function send(){
    const text=input.trim();
    if(!text||busy)return;
    setError("");
    const next=[...messages,{role:"user" as const,content:text}];
    setMessages(next);
    setInput("");
    setBusy(true);
    try{
      const r=await fetch("/api/lumi/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content}))})});
      const j=await r.json();
      if(r.ok)setMessages(m=>[...m,{role:"assistant",content:j.reply,actions:j.actions}]);
      else setError(j.error);
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  return <AppShell><div className="content">
    <div className="eyebrow">AI ASSISTANT</div>
    <h1 className="title">Lumi</h1>
    <p className="muted">Context-aware help powered by the same AI router as the rest of Picbo — not a scripted bot.</p>

    <div className="card" style={{marginTop:22,maxWidth:720,display:"flex",flexDirection:"column",height:520}}>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14,paddingRight:4}}>
        {messages.map((m,i)=>(
          <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"80%"}}>
            <div style={{
              background:m.role==="user"?"var(--accent)":"#161923",
              color:m.role==="user"?"#fff":"var(--text)",
              borderRadius:12,padding:"10px 14px",fontSize:14
            }}>{m.content}</div>
            {m.actions&&m.actions.length>0&&<div className="chips" style={{marginTop:8}}>
              {m.actions.map(a=><Link key={a.href} className="chip" href={a.href}>{a.label}</Link>)}
            </div>}
          </div>
        ))}
        {busy&&<div className="muted" style={{fontSize:13}}>Lumi is thinking…</div>}
        <div ref={endRef}/>
      </div>
      {error&&<div className="notice" style={{marginTop:10}}>{error}</div>}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")send()}}
          placeholder="Ask Lumi anything about your workspace…"
          style={{flex:1,background:"#0b0d12",border:"1px solid var(--line)",borderRadius:11,padding:12,color:"#fff"}}
        />
        <button className="btn primary" onClick={send} disabled={busy||!input.trim()}>Send</button>
      </div>
    </div>
  </div></AppShell>;
}
