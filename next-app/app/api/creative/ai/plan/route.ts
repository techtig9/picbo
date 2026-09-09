import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {buildShotPlan,buildCopy,normalizeProduct,buildAiCopyPrompt,parseAiCopy} from "@/lib/ai/creative-studio";
import {runGenerationJob} from "@/lib/ai/jobs";

export async function POST(req:Request){
  try{
    const ws=await getCurrentWorkspace();
    if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
    const body=await req.json();
    const product=normalizeProduct(body);
    const aspect=body?.aspect==="16:9"?"16:9":body?.aspect==="4:5"?"4:5":body?.aspect==="1:1"?"1:1":"9:16";
    const shots=buildShotPlan(product);

    // Copy is real AI output (Groq -> Cerebras -> OpenRouter -> optional Claude/Gemini),
    // with the deterministic template only as an explicit, labeled fallback if no
    // provider is configured or the response can't be parsed — never silently faked.
    let copy=buildCopy(product);
    let copySource:"ai"|"template"=  "template";
    try{
      const {result}=await runGenerationJob({task:"copy",quality:"balanced",prompt:buildAiCopyPrompt(product),metadata:{purpose:"creative_plan_copy"}},1);
      const parsed=parseAiCopy(String(result.output||""));
      if(parsed){copy=parsed;copySource="ai"}
    }catch{
      // No provider configured or generation failed — fall back to the template
      // copy above and say so via copySource, rather than pretending it's AI output.
    }

    const plan={product,shots,copy,aspect,durationMs:15000 as const};
    return NextResponse.json({plan,copySource});
  }catch(e:any){return NextResponse.json({error:e?.message||"UNKNOWN_ERROR"},{status:400})}
}
