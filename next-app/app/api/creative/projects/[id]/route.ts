import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const ws=await getCurrentWorkspace();if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
 const s=await createClient();const {data,error}=await s.from("video_projects").select("*").eq("id",id).eq("workspace_id",ws.workspace_id).single();
 if(error)throw error;return NextResponse.json({project:data});}catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:500})}
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const ws=await getCurrentWorkspace();if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
 const body=await req.json();const allowed=["title","aspect","editor_state","status"];
 const patch=Object.fromEntries(Object.entries(body).filter(([k])=>allowed.includes(k)));
 const s=await createClient();const {data,error}=await s.from("video_projects").update(patch).eq("id",id).eq("workspace_id",ws.workspace_id).select("*").single();
 if(error)throw error;return NextResponse.json({project:data});}catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:500})}
}
