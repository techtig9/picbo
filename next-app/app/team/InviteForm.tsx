"use client";
import {useState,useTransition} from "react";
import {inviteMember} from "./actions";

export function InviteForm(){
  const [isPending,startTransition]=useTransition();
  const [link,setLink]=useState("");
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);

  function submit(formData:FormData){
    setError("");setLink("");setCopied(false);
    startTransition(async()=>{
      try{
        const {token}=await inviteMember(formData);
        setLink(`${window.location.origin}/invite/${token}`);
      }catch(e:any){setError(e.message)}
    });
  }

  return <div>
    <form action={submit} className="form">
      <label>Email<input name="email" type="email" placeholder="teammate@company.com" required/></label>
      <label>Role
        <select name="role" defaultValue="editor">
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <button className="btn primary" disabled={isPending}>{isPending?"Inviting…":"Send invite"}</button>
    </form>
    {error&&<div className="notice" style={{marginTop:10}}>{error}</div>}
    {link&&<div className="notice" style={{marginTop:10}}>
      No email sending is connected yet — share this link directly with your teammate:
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input readOnly value={link} style={{flex:1,fontSize:12}}/>
        <button type="button" className="btn" onClick={()=>{navigator.clipboard.writeText(link);setCopied(true)}}>{copied?"Copied":"Copy"}</button>
      </div>
    </div>}
  </div>;
}
