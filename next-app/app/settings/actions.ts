"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function updateProfile(formData:FormData){
  const user=await requireUser();
  const displayName=String(formData.get("displayName")||"").trim();
  const supabase=await createClient();
  const {error}=await supabase.from("profiles").update({display_name:displayName||null,updated_at:new Date().toISOString()}).eq("id",user.id);
  if(error)throw error;
  revalidatePath("/settings");
}

export async function updateWorkspaceName(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  if(ws.role!=="owner"&&ws.role!=="admin")throw new Error("ONLY_OWNERS_AND_ADMINS_CAN_RENAME_WORKSPACE");
  const name=String(formData.get("name")||"").trim();
  if(!name)throw new Error("WORKSPACE_NAME_REQUIRED");
  const supabase=await createClient();
  const {error}=await supabase.from("workspaces").update({name,updated_at:new Date().toISOString()}).eq("id",ws.workspace_id);
  if(error)throw error;
  await supabase.from("workspace_activity").insert({workspace_id:ws.workspace_id,actor_id:user.id,action:"renamed_workspace"});
  revalidatePath("/settings");
}

export async function changePassword(formData:FormData){
  const newPassword=String(formData.get("newPassword")||"");
  const confirm=String(formData.get("confirmPassword")||"");
  if(newPassword.length<8)throw new Error("Password must be at least 8 characters");
  if(newPassword!==confirm)throw new Error("Passwords don't match");
  const supabase=await createClient();
  const {error}=await supabase.auth.updateUser({password:newPassword});
  if(error)throw error;
}

/**
 * Deletes the workspace ONLY if the requester is its sole member — a
 * multi-member workspace has to be handed off or emptied first, rather than
 * silently deleting other people's access. Real deletion (cascades via FK),
 * not a fake confirmation.
 */
export async function deleteWorkspace(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  if(ws.role!=="owner")throw new Error("ONLY_THE_OWNER_CAN_DELETE_A_WORKSPACE");
  const confirmName=String(formData.get("confirmName")||"");
  const supabase=await createClient();

  const {data:ws2}=await supabase.from("workspaces").select("name").eq("id",ws.workspace_id).single();
  if(confirmName!==ws2?.name)throw new Error("Workspace name doesn't match — type it exactly to confirm deletion");

  const {count}=await supabase.from("workspace_members").select("user_id",{count:"exact",head:true}).eq("workspace_id",ws.workspace_id);
  if((count||0)>1)throw new Error("Remove all other members before deleting this workspace");

  const {error}=await supabase.from("workspaces").delete().eq("id",ws.workspace_id);
  if(error)throw error;
  void user;
  redirect("/auth/sign-in?message=Workspace+deleted");
}
