import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import Link from "next/link";
import {createCampaign,duplicateCampaign,archiveCampaign} from "./actions";

const STATUS_LABEL:Record<string,string>={draft:"Draft",active:"Active",paused:"Paused",archived:"Archived"};

export default async function Campaigns(){
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const [{data:campaigns},{data:products}]=await Promise.all([
    supabase.from("campaigns").select("id,name,objective,status,budget_cents,created_at,products(name)").eq("workspace_id",ws!.workspace_id).order("created_at",{ascending:false}),
    supabase.from("products").select("id,name").eq("workspace_id",ws!.workspace_id).order("name")
  ]);

  return <AppShell><div className="content">
    <div className="eyebrow">PERFORMANCE MARKETING</div>
    <h1 className="title">Campaigns</h1>
    <p className="muted">Group ad variants under a budget, audience and objective — track status from draft to archived.</p>

    <div className="card" style={{marginTop:22,maxWidth:520}}>
      <h3>New campaign</h3>
      {(!products||products.length===0)?
        <p className="muted">Add a product first before creating a campaign.</p>
      :
        <form action={createCampaign} className="form">
          <label>Name<input name="name" required placeholder="e.g. Autumn Skincare Push"/></label>
          <label>Product
            <select name="productId" required defaultValue="">
              <option value="" disabled>Choose a product…</option>
              {products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Objective<input name="objective" required placeholder="e.g. sales, awareness, leads"/></label>
          <label>Audience<input name="audience" placeholder="Who this campaign targets"/></label>
          <label>Budget (USD, optional)<input name="budget" type="number" min="0" step="1"/></label>
          <button className="btn primary">Create campaign</button>
        </form>
      }
    </div>

    <div className="head"><h2>Your campaigns</h2><span className="muted">{campaigns?.length||0} campaigns</span></div>
    {(!campaigns||campaigns.length===0)?
      <div className="card"><p className="muted">No campaigns yet.</p></div>
    :
      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Product</th><th>Objective</th><th>Budget</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {campaigns.map((c:any)=>(
              <tr key={c.id}>
                <td><Link href={`/campaigns/${c.id}`}>{c.name}</Link></td>
                <td>{c.products?.name||"—"}</td>
                <td>{c.objective}</td>
                <td>{c.budget_cents?`$${(c.budget_cents/100).toLocaleString()}`:"—"}</td>
                <td><span className="status">{STATUS_LABEL[c.status]||c.status}</span></td>
                <td style={{display:"flex",gap:6}}>
                  <form action={duplicateCampaign}>
                    <input type="hidden" name="id" value={c.id}/>
                    <button className="btn" style={{padding:"4px 10px",fontSize:12}}>Duplicate</button>
                  </form>
                  {c.status!=="archived"&&<form action={archiveCampaign}>
                    <input type="hidden" name="id" value={c.id}/>
                    <button className="btn" style={{padding:"4px 10px",fontSize:12}}>Archive</button>
                  </form>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    }
  </div></AppShell>;
}
