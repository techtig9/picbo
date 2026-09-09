import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";

export async function GET(){
  try{
    const ws=await getCurrentWorkspace();
    if(!ws?.workspace_id) return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
    const supabase=await createClient();
    const {data,error}=await supabase.from("render_jobs")
      .select("status,stage,progress,created_at,completed_at,error_code")
      .eq("workspace_id",ws.workspace_id)
      .order("created_at",{ascending:false}).limit(20);
    if(error) throw error;
    const counts=(data||[]).reduce((a,j)=>{a[j.status]=(a[j.status]||0)+1;return a},{} as Record<string,number>);
    return NextResponse.json({counts,recent:data||[]});
  }catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:500})}
}
