import {redirect} from "next/navigation";
import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import type {Metadata} from "next";

export const metadata:Metadata={
  title:"Picbo.ai — AI Product-to-Advertising Platform",
  description:"Turn a single product photo into photoshoots, ads, video and Shorts with AI.",
  robots:{index:true,follow:true}
};

const FEATURES=[
  ["Photoshoot Studio","Turn one product photo into a full studio shot list with consistent lighting and composition."],
  ["Product Identity","Upload reference photos once — logo, packaging, shape and color are protected in every generation after."],
  ["Ad Studio","Platform-specific ad concepts and copy for Meta, TikTok, Google and more, from a single brief."],
  ["Video & Shorts","15-second product ads and vertical Shorts, storyboarded and rendered from the same pipeline."],
  ["Brand Kits","Colors, fonts and voice, reusable across every studio so output stays on-brand automatically."],
  ["Lumi Assistant","A context-aware AI assistant that knows your workspace, not a scripted chatbot."]
];

export default async function Home(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(user)redirect("/dashboard");

  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at 70% -10%,#8b7cff22,transparent 34%),#08090d",color:"#f6f7fb"}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 32px",maxWidth:1200,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,fontWeight:800,fontSize:19}}>
        <span style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#8b7cff,#45d9c0)",display:"grid",placeItems:"center"}}>P</span>
        Picbo.ai
      </div>
      <nav style={{display:"flex",gap:20,alignItems:"center",fontSize:14}}>
        <Link href="/pricing" style={{color:"#9aa1b2"}}>Pricing</Link>
        <Link href="/auth/sign-in" style={{color:"#9aa1b2"}}>Sign in</Link>
        <Link href="/auth/sign-up" style={{background:"linear-gradient(135deg,#8b7cff,#6d5df0)",color:"#fff",padding:"10px 18px",borderRadius:11,fontWeight:700}}>Get started</Link>
      </nav>
    </header>

    <section style={{textAlign:"center",padding:"80px 24px 60px",maxWidth:800,margin:"0 auto"}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:1,color:"#8b7cff",textTransform:"uppercase"}}>AI Product-to-Advertising Platform</div>
      <h1 style={{fontSize:48,letterSpacing:-1.5,margin:"16px 0",lineHeight:1.1}}>Turn one product photo into a full campaign.</h1>
      <p style={{color:"#9aa1b2",fontSize:17,lineHeight:1.6}}>Photoshoots, ad copy, 15-second videos and Shorts — generated from a single product, with consistent identity across every output.</p>
      <div style={{marginTop:28,display:"flex",gap:12,justifyContent:"center"}}>
        <Link href="/auth/sign-up" style={{background:"linear-gradient(135deg,#8b7cff,#6d5df0)",color:"#fff",padding:"14px 26px",borderRadius:12,fontWeight:700}}>Start creating free</Link>
        <Link href="/pricing" style={{border:"1px solid #262b38",padding:"14px 26px",borderRadius:12,fontWeight:700,color:"#fff"}}>View pricing</Link>
      </div>
    </section>

    <section style={{maxWidth:1100,margin:"0 auto",padding:"20px 24px 100px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
      {FEATURES.map(([title,desc])=>(
        <div key={title} style={{border:"1px solid #262b38",background:"linear-gradient(180deg,#12151d,#0f1117)",borderRadius:18,padding:22}}>
          <h3 style={{margin:"0 0 8px",fontSize:16}}>{title}</h3>
          <p style={{color:"#9aa1b2",fontSize:13,lineHeight:1.5,margin:0}}>{desc}</p>
        </div>
      ))}
    </section>
  </main>;
}
