import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {runGenerationJob} from "@/lib/ai/jobs";

export async function POST(req:Request){
  try{
    const ws=await getCurrentWorkspace();
    if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
    const body=await req.json();
    const productId=String(body.productId||"");
    if(!productId)return NextResponse.json({error:"PRODUCT_ID_REQUIRED"},{status:400});
    const supabase=await createClient();
    const {data:product,error}=await supabase.from("products").select("name,description,brand").eq("id",productId).eq("workspace_id",ws.workspace_id).maybeSingle();
    if(error)throw error;
    if(!product)return NextResponse.json({error:"PRODUCT_NOT_FOUND"},{status:404});

    const angle=String(body.angle||"authentic first impression");
    const prompt=`Write a 20-25 second UGC-style talk-to-camera video script for "${product.name}"${product.brand?` (${product.brand})`:""}. ${product.description||""}
Angle: ${angle}. Sound like a real person talking to a friend, not an ad. No invented claims, no fake statistics, no "doctors recommend" style claims. Return plain spoken-word script text only, no stage directions, no timestamps.`;

    const {result}=await runGenerationJob({task:"copy",quality:"balanced",prompt,productId,metadata:{purpose:"ugc_script"}},1);
    return NextResponse.json({script:String(result.output||"").trim(),provider:result.provider});
  }catch(e:any){
    const status=e?.message==="UNAUTHENTICATED"?401:e?.message?.includes("INSUFFICIENT")?402:e?.message==="ALL_PROVIDERS_FAILED"?503:500;
    return NextResponse.json({error:e?.message||"Script generation failed"},{status});
  }
}
