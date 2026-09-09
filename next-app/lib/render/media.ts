export type MediaKind="video"|"image"|"audio"|"caption"|"logo";

export interface MediaAsset {
  id:string;
  kind:MediaKind;
  storagePath:string;
  publicUrl?:string;
  mimeType:string;
  durationMs?:number;
  width?:number;
  height?:number;
}

export interface CaptionCue { startMs:number; endMs:number; text:string; }
export interface AudioTrack { kind:"music"|"voiceover"; storagePath:string; startMs:number; endMs:number; volume:number; }
export interface CompositionManifest {
  width:number; height:number; fps:number; durationMs:number;
  scenes:Array<{assetPath:string;startMs:number;durationMs:number;motion:string;transition:string;text?:string}>;
  audio:AudioTrack[];
  captions:CaptionCue[];
  logoPath?:string;
}
