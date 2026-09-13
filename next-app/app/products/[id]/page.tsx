import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createSignedAssetUrl} from "@/lib/storage";
import {uploadProductReference,deleteProductReference,analyzeProductIdentity} from "./identity-actions";

const STATUS_LABEL:Record<string,string>={
  draft:"Draft",analyzing:"Analyzing…",ready:"Ready",needs_review:"Needs review",failed:"Analysis failed"
};

export default async function ProductDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const {data:p}=ws?.workspace_id
    ?await supabase.from("products").select("id,name,sku,brand,description").eq("id",id).eq("workspace_id",ws.workspace_id).maybeSingle()
    :{data:null};

  if(!p)return <AppShell><div className="content"><div className="notice">Product not found.</div></div></AppShell>;

  const [{data:refs},{data:identity}]=await Promise.all([
    supabase.from("product_references").select("id,kind,is_primary,assets(storage_path)").eq("product_id",id).eq("workspace_id",ws!.workspace_id).order("is_primary",{ascending:false}),
    supabase.from("product_identity").select("identity_status,prompt_context,negative_constraints,color_rules").eq("product_id",id).eq("workspace_id",ws!.workspace_id).maybeSingle()
  ]);

  const refsWithUrls=await Promise.all((refs||[]).map(async(r:any)=>{
    const path=r.assets?.storage_path;
    const url=path?await createSignedAssetUrl(path,600).catch(()=>null):null;
    return {...r,url};
  }));

  const status=identity?.identity_status||"draft";
  const uploadAction=uploadProductReference.bind(null,id);
  const deleteAction=deleteProductReference.bind(null,id);
  const analyzeAction=async()=>{"use server";await analyzeProductIdentity(id);};

  return <AppShell><div className="content">
    <div className="eyebrow">PRODUCT</div>
    <h1 className="title">{p.name}</h1>
    <p className="muted">{p.brand||"No brand"} · {p.sku||"No SKU"}</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>Reference photos</h3>
        <p className="muted">Upload front, back, side, detail and packaging references. The primary reference drives Product Identity analysis.</p>
        <form action={uploadAction} className="form" encType="multipart/form-data">
          <label>Photo<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required/></label>
          <label>Type
            <select name="kind" defaultValue="reference">
              <option value="reference">Reference</option>
              <option value="front">Front</option>
              <option value="back">Back</option>
              <option value="side">Side</option>
              <option value="detail">Detail</option>
              <option value="packaging">Packaging</option>
              <option value="logo">Logo</option>
            </select>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:8,gridTemplateColumns:"none"}}>
            <input type="checkbox" name="isPrimary" style={{width:"auto"}}/> Set as primary reference
          </label>
          <button className="btn primary">Upload reference</button>
        </form>
        {refsWithUrls.length>0&&<div className="chips" style={{marginTop:14}}>
          {refsWithUrls.map((r:any)=>(
            <span className="chip" key={r.id} style={{display:"flex",alignItems:"center",gap:6}}>
              {r.is_primary?"★ ":""}{r.kind}
              <form action={deleteAction} style={{display:"inline"}}>
                <input type="hidden" name="refId" value={r.id}/>
                <button className="icon" aria-label="Remove" style={{width:20,height:20,fontSize:11,padding:0}}>✕</button>
              </form>
            </span>
          ))}
        </div>}
      </div>

      <div className="card">
        <h3>Product Identity</h3>
        <p className="muted">Protect logo, packaging, text, shape, colors and proportions in future generations.</p>
        <span className="status">{STATUS_LABEL[status]||status}</span>
        {identity?.prompt_context&&<p className="muted" style={{marginTop:10}}>{identity.prompt_context}</p>}
        {identity?.negative_constraints&&<p className="muted"><strong>Avoid:</strong> {identity.negative_constraints}</p>}
        <form action={analyzeAction} style={{marginTop:12}}>
          <button className="btn primary" disabled={refsWithUrls.length===0}>
            {status==="ready"||status==="needs_review"?"Re-analyze identity":"Analyze identity"}
          </button>
        </form>
        {refsWithUrls.length===0&&<p className="muted" style={{marginTop:8}}>Upload at least one reference photo first.</p>}
        {status==="needs_review"&&<p className="muted" style={{marginTop:8}}>The analysis came back with low confidence — review and re-analyze once you've added clearer references.</p>}
        {status==="failed"&&<p className="muted" style={{marginTop:8}}>Analysis failed — this usually means no vision-capable AI provider (Gemini or Claude) is configured yet.</p>}
      </div>

      <div className="card">
        <h3>Description</h3>
        <p className="muted">{p.description||"Add product details to improve creative direction."}</p>
      </div>
    </div>
  </div></AppShell>;
}
