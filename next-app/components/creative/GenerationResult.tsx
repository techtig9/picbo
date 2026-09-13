"use client";

/**
 * Renders what a generation actually produced.
 *
 * This is the fix for the single worst product failure in the audit: the
 * studio previously reported success as the string
 * "Job <id> completed. Results are returned by the configured provider."
 * and never displayed the image. A user spent credits and saw a sentence.
 *
 * Every state a job can be in gets a real, distinct rendering — queued,
 * running, validating, completed, failed, cancelled — along with which
 * provider and model served it and what it cost.
 */

export interface JobAsset{
  assetId:string;
  url:string|null;
  mimeType:string;
  sizeBytes:number;
  width?:number|null;
  height?:number|null;
}

export interface JobState{
  jobId:string;
  status:string;
  progress:number;
  task:string;
  provider?:string|null;
  model?:string|null;
  latencyMs?:number|null;
  assets:JobAsset[];
  error?:{code:string;message:string}|null;
  creditCost?:number;
}

const STAGE_COPY:Record<string,{label:string;detail:string}>={
  queued:{label:"Queued",detail:"Waiting for an available provider."},
  running:{label:"Generating",detail:"The model is working on your image."},
  validating:{label:"Validating",detail:"Checking and saving the result to your library."},
  completed:{label:"Done",detail:""},
  failed:{label:"Failed",detail:""},
  cancelled:{label:"Cancelled",detail:"This generation was cancelled before it started."}
};

const IN_FLIGHT=new Set(["queued","running","validating"]);

export function GenerationResult({
  job,onRetry,onCancel,busy
}:{
  job:JobState;
  onRetry:()=>void;
  onCancel:()=>void;
  busy?:boolean;
}){
  const stage=STAGE_COPY[job.status]||{label:job.status,detail:""};
  const inFlight=IN_FLIGHT.has(job.status);

  return <div className="result-panel">
    <div className="result-head">
      <div>
        <span className={`stage-badge stage-${job.status}`}>{stage.label}</span>
        {job.provider&&
          <span className="muted small" style={{marginLeft:10}}>
            {job.provider} · {job.model}
            {job.latencyMs?` · ${(job.latencyMs/1000).toFixed(1)}s`:""}
          </span>
        }
      </div>
      {typeof job.creditCost==="number"&&
        <span className="muted small">{job.creditCost} credit{job.creditCost===1?"":"s"}</span>
      }
    </div>

    {inFlight&&
      <div className="generating">
        {/* The "creative pulse" — a single calm indicator, not a spinner per element. */}
        <div className="pulse" aria-hidden="true"><span/><span/><span/></div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={job.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Generation ${stage.label.toLowerCase()}`}
        >
          <div className="progress-bar" style={{width:`${Math.max(6,job.progress)}%`}}/>
        </div>
        <p className="muted">{stage.detail}</p>
        {job.status==="queued"&&
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        }
      </div>
    }

    {job.status==="failed"&&job.error&&
      <div className="result-failed" role="alert">
        {/* The user-facing message, never a provider stack trace or the
            "ALL_PROVIDERS_FAILED: groq/... | cerebras/..." chain. */}
        <p>{job.error.message}</p>
        <button type="button" className="btn primary" onClick={onRetry} disabled={busy}>Try again</button>
      </div>
    }

    {job.status==="cancelled"&&
      <div className="result-failed">
        <p>{stage.detail} Your credits were refunded.</p>
        <button type="button" className="btn primary" onClick={onRetry} disabled={busy}>Start again</button>
      </div>
    }

    {job.status==="completed"&&job.assets.length>0&&
      <div className="result-assets">
        {job.assets.map((asset,i)=>
          <figure key={asset.assetId} className="result-asset">
            {asset.url
              ? asset.mimeType.startsWith("video/")
                ? <video src={asset.url} controls playsInline preload="metadata"/>
                /* eslint-disable-next-line @next/next/no-img-element */
                : <img src={asset.url} alt={`Generated result ${i+1}`}/>
              : <div className="result-asset-missing">Preview unavailable — open it from your library.</div>
            }
            <figcaption>
              <span className="muted small">
                {asset.width&&asset.height?`${asset.width} × ${asset.height} · `:""}
                {(asset.sizeBytes/1024).toFixed(0)} KB
              </span>
              <span className="result-actions">
                {asset.url&&
                  /* download attribute is cross-origin here (signed storage URL),
                     so the browser navigates rather than downloading; target=_blank
                     keeps the studio state intact either way. */
                  <a className="btn" href={asset.url} target="_blank" rel="noopener noreferrer">Open</a>
                }
                <a className="btn" href="/assets">In library</a>
              </span>
            </figcaption>
          </figure>
        )}
        <p className="muted small">
          Saved to your asset library automatically. Generated images are kept with their
          prompt, provider and model so you can trace any result back to how it was made.
        </p>
      </div>
    }

    {job.status==="completed"&&job.assets.length===0&&
      <p className="muted">This generation produced text rather than an image.</p>
    }
  </div>;
}
