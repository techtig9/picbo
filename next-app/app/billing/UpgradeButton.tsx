"use client";
import {useTransition,useState} from "react";
import {startCheckout} from "./actions";

export function UpgradeButton({planId,period,label}:{planId:string;period:"monthly"|"annual";label:string}){
  const [isPending,startTransition]=useTransition();
  const [error,setError]=useState("");

  function onClick(){
    setError("");
    startTransition(async()=>{
      try{
        const {checkoutUrl}=await startCheckout(planId,period);
        window.location.href=checkoutUrl;
      }catch(e:any){setError(e.message)}
    });
  }

  return <div>
    <button className="btn primary" onClick={onClick} disabled={isPending}>{isPending?"Loading…":label}</button>
    {error&&<p className="muted" style={{marginTop:8,fontSize:12}}>{error}</p>}
  </div>;
}
