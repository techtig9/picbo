function escape(v){return String(v||"").replace(/\\/g,"\\\\").replace(/:/g,"\\:").replace(/'/g,"\\'")}
function transition(kind,d){
  const t=Math.max(.1,Math.min(1,d));
  if(kind==="fade") return `fade=t=in:st=0:d=${t}`;
  return "";
}
function logoOverlay(inputIndex,x,y,w,h){return `[${inputIndex}:v]scale=${w}:-1[logo]`}
function captionFilter(text,start,end,fontSize,color,x,y){
  return `drawtext=text='${escape(text)}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${color}:box=1:boxborderw=14:enable='between(t,${start},${end})'`;
}
module.exports={transition,logoOverlay,captionFilter};
