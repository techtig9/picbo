import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {getUgcAvatarProvider} from "@/lib/ai/providers/ugc-avatar";

export async function GET(){
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
  const provider=getUgcAvatarProvider();
  const avatars=await provider.listAvatars();
  return NextResponse.json({configured:provider.configured,avatars});
}
