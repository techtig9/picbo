import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
  try{
    const s=await createClient();
    const {error}=await s.from("workspace_credits").select("workspace_id").limit(1);
    if(error) throw error;
    return NextResponse.json({status:"ready"});
  }catch(e:any){
    return NextResponse.json({status:"not_ready",error:e?.message||"DATABASE_UNAVAILABLE"},{status:503});
  }
}
