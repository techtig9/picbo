import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import crypto from "node:crypto";
export async function POST(req:Request){
 try{
  const ws=await getCurrentWorkspace(); if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const b=await req.json(); if(!b.projectId)return NextResponse.json({error:"PROJECT_REQUIRED"},{status:400});
  const token=crypto.randomBytes(24).toString("base64url");
  const s=await createClient();
  const {error}=await s.from("project_shares").insert({workspace_id:ws.workspace_id,project_id:b.projectId,token,permission:b.permission==="edit"?"edit":"view"});
  if(error)throw error;
  return NextResponse.json({token,permission:b.permission==="edit"?"edit":"view"});
 }catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:500})}
}
