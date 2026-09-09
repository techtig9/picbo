"use client";
import {useState} from "react";
import Link from "next/link";
import {Sparkles,Plus,Package,FolderOpen,Megaphone,Camera,Image,Brush,Video,Users,Boxes,LayoutTemplate,BarChart3,Store,Code2,CreditCard,Settings,CircleHelp,Palette,Wand2} from "lucide-react";
import {NotificationBell} from "./NotificationBell";
import {signOut} from "@/app/auth/actions";

const groups:any[][]=[
  [["Dashboard","/dashboard",Sparkles],["Lumi Assistant","/lumi",Wand2],["Create","/create",Plus],["Products","/products",Package],["Projects","/projects",FolderOpen],["Campaigns","/campaigns",Megaphone]],
  [["Photoshoot","/create/photoshoot",Camera],["Image Studio","/create/image",Image],["Ad Studio","/create/ads",Brush],["Video Studio","/create/video",Video],["Shorts & Reels","/create/shorts",Video],["UGC & Avatars","/create/ugc",Users]],
  [["Assets","/assets",Boxes],["Brand Kits","/brand-kits",Palette],["Templates","/templates",LayoutTemplate],["Inspiration","/inspiration",Sparkles],["Analytics","/analytics",BarChart3],["Integrations","/integrations",Store]],
  [["Team & Agency","/team",Users],["Developer / API","/developer",Code2],["Billing","/billing",CreditCard],["Settings","/settings",Settings],["Help","/help",CircleHelp]]
];

export function AppShell({children}:{children:React.ReactNode}){
  const [navOpen,setNavOpen]=useState(false);

  return <div className="shell">
    {navOpen&&<div className="backdrop" onClick={()=>setNavOpen(false)} aria-hidden="true"/>}
    <aside className={`side${navOpen?" open":""}`}>
      <Link className="brand" href="/dashboard" onClick={()=>setNavOpen(false)}><span className="logo">P</span>Picbo.ai</Link>
      {groups.map((g,i)=>(
        <div key={i}>
          <div className="label">{["Main","Create","Manage","Workspace"][i]}</div>
          <nav className="nav">{g.map(([label,href,I])=><Link href={href} key={href} onClick={()=>setNavOpen(false)}><I size={16}/>{label}</Link>)}</nav>
        </div>
      ))}
      <div className="bottom" style={{paddingTop:16}}>
        <form action={signOut}><button className="btn" style={{width:"100%"}}>Sign out</button></form>
      </div>
    </aside>
    <main className="main">
      <header className="top">
        <button className="icon mobile" aria-label={navOpen?"Close navigation":"Open navigation"} aria-expanded={navOpen} onClick={()=>setNavOpen(o=>!o)}>☰</button>
        <input className="search" placeholder="Search products, projects, assets…  (⌘ K)" aria-label="Search"/>
        <div className="actions">
          <Link className="btn primary" href="/create">+ Create</Link>
          <NotificationBell/>
          <span className="avatar" aria-hidden="true">SA</span>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
