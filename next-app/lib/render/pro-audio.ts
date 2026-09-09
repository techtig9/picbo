export interface AudioTrack {
  type:"music"|"voice"|"sfx";
  url:string;
  startMs:number;
  endMs:number;
  volume:number;
  fadeInMs:number;
  fadeOutMs:number;
}

export function clampVolume(v:number){
  return Math.max(0,Math.min(2,Number.isFinite(v)?v:1));
}

export function audioWindow(track:AudioTrack){
  return {
    start:Math.max(0,track.startMs)/1000,
    end:Math.max(track.startMs,track.endMs)/1000,
    volume:clampVolume(track.volume),
    fadeIn:Math.max(0,track.fadeInMs)/1000,
    fadeOut:Math.max(0,track.fadeOutMs)/1000
  };
}
