import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {updateCampaignStatus,linkAdBriefToCampaign} from "../actions";

export default async function CampaignDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  const {data:campaign}=await supabase.from("campaigns").select("id,name,objective,audience,status,budget_cents,created_at,products(name)").eq("id",id).eq("workspace_id",ws!.workspace_id).maybeSingle();
  if(!campaign)return <AppShell><div className="content"><div className="notice">Campaign not found.</div></div></AppShell>;

  const [{data:links},{data:allBriefs}]=await Promise.all([
    supabase.from("campaign_ad_briefs").select("ad_brief_id,ad_briefs(id,objective,status,ad_variants(id,platform,headline,score))").eq("campaign_id",id),
    supabase.from("ad_briefs").select("id,objective,status").eq("workspace_id",ws!.workspace_id).order("created_at",{ascending:false}).limit(30)
  ]);

  const linkedIds=new Set((links||[]).map((l:any)=>l.ad_brief_id));
  const availableBriefs=(allBriefs||[]).filter((b:any)=>!linkedIds.has(b.id));
  const allVariants=(links||[]).flatMap((l:any)=>l.ad_briefs?.ad_variants||[]);
  const avgScore=allVariants.length?(allVariants.reduce((n:number,v:any)=>n+(Number(v.score)||0),0)/allVariants.length).toFixed(1):"—";

  const statusAction=updateCampaignStatus.bind(null,id);
  const linkAction=linkAdBriefToCampaign.bind(null,id);

  return <AppShell><div className="content">
    <div className="eyebrow">CAMPAIGN</div>
    <h1 className="title">{campaign.name}</h1>
    <p className="muted">{(campaign.products as any)?.name} · {campaign.objective}</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>Status &amp; budget</h3>
        <form action={statusAction} className="form">
          <select name="status" defaultValue={campaign.status}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
          <button className="btn primary">Update status</button>
        </form>
        <p className="muted" style={{marginTop:10}}>Budget: {campaign.budget_cents?`$${(campaign.budget_cents/100).toLocaleString()}`:"Not set"}</p>
        {(campaign.audience as any)?.description&&<p className="muted">Audience: {(campaign.audience as any).description}</p>}
      </div>

      <div className="card">
        <h3>Performance</h3>
        <p className="muted">{allVariants.length} creative variants across {(links||[]).length} ad briefs.</p>
        <div className="metric">{avgScore}</div>
        <p className="muted">Average variant score</p>
      </div>

      <div className="card">
        <h3>Creative variants</h3>
        <div className="chips">
          {(links||[]).length===0&&<p className="muted">No ad briefs linked yet.</p>}
          {(links||[]).map((l:any)=><span className="chip" key={l.ad_brief_id}>{l.ad_briefs?.objective} · {l.ad_briefs?.status}</span>)}
        </div>
        {availableBriefs.length>0&&<form action={linkAction} className="form" style={{marginTop:14}}>
          <label>Link an existing ad brief
            <select name="adBriefId" defaultValue="">
              <option value="" disabled>Choose a brief…</option>
              {availableBriefs.map((b:any)=><option key={b.id} value={b.id}>{b.objective} ({b.status})</option>)}
            </select>
          </label>
          <button className="btn">Link brief</button>
        </form>}
        <p className="muted" style={{marginTop:10}}>Create new creative in <a href="/create/ads">Ad Studio</a>, then link the resulting brief here.</p>
      </div>
    </div>
  </div></AppShell>;
}
