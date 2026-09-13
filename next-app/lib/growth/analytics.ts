export type AnalyticsEvent =
  | "project_created"|"asset_uploaded"|"photo_generated"|"ad_generated"
  | "video_rendered"|"exported"|"shared"|"template_used"|"credits_spent";

export interface AnalyticsPayload {
  event:AnalyticsEvent; workspaceId:string; projectId?:string;
  value?:number; metadata?:Record<string,unknown>;
}
export function normalizeAnalyticsEvent(p:AnalyticsPayload){
  return {...p,value:Number.isFinite(p.value)?p.value:0,metadata:p.metadata||{},createdAt:new Date().toISOString()};
}
