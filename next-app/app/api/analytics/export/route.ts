import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {rangeSince,toCsv} from "@/lib/analytics";

export async function GET(req:Request){
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const url=new URL(req.url);
  const range=url.searchParams.get("range")||"30d";
  const {since}=rangeSince(range);

  const supabase=await createClient();
  const {data:jobs,error}=await supabase.from("ai_jobs")
    .select("id,task,quality,status,error_code,created_at,completed_at")
    .eq("workspace_id",ws.workspace_id)
    .gte("created_at",since.toISOString())
    .order("created_at",{ascending:false});
  if(error)return NextResponse.json({error:error.message},{status:500});

  const csv=toCsv(
    ["id","task","quality","status","error_code","created_at","completed_at"],
    (jobs||[]).map((j:any)=>[j.id,j.task,j.quality,j.status,j.error_code||"",j.created_at,j.completed_at||""])
  );

  return new NextResponse(csv,{headers:{"content-type":"text/csv","content-disposition":`attachment; filename="picbo-generations-${range}.csv"`}});
}
