"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {AppShell} from "@/components/app-shell";
import {SourceImagePicker,type PickedAsset} from "@/components/creative/SourceImagePicker";
import {GenerationResult,type JobState} from "@/components/creative/GenerationResult";

/**
 * Image Studio.
 *
 * Rebuilt in Phase 2. The previous version submitted a job and then reported
 * `Job ${id} completed. Results are returned by the configured provider.` as
 * plain text — the generated image was never rendered, downloadable, or saved
 * anywhere the user could reach it. It also required pasting a raw asset URL
 * for every edit mode.
 *
 * Now: submit returns a job id, this polls it, and every state is shown for
 * real, ending in the actual image.
 */

const IMAGE_MODES=["generate","edit","outpaint","background_remove","upscale"] as const;
type ImageMode=typeof IMAGE_MODES[number];

const MODE_LABEL:Record<ImageMode,string>={
  generate:"Generate",edit:"Edit / Inpaint",outpaint:"Outpaint",
  background_remove:"Remove background",upscale:"Upscale"
};
const NEEDS_SOURCE_IMAGE=new Set<ImageMode>(["edit","outpaint","background_remove","upscale"]);
const NEEDS_PROMPT=new Set<ImageMode>(["generate","edit","outpaint"]);
const TASK_FOR_MODE:Record<ImageMode,string>={
  generate:"image",edit:"image_edit",outpaint:"image_edit",
  background_remove:"background_remove",upscale:"upscale"
};

const RATIOS=["1:1","4:5","3:4","9:16","16:9"];
const QUALITIES=[["fast","Fast"],["balanced","Balanced"],["pro","Pro"]] as const;

const POLL_INTERVAL_MS=1500;
const POLL_TIMEOUT_MS=5*60*1000;
const TERMINAL=new Set(["completed","failed","cancelled"]);

export default function ImageStudio(){
  const [mode,setMode]=useState<ImageMode>("generate");
  const [prompt,setPrompt]=useState("");
  const [negativePrompt,setNegativePrompt]=useState("");
  const [ratio,setRatio]=useState("1:1");
  const [quality,setQuality]=useState<"fast"|"balanced"|"pro">("balanced");
  const [source,setSource]=useState<PickedAsset|null>(null);

  const [job,setJob]=useState<JobState|null>(null);
  const [busy,setBusy]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const [history,setHistory]=useState<JobState[]>([]);

  // Cleared on unmount and before each new submit so an abandoned poll can
  // never write over a newer job's state.
  const pollTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const stopPolling=useCallback(()=>{
    if(pollTimer.current){clearTimeout(pollTimer.current);pollTimer.current=null}
  },[]);
  useEffect(()=>stopPolling,[stopPolling]);

  const poll=useCallback((jobId:string,startedAt:number)=>{
    pollTimer.current=setTimeout(async()=>{
      try{
        const res=await fetch(`/api/ai/jobs/${jobId}`);
        if(!res.ok)throw new Error((await res.json().catch(()=>({}))).message||"Could not read job status.");
        const data=await res.json();

        const next:JobState={
          jobId:data.jobId,status:data.status,progress:data.progress??0,task:data.task,
          provider:data.provider,model:data.model,latencyMs:data.latencyMs,
          assets:data.assets||[],error:data.error
        };
        setJob(prev=>({...next,creditCost:prev?.creditCost}));

        if(TERMINAL.has(data.status)){
          setBusy(false);
          if(data.status==="completed"&&next.assets.length>0){
            setHistory(h=>[next,...h].slice(0,8));
          }
          return;
        }
        if(Date.now()-startedAt>POLL_TIMEOUT_MS){
          setBusy(false);
          setJob(prev=>prev?{...prev,status:"failed",error:{
            code:"POLL_TIMEOUT",
            message:"This is taking longer than expected. It may still finish — check your library in a few minutes."
          }}:prev);
          return;
        }
        poll(jobId,startedAt);
      }catch(e:any){
        setBusy(false);
        setJob(prev=>prev?{...prev,status:"failed",error:{code:"POLL_FAILED",message:e.message}}:prev);
      }
    },POLL_INTERVAL_MS);
  },[]);

  async function run(){
    stopPolling();
    setSubmitError("");
    setBusy(true);
    setJob(null);

    try{
      const res=await fetch("/api/ai/generate",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          task:TASK_FOR_MODE[mode],
          quality,
          prompt:NEEDS_PROMPT.has(mode)?prompt:undefined,
          negativePrompt:negativePrompt.trim()||undefined,
          aspectRatio:mode==="generate"?ratio:undefined,
          imageUrls:NEEDS_SOURCE_IMAGE.has(mode)&&source?[source.url]:undefined,
          // A fresh key per submit: a retry after a failure is a NEW generation
          // and must not be deduplicated onto the failed job.
          metadata:{idempotencyKey:crypto.randomUUID(),mode}
        })
      });

      const data=await res.json();
      if(!res.ok){
        setBusy(false);
        setSubmitError(data.message||data.error||"Could not start the generation.");
        return;
      }

      setJob({
        jobId:data.jobId,status:data.status,progress:0,task:TASK_FOR_MODE[mode],
        assets:[],creditCost:data.creditCost
      });
      poll(data.jobId,Date.now());
    }catch(e:any){
      setBusy(false);
      setSubmitError(e.message||"Could not reach the server.");
    }
  }

  async function cancel(){
    if(!job)return;
    try{
      const res=await fetch(`/api/ai/jobs/${job.jobId}/cancel`,{method:"POST"});
      const data=await res.json();
      if(res.ok){
        stopPolling();
        setBusy(false);
        setJob(prev=>prev?{...prev,status:"cancelled"}:prev);
      }else{
        // Most often: it started between the click and the request. Let the
        // poll keep running rather than telling the user it stopped.
        setSubmitError(data.message||"Could not cancel this job.");
      }
    }catch{
      setSubmitError("Could not reach the server to cancel.");
    }
  }

  const ready=NEEDS_PROMPT.has(mode)
    ? prompt.trim().length>0&&(!NEEDS_SOURCE_IMAGE.has(mode)||Boolean(source))
    : Boolean(source);

  return <AppShell><div className="content">
    <div className="eyebrow">AI IMAGE ENGINE</div>
    <h1 className="title">Image Studio</h1>
    <p className="muted">Generate, edit, remove backgrounds and upscale — results are saved straight to your library.</p>

    <div className="chips" role="tablist" aria-label="Image mode">
      {IMAGE_MODES.map(m=>
        <button
          key={m}
          role="tab"
          aria-selected={mode===m}
          className={`chip${mode===m?" chip-active":""}`}
          onClick={()=>{setMode(m);setSubmitError("")}}
        >{MODE_LABEL[m]}</button>
      )}
    </div>

    <div className="studio-grid">
      <div className="hero studio-controls">
        {NEEDS_SOURCE_IMAGE.has(mode)&&
          <SourceImagePicker value={source} onChange={setSource} label="Source image"/>
        }

        {NEEDS_PROMPT.has(mode)&&
          <label className="field">
            <span className="picker-label">Prompt</span>
            <textarea
              value={prompt}
              onChange={e=>setPrompt(e.target.value)}
              placeholder="Premium studio product image, soft shadows, luxury editorial lighting…"
              maxLength={12000}
            />
          </label>
        }

        {NEEDS_PROMPT.has(mode)&&
          <label className="field">
            <span className="picker-label">Negative prompt <span className="muted small">(optional)</span></span>
            <input
              className="text-input"
              value={negativePrompt}
              onChange={e=>setNegativePrompt(e.target.value)}
              placeholder="blurry, watermark, distorted text"
            />
          </label>
        }

        {mode==="generate"&&
          <div className="field">
            <span className="picker-label">Aspect ratio</span>
            <div className="chips">
              {RATIOS.map(x=>
                <button key={x} className={`chip${ratio===x?" chip-active":""}`} onClick={()=>setRatio(x)}>{x}</button>
              )}
            </div>
          </div>
        }

        <div className="field">
          <span className="picker-label">Quality</span>
          <div className="chips">
            {QUALITIES.map(([value,label])=>
              <button
                key={value}
                className={`chip${quality===value?" chip-active":""}`}
                onClick={()=>setQuality(value)}
              >{label}</button>
            )}
          </div>
        </div>

        {submitError&&<div className="notice error" role="alert">{submitError}</div>}

        <button className="btn primary submit" disabled={!ready||busy} onClick={run}>
          {busy?"Working…":MODE_LABEL[mode]}
        </button>
        {!ready&&!busy&&
          <p className="muted small">
            {NEEDS_SOURCE_IMAGE.has(mode)&&!source
              ? "Add a source image to continue."
              : "Write a prompt to continue."}
          </p>
        }
      </div>

      <div className="studio-output">
        {job
          ? <GenerationResult job={job} onRetry={run} onCancel={cancel} busy={busy}/>
          : <div className="result-panel empty">
              <p><strong>Your results will appear here</strong></p>
              <p className="muted">
                Each generation is saved to your library with the prompt, provider and model that produced it.
              </p>
            </div>
        }
      </div>
    </div>

    {history.length>0&&
      <>
        <div className="head"><h2>This session</h2></div>
        <div className="history-grid">
          {history.flatMap(h=>h.assets.map(a=>
            a.url
              ? <a key={a.assetId} href={a.url} target="_blank" rel="noopener noreferrer" className="history-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="Earlier result from this session" loading="lazy"/>
                </a>
              : null
          ))}
        </div>
      </>
    }
  </div></AppShell>;
}
