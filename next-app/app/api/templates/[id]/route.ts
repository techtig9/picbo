import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const {id}=await params;
  const supabase=await createClient();
  const {data,error}=await supabase.from("creative_templates").select("id,name,category,definition").eq("id",id).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(!data)return NextResponse.json({error:"TEMPLATE_NOT_FOUND"},{status:404});
  return NextResponse.json({template:data});
}
