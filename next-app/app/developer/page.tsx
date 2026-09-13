import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {CreateKeyForm} from "./CreateKeyForm";
import {revokeApiKey} from "./actions";

export default async function Developer(){
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const canManage=ws?.role==="owner"||ws?.role==="admin";

  const {data:keys}=await supabase.from("api_keys").select("id,name,key_prefix,created_at,last_used_at,revoked_at").eq("workspace_id",ws!.workspace_id).order("created_at",{ascending:false});

  const activeKeyIds=(keys||[]).filter((k:any)=>!k.revoked_at).map((k:any)=>k.id);
  const {data:recentRequests}=activeKeyIds.length
    ?await supabase.from("api_request_logs").select("method,path,status_code,created_at").in("api_key_id",activeKeyIds).order("created_at",{ascending:false}).limit(15)
    :{data:[]};

  return <AppShell><div className="content">
    <div className="eyebrow">DEVELOPER PLATFORM</div>
    <h1 className="title">Developer / API</h1>
    <p className="muted">Programmatic access to your workspace's products and generations.</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>API keys</h3>
        {canManage?
          <CreateKeyForm/>
        :
          <p className="muted">Only workspace owners and admins can create or revoke API keys.</p>
        }
        <div style={{marginTop:16}}>
          {(!keys||keys.length===0)?
            <p className="muted">No API keys yet.</p>
          :
            <table className="table">
              <thead><tr><th>Name</th><th>Key</th><th>Last used</th><th></th></tr></thead>
              <tbody>
                {keys.map((k:any)=>(
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td style={{fontFamily:"monospace",fontSize:12}}>{k.key_prefix}…</td>
                    <td>{k.last_used_at?new Date(k.last_used_at).toLocaleDateString():"Never"}</td>
                    <td>
                      {k.revoked_at?
                        <span className="status">Revoked</span>
                      :canManage&&(
                        <form action={revokeApiKey}>
                          <input type="hidden" name="id" value={k.id}/>
                          <button className="btn" style={{padding:"4px 10px",fontSize:12}}>Revoke</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>

      <div className="card">
        <h3>Quick start</h3>
        <p className="muted">Authenticate with a bearer token:</p>
        <pre style={{background:"#0b0d12",padding:12,borderRadius:10,fontSize:11,overflowX:"auto"}}>{`curl https://picbo.ai/api/v1/products \\
  -H "Authorization: Bearer pk_live_..."`}</pre>
        <p className="muted" style={{marginTop:10}}>Returns your workspace's products as JSON. Rate limit: 60 requests/minute per key.</p>
        <h3 style={{marginTop:16}}>Endpoints</h3>
        <div className="chips">
          <span className="chip">GET /api/v1/products</span>
        </div>
        <p className="muted" style={{marginTop:8}}>More endpoints (projects, generations, render status) follow the same auth pattern — see lib/developer/verify-request.ts.</p>
      </div>

      <div className="card">
        <h3>Recent API requests</h3>
        {(!recentRequests||recentRequests.length===0)?
          <p className="muted">No requests yet.</p>
        :
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {recentRequests.map((r:any,i:number)=>(
              <div key={i} className="muted" style={{fontSize:12,display:"flex",justifyContent:"space-between"}}>
                <span>{r.method} {r.path}</span>
                <span>{r.status_code} · {new Date(r.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  </div></AppShell>;
}
