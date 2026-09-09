import {NextResponse} from "next/server";
import {getCurrentWorkspace,requireUser} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const supabase=await createClient();
  const {data,error}=await supabase.from("notifications").select("id,type,title,body,link,read_at,created_at")
    .eq("workspace_id",ws.workspace_id).eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({notifications:data,unreadCount:(data||[]).filter(n=>!n.read_at).length});
}

export async function POST(req:Request){
  const user=await requireUser();
  const supabase=await createClient();
  const body=await req.json();
  if(body.markAllRead){
    await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",user.id).is("read_at",null);
    return NextResponse.json({ok:true});
  }
  if(body.id){
    await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",body.id).eq("user_id",user.id);
    return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"NOTHING_TO_UPDATE"},{status:400});
}
