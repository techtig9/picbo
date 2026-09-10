import {createAdminClient} from "@/lib/supabase/admin";
import {validateMedia,MediaValidationError,type MediaKind} from "./media-validation";
import {assertStorageQuotaAsAdmin} from "@/lib/storage/quota";
import {log} from "@/lib/observability/logger";
import type {ProviderResult} from "@/lib/ai/types";

/**
 * Turns a provider result into durable, viewable assets.
 *
 * Before this existed, a completed generation stored the provider's raw JSON
 * in ai_jobs.result and nothing else. Those provider URLs are short-lived
 * (fal expires them within hours), so even the JSON was not a lasting record,
 * and no UI ever rendered them — a user paid credits and never saw the image.
 *
 * Now: download → validate the actual bytes → store in our own private
 * bucket → create an assets row → return signed URLs the studio can render.
 *
 * Uses the service-role client because this runs in background job processing
 * where there is no request cookie, and because the workspace has already been
 * authorised by the caller that created the job.
 */

const DOWNLOAD_TIMEOUT_MS=60_000;
const SIGNED_URL_TTL_SECONDS=3600;

export interface StoredAsset{
  assetId:string;
  storagePath:string;
  signedUrl:string;
  mimeType:string;
  sizeBytes:number;
  width?:number;
  height?:number;
}

export interface PersistOutputParams{
  jobId:string;
  workspaceId:string;
  userId:string;
  task:string;
  result:ProviderResult;
  /** Links the generated asset back to the product it was generated for. */
  productId?:string|null;
  projectId?:string|null;
}

export class NoOutputError extends Error{
  constructor(message:string){super(message);this.name="NoOutputError"}
}

function expectedKindForTask(task:string):MediaKind{
  return task==="video"||task==="render"?"video":"image";
}

/**
 * Downloads one provider URL and validates it is really the media we expect.
 * Blocks non-HTTPS and obviously-internal hosts: the URL comes from a
 * third-party API response, so treating it as fetchable without checks is an
 * SSRF vector against our own network.
 */
async function downloadAndValidate(url:string,expectKind:MediaKind){
  let parsed:URL;
  try{parsed=new URL(url)}
  catch{throw new MediaValidationError("The provider returned a malformed output URL.","BAD_OUTPUT_URL")}

  if(parsed.protocol!=="https:"){
    throw new MediaValidationError("Provider output must be served over HTTPS.","INSECURE_OUTPUT_URL");
  }
  const host=parsed.hostname.toLowerCase();
  const isPrivate=
    host==="localhost"||host==="::1"||host.endsWith(".localhost")||host.endsWith(".internal")||
    /^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)||/^169\.254\./.test(host);
  if(isPrivate){
    throw new MediaValidationError("Provider output URL points at a private address.","PRIVATE_OUTPUT_URL");
  }

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),DOWNLOAD_TIMEOUT_MS);
  try{
    const res=await fetch(parsed.toString(),{signal:controller.signal,redirect:"follow",cache:"no-store"});
    if(!res.ok){
      throw new MediaValidationError(`Could not download the generated file (HTTP ${res.status}).`,"OUTPUT_DOWNLOAD_FAILED");
    }
    const bytes=new Uint8Array(await res.arrayBuffer());
    return validateMedia(bytes,{expectKind});
  }catch(e:any){
    if(e instanceof MediaValidationError)throw e;
    if(e?.name==="AbortError"){
      throw new MediaValidationError("Downloading the generated file timed out.","OUTPUT_DOWNLOAD_TIMEOUT");
    }
    throw new MediaValidationError(`Could not download the generated file: ${e?.message||"network error"}`,"OUTPUT_DOWNLOAD_FAILED");
  }finally{
    clearTimeout(timer);
  }
}

export async function persistGenerationOutput(params:PersistOutputParams):Promise<StoredAsset[]>{
  const urls=(params.result.assetUrls||[]).filter(Boolean);

  // A "completed" job with no output is a failure, not a success. Previously
  // this case sailed through and the user was told the job completed.
  if(urls.length===0){
    throw new NoOutputError("The provider completed but returned no image or video.");
  }

  const expectKind=expectedKindForTask(params.task);
  const supabase=createAdminClient();
  const stored:StoredAsset[]=[];

  for(const [index,url] of urls.entries()){
    const media=await downloadAndValidate(url,expectKind);

    // Enforce the plan quota against real bytes, before writing them.
    await assertStorageQuotaAsAdmin(params.workspaceId,media.sizeBytes);

    const assetId=crypto.randomUUID();
    const storagePath=`${params.workspaceId}/${assetId}/output-${index+1}.${media.format.extension}`;

    const {error:uploadError}=await supabase.storage
      .from("picbo-assets")
      .upload(storagePath,media.bytes,{contentType:media.format.mime,upsert:false});
    if(uploadError){
      throw new Error(`Could not save the generated file: ${uploadError.message}`);
    }

    const {error:rowError}=await supabase.from("assets").insert({
      id:assetId,
      workspace_id:params.workspaceId,
      product_id:params.productId||null,
      project_id:params.projectId||null,
      kind:media.format.kind==="video"?"generated_video":"generated_image",
      status:"ready",
      storage_path:storagePath,
      mime_type:media.format.mime,
      size_bytes:media.sizeBytes,
      created_by:params.userId,
      metadata:{
        job_id:params.jobId,
        task:params.task,
        provider:params.result.provider,
        model:params.result.model,
        provider_request_id:params.result.requestId,
        width:media.width??null,
        height:media.height??null,
        source_index:index
      }
    });
    if(rowError){
      // Don't leave an orphaned object in the bucket that nothing references.
      await supabase.storage.from("picbo-assets").remove([storagePath]).catch(()=>{});
      throw new Error(`Could not record the generated file: ${rowError.message}`);
    }

    const {data:signed}=await supabase.storage
      .from("picbo-assets")
      .createSignedUrl(storagePath,SIGNED_URL_TTL_SECONDS);

    stored.push({
      assetId,
      storagePath,
      signedUrl:signed?.signedUrl||"",
      mimeType:media.format.mime,
      sizeBytes:media.sizeBytes,
      width:media.width,
      height:media.height
    });
  }

  log("info","generation.output_persisted",{
    job_id:params.jobId,workspace_id:params.workspaceId,
    assets:stored.length,provider:params.result.provider,model:params.result.model
  });

  return stored;
}

/** Re-signs stored assets for display. Signed URLs expire; storage paths do not. */
export async function signAssetPaths(paths:string[],ttlSeconds=SIGNED_URL_TTL_SECONDS):Promise<Record<string,string>>{
  if(paths.length===0)return {};
  const supabase=createAdminClient();
  const {data}=await supabase.storage.from("picbo-assets").createSignedUrls(paths,ttlSeconds);
  const out:Record<string,string>={};
  for(const entry of data||[]){
    if(entry.path&&entry.signedUrl)out[entry.path]=entry.signedUrl;
  }
  return out;
}
