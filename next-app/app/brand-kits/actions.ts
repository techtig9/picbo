"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";

function parseList(raw:FormDataEntryValue|null){
  return String(raw||"").split(",").map(s=>s.trim()).filter(Boolean);
}

export async function createBrandKit(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const name=String(formData.get("name")||"").trim();
  if(!name)throw new Error("BRAND_KIT_NAME_REQUIRED");
  const colors=parseList(formData.get("colors"));
  const fonts=parseList(formData.get("fonts"));
  const voiceTone=String(formData.get("voiceTone")||"").trim();
  const rulesText=String(formData.get("rules")||"").trim();
  const supabase=await createClient();
  const {data,error}=await supabase.from("brand_kits").insert({
    workspace_id:ws.workspace_id,
    name,
    colors,
    fonts,
    voice:voiceTone?{tone:voiceTone}:{},
    rules:rulesText?{notes:rulesText}:{},
    created_by:user.id
  }).select("id").single();
  if(error)throw error;
  revalidatePath("/brand-kits");
  return data;
}

export async function deleteBrandKit(formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const id=String(formData.get("id")||"");
  if(!id)throw new Error("BRAND_KIT_ID_REQUIRED");
  const supabase=await createClient();
  const {error}=await supabase.from("brand_kits").delete().eq("id",id).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath("/brand-kits");
}
