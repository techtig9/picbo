"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";

async function assertOwnership(supabase:any,workspaceId:string,videoProjectId:string){
  const {data,error}=await supabase.from("video_projects").select("id").eq("id",videoProjectId).eq("workspace_id",workspaceId).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error("VIDEO_PROJECT_NOT_FOUND");
}

export async function updateSceneText(videoProjectId:string,sceneId:string,text:string){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const supabase=await createClient();
  await assertOwnership(supabase,ws.workspace_id,videoProjectId);
  const {error}=await supabase.from("video_scenes").update({text_overlay:text}).eq("id",sceneId).eq("video_project_id",videoProjectId);
  if(error)throw error;
  await supabase.from("video_projects").update({updated_at:new Date().toISOString()}).eq("id",videoProjectId);
  revalidatePath(`/create/video/${videoProjectId}/edit`);
}

export async function updateSceneTiming(videoProjectId:string,sceneId:string,durationMs:number,motion:string,transition:string){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const supabase=await createClient();
  await assertOwnership(supabase,ws.workspace_id,videoProjectId);
  const {error}=await supabase.from("video_scenes").update({
    duration_ms:Math.max(500,Math.round(durationMs)),motion,transition
  }).eq("id",sceneId).eq("video_project_id",videoProjectId);
  if(error)throw error;
  await supabase.from("video_projects").update({updated_at:new Date().toISOString()}).eq("id",videoProjectId);
  revalidatePath(`/create/video/${videoProjectId}/edit`);
}

/** Swaps a scene's order with its immediate neighbor (up/down reorder — persisted, not local-only). */
export async function moveScene(videoProjectId:string,sceneId:string,direction:"up"|"down"){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const supabase=await createClient();
  await assertOwnership(supabase,ws.workspace_id,videoProjectId);

  const {data:scenes,error}=await supabase.from("video_scenes").select("id,scene_order").eq("video_project_id",videoProjectId).order("scene_order");
  if(error)throw error;
  const idx=(scenes||[]).findIndex((s:any)=>s.id===sceneId);
  if(idx===-1)throw new Error("SCENE_NOT_FOUND");
  const swapIdx=direction==="up"?idx-1:idx+1;
  if(swapIdx<0||swapIdx>=(scenes||[]).length)return; // already at the edge, no-op

  const a=scenes[idx],b=scenes[swapIdx];
  // Swap via a temporary order value to avoid violating the unique(video_project_id,scene_order) constraint mid-update.
  const tempOrder=-1;
  await supabase.from("video_scenes").update({scene_order:tempOrder}).eq("id",a.id);
  await supabase.from("video_scenes").update({scene_order:a.scene_order}).eq("id",b.id);
  await supabase.from("video_scenes").update({scene_order:b.scene_order}).eq("id",a.id);
  await supabase.from("video_projects").update({updated_at:new Date().toISOString()}).eq("id",videoProjectId);
  revalidatePath(`/create/video/${videoProjectId}/edit`);
}

export async function renameVideoProject(videoProjectId:string,name:string){
  await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const trimmed=name.trim();
  if(!trimmed)throw new Error("NAME_REQUIRED");
  const supabase=await createClient();
  const {error}=await supabase.from("video_projects").update({name:trimmed,updated_at:new Date().toISOString()}).eq("id",videoProjectId).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  revalidatePath(`/create/video/${videoProjectId}/edit`);
}
