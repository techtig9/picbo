import {AppShell} from "@/components/app-shell";
import Link from "next/link";
import {Camera,Image,Brush,Video,ArrowUpRight} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";

const QUICK=[["Photoshoot","Complete product shot list.",Camera,"/create/photoshoot"],["Image","Product image generation/editing.",Image,"/create/image"],["Ad","Hooks, copy and static ads.",Brush,"/create/ads"],["Video","15-second animated ad.",Video,"/create/video"]] as const;

export default async function Dashboard(){
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  const [{count:productCount},{count:projectCount},{data:credits},{count:activeJobs},{data:recentProjects},{data:recentRenders}]=await Promise.all([
    supabase.from("products").select("id",{count:"exact",head:true}).eq("workspace_id",ws!.workspace_id),
    supabase.from("projects").select("id",{count:"exact",head:true}).eq("workspace_id",ws!.workspace_id),
    supabase.from("workspace_credits").select("balance").eq("workspace_id",ws!.workspace_id).maybeSingle(),
    supabase.from("ai_jobs").select("id",{count:"exact",head:true}).eq("workspace_id",ws!.workspace_id).in("status",["queued","running","validating"]),
    supabase.from("projects").select("id,name,status,updated_at").eq("workspace_id",ws!.workspace_id).order("updated_at",{ascending:false}).limit(5),
    supabase.from("render_jobs").select("id,status,video_project_id,created_at").eq("workspace_id",ws!.workspace_id).order("created_at",{ascending:false}).limit(5)
  ]);

  const stats=[
    ["Products",String(productCount??0)],
    ["Projects",String(projectCount??0)],
    ["Credits",String(credits?.balance??0)],
    ["Active jobs",String(activeJobs??0)]
  ];

  return <AppShell><div className="content">
    <div className="eyebrow">AI PRODUCT-TO-ADVERTISING</div>
    <h1 className="title">Turn a product into a campaign.</h1>
    <p className="muted">Create photos, ads, 15-second videos and Shorts from one product.</p>

    <div className="hero">
      <div className="eyebrow">AI CREATIVE DIRECTOR</div>
      <h2>What do you want to create?</h2>
      <p className="muted">Describe the outcome and Picbo will select the right workflow.</p>
      <div className="chips">
        <Link className="btn primary" href="/create">Create with AI</Link>
        <Link className="chip" href="/create/photoshoot">Product photoshoot</Link>
        <Link className="chip" href="/create/ads">Ad creative</Link>
        <Link className="chip" href="/create/video">15-sec video</Link>
      </div>
    </div>

    <div className="head"><h2>Quick create</h2></div>
    <div className="grid four">
      {QUICK.map(([t,d,I,h])=>(
        <Link className="card quick" href={h} key={t}>
          <span className="qicon"><I size={20}/></span>
          <span><h3>{t}</h3><span className="muted">{d}</span></span>
          <ArrowUpRight size={16}/>
        </Link>
      ))}
    </div>

    <div className="head"><h2>Workspace overview</h2></div>
    <div className="grid four">
      {stats.map(x=><div className="card" key={x[0]}><span className="muted">{x[0]}</span><div className="metric">{x[1]}</div></div>)}
    </div>

    <div className="head"><h2>Recent projects</h2><Link className="btn" href="/projects">View all</Link></div>
    <div className="card">
      {(!recentProjects||recentProjects.length===0)?
        <p className="muted">No projects yet — <Link href="/projects">create one</Link> to see it here.</p>
      :
        <table className="table">
          <thead><tr><th>Project</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            {recentProjects.map((p:any)=>(
              <tr key={p.id}>
                <td><Link href={`/projects/${p.id}`}>{p.name}</Link></td>
                <td><span className="status">{p.status}</span></td>
                <td>{new Date(p.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </div>

    {recentRenders&&recentRenders.length>0&&<>
      <div className="head"><h2>Recent renders</h2></div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Status</th><th>Started</th><th></th></tr></thead>
          <tbody>
            {recentRenders.map((r:any)=>(
              <tr key={r.id}>
                <td><span className="status">{r.status}</span></td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td><Link className="btn" href={`/create/video/${r.video_project_id}/edit`} style={{padding:"4px 10px",fontSize:12}}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>}
  </div></AppShell>;
}
