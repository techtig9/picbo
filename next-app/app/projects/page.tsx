import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import Link from "next/link";
import {createProject} from "./actions";

const STATUS_LABEL:Record<string,string>={draft:"Draft",active:"Active",archived:"Archived"};

export default async function Projects(){
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const {data:projects}=ws?.workspace_id
    ?await supabase.from("projects").select("id,name,status,created_at").eq("workspace_id",ws.workspace_id).order("created_at",{ascending:false})
    :{data:[]};

  return <AppShell><div className="content">
    <div className="eyebrow">WORKSPACE</div>
    <h1 className="title">Projects</h1>
    <p className="muted">Group products, assets and generations for a campaign or launch into one place.</p>

    <div className="card" style={{marginTop:22,maxWidth:480}}>
      <h3>New project</h3>
      <form action={createProject} className="form">
        <label>Name<input name="name" placeholder="e.g. Autumn Skincare Launch" required/></label>
        <button className="btn primary">Create project</button>
      </form>
    </div>

    <div className="head"><h2>Your projects</h2><span className="muted">{projects?.length||0} projects</span></div>
    {(!projects||projects.length===0)?
      <div className="card"><p className="muted">No projects yet. Create one above to start organizing a launch.</p></div>
    :
      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {projects.map((pr:any)=>(
              <tr key={pr.id}>
                <td><Link href={`/projects/${pr.id}`}>{pr.name}</Link></td>
                <td><span className="status">{STATUS_LABEL[pr.status]||pr.status}</span></td>
                <td>{new Date(pr.created_at).toLocaleDateString()}</td>
                <td><Link href={`/projects/${pr.id}`} className="btn">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    }
  </div></AppShell>;
}
