 "use server";
import {createClient} from "@/lib/supabase/server";import {getCurrentWorkspace,requireUser} from "@/lib/auth";import {buildProductShootPrompt} from "@/lib/creative/prompt";import type {PhotoshootRequest} from "@/lib/creative/types";import {runGenerationJob} from "@/lib/ai/jobs";import {revalidatePath} from "next/cache";
export async function createPhotoshoot(input:PhotoshootRequest){
 const user=await requireUser();const ws=await getCurrentWorkspace();if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
 const supabase=await createClient();const {data:product}=await supabase.from("products").select("id,name").eq("id",input.productId).eq("workspace_id",ws.workspace_id).maybeSingle();if(!product)throw new Error("PRODUCT_NOT_FOUND");
 // If this product has a completed Product Identity analysis, use its real,
 // specific prompt context/negative constraints instead of the generic
 // "preserve identity" boilerplate — connects the Phase 3 vision-analysis
 // feature to actual generation, which nothing previously did.
 let identityContext:{promptContext?:string;negativeConstraints?:string}|undefined;
 if(input.preserveProductIdentity){
  const {data:identity}=await supabase.from("product_identity").select("identity_status,prompt_context,negative_constraints").eq("product_id",input.productId).eq("workspace_id",ws.workspace_id).maybeSingle();
  if(identity?.identity_status==="ready"){
   identityContext={promptContext:identity.prompt_context||undefined,negativeConstraints:identity.negative_constraints||undefined};
  }
 }
 const {data:shoot,error}=await supabase.from("creative_shoots").insert({workspace_id:ws.workspace_id,product_id:input.productId,created_by:user.id,name:`${product.name} AI Photoshoot`,request:input,status:"running"}).select("id").single();if(error)throw error;
 const prompt=buildProductShootPrompt(input,identityContext);
 try{
  const result=await runGenerationJob({task:"image",quality:"balanced",prompt,imageUrls:[],aspectRatio:input.aspectRatio,productId:input.productId,metadata:{shootId:shoot.id,referenceAssetIds:input.referenceAssetIds}},Math.max(1,input.variants));
  await supabase.from("creative_shoots").update({status:"completed"}).eq("id",shoot.id);
  await supabase.from("creative_shot_items").insert(input.shotTypes.flatMap((shot,i)=>Array.from({length:input.variants},(_,v)=>({shoot_id:shoot.id,job_id:result.jobId,shot_type:shot,aspect_ratio:input.aspectRatio,status:"completed",variant_no:v+1,prompt}))));
  revalidatePath("/create/photoshoot");return {shootId:shoot.id,jobId:result.jobId};
 }catch(e){await supabase.from("creative_shoots").update({status:"failed"}).eq("id",shoot.id);throw e}
}
