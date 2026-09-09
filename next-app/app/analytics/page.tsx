import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {rangeSince,bucketByDay,groupCount,avgBy} from "@/lib/analytics";
import {BarChart} from "@/components/analytics/BarChart";
import Link from "next/link";

const RANGES=[["7d","7 days"],["30d","30 days"],["90d","90 days"]] as const;

export default async function Analytics({searchParams}:{searchParams:Promise<{range?:string}>}){
  const {range="30d"}=await searchParams;
  const {since,days}=rangeSince(range);
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  const {data:jobs}=await supabase.from("ai_jobs")
    .select("id,task,status,created_at")
    .eq("workspace_id",ws!.workspace_id)
    .gte("created_at",since.toISOString());

  const jobIds=(jobs||[]).map((j:any)=>j.id);
  const {data:attempts}=jobIds.length
    ?await supabase.from("ai_job_attempts").select("provider,status,cost_usd,latency_ms,job_id").in("job_id",jobIds)
    :{data:[]};

  const {data:ledger}=await supabase.from("credit_ledger")
    .select("amount,created_at")
    .eq("workspace_id",ws!.workspace_id)
    .eq("type","charge")
    .gte("created_at",since.toISOString());

  const {data:renders}=await supabase.from("render_jobs")
    .select("status,started_at,completed_at,created_at")
    .eq("workspace_id",ws!.workspace_id)
    .gte("created_at",since.toISOString());

  const volumeByDay=bucketByDay((jobs||[]).map((j:any)=>({created_at:j.created_at})),days);
  const spendByDay=bucketByDay((ledger||[]).map((l:any)=>({created_at:l.created_at,value:Math.abs(l.amount)})),days);

  const totalJobs=(jobs||[]).length;
  const completedJobs=(jobs||[]).filter((j:any)=>j.status==="completed").length;
  const failedJobs=(jobs||[]).filter((j:any)=>j.status==="failed").length;
  const successRate=totalJobs?((completedJobs/totalJobs)*100).toFixed(1):"—";
  const failureRate=totalJobs?((failedJobs/totalJobs)*100).toFixed(1):"—";

  const providerCounts=groupCount(attempts||[],"provider");
  const totalCostUsd=(attempts||[]).reduce((n:number,a:any)=>n+(Number(a.cost_usd)||0),0);
  const avgLatencyByProvider=Object.keys(providerCounts).map(p=>({
    provider:p,
    avgMs:Math.round(avgBy((attempts||[]) as any[],"latency_ms",(a:any)=>a.provider===p))
  }));

  const completedRenders=(renders||[]).filter((r:any)=>r.completed_at&&r.started_at);
  const avgRenderMs=completedRenders.length
    ?completedRenders.reduce((n:number,r:any)=>n+(new Date(r.completed_at).getTime()-new Date(r.started_at).getTime()),0)/completedRenders.length
    :0;

  return <AppShell><div className="content">
    <div className="eyebrow">WORKSPACE</div>
    <h1 className="title">Analytics &amp; AI Optimization</h1>
    <p className="muted">Real generation, provider and spend data for this workspace — nothing here is simulated.</p>

    <div className="chips" style={{marginTop:16}}>
      {RANGES.map(([id,label])=><Link key={id} className="chip" href={`/analytics?range=${id}`} style={{color:range===id?"#fff":"#9aa1b2"}}>{label}</Link>)}
      <a className="chip" href={`/api/analytics/export?range=${range}`}>Export CSV</a>
    </div>

    <div className="grid four" style={{marginTop:16}}>
      <div className="card"><span className="muted">Generations</span><div className="metric">{totalJobs}</div></div>
      <div className="card"><span className="muted">Success rate</span><div className="metric">{successRate}{totalJobs?"%":""}</div></div>
      <div className="card"><span className="muted">Failure rate</span><div className="metric">{failureRate}{totalJobs?"%":""}</div></div>
      <div className="card"><span className="muted">AI cost</span><div className="metric">${totalCostUsd.toFixed(2)}</div></div>
    </div>

    <div className="grid three" style={{marginTop:16}}>
      <div className="card" style={{gridColumn:"span 2"}}>
        <h3>Generation volume</h3>
        <BarChart data={volumeByDay}/>
      </div>
      <div className="card">
        <h3>Provider usage</h3>
        {Object.keys(providerCounts).length===0?<p className="muted">No AI activity in this range yet.</p>:
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {Object.entries(providerCounts).map(([p,c])=>(
              <div key={p} style={{display:"flex",justifyContent:"space-between"}}>
                <span className="muted">{p}</span><span>{c}</span>
              </div>
            ))}
          </div>
        }
      </div>
    </div>

    <div className="grid three" style={{marginTop:16}}>
      <div className="card" style={{gridColumn:"span 2"}}>
        <h3>Credit consumption</h3>
        <BarChart data={spendByDay} color="#45d9c0"/>
      </div>
      <div className="card">
        <h3>Provider latency</h3>
        {avgLatencyByProvider.length===0?<p className="muted">No data yet.</p>:
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {avgLatencyByProvider.map(p=>(
              <div key={p.provider} style={{display:"flex",justifyContent:"space-between"}}>
                <span className="muted">{p.provider}</span><span>{p.avgMs}ms</span>
              </div>
            ))}
          </div>
        }
        <h3 style={{marginTop:16}}>Avg render time</h3>
        <div className="metric">{avgRenderMs?`${(avgRenderMs/1000).toFixed(1)}s`:"—"}</div>
      </div>
    </div>
  </div></AppShell>;
}
