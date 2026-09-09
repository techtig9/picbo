"use client";
import {useEffect,useState,useRef} from "react";

interface RenderJobStatus{
  id:string;status:string;progress:number;stage?:string;
  error_code?:string;error_message?:string;
}

const TERMINAL=new Set(["completed","dead_letter"]);
const POLL_MS=4000;

const STAGE_LABEL:Record<string,string>={
  queued:"Waiting for a render worker",
  processing:"Rendering",
  retrying:"Retrying after a transient failure",
  completed:"Done",
  dead_letter:"Failed permanently — credits refunded",
  failed:"Failed"
};

export function RenderStatus({renderJobId}:{renderJobId:string}){
  const [job,setJob]=useState<RenderJobStatus|null>(null);
  const [downloadUrl,setDownloadUrl]=useState("");
  const [error,setError]=useState("");
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);

  useEffect(()=>{
    let cancelled=false;
    async function poll(){
      try{
        const r=await fetch(`/api/creative/video/render/${renderJobId}`);
        const j=await r.json();
        if(cancelled)return;
        if(!r.ok){setError(j.error);return}
        setJob(j.job);
        if(j.job.status==="completed"){
          const outRes=await fetch(`/api/creative/video/render/${renderJobId}/output`);
          const outJson=await outRes.json();
          if(!cancelled&&outRes.ok)setDownloadUrl(outJson.url);
        }
        if(!TERMINAL.has(j.job.status)){
          timer.current=setTimeout(poll,POLL_MS);
        }
      }catch(e:any){
        if(!cancelled)setError(e.message);
      }
    }
    poll();
    return ()=>{cancelled=true;if(timer.current)clearTimeout(timer.current)};
  },[renderJobId]);

  if(error)return <div className="notice">Couldn't check render status: {error}</div>;
  if(!job)return <div className="muted" style={{fontSize:13}}>Checking render status…</div>;

  return <div className="card" style={{marginTop:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span className="status">{STAGE_LABEL[job.status]||job.status}</span>
      {!TERMINAL.has(job.status)&&<span className="muted" style={{fontSize:12}}>{job.progress}%</span>}
    </div>
    {job.stage&&!TERMINAL.has(job.status)&&<p className="muted" style={{marginTop:8,fontSize:12}}>{job.stage}</p>}
    {job.status==="dead_letter"&&<p className="muted" style={{marginTop:8,fontSize:12}}>{job.error_message||"The render failed after all retry attempts. Your credits were automatically refunded."}</p>}
    {job.status==="completed"&&downloadUrl&&
      <a className="btn primary" href={downloadUrl} style={{marginTop:10,display:"inline-block"}} target="_blank" rel="noreferrer">Download video</a>
    }
  </div>;
}
