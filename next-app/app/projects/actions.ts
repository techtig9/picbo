"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function createProject(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const name=String(formData.get("name")||"").trim();
  if(!name)throw new Error("PROJECT_NAME_REQUIRED");
  const supabase=await createClient();
  const {data,error}=await supabase.from("projects").insert({
    workspace_id:ws.workspace_id,name,status:"draft",created_by:user.id
  }).select("id").single();
  if(error)throw error;
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProjectStatus(projectId:string,formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const status=String(formData.get("status")||"");
  if(!["draft","active","archived"].includes(status))throw new Error("INVALID_STATUS");
  const supabase=await createClient();
  const {error}=await supabase.from("projects").update({status,updated_at:new Date().toISOString()}).eq("id",projectId).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteProject(formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const id=String(formData.get("id")||"");
  if(!id)throw new Error("PROJECT_ID_REQUIRED");
  const supabase=await createClient();
  const {error}=await supabase.from("projects").delete().eq("id",id).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath("/projects");
}

export async function linkProductToProject(projectId:string,formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const productId=String(formData.get("productId")||"");
  if(!productId)throw new Error("PRODUCT_ID_REQUIRED");
  const supabase=await createClient();
  // Confirm the product belongs to this workspace before linking (defense in depth
  // beyond RLS — avoids a confusing silent no-op if it doesn't).
  const {data:product,error:productErr}=await supabase.from("products").select("id").eq("id",productId).eq("workspace_id",ws.workspace_id).maybeSingle();
  if(productErr)throw productErr;
  if(!product)throw new Error("PRODUCT_NOT_FOUND");
  const {error}=await supabase.from("project_products").insert({project_id:projectId,product_id:productId});
  if(error&&error.code!=="23505")throw error; // ignore duplicate link
  revalidatePath(`/projects/${projectId}`);
}

export async function unlinkProductFromProject(projectId:string,formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const productId=String(formData.get("productId")||"");
  const supabase=await createClient();
  const {error}=await supabase.from("project_products").delete().eq("project_id",projectId).eq("product_id",productId);
  if(error)throw error;
  revalidatePath(`/projects/${projectId}`);
}
