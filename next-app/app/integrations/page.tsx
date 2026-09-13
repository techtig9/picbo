import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {INTEGRATIONS} from "@/lib/integrations/registry";
import {disconnectIntegration} from "./actions";

const STATUS_LABEL:Record<string,string>={disconnected:"Disconnected",connecting:"Connecting…",connected:"Connected",error:"Error"};

export default async function Integrations({searchParams}:{searchParams:Promise<{error?:string;connected?:string}>}){
  const {error,connected}=await searchParams;
  const ws=await getCurrentWorkspace();
  const canManage=ws?.role==="owner"||ws?.role==="admin";
  const supabase=await createClient();
  const {data:connections}=await supabase.from("integration_connections").select("provider,status,external_account_label,last_error,connected_at").eq("workspace_id",ws!.workspace_id);
  const byProvider=new Map((connections||[]).map((c:any)=>[c.provider,c]));

  return <AppShell><div className="content">
    <div className="eyebrow">WORKSPACE</div>
    <h1 className="title">Integrations</h1>
    <p className="muted">Connect commerce, social and advertising accounts to publish and sync directly from Picbo.</p>

    {error&&<div className="notice" style={{marginTop:16}}>{error}</div>}
    {connected&&<div className="notice" style={{marginTop:16}}>Connected {connected}.</div>}

    <div className="grid three" style={{marginTop:16}}>
      {INTEGRATIONS.map(integration=>{
        const conn=byProvider.get(integration.id) as any;
        const status=conn?.status||"disconnected";
        return <div className="card" key={integration.id}>
          <h3>{integration.label}</h3>
          <span className="status">{STATUS_LABEL[status]||status}</span>
          {conn?.external_account_label&&<p className="muted" style={{marginTop:8}}>{conn.external_account_label}</p>}
          {status==="error"&&conn?.last_error&&<p className="muted">{conn.last_error}</p>}
          <div style={{marginTop:12}}>
            {!canManage?
              <p className="muted">Only owners/admins can manage integrations.</p>
            :status==="connected"?
              <form action={disconnectIntegration}>
                <input type="hidden" name="provider" value={integration.id}/>
                <button className="btn">Disconnect</button>
              </form>
            :integration.configured?
              <a className="btn primary" href={`/api/integrations/${integration.id}/connect`}>Connect</a>
            :
              <>
                <button className="btn" disabled>Connect</button>
                <p className="muted" style={{marginTop:8,fontSize:12}}>Not configured yet — needs API credentials for {integration.label}.</p>
              </>
            }
          </div>
        </div>;
      })}
    </div>
  </div></AppShell>;
}
