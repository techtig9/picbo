import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {firstAvailableProviderForTask} from "@/lib/ai/provider-router";
import type {TaskKind} from "@/lib/ai/types";
import {creditCost,canSpend,type CreditCost} from "@/lib/billing/credits";

// Product-facing task vocabulary (matches DEFAULT_CREDIT_COSTS) mapped onto the
// underlying AI TaskKind used by the real provider registry/router.
const TASK_TO_KIND:Record<keyof CreditCost,TaskKind>={
  chat:"chat",copy:"copy",image:"image",product_photo:"image",storyboard:"analysis",video:"video"
};

export async function POST(req:Request){
  try{
    const ws=await getCurrentWorkspace();
    if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
    const body=await req.json();
    const task=String(body.task||"chat") as keyof CreditCost;
    if(!(task in TASK_TO_KIND))return NextResponse.json({error:"UNKNOWN_TASK"},{status:400});
    const provider=firstAvailableProviderForTask(TASK_TO_KIND[task]);
    if(!provider)return NextResponse.json({error:"NO_AI_PROVIDER_AVAILABLE"},{status:503});
    const cost=creditCost(task);
    const s=await createClient();
    const {data:account,error}=await s.from("workspace_credits").select("balance").eq("workspace_id",ws.workspace_id).single();
    if(error)throw error;
    if(!canSpend(Number(account?.balance||0),cost))return NextResponse.json({error:"INSUFFICIENT_CREDITS",required:cost,balance:Number(account?.balance||0)},{status:402});
    return NextResponse.json({provider:{id:provider.id,label:provider.label},estimatedCostCredits:cost,task});
  }catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:500})}
}
