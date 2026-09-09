"use client";
import {useState,useTransition} from "react";
import {EditorShell} from "@/components/creative/EditorShell";
import {Timeline} from "@/components/creative/Timeline";
import {PreviewCanvas} from "@/components/creative/PreviewCanvas";
import {ExportPanel} from "@/components/creative/ExportPanel";
import {RenderStatus} from "@/components/render/RenderStatus";
import type {EditorScene,EditorState,EditorTab} from "@/lib/ui/editor-model";
import {updateSceneText,moveScene,renameVideoProject} from "./actions";

export interface EditorClientProps{
  videoProjectId:string;
  title:string;
  aspect:"9:16"|"4:5"|"1:1"|"16:9";
  initialScenes:EditorScene[];
}

export function VideoEditorClient({videoProjectId,title,aspect,initialScenes}:EditorClientProps){
  const [isPending,startTransition]=useTransition();
  const [saveMsg,setSaveMsg]=useState("");
  const [renderMsg,setRenderMsg]=useState("");
  const [renderBusy,setRenderBusy]=useState(false);
  const [renderJobId,setRenderJobId]=useState("");
  const [state,setState]=useState<EditorState>({
    projectId:videoProjectId,title,aspect,activeTab:"scenes",
    scenes:initialScenes,selectedSceneId:initialScenes[0]?.id,
    zoom:1,playing:false,currentTimeMs:0,dirty:false
  });

  const selectedScene=state.scenes.find(s=>s.id===state.selectedSceneId);

  function onTab(t:EditorTab){setState(s=>({...s,activeTab:t}))}
  function onSelect(id:string){setState(s=>({...s,selectedSceneId:id,activeTab:"text"}))}
  function onSeek(ms:number){setState(s=>({...s,currentTimeMs:ms}))}
  function onPlay(){setState(s=>({...s,playing:!s.playing}))}

  function saveText(text:string){
    if(!selectedScene)return;
    setState(s=>({...s,scenes:s.scenes.map(sc=>sc.id===selectedScene.id?{...sc,text}:sc),dirty:true}));
    startTransition(async()=>{
      try{
        await updateSceneText(videoProjectId,selectedScene.id,text);
        setSaveMsg("Saved");
        setState(s=>({...s,dirty:false}));
      }catch(e:any){setSaveMsg(`Save failed: ${e.message}`)}
    });
  }

  function move(direction:"up"|"down"){
    if(!selectedScene)return;
    startTransition(async()=>{
      try{await moveScene(videoProjectId,selectedScene.id,direction);setSaveMsg("Reordered");}
      catch(e:any){setSaveMsg(`Reorder failed: ${e.message}`)}
    });
  }

  async function onExport(platform:string){
    setRenderBusy(true);setRenderMsg(`Queueing render for ${platform}…`);
    try{
      const r=await fetch("/api/creative/video/render",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({videoProjectId,platform,idempotencyKey:crypto.randomUUID()})});
      const j=await r.json();
      setRenderMsg(r.ok?`Render queued: ${j.renderJobId}. Estimated credits: ${j.estimatedCredits}.`:`Render error: ${j.error}`);
      if(r.ok)setRenderJobId(j.renderJobId);
    }catch(e:any){setRenderMsg(e.message)}finally{setRenderBusy(false)}
  }

  return <div>
    <EditorShell state={state} onTab={onTab} onPlay={onPlay} onExport={()=>onTab("export")}>
      {state.activeTab==="export"?
        <ExportPanel onExport={onExport}/>
      :
        <div style={{display:"flex",height:"100%",flexDirection:"column"}}>
          <div style={{flex:1,minHeight:0}}>
            <PreviewCanvas aspect={state.aspect}>
              {selectedScene?.text&&<div style={{position:"absolute",bottom:24,left:0,right:0,textAlign:"center",color:"#fff",fontWeight:700,fontSize:18,textShadow:"0 2px 8px #000"}}>{selectedScene.text}</div>}
            </PreviewCanvas>
          </div>
          {state.activeTab==="text"&&selectedScene&&<div style={{padding:16,borderTop:"1px solid var(--line)"}}>
            <label className="muted" style={{display:"block",marginBottom:6,fontSize:11}}>Scene text overlay ({selectedScene.id})</label>
            <textarea
              defaultValue={selectedScene.text||""}
              onBlur={e=>saveText(e.target.value)}
              style={{minHeight:60}}
              placeholder="On-screen text for this scene…"
            />
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button className="btn" onClick={()=>move("up")} disabled={isPending}>Move earlier</button>
              <button className="btn" onClick={()=>move("down")} disabled={isPending}>Move later</button>
              {saveMsg&&<span className="muted" style={{alignSelf:"center"}}>{saveMsg}</span>}
            </div>
          </div>}
        </div>
      }
    </EditorShell>
    <Timeline state={state} onSelect={onSelect} onSeek={onSeek}/>
    {renderMsg&&<div className="notice" style={{marginTop:16}}>{renderMsg}</div>}
    {renderJobId&&<RenderStatus renderJobId={renderJobId}/>}
  </div>;
}
