"use client";
import {useEffect,useRef,useState} from "react";
import {Bell} from "lucide-react";
import Link from "next/link";

interface Notification{id:string;type:string;title:string;body?:string;link?:string;read_at?:string|null;created_at:string}

export function NotificationBell(){
  const [open,setOpen]=useState(false);
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const ref=useRef<HTMLDivElement>(null);

  async function load(){
    try{
      const r=await fetch("/api/notifications");
      const j=await r.json();
      if(r.ok){setNotifications(j.notifications||[]);setUnreadCount(j.unreadCount||0)}
    }catch{ /* non-critical, leave stale state */ }
  }

  useEffect(()=>{
    load();
    const interval=setInterval(load,30000);
    return ()=>clearInterval(interval);
  },[]);

  useEffect(()=>{
    function onClickOutside(e:MouseEvent){if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)}
    document.addEventListener("mousedown",onClickOutside);
    return ()=>document.removeEventListener("mousedown",onClickOutside);
  },[]);

  async function markAllRead(){
    await fetch("/api/notifications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({markAllRead:true})});
    load();
  }

  async function markRead(id:string){
    await fetch("/api/notifications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})});
    load();
  }

  return <div ref={ref} style={{position:"relative"}}>
    <button className="icon" aria-label={`Notifications${unreadCount>0?` (${unreadCount} unread)`:""}`} onClick={()=>setOpen(o=>!o)} style={{position:"relative"}}>
      <Bell size={17}/>
      {unreadCount>0&&<span style={{position:"absolute",top:2,right:2,width:8,height:8,borderRadius:"50%",background:"var(--accent)"}}/>}
    </button>
    {open&&<div role="menu" style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:320,maxHeight:400,overflowY:"auto",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:14,boxShadow:"0 20px 60px #0008",zIndex:50}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderBottom:"1px solid var(--line)"}}>
        <strong style={{fontSize:13}}>Notifications</strong>
        {unreadCount>0&&<button className="btn" style={{padding:"3px 8px",fontSize:11}} onClick={markAllRead}>Mark all read</button>}
      </div>
      {notifications.length===0?
        <p className="muted" style={{padding:14,fontSize:13}}>Nothing yet — you'll see render results and alerts here.</p>
      :
        notifications.map(n=>(
          <Link key={n.id} href={n.link||"#"} onClick={()=>!n.read_at&&markRead(n.id)}
           style={{display:"block",padding:"10px 14px",borderBottom:"1px solid var(--line)",background:n.read_at?"transparent":"#1b1e2833"}}>
            <div style={{fontSize:13,fontWeight:n.read_at?400:700}}>{n.title}</div>
            {n.body&&<div className="muted" style={{fontSize:12,marginTop:2}}>{n.body}</div>}
            <div className="muted" style={{fontSize:11,marginTop:4}}>{new Date(n.created_at).toLocaleString()}</div>
          </Link>
        ))
      }
    </div>}
  </div>;
}
