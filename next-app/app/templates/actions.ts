"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";

const CATEGORIES=["ad","photoshoot","video","shorts","ugc"] as const;

export async function createTemplate(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const name=String(formData.get("name")||"").trim();
  const category=String(formData.get("category")||"ad");
  if(!name)throw new Error("TEMPLATE_NAME_REQUIRED");
  if(!(CATEGORIES as readonly string[]).includes(category))throw new Error("INVALID_CATEGORY");

  const definition={
    objective:String(formData.get("objective")||""),
    tone:String(formData.get("tone")||""),
    audience:String(formData.get("audience")||""),
    cta:String(formData.get("cta")||""),
    hook:String(formData.get("hook")||"")
  };

  const supabase=await createClient();
  const {error}=await supabase.from("creative_templates").insert({
    workspace_id:ws.workspace_id,name,category,definition,featured:false
  });
  if(error)throw error;
  void user;
  revalidatePath("/templates");
}

export async function duplicateTemplate(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const id=String(formData.get("id")||"");
  const supabase=await createClient();
  const {data:source,error:sourceErr}=await supabase.from("creative_templates").select("name,category,definition").eq("id",id).maybeSingle();
  if(sourceErr)throw sourceErr;
  if(!source)throw new Error("TEMPLATE_NOT_FOUND");
  const {error}=await supabase.from("creative_templates").insert({
    workspace_id:ws.workspace_id,name:`${source.name} (copy)`,category:source.category,definition:source.definition,featured:false
  });
  if(error)throw error;
  void user;
  revalidatePath("/templates");
}

export async function deleteTemplate(formData:FormData){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const id=String(formData.get("id")||"");
  const supabase=await createClient();
  // Only ever deletes templates owned by this workspace (RLS also enforces
  // this — featured/global templates have workspace_id null and aren't
  // matched by this filter).
  const {error}=await supabase.from("creative_templates").delete().eq("id",id).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath("/templates");
}
