export type SocialPlatform =
  | "instagram_reels" | "tiktok" | "youtube_shorts"
  | "instagram_feed" | "facebook_feed" | "youtube";

export interface SocialPreset {
  id:SocialPlatform;
  label:string;
  width:number;
  height:number;
  maxDurationMs:number;
  safeZone:{top:number;bottom:number;left:number;right:number};
  recommended:boolean;
}

export const SOCIAL_PRESETS:Record<SocialPlatform,SocialPreset> = {
  instagram_reels:{id:"instagram_reels",label:"Instagram Reels",width:1080,height:1920,maxDurationMs:90000,safeZone:{top:.12,bottom:.16,left:.06,right:.06},recommended:true},
  tiktok:{id:"tiktok",label:"TikTok",width:1080,height:1920,maxDurationMs:180000,safeZone:{top:.10,bottom:.20,left:.06,right:.06},recommended:true},
  youtube_shorts:{id:"youtube_shorts",label:"YouTube Shorts",width:1080,height:1920,maxDurationMs:180000,safeZone:{top:.10,bottom:.14,left:.06,right:.06},recommended:true},
  instagram_feed:{id:"instagram_feed",label:"Instagram Feed",width:1080,height:1350,maxDurationMs:90000,safeZone:{top:.08,bottom:.12,left:.06,right:.06},recommended:false},
  facebook_feed:{id:"facebook_feed",label:"Facebook Feed",width:1080,height:1350,maxDurationMs:240000,safeZone:{top:.08,bottom:.12,left:.06,right:.06},recommended:false},
  youtube:{id:"youtube",label:"YouTube",width:1920,height:1080,maxDurationMs:3600000,safeZone:{top:.06,bottom:.08,left:.04,right:.04},recommended:false}
};

export function getPreset(id:SocialPlatform){return SOCIAL_PRESETS[id]}
export function safeRect(p:SocialPreset){
  return {
    x:p.width*p.safeZone.left,
    y:p.height*p.safeZone.top,
    width:p.width*(1-p.safeZone.left-p.safeZone.right),
    height:p.height*(1-p.safeZone.top-p.safeZone.bottom)
  }
}
