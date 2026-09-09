import Link from "next/link";
import {PLANS,priceFor} from "@/lib/billing/plans";

export const metadata={title:"Pricing",description:"Simple, credit-based pricing for Picbo.ai — every plan includes every studio.",robots:{index:true,follow:true}};

export default function PricingPage(){
  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at 70% -10%,#8b7cff22,transparent 34%),#08090d",color:"#f6f7fb"}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 32px",maxWidth:1200,margin:"0 auto"}}>
      <Link href="/" style={{display:"flex",alignItems:"center",gap:10,fontWeight:800,fontSize:19,color:"#fff"}}>
        <span style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#8b7cff,#45d9c0)",display:"grid",placeItems:"center"}}>P</span>
        Picbo.ai
      </Link>
      <nav style={{display:"flex",gap:20,alignItems:"center",fontSize:14}}>
        <Link href="/auth/sign-in" style={{color:"#9aa1b2"}}>Sign in</Link>
        <Link href="/auth/sign-up" style={{background:"linear-gradient(135deg,#8b7cff,#6d5df0)",color:"#fff",padding:"10px 18px",borderRadius:11,fontWeight:700}}>Get started</Link>
      </nav>
    </header>

    <section style={{textAlign:"center",padding:"50px 24px 20px"}}>
      <h1 style={{fontSize:36,letterSpacing:-1}}>Simple, credit-based pricing</h1>
      <p style={{color:"#9aa1b2"}}>Every plan includes every studio. Upgrade for more monthly credits and higher render priority.</p>
    </section>

    <section style={{maxWidth:1100,margin:"0 auto",padding:"20px 24px 100px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
      {PLANS.map(plan=>(
        <div key={plan.id} style={{border:"1px solid #262b38",background:"linear-gradient(180deg,#12151d,#0f1117)",borderRadius:18,padding:22}}>
          <h3 style={{margin:"0 0 6px"}}>{plan.name}</h3>
          <div style={{fontSize:28,fontWeight:800}}>
            {priceFor(plan,"monthly")===0?"Free":`$${(priceFor(plan,"monthly")/100).toFixed(0)}`}
            {priceFor(plan,"monthly")>0&&<span style={{fontSize:13,color:"#9aa1b2",fontWeight:400}}>/mo</span>}
          </div>
          <p style={{color:"#9aa1b2",fontSize:13}}>{plan.creditsPerMonth.toLocaleString()} credits/mo</p>
          <ul style={{margin:"14px 0",paddingLeft:18,fontSize:13,color:"#aeb4c3",lineHeight:1.7}}>
            {plan.features.map(f=><li key={f}>{f}</li>)}
          </ul>
          <Link href="/auth/sign-up" style={{display:"block",textAlign:"center",background:plan.id==="free"?"#171a22":"linear-gradient(135deg,#8b7cff,#6d5df0)",color:"#fff",padding:"10px",borderRadius:11,fontWeight:700,marginTop:10}}>
            {plan.id==="free"?"Start free":"Get started"}
          </Link>
        </div>
      ))}
    </section>
  </main>;
}
