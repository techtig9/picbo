import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {validateMedia,MediaValidationError} from "@/lib/generation/media-validation";
import {assertStorageQuota} from "@/lib/storage/quota";
import {log} from "@/lib/observability/logger";

/**
 * Uploads a source image for editing, photoshoots and product references.
 *
 * This exists so users stop being asked to paste a raw asset URL. The Image
 * Studio previously said "Source image URL (from Assets — right-click an image
 * there to copy its link)", which is not a workflow anyone should have to
 * follow, and which also meant the app happily fetched arbitrary URLs.
 *
 * Validation is on the actual bytes, not the declared Content-Type or the
 * filename: a browser will send whatever the client claims. See
 * lib/generation/media-validation.ts for why SVG is rejected outright.
 *
 * Writes through the user-scoped client so storage RLS applies — the object
 * path is workspace-prefixed and the policy checks membership.
 */

const MAX_UPLOAD_BYTES=25*1024*1024;

export async function POST(req:Request){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id){
    return NextResponse.json({error:"WORKSPACE_REQUIRED",message:"You need a workspace before uploading."},{status:400});
  }

  let form:FormData;
  try{form=await req.formData()}
  catch{return NextResponse.json({error:"INVALID_FORM",message:"Expected a multipart form upload."},{status:400})}

  const file=form.get("file");
  if(!(file instanceof File)){
    return NextResponse.json({error:"FILE_REQUIRED",message:"No file was included in the upload."},{status:400});
  }

  // Cheap rejection before buffering the whole thing into memory.
  if(file.size>MAX_UPLOAD_BYTES){
    return NextResponse.json(
      {error:"FILE_TOO_LARGE",message:`That file is ${(file.size/1024/1024).toFixed(1)}MB. The limit is ${MAX_UPLOAD_BYTES/1024/1024}MB.`},
      {status:413}
    );
  }

  const bytes=new Uint8Array(await file.arrayBuffer());

  let media;
  try{
    media=validateMedia(bytes,{expectKind:"image"});
  }catch(e:any){
    if(e instanceof MediaValidationError){
      return NextResponse.json({error:e.code,message:e.message},{status:415});
    }
    throw e;
  }

  try{
    await assertStorageQuota(ws.workspace_id,media.sizeBytes);
  }catch(e:any){
    return NextResponse.json(
      {error:"STORAGE_QUOTA_EXCEEDED",message:String(e?.message||"").replace("STORAGE_QUOTA_EXCEEDED: ","")},
      {status:507}
    );
  }

  const supabase=await createClient();
  const assetId=crypto.randomUUID();
  // The original filename never becomes part of the storage path: it is
  // attacker-controlled and would allow traversal and collisions. It is kept
  // as display metadata only.
  const storagePath=`${ws.workspace_id}/${assetId}/source.${media.format.extension}`;

  const {error:uploadError}=await supabase.storage
    .from("picbo-assets")
    .upload(storagePath,media.bytes,{contentType:media.format.mime,upsert:false});
  if(uploadError){
    log("error","asset.upload_failed",{workspace_id:ws.workspace_id,message:uploadError.message});
    return NextResponse.json({error:"UPLOAD_FAILED",message:uploadError.message},{status:500});
  }

  const {error:rowError}=await supabase.from("assets").insert({
    id:assetId,
    workspace_id:ws.workspace_id,
    product_id:form.get("productId")?String(form.get("productId")):null,
    kind:"source_image",
    status:"ready",
    storage_path:storagePath,
    mime_type:media.format.mime,
    size_bytes:media.sizeBytes,
    created_by:user.id,
    metadata:{
      original_filename:file.name.slice(0,200),
      width:media.width??null,
      height:media.height??null
    }
  });
  if(rowError){
    await supabase.storage.from("picbo-assets").remove([storagePath]);
    return NextResponse.json({error:"ASSET_RECORD_FAILED",message:rowError.message},{status:500});
  }

  const {data:signed}=await supabase.storage.from("picbo-assets").createSignedUrl(storagePath,3600);

  log("info","asset.uploaded",{
    workspace_id:ws.workspace_id,asset_id:assetId,mime:media.format.mime,size_bytes:media.sizeBytes
  });

  return NextResponse.json({
    assetId,
    url:signed?.signedUrl||null,
    mimeType:media.format.mime,
    sizeBytes:media.sizeBytes,
    width:media.width??null,
    height:media.height??null,
    filename:file.name
  },{status:201});
}
