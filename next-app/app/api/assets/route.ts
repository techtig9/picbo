import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {signAssetPaths} from "@/lib/generation/persist-output";

/**
 * Recent workspace assets, with signed preview URLs — the data behind the
 * asset picker that replaced raw URL entry.
 *
 * RLS scopes the query to the caller's workspace; the explicit workspace_id
 * filter is belt and braces, not the security boundary.
 */
export async function GET(req:Request){
  const url=new URL(req.url);
  const kind=url.searchParams.get("kind");
  const limit=Math.min(60,Math.max(1,Number(url.searchParams.get("limit")||24)));

  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});

  const supabase=await createClient();
  let query=supabase.from("assets")
    .select("id,kind,status,mime_type,size_bytes,storage_path,metadata,created_at")
    .eq("workspace_id",ws.workspace_id)
    .eq("status","ready")
    .not("storage_path","is",null)
    .order("created_at",{ascending:false})
    .limit(limit);

  if(kind==="source")query=query.eq("kind","source_image");
  else if(kind==="generated")query=query.in("kind",["generated_image","generated_video"]);

  const {data,error}=await query;
  if(error)return NextResponse.json({error:"ASSET_LOOKUP_FAILED",message:error.message},{status:500});

  const rows=data||[];
  const signed=await signAssetPaths(rows.map(r=>r.storage_path).filter(Boolean) as string[]);

  return NextResponse.json({
    assets:rows.map(r=>({
      assetId:r.id,
      kind:r.kind,
      url:r.storage_path?signed[r.storage_path]||null:null,
      mimeType:r.mime_type,
      sizeBytes:r.size_bytes,
      width:(r.metadata as any)?.width??null,
      height:(r.metadata as any)?.height??null,
      filename:(r.metadata as any)?.original_filename??null,
      createdAt:r.created_at
    }))
  });
}
