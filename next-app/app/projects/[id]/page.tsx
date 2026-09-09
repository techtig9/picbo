import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import Link from "next/link";
import {updateProjectStatus,deleteProject,linkProductToProject,unlinkProductFromProject} from "../actions";
import {ShareButton} from "./ShareButton";

export default async function ProjectDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  const {data:project}=ws?.workspace_id
    ?await supabase.from("projects").select("id,name,status,created_at").eq("id",id).eq("workspace_id",ws.workspace_id).maybeSingle()
    :{data:null};
  if(!project)return <AppShell><div className="content"><div className="notice">Project not found.</div></div></AppShell>;

  const [{data:links},{data:allProducts},{data:assets}]=await Promise.all([
    supabase.from("project_products").select("product_id,products(id,name,sku)").eq("project_id",id),
    supabase.from("products").select("id,name").eq("workspace_id",ws!.workspace_id).order("name"),
    supabase.from("assets").select("id,kind,status,created_at").eq("project_id",id).order("created_at",{ascending:false})
  ]);

  const linkedIds=new Set((links||[]).map((l:any)=>l.product_id));
  const availableProducts=(allProducts||[]).filter((p:any)=>!linkedIds.has(p.id));
  const statusAction=updateProjectStatus.bind(null,id);
  const linkAction=linkProductToProject.bind(null,id);
  const unlinkAction=unlinkProductFromProject.bind(null,id);

  return <AppShell><div className="content">
    <div className="eyebrow">PROJECT</div>
    <h1 className="title">{project.name}</h1>
    <p className="muted">Created {new Date(project.created_at).toLocaleDateString()}</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>Status</h3>
        <form action={statusAction} className="form">
          <select name="status" defaultValue={project.status}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button className="btn primary">Update status</button>
        </form>
        <form action={deleteProject} style={{marginTop:12}}>
          <input type="hidden" name="id" value={project.id}/>
          <button className="btn">Delete project</button>
        </form>
        <div style={{marginTop:12}}><ShareButton projectId={project.id}/></div>
      </div>

      <div className="card">
        <h3>Products in this project</h3>
        <div className="chips">
          {(links||[]).length===0&&<p className="muted">No products linked yet.</p>}
          {(links||[]).map((l:any)=>(
            <span className="chip" key={l.product_id} style={{display:"flex",alignItems:"center",gap:6}}>
              {l.products?.name||"Unknown product"}
              <form action={unlinkAction} style={{display:"inline"}}>
                <input type="hidden" name="productId" value={l.product_id}/>
                <button className="icon" aria-label="Remove" style={{width:20,height:20,fontSize:11,padding:0}}>✕</button>
              </form>
            </span>
          ))}
        </div>
        {availableProducts.length>0&&<form action={linkAction} className="form" style={{marginTop:14}}>
          <label>Add product
            <select name="productId" defaultValue="">
              <option value="" disabled>Choose a product…</option>
              {availableProducts.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button className="btn">Link product</button>
        </form>}
      </div>

      <div className="card">
        <h3>Assets</h3>
        <p className="muted">{assets?.length||0} assets generated in this project.</p>
        {(assets||[]).length>0&&<div className="chips" style={{marginTop:10}}>
          {assets!.map((a:any)=><span className="chip" key={a.id}>{a.kind} · {a.status}</span>)}
        </div>}
      </div>
    </div>

    <div className="notice" style={{marginTop:16}}>
      To generate creative for this project, open <Link href="/create/photoshoot">Photoshoot</Link>, <Link href="/create/ads">Ad Studio</Link> or <Link href="/create/video">Video Studio</Link> and pick one of the linked products — new assets will show up here once project-scoped generation is wired into those studios.
    </div>
  </div></AppShell>;
}
