 "use server";
import {createClient} from "@/lib/supabase/server";import {requireUser,getCurrentWorkspace} from "@/lib/auth";import {runTextGenerationJob} from "@/lib/ai/jobs";import {buildAdCopyPrompt} from "@/lib/ads/prompt";import type {AdBrief} from "@/lib/ads/types";import {revalidatePath} from "next/cache";
export async function createAdBrief(input:AdBrief){
 const user=await requireUser();const ws=await getCurrentWorkspace();if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");const supabase=await createClient();
 const {data:product}=await supabase.from("products").select("id,name").eq("id",input.productId).eq("workspace_id",ws.workspace_id).maybeSingle();if(!product)throw new Error("PRODUCT_NOT_FOUND");
 const {data:brief,error}=await supabase.from("ad_briefs").insert({workspace_id:ws.workspace_id,product_id:input.productId,project_id:input.projectId||null,created_by:user.id,objective:input.objective,brief:input}).select("id").single();if(error)throw error;
 try{
  const result=await runTextGenerationJob({task:"copy",quality:"fast",prompt:buildAdCopyPrompt(input,product.name),productId:input.productId,metadata:{briefId:brief.id}});
  await supabase.from("ad_briefs").update({status:"generated"}).eq("id",brief.id);
  return {briefId:brief.id,jobId:result.jobId};
 }catch(e){await supabase.from("ad_briefs").update({status:"failed"}).eq("id",brief.id);throw e}
}
