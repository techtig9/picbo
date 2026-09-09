function esc(v){
  return String(v||"").replace(/\\/g,"\\\\").replace(/:/g,"\\:").replace(/'/g,"\\'");
}

function timedText(o){
  const start=Math.max(0,Number(o.startMs||0))/1000;
  const end=Math.max(start,Number(o.endMs||0))/1000;
  const x=o.position==="left"?"w*0.08":o.position==="right"?"w*0.92-text_w":"(w-text_w)/2";
  const y=o.vertical==="top"?"h*0.12":o.vertical==="bottom"?"h*0.78":"(h-text_h)/2";
  return `drawtext=text='${esc(o.text)}':x=${x}:y=${y}:fontsize=${Number(o.fontSize||48)}:fontcolor=${o.color||"white"}:borderw=${Number(o.borderWidth||2)}:bordercolor=${o.borderColor||"black"}:enable='between(t,${start},${end})'`;
}

function animatedCaption(o){
  const start=Number(o.startMs||0)/1000;
  const end=Number(o.endMs||0)/1000;
  const progress=`min(1,max(0,(t-${start})/${Math.max(.1,end-start)}))`;
  const x=o.position==="left"?"w*0.08":o.position==="right"?"w*0.92-text_w":"(w-text_w)/2";
  const baseY=o.vertical==="top"?"h*0.12":o.vertical==="bottom"?"h*0.78":"(h-text_h)/2";
  const y=o.animation==="slide-up"?`(${baseY})+(1-${progress})*80`:baseY;
  const alpha=o.animation==="fade"?progress:1;
  return `drawtext=text='${esc(o.text)}':x=${x}:y=${y}:fontsize=${Number(o.fontSize||48)}:fontcolor=${o.color||"white"}:borderw=${Number(o.borderWidth||2)}:bordercolor=${o.borderColor||"black"}:alpha=${alpha}:enable='between(t,${start},${end})'`;
}

function logoFilter(path,position,opacity){
  const x=position==="left"?"w*0.06":position==="right"?"w-overlay_w*1.06":"(w-overlay_w)/2";
  const y=position==="top"?"h*0.05":position==="bottom"?"h-overlay_h*1.05":"(h-overlay_h)/2";
  return `movie=${path},format=rgba,colorchannelmixer=aa=${Math.max(0,Math.min(1,opacity??1))}[logo];[in][logo]overlay=${x}:${y}[out]`;
}

function watermarkFilter(text){
  return `drawtext=text='${esc(text)}':x=w-text_w-w*0.03:y=h-text_h-h*0.03:fontsize=24:fontcolor=white@0.55`;
}

function crossfade(duration){
  return `xfade=transition=fade:duration=${Math.max(.1,Math.min(1.5,duration))}:offset=0`;
}

module.exports={timedText,animatedCaption,logoFilter,watermarkFilter,crossfade};
