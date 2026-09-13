import Link from "next/link";

export default function NotFound(){
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"radial-gradient(circle at 70% -10%,#8b7cff22,transparent 34%),#08090d",color:"#f6f7fb",padding:24}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:1,color:"#8b7cff",textTransform:"uppercase"}}>404</div>
      <h1 style={{fontSize:32,margin:"12px 0"}}>Page not found</h1>
      <p style={{color:"#9aa1b2",marginBottom:24}}>The page you're looking for doesn't exist or may have moved.</p>
      <Link href="/dashboard" style={{background:"linear-gradient(135deg,#8b7cff,#6d5df0)",color:"#fff",padding:"12px 24px",borderRadius:11,fontWeight:700}}>Back to dashboard</Link>
    </div>
  </main>;
}
