import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
export async function POST(req:Request){
 try{
  const ws=await getCurrentWorkspace(); if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const b=await req.json();
  const s=await createClient();
  const {error}=await s.from("analytics_events").insert({workspace_id:ws.workspace_id,event_name:String(b.event),project_id:b.projectId||null,value:Number(b.value||0),metadata:b.metadata||{}});
  if(error)throw error; return NextResponse.json({ok:true});
 }catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:500})}
}
