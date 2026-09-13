import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {listProviderStatus} from "@/lib/ai/provider-router";
export async function GET(){
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  return NextResponse.json({providers:listProviderStatus()});
}
