import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 try{
  const ws=await getCurrentWorkspace(); if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const s=await createClient();
  const {data,error}=await s.from("analytics_events").select("event_name,value,created_at").eq("workspace_id",ws.workspace_id).order("created_at",{ascending:false}).limit(500);
  if(error)throw error;
  const summary=(data||[]).reduce((a:any,e:any)=>{a[e.event_name]=(a[e.event_name]||0)+1;return a},{});
  return NextResponse.json({summary,events:data||[]});
 }catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:500})}
}
