"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {safeAssetPath,createSignedAssetUrl} from "@/lib/storage";
import {assertStorageQuota} from "@/lib/storage/quota";
import {runGenerationJob} from "@/lib/ai/jobs";
import {buildIdentityAnalysisPrompt,parseIdentityAnalysis} from "@/lib/ai/product-identity";
import {revalidatePath} from "next/cache";

const ALLOWED_MIME=["image/jpeg","image/png","image/webp"];
const MAX_UPLOAD_BYTES=15*1024*1024; // 15MB
const REFERENCE_KINDS=["reference","front","back","side","detail","packaging","logo"] as const;

export async function uploadProductReference(productId:string,formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");

  const file=formData.get("file");
  if(!(file instanceof File)||file.size===0)throw new Error("FILE_REQUIRED");
  if(!ALLOWED_MIME.includes(file.type))throw new Error("UNSUPPORTED_FILE_TYPE");
  if(file.size>MAX_UPLOAD_BYTES)throw new Error("FILE_TOO_LARGE");
  await assertStorageQuota(ws.workspace_id,file.size);

  const kindRaw=String(formData.get("kind")||"reference");
  const kind=(REFERENCE_KINDS as readonly string[]).includes(kindRaw)?kindRaw:"reference";
  const isPrimary=formData.get("isPrimary")==="on";

  const supabase=await createClient();

  const {data:asset,error:assetErr}=await supabase.from("assets").insert({
    workspace_id:ws.workspace_id,product_id:productId,kind:"product_reference",
    status:"processing",mime_type:file.type,size_bytes:file.size,created_by:user.id
  }).select("id").single();
  if(assetErr)throw assetErr;

  const path=safeAssetPath(ws.workspace_id,asset.id,file.name||"reference.jpg");
  const bytes=Buffer.from(await file.arrayBuffer());
  const {error:uploadErr}=await supabase.storage.from("picbo-assets").upload(path,bytes,{contentType:file.type,upsert:false});
  if(uploadErr){
    await supabase.from("assets").update({status:"failed"}).eq("id",asset.id);
    throw uploadErr;
  }
  await supabase.from("assets").update({status:"ready",storage_path:path}).eq("id",asset.id);

  if(isPrimary){
    await supabase.from("product_references").update({is_primary:false}).eq("product_id",productId).eq("workspace_id",ws.workspace_id);
  }
  const {error:refErr}=await supabase.from("product_references").insert({
    workspace_id:ws.workspace_id,product_id:productId,asset_id:asset.id,kind,is_primary:isPrimary,created_by:user.id
  });
  if(refErr)throw refErr;

  revalidatePath(`/products/${productId}`);
}

export async function deleteProductReference(productId:string,formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const refId=String(formData.get("refId")||"");
  if(!refId)throw new Error("REFERENCE_ID_REQUIRED");
  const supabase=await createClient();
  const {error}=await supabase.from("product_references").delete().eq("id",refId).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath(`/products/${productId}`);
}

/**
 * Runs real vision analysis (Gemini/Claude — whichever vision-capable provider
 * is configured) against the product's reference images and saves structured
 * identity rules. Goes through the normal AI job pipeline (credits reserved/
 * refunded, provider attempts logged) like every other generation.
 */
export async function analyzeProductIdentity(productId:string){
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const supabase=await createClient();

  const {data:product,error:productErr}=await supabase.from("products").select("id,name,brand").eq("id",productId).eq("workspace_id",ws.workspace_id).single();
  if(productErr)throw productErr;

  const {data:refs,error:refsErr}=await supabase.from("product_references")
    .select("asset_id,is_primary,assets(storage_path)")
    .eq("product_id",productId).eq("workspace_id",ws.workspace_id)
    .order("is_primary",{ascending:false}).limit(4);
  if(refsErr)throw refsErr;
  const paths=(refs||[]).map((r:any)=>r.assets?.storage_path).filter(Boolean);
  if(!paths.length)throw new Error("NO_REFERENCE_IMAGES");

  const imageUrls=await Promise.all(paths.map((p:string)=>createSignedAssetUrl(p,600)));

  await supabase.from("product_identity").upsert({
    product_id:productId,workspace_id:ws.workspace_id,identity_status:"analyzing"
  });

  try{
    const {result}=await runGenerationJob({
      task:"analysis",quality:"balanced",
      prompt:buildIdentityAnalysisPrompt(product.name,product.brand),
      imageUrls,productId,
      metadata:{purpose:"product_identity_analysis"}
    },2);

    const parsed=parseIdentityAnalysis(String(result.output||""));
    if(!parsed){
      await supabase.from("product_identity").upsert({
        product_id:productId,workspace_id:ws.workspace_id,identity_status:"needs_review",
        prompt_context:String(result.output||"").slice(0,2000)
      });
      revalidatePath(`/products/${productId}`);
      return {status:"needs_review" as const};
    }

    await supabase.from("product_identity").upsert({
      product_id:productId,workspace_id:ws.workspace_id,
      identity_status:parsed.confidence>=0.6?"ready":"needs_review",
      logo_rules:parsed.logoRules,packaging_rules:parsed.packagingRules,text_rules:parsed.textRules,
      shape_rules:parsed.shapeRules,color_rules:parsed.colorRules,proportion_rules:parsed.proportionRules,
      prompt_context:parsed.promptContext,negative_constraints:parsed.negativeConstraints,
      updated_at:new Date().toISOString()
    });
    revalidatePath(`/products/${productId}`);
    return {status:parsed.confidence>=0.6?"ready" as const:"needs_review" as const};
  }catch(e:any){
    await supabase.from("product_identity").upsert({
      product_id:productId,workspace_id:ws.workspace_id,identity_status:"failed"
    });
    revalidatePath(`/products/${productId}`);
    throw e;
  }
}
