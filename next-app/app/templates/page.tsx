import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createTemplate,duplicateTemplate,deleteTemplate} from "./actions";
import Link from "next/link";

const CATEGORIES=[["all","All"],["ad","Ad"],["photoshoot","Photoshoot"],["video","Video"],["shorts","Shorts"],["ugc","UGC"]] as const;
const STUDIO_ROUTE:Record<string,string>={ad:"/create/ads",photoshoot:"/create/photoshoot",video:"/create/video",shorts:"/create/shorts",ugc:"/create/ugc"};

export default async function Templates({searchParams}:{searchParams:Promise<{category?:string;q?:string}>}){
  const {category="all",q=""}=await searchParams;
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  let query=supabase.from("creative_templates").select("id,name,category,definition,featured,workspace_id,created_at").order("featured",{ascending:false}).order("created_at",{ascending:false});
  if(category!=="all")query=query.eq("category",category);
  if(q.trim())query=query.ilike("name",`%${q.trim()}%`);
  const {data:templates}=await query;

  return <AppShell><div className="content">
    <div className="eyebrow">CREATIVE PRESETS</div>
    <h1 className="title">Templates</h1>
    <p className="muted">Brand-safe starting points for Ad Studio, Photoshoot, Video, Shorts and UGC.</p>

    <form method="GET" style={{marginTop:22,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <input className="search" name="q" defaultValue={q} placeholder="Search templates…" style={{maxWidth:280}}/>
      <input type="hidden" name="category" value={category}/>
      <button className="btn">Search</button>
    </form>
    <div className="chips" style={{marginTop:12}}>
      {CATEGORIES.map(([id,label])=>(
        <Link key={id} className="chip" href={`/templates?category=${id}${q?`&q=${encodeURIComponent(q)}`:""}`} style={{color:category===id?"#fff":"#9aa1b2"}}>{label}</Link>
      ))}
    </div>

    <div className="head"><h2>Library</h2><span className="muted">{templates?.length||0} templates</span></div>
    {(!templates||templates.length===0)?
      <div className="card"><p className="muted">No templates match yet.</p></div>
    :
      <div className="grid three">
        {templates.map((t:any)=>(
          <div className="card" key={t.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <h3>{t.name}</h3>
              {t.featured&&<span className="status">Featured</span>}
            </div>
            <p className="muted">{t.category} · {t.definition?.tone||"No tone set"}</p>
            {t.definition?.hook&&<p className="muted">"{t.definition.hook}"</p>}
            <div className="chips" style={{marginTop:10}}>
              <Link className="btn primary" href={`${STUDIO_ROUTE[t.category]||"/create"}${t.category==="ad"?`?template=${t.id}`:""}`}>Use template</Link>
              <form action={duplicateTemplate} style={{display:"inline"}}>
                <input type="hidden" name="id" value={t.id}/>
                <button className="btn">Duplicate</button>
              </form>
              {t.workspace_id===ws?.workspace_id&&
                <form action={deleteTemplate} style={{display:"inline"}}>
                  <input type="hidden" name="id" value={t.id}/>
                  <button className="btn">Delete</button>
                </form>
              }
            </div>
          </div>
        ))}
      </div>
    }

    <div className="card" style={{marginTop:22,maxWidth:520}}>
      <h3>Save a new template</h3>
      <form action={createTemplate} className="form">
        <label>Name<input name="name" required placeholder="e.g. Weekend Sale Push"/></label>
        <label>Category
          <select name="category" defaultValue="ad">
            <option value="ad">Ad</option>
            <option value="photoshoot">Photoshoot</option>
            <option value="video">Video</option>
            <option value="shorts">Shorts</option>
            <option value="ugc">UGC</option>
          </select>
        </label>
        <label>Objective<input name="objective" placeholder="e.g. sales, awareness"/></label>
        <label>Tone<input name="tone" placeholder="e.g. premium, playful, urgent"/></label>
        <label>Audience<input name="audience" placeholder="Who this is for"/></label>
        <label>Hook<input name="hook" placeholder="Opening line"/></label>
        <label>CTA<input name="cta" placeholder="e.g. Shop now"/></label>
        <button className="btn primary">Save template</button>
      </form>
    </div>
  </div></AppShell>;
}
