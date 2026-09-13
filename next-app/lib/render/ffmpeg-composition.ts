import type {CompositionManifest} from "./media";

export interface ResolvedAsset { path:string; mimeType?:string; durationMs?:number; }

export function aspectDimensions(aspect:string){
  switch(aspect){
    case "9:16": return {width:1080,height:1920};
    case "4:5": return {width:1080,height:1350};
    case "1:1": return {width:1080,height:1080};
    default: return {width:1920,height:1080};
  }
}

export function motionFilter(motion:string,durationSeconds:number){
  const frames=Math.max(1,Math.round(durationSeconds*30));
  switch(motion){
    case "zoom-in": return `zoompan=z='min(zoom+0.0015,1.15)':d=${frames}:s=1080x1920:fps=30`;
    case "zoom-out": return `zoompan=z='if(lte(on,1),1.15,max(zoom-0.0015,1))':d=${frames}:s=1080x1920:fps=30`;
    case "pan-left": return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)-min(on*2,iw/10)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    case "pan-right": return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)+min(on*2,iw/10)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30`;
    default: return `zoompan=z='1.04':d=${frames}:s=1080x1920:fps=30`;
  }
}

export function transitionFilter(kind:string,durationSeconds:number){
  const d=Math.max(.1,Math.min(1.5,durationSeconds));
  if(kind==="fade") return `fade=t=in:st=0:d=${d}`;
  if(kind==="blur") return `boxblur=2:1`;
  return "";
}

export function buildScenePlan(manifest:CompositionManifest){
  const scenes=manifest.scenes.map((s,i)=>({
    index:i,
    assetPath:s.assetPath,
    durationSeconds:s.durationMs/1000,
    motion:motionFilter(s.motion,s.durationMs/1000),
    transition:transitionFilter(s.transition,Math.min(1,s.durationMs/1000))
  }));
  return {scenes,dimensions:{width:manifest.width,height:manifest.height},durationMs:manifest.durationMs};
}

export function buildAudioMixPlan(manifest:CompositionManifest){
  return manifest.audio.map((a,i)=>({
    inputIndex:i,
    start:a.startMs/1000,
    end:a.endMs/1000,
    volume:Math.max(0,Math.min(2,a.volume))
  }));
}
