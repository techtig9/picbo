export type AdPlatform="meta_feed"|"instagram_feed"|"instagram_story"|"instagram_reel"|"tiktok"|"youtube_shorts"|"google_display"|"linkedin";
export type AdFormat="static"|"carousel"|"story"|"short";
export type CreativeObjective="sales"|"leads"|"traffic"|"awareness"|"app_installs";
export interface AdBrief{productId:string;projectId?:string;brandKitId?:string;objective:CreativeObjective;platforms:AdPlatform[];format:AdFormat;offer?:string;audience?:string;tone?:string;language?:string;hook?:string;cta?:string;variants:number;assetIds:string[]}
export interface AdVariant{id:string;headline:string;primaryText:string;description?:string;cta:string;platform:AdPlatform;assetId?:string;score?:number}
export const PLATFORM_SPECS:Record<AdPlatform,{width:number;height:number,ratio:string,label:string}>={
 meta_feed:{width:1200,height:628,ratio:"1.91:1",label:"Meta Feed"},
 instagram_feed:{width:1080,height:1350,ratio:"4:5",label:"Instagram Feed"},
 instagram_story:{width:1080,height:1920,ratio:"9:16",label:"Instagram Story"},
 instagram_reel:{width:1080,height:1920,ratio:"9:16",label:"Instagram Reel"},
 tiktok:{width:1080,height:1920,ratio:"9:16",label:"TikTok"},
 youtube_shorts:{width:1080,height:1920,ratio:"9:16",label:"YouTube Shorts"},
 google_display:{width:1200,height:628,ratio:"1.91:1",label:"Google Display"},
 linkedin:{width:1200,height:627,ratio:"1.91:1",label:"LinkedIn"}
};
