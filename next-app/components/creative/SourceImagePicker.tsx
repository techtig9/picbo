"use client";
import {useCallback,useEffect,useRef,useState} from "react";

/**
 * Drag/drop upload plus a picker of recent workspace assets.
 *
 * Replaces the raw-URL text input the Image Studio used to require
 * ("right-click an image in Assets to copy its link"). Uploads go to
 * /api/assets/upload, which validates the real bytes and stores the file in
 * the private bucket; what comes back is a signed URL the provider can read.
 */

export interface PickedAsset{
  assetId:string;
  url:string;
  filename?:string|null;
  width?:number|null;
  height?:number|null;
}

interface Props{
  value:PickedAsset|null;
  onChange:(asset:PickedAsset|null)=>void;
  label?:string;
}

export function SourceImagePicker({value,onChange,label="Source image"}:Props){
  const [recent,setRecent]=useState<PickedAsset[]>([]);
  const [loadingRecent,setLoadingRecent]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [dragging,setDragging]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);

  const loadRecent=useCallback(async()=>{
    setLoadingRecent(true);
    try{
      const res=await fetch("/api/assets?kind=source&limit=12");
      if(res.ok){
        const data=await res.json();
        setRecent((data.assets||[]).filter((a:PickedAsset)=>a.url));
      }
    }catch{
      // A failed recents fetch is not worth an error banner — upload still works.
    }finally{
      setLoadingRecent(false);
    }
  },[]);

  useEffect(()=>{void loadRecent()},[loadRecent]);

  async function upload(file:File){
    setError("");
    setUploading(true);
    setProgress(0);

    try{
      const body=new FormData();
      body.append("file",file);

      // XMLHttpRequest rather than fetch: fetch cannot report upload progress,
      // and a 20MB photo on a phone connection needs a progress bar to not
      // look frozen.
      const result=await new Promise<any>((resolve,reject)=>{
        const xhr=new XMLHttpRequest();
        xhr.open("POST","/api/assets/upload");
        xhr.upload.onprogress=e=>{
          if(e.lengthComputable)setProgress(Math.round((e.loaded/e.total)*100));
        };
        xhr.onload=()=>{
          let parsed:any={};
          try{parsed=JSON.parse(xhr.responseText)}catch{}
          if(xhr.status>=200&&xhr.status<300)resolve(parsed);
          else reject(new Error(parsed.message||`Upload failed (${xhr.status})`));
        };
        xhr.onerror=()=>reject(new Error("Upload failed — check your connection and try again."));
        xhr.send(body);
      });

      onChange({
        assetId:result.assetId,url:result.url,filename:result.filename,
        width:result.width,height:result.height
      });
      void loadRecent();
    }catch(e:any){
      setError(e.message);
    }finally{
      setUploading(false);
      setProgress(0);
    }
  }

  function onDrop(e:React.DragEvent){
    e.preventDefault();
    setDragging(false);
    const file=e.dataTransfer.files?.[0];
    if(file)void upload(file);
  }

  if(value){
    return <div className="picker">
      <span className="picker-label">{label}</span>
      <div className="picker-selected">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.url} alt={value.filename||"Selected source image"}/>
        <div className="picker-selected-meta">
          <strong>{value.filename||"Selected image"}</strong>
          {value.width&&value.height&&<span className="muted">{value.width} × {value.height}</span>}
        </div>
        <button type="button" className="btn" onClick={()=>onChange(null)}>Change</button>
      </div>
    </div>;
  }

  return <div className="picker">
    <span className="picker-label">{label}</span>

    <div
      className={`dropzone${dragging?" dragging":""}`}
      onDragOver={e=>{e.preventDefault();setDragging(true)}}
      onDragLeave={()=>setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value=""}}
      />
      {uploading
        ? <>
            <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className="progress-bar" style={{width:`${progress}%`}}/>
            </div>
            <p className="muted">Uploading… {progress}%</p>
          </>
        : <>
            <p><strong>Drop an image here</strong></p>
            <p className="muted">or</p>
            <button type="button" className="btn" onClick={()=>inputRef.current?.click()}>Choose a file</button>
            <p className="muted small">PNG, JPEG, WebP or GIF · up to 25MB</p>
          </>
      }
    </div>

    {error&&<div className="notice error" role="alert">{error}</div>}

    {recent.length>0&&
      <div className="recent">
        <span className="picker-label">Or pick a recent upload</span>
        <div className="recent-grid">
          {recent.map(a=>
            <button key={a.assetId} type="button" className="recent-item" onClick={()=>onChange(a)} title={a.filename||"Asset"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.filename||"Recent asset"} loading="lazy"/>
            </button>
          )}
        </div>
      </div>
    }
    {loadingRecent&&recent.length===0&&<p className="muted small">Loading your recent uploads…</p>}
  </div>;
}
