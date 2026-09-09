import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const s=await createClient();
  const {data,error}=await s.from("workspace_credits").select("balance,lifetime_used,monthly_limit").eq("workspace_id",ws.workspace_id).single();
  if(error) return NextResponse.json({balance:0,lifetime_used:0,monthly_limit:0});
  return NextResponse.json(data);
}
