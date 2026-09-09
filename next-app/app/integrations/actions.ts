"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";

export async function disconnectIntegration(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  if(ws.role!=="owner"&&ws.role!=="admin")throw new Error("ONLY_OWNERS_AND_ADMINS_CAN_MANAGE_INTEGRATIONS");
  const provider=String(formData.get("provider")||"");
  const supabase=await createClient();
  const {error}=await supabase.from("integration_connections").update({
    status:"disconnected",encrypted_credentials:null,disconnected_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq("workspace_id",ws.workspace_id).eq("provider",provider);
  if(error)throw error;
  await supabase.from("workspace_activity").insert({workspace_id:ws.workspace_id,actor_id:user.id,action:`disconnected_${provider}`});
  revalidatePath("/integrations");
}
