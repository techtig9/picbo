import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {signAssetPaths} from "@/lib/generation/persist-output";

/**
 * Asset library.
 *
 * Previously a table of kind / status / MIME type / date — an image library
 * that never showed an image. Now a visual grid with real previews, which is
 * the only way a user can find the thing they generated.
 */

export const metadata={title:"Asset Library",robots:{index:false,follow:false}};

function formatBytes(n:number|null|undefined){
  if(!n)return "—";
  if(n<1024)return `${n} B`;
  if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

const KIND_LABEL:Record<string,string>={
  source_image:"Upload",
  generated_image:"Generated",
  generated_video:"Video",
  render_output:"Render"
};

export default async function Assets(){
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  const {data:assets}=ws?.workspace_id
    ? await supabase.from("assets")
        .select("id,kind,status,mime_type,size_bytes,storage_path,metadata,created_at")
        .eq("workspace_id",ws.workspace_id)
        .order("created_at",{ascending:false})
        .limit(120)
    : {data:[]};

  const rows=assets||[];
  const signed=await signAssetPaths(rows.map(r=>r.storage_path).filter(Boolean) as string[]);

  return <AppShell><div className="content">
    <div className="eyebrow">MEDIA MANAGEMENT</div>
    <h1 className="title">Asset Library</h1>
    <p className="muted">
      Everything you upload and everything Picbo generates, stored privately to your workspace.
    </p>

    <div className="head" style={{marginTop:22}}>
      <h2>Assets</h2>
      <span className="muted">{rows.length} item{rows.length===1?"":"s"}</span>
    </div>

    {rows.length===0
      ? <div className="card empty-state">
          <h3>No assets yet</h3>
          <p className="muted">
            Upload a product photo or run a generation — results are saved here automatically,
            with the prompt, provider and model that produced them.
          </p>
          <a className="btn primary" href="/create/image">Open Image Studio</a>
        </div>
      : <div className="asset-grid">
          {rows.map(a=>{
            const url=a.storage_path?signed[a.storage_path]:null;
            const meta=(a.metadata||{}) as any;
            const isVideo=(a.mime_type||"").startsWith("video/");
            return <figure key={a.id} className="asset-card">
              <div className="asset-thumb">
                {url
                  ? isVideo
                    ? <video src={url} preload="metadata" muted playsInline/>
                    /* eslint-disable-next-line @next/next/no-img-element */
                    : <img src={url} alt={meta.original_filename||`${KIND_LABEL[a.kind]||a.kind} asset`} loading="lazy"/>
                  : <div className="asset-thumb-missing">
                      {a.status==="processing"?"Processing…":"No preview"}
                    </div>
                }
              </div>
              <figcaption>
                <div className="asset-card-row">
                  <span className="chip">{KIND_LABEL[a.kind]||a.kind}</span>
                  {a.status!=="ready"&&<span className="status">{a.status}</span>}
                </div>
                <span className="muted small">
                  {meta.width&&meta.height?`${meta.width} × ${meta.height} · `:""}
                  {formatBytes(a.size_bytes)}
                </span>
                {meta.provider&&
                  <span className="muted small">{meta.provider} · {meta.model}</span>
                }
                <span className="muted small">{new Date(a.created_at).toLocaleDateString()}</span>
                {url&&
                  <a className="btn" href={url} target="_blank" rel="noopener noreferrer">Open</a>
                }
              </figcaption>
            </figure>;
          })}
        </div>
    }
  </div></AppShell>;
}
