import {requirePlatformAdmin} from "@/lib/admin/guard";
import {createAdminClient} from "@/lib/supabase/admin";
import {PLANS} from "@/lib/billing/plans";

export default async function AdminDashboard(){
  await requirePlatformAdmin();
  const supabase=createAdminClient();

  const since7d=new Date(Date.now()-7*86400000).toISOString();
  const since30d=new Date(Date.now()-30*86400000).toISOString();

  const [
    {count:totalWorkspaces},
    {count:totalUsers},
    {data:subscriptions},
    {data:recentJobs},
    {count:jobs7d},
    {count:failedJobs7d},
    {data:attempts7d},
    {data:moderationFlags},
    {count:renderQueued},
    {count:renderProcessing},
    {count:renderDeadLetter24h},
    {data:healthHistory}
  ]=await Promise.all([
    supabase.from("workspaces").select("id",{count:"exact",head:true}),
    supabase.from("profiles").select("id",{count:"exact",head:true}),
    supabase.from("subscriptions").select("plan,billing_period,status").neq("plan","free"),
    supabase.from("ai_jobs").select("id,task,status,workspace_id,created_at,error_code").order("created_at",{ascending:false}).limit(20),
    supabase.from("ai_jobs").select("id",{count:"exact",head:true}).gte("created_at",since7d),
    supabase.from("ai_jobs").select("id",{count:"exact",head:true}).eq("status","failed").gte("created_at",since7d),
    supabase.from("ai_job_attempts").select("provider,status,cost_usd,created_at").gte("created_at",since30d),
    supabase.from("moderation_flags").select("id,task,category,reason,created_at").order("created_at",{ascending:false}).limit(10),
    supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","queued"),
    supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","processing"),
    supabase.from("render_jobs").select("id",{count:"exact",head:true}).eq("status","dead_letter").gte("created_at",since7d),
    supabase.from("system_health_events").select("service,status,metadata,created_at").order("created_at",{ascending:false}).limit(15)
  ]);

  const activeSubs=(subscriptions||[]).filter((s:any)=>s.status==="active");
  const mrrCents=activeSubs.reduce((sum:number,s:any)=>{
    const plan=PLANS.find(p=>p.id===s.plan);
    if(!plan)return sum;
    return sum+(s.billing_period==="annual"?Math.round(plan.annualPriceCents/12):plan.monthlyPriceCents);
  },0);
  const arrCents=mrrCents*12;

  const providerCounts:Record<string,number>={};
  const providerCost:Record<string,number>={};
  for(const a of (attempts7d||[]) as any[]){
    providerCounts[a.provider]=(providerCounts[a.provider]||0)+1;
    providerCost[a.provider]=(providerCost[a.provider]||0)+(Number(a.cost_usd)||0);
  }

  const failedRecent=(recentJobs||[]).filter((j:any)=>j.status==="failed");

  return <div style={{padding:"32px 40px",background:"#0b0d12",minHeight:"100vh",color:"#fff"}}>
    <div style={{fontSize:12,letterSpacing:1,color:"#8b7cff",textTransform:"uppercase"}}>Platform Admin</div>
    <h1 style={{fontSize:28,margin:"6px 0 20px"}}>Picbo.ai Operations</h1>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
      {[
        ["Workspaces",String(totalWorkspaces??0)],
        ["Users",String(totalUsers??0)],
        ["MRR",`$${(mrrCents/100).toLocaleString()}`],
        ["ARR",`$${(arrCents/100).toLocaleString()}`]
      ].map(([label,value])=>(
        <div key={label} style={{background:"#161923",border:"1px solid #262b38",borderRadius:14,padding:18}}>
          <div style={{fontSize:12,color:"#9aa1b2"}}>{label}</div>
          <div style={{fontSize:26,fontWeight:700,marginTop:6}}>{value}</div>
        </div>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:20}}>
      <div style={{background:"#161923",border:"1px solid #262b38",borderRadius:14,padding:18}}>
        <h3 style={{marginTop:0}}>Render queue</h3>
        <div style={{display:"flex",gap:24}}>
          <div><div style={{fontSize:22,fontWeight:700}}>{renderQueued??0}</div><div style={{color:"#9aa1b2",fontSize:12}}>Queued</div></div>
          <div><div style={{fontSize:22,fontWeight:700}}>{renderProcessing??0}</div><div style={{color:"#9aa1b2",fontSize:12}}>Processing</div></div>
          <div><div style={{fontSize:22,fontWeight:700}}>{renderDeadLetter24h??0}</div><div style={{color:"#9aa1b2",fontSize:12}}>Dead-lettered (7d)</div></div>
        </div>
        {((renderQueued||0)+(renderProcessing||0))>0&&<p style={{color:"#e2b93b",fontSize:12,marginTop:10}}>No render worker is deployed in this environment — queued/processing jobs will be swept to dead_letter (with refund) once they exceed the timeout. See PICBO_FINAL_REPORT.md.</p>}
      </div>
      <div style={{background:"#161923",border:"1px solid #262b38",borderRadius:14,padding:18}}>
        <h3 style={{marginTop:0}}>System health history</h3>
        {(!healthHistory||healthHistory.length===0)?
          <p style={{color:"#9aa1b2"}}>No history yet — call <code>/api/health/check</code> with the render-worker secret (e.g. from a cron) to start recording snapshots.</p>
        :
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:140,overflowY:"auto"}}>
            {healthHistory.map((h:any,i:number)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:h.status==="ok"?"#6fe2cc":h.status==="degraded"?"#e2b93b":"#ff8a8a"}}>{h.service}: {h.status}</span>
                <span style={{color:"#9aa1b2"}}>{new Date(h.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        }
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:20}}>
      <div style={{background:"#161923",border:"1px solid #262b38",borderRadius:14,padding:18}}>
        <h3 style={{marginTop:0}}>Generation volume (7d)</h3>
        <div style={{fontSize:26,fontWeight:700}}>{jobs7d??0}</div>
        <p style={{color:"#9aa1b2",fontSize:13}}>{failedJobs7d??0} failed ({jobs7d?(((failedJobs7d||0)/jobs7d)*100).toFixed(1):"0"}%)</p>
      </div>
      <div style={{background:"#161923",border:"1px solid #262b38",borderRadius:14,padding:18}}>
        <h3 style={{marginTop:0}}>Provider usage &amp; cost (30d)</h3>
        {Object.keys(providerCounts).length===0?<p style={{color:"#9aa1b2"}}>No activity yet.</p>:
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {Object.entries(providerCounts).map(([p,c])=>(
              <div key={p} style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span style={{color:"#9aa1b2"}}>{p}</span>
                <span>{c} calls · ${(providerCost[p]||0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        }
      </div>
    </div>

    <div style={{marginTop:20,background:"#161923",border:"1px solid #262b38",borderRadius:14,padding:18}}>
      <h3 style={{marginTop:0}}>Moderation — recently blocked prompts</h3>
      {(!moderationFlags||moderationFlags.length===0)?<p style={{color:"#9aa1b2"}}>No blocked prompts.</p>:
        <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
          <thead><tr style={{color:"#9aa1b2",textAlign:"left"}}><th style={{padding:"6px 0"}}>Task</th><th>Category</th><th>Reason</th><th>When</th></tr></thead>
          <tbody>
            {moderationFlags.map((m:any)=>(
              <tr key={m.id} style={{borderTop:"1px solid #262b38"}}>
                <td style={{padding:"6px 0"}}>{m.task||"—"}</td>
                <td>{m.category||"—"}</td>
                <td>{m.reason||"—"}</td>
                <td>{new Date(m.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </div>

    <div style={{marginTop:20,background:"#161923",border:"1px solid #262b38",borderRadius:14,padding:18}}>
      <h3 style={{marginTop:0}}>Needs attention — recent failures</h3>
      {failedRecent.length===0?<p style={{color:"#9aa1b2"}}>No recent failures across any workspace.</p>:
        <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
          <thead><tr style={{color:"#9aa1b2",textAlign:"left"}}><th style={{padding:"6px 0"}}>Task</th><th>Error</th><th>Workspace</th><th>When</th></tr></thead>
          <tbody>
            {failedRecent.map((j:any)=>(
              <tr key={j.id} style={{borderTop:"1px solid #262b38"}}>
                <td style={{padding:"6px 0"}}>{j.task}</td>
                <td>{j.error_code||"—"}</td>
                <td style={{fontFamily:"monospace",fontSize:11}}>{j.workspace_id.slice(0,8)}</td>
                <td>{new Date(j.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </div>
  </div>;
}
