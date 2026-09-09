import {getPreset,SocialPlatform} from "./platform-presets";
export function buildExportManifest(platform:SocialPlatform,durationMs:number){
  const p=getPreset(platform);
  if(durationMs>p.maxDurationMs) throw new Error("DURATION_EXCEEDS_PLATFORM_LIMIT");
  return {platform,width:p.width,height:p.height,maxDurationMs:p.maxDurationMs,safeZone:p.safeZone,format:"mp4",videoCodec:"h264",audioCodec:"aac"};
}
