function esc(v){return String(v||"").replace(/\\/g,"\\\\").replace(/:/g,"\\:").replace(/'/g,"\\'").replace(/%/g,"\\%")}
function y(p){return p==="top"?"h*0.10":p==="center"?"(h-text_h)/2":"h*0.80"}
function overlayFilters(a){return a.map(o=>`drawtext=text='${esc(o.text)}':x=(w-text_w)/2:y=${y(o.position)}:fontsize=${o.fontSize}:fontcolor=white:box=1:boxborderw=18:alpha=${o.opacity}:enable='between(t,${o.startMs/1000},${o.endMs/1000})'`)}
module.exports={overlayFilters};
