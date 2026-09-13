import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {validatePhotoRequest} from "@/lib/ai/photo-studio";

export async function POST(req:Request){
  try{
    const ws=await getCurrentWorkspace();
    if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
    const body=await req.json();
    const request=validatePhotoRequest(body);
    return NextResponse.json({workspaceId:ws.workspace_id,request,status:"ready_for_image_model"});
  }catch(e:any){return NextResponse.json({error:e?.message||"INVALID_REQUEST"},{status:400})}
}
