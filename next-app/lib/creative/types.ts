export type AspectRatio="1:1"|"4:5"|"3:4"|"9:16"|"16:9";
export type ShotType="studio"|"lifestyle"|"ecommerce"|"closeup"|"detail"|"packaging"|"hero"|"social";
export type BackgroundMode="generated"|"transparent"|"solid"|"reference";
export interface PhotoshootRequest{
 productId:string;referenceAssetIds:string[];shotTypes:ShotType[];aspectRatio:AspectRatio;
 background:BackgroundMode;backgroundPrompt?:string;scenePrompt?:string;lighting?:string;
 cameraAngle?:string;variants:number;preserveProductIdentity:boolean;brandKitId?:string;
}
export interface ImageEditRequest{assetId:string;instruction:string;maskAssetId?:string;mode:"edit"|"inpaint"|"outpaint"|"remove_background"|"upscale";aspectRatio?:AspectRatio}
export const PHOTO_DEFAULTS={aspectRatio:"4:5" as AspectRatio,variants:4,lighting:"soft commercial studio",cameraAngle:"three-quarter"} as const;
