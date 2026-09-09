import {createAdminClient} from "@/lib/supabase/admin";

/**
 * Public, unauthenticated view of a shared project. Deliberately does NOT
 * add an RLS policy exposing project_shares to the anon role — the token
 * itself is the credential, so it's verified server-side via the
 * service-role client (same pattern as webhook/worker-secret verification
 * elsewhere in this app), and only read-only project data is ever returned.
 * "edit" permission (stored on the row) is intentionally not honored here —
 * granting anonymous internet write access to a private project is a much
 * bigger security decision than this endpoint should make unilaterally.
 */
export default async function SharedProject({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const supabase=createAdminClient();

  const {data:share}=await supabase.from("project_shares").select("project_id,expires_at,permission").eq("token",token).maybeSingle();

  if(!share){
    return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#08090d",color:"#f6f7fb"}}>
      <p style={{color:"#9aa1b2"}}>This share link is invalid.</p>
    </main>;
  }
  if(share.expires_at&&new Date(share.expires_at)<new Date()){
    return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#08090d",color:"#f6f7fb"}}>
      <p style={{color:"#9aa1b2"}}>This share link has expired.</p>
    </main>;
  }

  const {data:project}=await supabase.from("projects").select("name,status,created_at").eq("id",share.project_id).maybeSingle();
  const {data:links}=await supabase.from("project_products").select("products(name,brand)").eq("project_id",share.project_id);

  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at 70% -10%,#8b7cff22,transparent 34%),#08090d",color:"#f6f7fb",padding:"60px 24px"}}>
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:1,color:"#8b7cff",textTransform:"uppercase"}}>Shared project · read-only</div>
      <h1 style={{fontSize:32,margin:"10px 0"}}>{project?.name||"Untitled project"}</h1>
      <p style={{color:"#9aa1b2"}}>Status: {project?.status||"unknown"}</p>

      <div style={{border:"1px solid #262b38",background:"linear-gradient(180deg,#12151d,#0f1117)",borderRadius:18,padding:22,marginTop:20}}>
        <h3 style={{margin:"0 0 10px"}}>Products</h3>
        {(!links||links.length===0)?
          <p style={{color:"#9aa1b2",fontSize:13}}>No products linked to this project.</p>
        :
          <ul style={{margin:0,paddingLeft:18,color:"#aeb4c3",fontSize:14,lineHeight:1.8}}>
            {links.map((l:any,i:number)=><li key={i}>{l.products?.name}{l.products?.brand?` — ${l.products.brand}`:""}</li>)}
          </ul>
        }
      </div>
      <p style={{color:"#626a7b",fontSize:12,marginTop:16}}>Shared via Picbo.ai. This link is view-only.</p>
    </div>
  </main>;
}
