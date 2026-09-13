"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {log} from "@/lib/observability/logger";

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

/**
 * Permanently deletes the signed-in user's account.
 *
 * The privacy policy promises this and the master spec lists it as a SaaS
 * essential; it did not exist. There was a deleteWorkspace action, but no way
 * for a person to remove *themselves*.
 *
 * Order matters and is deliberate:
 *
 * 1. Refuse if the user is the sole owner of a workspace that still has other
 *    members. Deleting would either orphan their data or silently delete other
 *    people's work — neither is acceptable, so they must hand over or remove
 *    the others first.
 * 2. Delete storage objects before the database rows. The rows are what tell
 *    us which objects exist; dropping them first leaves unreachable files in
 *    the bucket that nobody is billed for and nobody can find.
 * 3. Delete the auth user last, via the service role. Everything else cascades
 *    from the foreign keys.
 *
 * Billing records are intentionally NOT deleted: financial records must be
 * retained, which the privacy policy states plainly rather than quietly doing.
 */
export async function deleteAccount(formData:FormData){
  const user=await requireUser();
  const confirmation=String(formData.get("confirm")||"").trim();
  if(confirmation!=="DELETE"){
    throw new Error('Type DELETE exactly to confirm you want to remove your account.');
  }

  const supabase=await createClient();
  const admin=createAdminClient();

  // 1. Refuse where deleting would affect other people.
  const {data:memberships}=await admin.from("workspace_members")
    .select("workspace_id,role").eq("user_id",user.id);

  for(const m of memberships||[]){
    if(m.role!=="owner")continue;
    const {count}=await admin.from("workspace_members")
      .select("user_id",{count:"exact",head:true})
      .eq("workspace_id",m.workspace_id).neq("user_id",user.id);
    if((count||0)>0){
      throw new Error(
        "You're the owner of a workspace that still has other members. Transfer ownership or remove them first, then delete your account."
      );
    }
  }

  const soleOwnedWorkspaces=(memberships||[]).filter(m=>m.role==="owner").map(m=>m.workspace_id);

  // 2. Storage before rows, or the files become unreachable orphans.
  for(const workspaceId of soleOwnedWorkspaces){
    try{
      const {data:objects}=await admin.storage.from("picbo-assets").list(workspaceId,{limit:1000});
      // Objects are stored at <workspace>/<asset>/<file>, so each listed entry
      // is a folder that must itself be listed.
      const paths:string[]=[];
      for(const entry of objects||[]){
        const {data:inner}=await admin.storage.from("picbo-assets").list(`${workspaceId}/${entry.name}`,{limit:100});
        for(const file of inner||[])paths.push(`${workspaceId}/${entry.name}/${file.name}`);
      }
      if(paths.length)await admin.storage.from("picbo-assets").remove(paths);
    }catch(e:any){
      // Logged, not fatal: a storage hiccup must not leave the user unable to
      // delete their account. Orphans are recoverable; a blocked deletion
      // right is a compliance failure.
      log("error","account.delete_storage_failed",{user_id:user.id,message:e?.message});
    }
  }

  // 3. Workspaces cascade to products, projects, assets, jobs and ledger rows.
  for(const workspaceId of soleOwnedWorkspaces){
    const {error}=await admin.from("workspaces").delete().eq("id",workspaceId);
    if(error)throw new Error(`Could not delete your workspace: ${error.message}`);
  }

  await admin.from("workspace_members").delete().eq("user_id",user.id);

  const {error:authError}=await admin.auth.admin.deleteUser(user.id);
  if(authError){
    throw new Error(`Your data was removed but the account itself could not be deleted: ${authError.message}. Contact support@picbo.ai.`);
  }

  log("info","account.deleted",{user_id:user.id,workspaces:soleOwnedWorkspaces.length});

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
