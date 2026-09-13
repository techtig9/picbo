import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import Link from "next/link";

const STUDIO_ROUTE:Record<string,string>={ad:"/create/ads",photoshoot:"/create/photoshoot",video:"/create/video",shorts:"/create/shorts",ugc:"/create/ugc"};

export default async function Inspiration(){
  const supabase=await createClient();
  const {data:featured}=await supabase.from("creative_templates").select("id,name,category,definition").eq("featured",true).order("created_at",{ascending:false});

  return <AppShell><div className="content">
    <div className="eyebrow">CREATIVE DIRECTION</div>
    <h1 className="title">Inspiration</h1>
    <p className="muted">Curated starting points, pulled from the same template library available in every studio.</p>

    {(!featured||featured.length===0)?
      <div className="card" style={{marginTop:22}}><p className="muted">No featured templates yet.</p></div>
    :
      <div className="grid three" style={{marginTop:22}}>
        {featured.map((t:any)=>(
          <div className="card" key={t.id}>
            <h3>{t.name}</h3>
            <p className="muted">{t.category} · {t.definition?.tone||"No tone set"}</p>
            {t.definition?.hook&&<p className="muted">"{t.definition.hook}"</p>}
            <Link className="btn primary" href={`${STUDIO_ROUTE[t.category]||"/templates"}${t.category==="ad"?`?template=${t.id}`:""}`} style={{marginTop:10,display:"inline-block"}}>Use this direction</Link>
          </div>
        ))}
      </div>
    }

    <div className="notice" style={{marginTop:16}}>Browse the full library, including your own saved templates, on the <Link href="/templates">Templates</Link> page.</div>
  </div></AppShell>;
}
