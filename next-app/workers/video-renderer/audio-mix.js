function buildAudioMix(tracks){
  const inputs=[];
  const filters=[];
  const labels=[];
  tracks.forEach((t,i)=>{
    inputs.push("-i",t.url);
    const label=`a${i}`;
    const start=Math.max(0,Number(t.startMs||0))/1000;
    const end=Math.max(start,Number(t.endMs||0))/1000;
    const vol=Math.max(0,Math.min(2,Number(t.volume??1)));
    let f=`[${i+1}:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,volume=${vol}`;
    if(Number(t.fadeInMs)>0)f+=`,afade=t=in:st=0:d=${Number(t.fadeInMs)/1000}`;
    if(Number(t.fadeOutMs)>0)f+=`,afade=t=out:st=${Math.max(0,end-start-Number(t.fadeOutMs)/1000)}:d=${Number(t.fadeOutMs)/1000}`;
    filters.push(`${f}[${label}]`);
    labels.push(`[${label}]`);
  });
  if(labels.length) filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=2[aout]`);
  return {inputs,filter:filters.join(";"),map:labels.length?"[aout]":null};
}
module.exports={buildAudioMix};
