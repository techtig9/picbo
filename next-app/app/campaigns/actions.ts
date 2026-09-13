"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function createCampaign(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const name=String(formData.get("name")||"").trim();
  const productId=String(formData.get("productId")||"");
  const objective=String(formData.get("objective")||"").trim();
  const audienceText=String(formData.get("audience")||"").trim();
  const budgetRaw=String(formData.get("budget")||"").trim();
  if(!name)throw new Error("CAMPAIGN_NAME_REQUIRED");
  if(!productId)throw new Error("PRODUCT_REQUIRED");
  if(!objective)throw new Error("OBJECTIVE_REQUIRED");

  const supabase=await createClient();
  const {data,error}=await supabase.from("campaigns").insert({
    workspace_id:ws.workspace_id,product_id:productId,name,objective,
    audience:audienceText?{description:audienceText}:{},
    budget_cents:budgetRaw?Math.round(Number(budgetRaw)*100):null,
    created_by:user.id
  }).select("id").single();
  if(error)throw error;
  revalidatePath("/campaigns");
  redirect(`/campaigns/${data.id}`);
}

export async function updateCampaignStatus(campaignId:string,formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const status=String(formData.get("status")||"");
  if(!["draft","active","paused","archived"].includes(status))throw new Error("INVALID_STATUS");
  const supabase=await createClient();
  const {error}=await supabase.from("campaigns").update({status,updated_at:new Date().toISOString()}).eq("id",campaignId).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
}

export async function duplicateCampaign(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const id=String(formData.get("id")||"");
  const supabase=await createClient();
  const {data:source,error:sourceErr}=await supabase.from("campaigns").select("product_id,name,objective,audience,budget_cents").eq("id",id).eq("workspace_id",ws.workspace_id).maybeSingle();
  if(sourceErr)throw sourceErr;
  if(!source)throw new Error("CAMPAIGN_NOT_FOUND");
  const {error}=await supabase.from("campaigns").insert({
    workspace_id:ws.workspace_id,product_id:source.product_id,name:`${source.name} (copy)`,
    objective:source.objective,audience:source.audience,budget_cents:source.budget_cents,
    created_by:user.id,status:"draft"
  });
  if(error)throw error;
  revalidatePath("/campaigns");
}

export async function archiveCampaign(formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const id=String(formData.get("id")||"");
  const supabase=await createClient();
  const {error}=await supabase.from("campaigns").update({status:"archived",updated_at:new Date().toISOString()}).eq("id",id).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath("/campaigns");
}

export async function linkAdBriefToCampaign(campaignId:string,formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const adBriefId=String(formData.get("adBriefId")||"");
  if(!adBriefId)throw new Error("AD_BRIEF_REQUIRED");
  const supabase=await createClient();
  // Confirm the brief belongs to this workspace before linking.
  const {data:brief,error:briefErr}=await supabase.from("ad_briefs").select("id").eq("id",adBriefId).eq("workspace_id",ws.workspace_id).maybeSingle();
  if(briefErr)throw briefErr;
  if(!brief)throw new Error("AD_BRIEF_NOT_FOUND");
  const {error}=await supabase.from("campaign_ad_briefs").insert({campaign_id:campaignId,ad_brief_id:adBriefId});
  if(error&&error.code!=="23505")throw error;
  revalidatePath(`/campaigns/${campaignId}`);
}
