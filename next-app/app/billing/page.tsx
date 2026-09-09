import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {PLANS,priceFor} from "@/lib/billing/plans";
import {getPaymentProvider} from "@/lib/billing/payment-provider";
import {getWorkspaceStorageUsage} from "@/lib/storage/quota";
import {UpgradeButton} from "./UpgradeButton";
import {cancelSubscription} from "./actions";

export default async function Billing({searchParams}:{searchParams:Promise<{period?:string}>}){
  const {period:periodParam}=await searchParams;
  const period=periodParam==="annual"?"annual":"monthly";
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const provider=getPaymentProvider();

  const [{data:subscription},{data:credits},{data:payments}]=await Promise.all([
    supabase.from("subscriptions").select("plan,billing_period,status,current_period_end,cancel_at_period_end").eq("workspace_id",ws!.workspace_id).maybeSingle(),
    supabase.from("workspace_credits").select("balance,lifetime_used,monthly_limit").eq("workspace_id",ws!.workspace_id).maybeSingle(),
    supabase.from("payment_events").select("id,type,amount_cents,currency,status,created_at").eq("workspace_id",ws!.workspace_id).order("created_at",{ascending:false}).limit(10)
  ]);
  const storage=await getWorkspaceStorageUsage(ws!.workspace_id);

  const currentPlan=subscription?.plan||"free";

  return <AppShell><div className="content">
    <div className="eyebrow">WORKSPACE</div>
    <h1 className="title">Billing &amp; Credits</h1>
    <p className="muted">Your current plan, credit balance and payment history.</p>

    {!provider.configured&&<div className="notice" style={{marginTop:16}}>
      No payment provider is connected yet (Paddle isn't configured in this environment) — plans and credits below are real, but upgrading won't process a payment until that's connected.
    </div>}

    <div className="grid four" style={{marginTop:16}}>
      <div className="card">
        <span className="muted">Current plan</span>
        <div className="metric" style={{textTransform:"capitalize"}}>{currentPlan}</div>
        {subscription?.status&&<span className="status">{subscription.status}</span>}
        {subscription?.cancel_at_period_end&&<p className="muted" style={{marginTop:8}}>Cancels at end of billing period.</p>}
      </div>
      <div className="card">
        <span className="muted">Credit balance</span>
        <div className="metric">{credits?.balance??0}</div>
        <p className="muted">{credits?.lifetime_used??0} used all-time</p>
      </div>
      <div className="card">
        <span className="muted">Storage</span>
        <div className="metric">{(storage.usedBytes/1024/1024/1024).toFixed(2)}GB</div>
        <p className="muted">of {(storage.quotaBytes/1024/1024/1024).toFixed(0)}GB on the {storage.plan} plan</p>
      </div>
      <div className="card">
        <span className="muted">Manage</span>
        {currentPlan!=="free"&&!subscription?.cancel_at_period_end&&
          <form action={cancelSubscription} style={{marginTop:10}}>
            <button className="btn">Cancel subscription</button>
          </form>
        }
        {currentPlan==="free"&&<p className="muted">You're on the Free plan — upgrade below anytime.</p>}
      </div>
    </div>

    <div className="head" style={{marginTop:22}}>
      <h2>Plans</h2>
      <div className="chips">
        <a className={`chip`} href="/billing?period=monthly" style={{color:period==="monthly"?"#fff":"#9aa1b2"}}>Monthly</a>
        <a className={`chip`} href="/billing?period=annual" style={{color:period==="annual"?"#fff":"#9aa1b2"}}>Annual (save ~17%)</a>
      </div>
    </div>
    <div className="grid four">
      {PLANS.map(plan=>{
        const price=priceFor(plan,period);
        const isCurrent=plan.id===currentPlan;
        return <div className="card" key={plan.id}>
          <h3>{plan.name}</h3>
          <div className="metric">{price===0?"Free":`$${(price/100).toFixed(0)}`}{price>0&&<span className="muted" style={{fontSize:12}}>/mo</span>}</div>
          <p className="muted">{plan.creditsPerMonth.toLocaleString()} credits/mo</p>
          <ul style={{margin:"10px 0",paddingLeft:18,fontSize:13,color:"var(--muted)"}}>
            {plan.features.map(f=><li key={f}>{f}</li>)}
          </ul>
          {isCurrent?
            <span className="status">Current plan</span>
          :plan.id==="free"?
            <span className="muted">Downgrade via support</span>
          :
            <UpgradeButton planId={plan.id} period={period} label={`Upgrade to ${plan.name}`}/>
          }
        </div>;
      })}
    </div>

    <div className="head" style={{marginTop:22}}><h2>Payment history</h2></div>
    <div className="card">
      {(!payments||payments.length===0)?
        <p className="muted">No payments yet.</p>
      :
        <table className="table">
          <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {payments.map((p:any)=>(
              <tr key={p.id}>
                <td>{p.type}</td>
                <td>{p.amount_cents?`$${(p.amount_cents/100).toFixed(2)} ${(p.currency||"usd").toUpperCase()}`:"—"}</td>
                <td><span className="status">{p.status}</span></td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </div>
  </div></AppShell>;
}
