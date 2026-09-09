"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {generateApiKey} from "@/lib/developer/api-keys";
import {revalidatePath} from "next/cache";

export async function createApiKey(name:string){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  if(ws.role!=="owner"&&ws.role!=="admin")throw new Error("ONLY_OWNERS_AND_ADMINS_CAN_MANAGE_API_KEYS");
  const trimmed=name.trim();
  if(!trimmed)throw new Error("KEY_NAME_REQUIRED");

  const {plaintext,prefix,hash}=generateApiKey();
  const supabase=await createClient();
  const {error}=await supabase.from("api_keys").insert({
    workspace_id:ws.workspace_id,name:trimmed,key_prefix:prefix,key_hash:hash,created_by:user.id
  });
  if(error)throw error;
  await supabase.from("workspace_activity").insert({workspace_id:ws.workspace_id,actor_id:user.id,action:"created_api_key"});
  revalidatePath("/developer");
  return {plaintext}; // only time the full key is ever available
}

export async function revokeApiKey(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  if(ws.role!=="owner"&&ws.role!=="admin")throw new Error("ONLY_OWNERS_AND_ADMINS_CAN_MANAGE_API_KEYS");
  const id=String(formData.get("id")||"");
  const supabase=await createClient();
  const {error}=await supabase.from("api_keys").update({revoked_at:new Date().toISOString()}).eq("id",id).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  await supabase.from("workspace_activity").insert({workspace_id:ws.workspace_id,actor_id:user.id,action:"revoked_api_key"});
  revalidatePath("/developer");
}
