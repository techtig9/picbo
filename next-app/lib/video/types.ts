export type VideoAspectRatio="9:16"|"4:5"|"1:1"|"16:9";
export type MotionPreset="slow_zoom"|"push_in"|"pull_out"|"pan_left"|"pan_right"|"parallax"|"float"|"product_spin"|"ken_burns";
export type TransitionType="cut"|"fade"|"crossfade"|"slide"|"zoom"|"blur"|"whip";
export type VideoObjective="product_ad"|"social_short"|"promo"|"ugc_style"|"brand_story";
export interface VideoScene{order:number;assetId?:string;durationMs:number;motion:MotionPreset;transition:TransitionType;text?:string;voiceover?:string;visualPrompt?:string}
export interface VideoBrief{productId:string;projectId?:string;objective:VideoObjective;aspectRatio:VideoAspectRatio;durationSeconds:15|30;scenes:VideoScene[];musicId?:string;voiceId?:string;captions:boolean;brandKitId?:string;cta?:string}
export const VIDEO_PRESETS={
 product_ad:{durationSeconds:15,aspectRatio:"9:16" as const},
 social_short:{durationSeconds:15,aspectRatio:"9:16" as const},
 promo:{durationSeconds:15,aspectRatio:"9:16" as const},
 ugc_style:{durationSeconds:15,aspectRatio:"9:16" as const},
 brand_story:{durationSeconds:30,aspectRatio:"16:9" as const}
};
