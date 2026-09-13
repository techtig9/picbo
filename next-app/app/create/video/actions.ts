 "use server";
import {createClient} from "@/lib/supabase/server";import {requireUser,getCurrentWorkspace} from "@/lib/auth";import {makeProductAdStoryboard} from "@/lib/video/storyboard";import {estimateVideoCredits} from "@/lib/video/render";import type {VideoBrief} from "@/lib/video/types";
export async function createVideoProject(input:VideoBrief){
 const user=await requireUser();const ws=await getCurrentWorkspace();if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");const supabase=await createClient();
 const {data:product}=await supabase.from("products").select("id,name").eq("id",input.productId).eq("workspace_id",ws.workspace_id).maybeSingle();if(!product)throw new Error("PRODUCT_NOT_FOUND");
 const brief={...input,scenes:input.scenes?.length?input.scenes:makeProductAdStoryboard()};
 const {data:video,error}=await supabase.from("video_projects").insert({workspace_id:ws.workspace_id,product_id:input.productId,project_id:input.projectId||null,created_by:user.id,name:`${product.name} ${input.durationSeconds}s Ad`,brief,duration_seconds:input.durationSeconds,aspect_ratio:input.aspectRatio,status:"storyboard_ready"}).select("id").single();if(error)throw error;
 const scenes=brief.scenes.map(s=>({video_project_id:video.id,scene_order:s.order,duration_ms:s.durationMs,asset_id:s.assetId||null,motion:s.motion,transition:s.transition,text_overlay:s.text||null,voiceover:s.voiceover||null,visual_prompt:s.visualPrompt||null}));
 const {error:sceneError}=await supabase.from("video_scenes").insert(scenes);if(sceneError)throw sceneError;
 const credits=estimateVideoCredits(brief);await supabase.from("video_projects").update({brief:{...brief,estimatedCredits:credits}}).eq("id",video.id);
 return {videoProjectId:video.id,estimatedCredits:credits,sceneCount:scenes.length};
}
