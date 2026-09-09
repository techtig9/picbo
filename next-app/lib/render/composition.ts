import type {CompositionManifest} from "./media";

export function buildCompositionManifest(input:CompositionManifest){
  if(input.durationMs<=0) throw new Error("INVALID_DURATION");
  if(input.width<320||input.height<320) throw new Error("INVALID_RESOLUTION");
  if(input.fps<24||input.fps>60) throw new Error("INVALID_FPS");

  const end=input.scenes.reduce((n,s)=>n+s.durationMs,0);
  if(Math.abs(end-input.durationMs)>100) throw new Error("TIMELINE_DURATION_MISMATCH");

  return {
    ...input,
    captions:input.captions.filter(c=>c.endMs>0&&c.startMs<c.endMs).map(c=>({
      ...c,
      startMs:Math.max(0,c.startMs),
      endMs:Math.min(input.durationMs,c.endMs)
    })),
    audio:input.audio.filter(a=>a.endMs>a.startMs)
  };
}

export function captionSrt(cues:CompositionManifest["captions"]){
  const ts=(ms:number)=>{
    const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000),x=ms%1000;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`;
  };
  return cues.map((c,i)=>`${i+1}\\n${ts(c.startMs)} --> ${ts(c.endMs)}\\n${c.text}\\n`).join("\\n");
}
