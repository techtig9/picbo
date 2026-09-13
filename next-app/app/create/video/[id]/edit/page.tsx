import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {VideoEditorClient} from "./EditorClient";
import type {EditorScene} from "@/lib/ui/editor-model";

export default async function VideoEditorPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  const {data:project}=ws?.workspace_id
    ?await supabase.from("video_projects").select("id,name,aspect_ratio").eq("id",id).eq("workspace_id",ws.workspace_id).maybeSingle()
    :{data:null};
  if(!project)return <AppShell><div className="content"><div className="notice">Video project not found.</div></div></AppShell>;

  const {data:scenes}=await supabase.from("video_scenes").select("id,scene_order,duration_ms,motion,transition,text_overlay,asset_id").eq("video_project_id",id).order("scene_order");

  const editorScenes:EditorScene[]=(scenes||[]).map((s:any)=>({
    id:s.id,durationMs:s.duration_ms,motion:s.motion,transition:s.transition,text:s.text_overlay||undefined
  }));

  return <AppShell><div className="content">
    <div className="eyebrow">CREATIVE EDITOR</div>
    <h1 className="title">{project.name}</h1>
    <p className="muted">Edit scene text, reorder scenes, and export when you're ready. Changes save as you go.</p>
    <div style={{marginTop:22}}>
      <VideoEditorClient
        videoProjectId={project.id}
        title={project.name}
        aspect={(project.aspect_ratio as any)||"9:16"}
        initialScenes={editorScenes}
      />
    </div>
  </div></AppShell>;
}
