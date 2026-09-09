import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createBrandKit,deleteBrandKit} from "./actions";

export default async function BrandKits(){
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const {data:kits}=ws?.workspace_id
    ?await supabase.from("brand_kits").select("id,name,colors,fonts,voice,rules,created_at").eq("workspace_id",ws.workspace_id).order("created_at",{ascending:false})
    :{data:[]};

  return <AppShell><div className="content">
    <div className="eyebrow">BRAND CONSISTENCY</div>
    <h1 className="title">Brand Kits</h1>
    <p className="muted">Keep logos, colors, typography, voice and campaign rules reusable across every generation. Attach a kit to any Ad Studio brief.</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card" style={{gridColumn:"span 1"}}>
        <h3>Create a brand kit</h3>
        <form action={async(formData:FormData)=>{"use server";await createBrandKit(formData);}} className="form">
          <label>Name<input name="name" placeholder="e.g. Noir Core Brand" required/></label>
          <label>Colors (comma separated hex)<input name="colors" placeholder="#111318, #8b7cff, #45d9c0"/></label>
          <label>Fonts (comma separated)<input name="fonts" placeholder="Inter, Playfair Display"/></label>
          <label>Voice / tone<input name="voiceTone" placeholder="Premium, confident, minimal"/></label>
          <label>Rules / notes<textarea name="rules" style={{minHeight:70}} placeholder="Never show competitor logos. Always include the wordmark…"/></label>
          <button className="btn primary">Create brand kit</button>
        </form>
      </div>

      <div className="card" style={{gridColumn:"span 2"}}>
        <h3>Applying a brand kit</h3>
        <p className="muted">When you attach a brand kit in Ad Studio, its colors, fonts, voice and rules are passed into the AI copy and creative brief so every variant stays on-brand automatically.</p>
        <div className="notice">Logo upload and per-kit default watermark are on the roadmap for the Asset Library integration.</div>
      </div>
    </div>

    <div className="head"><h2>Your brand kits</h2><span className="muted">{kits?.length||0} kits</span></div>
    {(!kits||kits.length===0)?
      <div className="card"><p className="muted">No brand kits yet. Create one above to start keeping every generation on-brand.</p></div>
    :
      <div className="grid three">
        {kits.map((k:any)=>(
          <div className="card" key={k.id}>
            <h3>{k.name}</h3>
            <div className="chips">
              {(k.colors||[]).map((c:string)=>(
                <span className="chip" key={c} style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:c,display:"inline-block",border:"1px solid #333"}}/>
                  {c}
                </span>
              ))}
            </div>
            {(k.fonts||[]).length>0&&<p className="muted" style={{marginTop:10}}>Fonts: {(k.fonts||[]).join(", ")}</p>}
            {k.voice?.tone&&<p className="muted">Voice: {k.voice.tone}</p>}
            {k.rules?.notes&&<p className="muted">{k.rules.notes}</p>}
            <form action={async(formData:FormData)=>{"use server";await deleteBrandKit(formData);}} style={{marginTop:12}}>
              <input type="hidden" name="id" value={k.id}/>
              <button className="btn">Delete</button>
            </form>
          </div>
        ))}
      </div>
    }
  </div></AppShell>;
}
