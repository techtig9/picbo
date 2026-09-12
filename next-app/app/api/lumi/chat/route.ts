import {NextResponse} from "next/server";
import {getCurrentWorkspace,requireUser} from "@/lib/auth";
import {consumeRateLimit,rateLimitHeaders,RATE_LIMITS,TOO_MANY_REQUESTS_MESSAGE} from "@/lib/security/rate-limit";
import {createClient} from "@/lib/supabase/server";
import {runTextGenerationJob} from "@/lib/ai/jobs";

const REAL_ROUTES=[
  ["/create/photoshoot","Photoshoot Studio"],["/create/image","Image Studio"],["/create/ads","Ad Studio"],
  ["/create/video","Video Studio"],["/create/shorts","Shorts Studio"],["/create/ugc","UGC Studio"],
  ["/products","Products"],["/brand-kits","Brand Kits"],["/campaigns","Campaigns"],["/templates","Templates"],
  ["/analytics","Analytics"],["/billing","Billing"],["/team","Team"],["/projects","Projects"]
];

function parseActions(raw:string):{reply:string;actions:{label:string;href:string}[]}{
  const marker=raw.lastIndexOf("ACTIONS:");
  if(marker===-1)return {reply:raw.trim(),actions:[]};
  const reply=raw.slice(0,marker).trim();
  const jsonPart=raw.slice(marker+"ACTIONS:".length).trim();
  try{
    const parsed=JSON.parse(jsonPart);
    if(!Array.isArray(parsed))return {reply,actions:[]};
    const validHrefs=new Set(REAL_ROUTES.map(r=>r[0]));
    const actions=parsed.filter((a:any)=>a?.href&&validHrefs.has(a.href)&&a?.label).slice(0,3);
    return {reply,actions};
  }catch{
    return {reply:raw.trim(),actions:[]};
  }
}

export async function POST(req:Request){
  try{
    const user=await requireUser();
    const limit=await consumeRateLimit(user.id,RATE_LIMITS.lumi);
    if(!limit.allowed){
      return NextResponse.json(
        {error:"RATE_LIMIT_EXCEEDED",message:TOO_MANY_REQUESTS_MESSAGE},
        {status:429,headers:rateLimitHeaders(limit)}
      );
    }

    const ws=await getCurrentWorkspace();
    if(!ws?.workspace_id)return NextResponse.json({error:"WORKSPACE_REQUIRED"},{status:400});
    const body=await req.json();
    const messages:{role:"user"|"assistant";content:string}[]=Array.isArray(body.messages)?body.messages.slice(-10):[];
    if(!messages.length)return NextResponse.json({error:"MESSAGE_REQUIRED"},{status:400});

    const supabase=await createClient();
    const [{count:productCount},{data:recentProjects},{data:credits}]=await Promise.all([
      supabase.from("products").select("id",{count:"exact",head:true}).eq("workspace_id",ws.workspace_id),
      supabase.from("projects").select("name,status").eq("workspace_id",ws.workspace_id).order("updated_at",{ascending:false}).limit(3),
      supabase.from("workspace_credits").select("balance").eq("workspace_id",ws.workspace_id).maybeSingle()
    ]);

    const context=`Workspace context: ${productCount||0} products, ${credits?.balance??0} credits remaining. Recent projects: ${(recentProjects||[]).map((p:any)=>`${p.name} (${p.status})`).join(", ")||"none yet"}.`;

    const conversationText=messages.map(m=>`${m.role==="user"?"User":"Lumi"}: ${m.content}`).join("\n");
    const prompt=`You are Lumi, the in-app AI assistant for Picbo.ai, a product-photography and advertising platform. Be concise, helpful, and specific to what Picbo can actually do (photoshoots, image editing, ad copy, 15-second video ads, Shorts, UGC scripts, brand kits, campaigns, analytics, billing). Never invent features Picbo doesn't have. Never fabricate data about this workspace beyond what's given below.

${context}

Real in-app destinations you may suggest: ${REAL_ROUTES.map(([href,label])=>`${label} (${href})`).join(", ")}.

Conversation so far:
${conversationText}

Reply to the last user message directly and naturally (2-4 sentences, no markdown headers). If — and only if — navigating somewhere in the app would genuinely help, end your response on a new line with exactly:
ACTIONS: [{"label":"...","href":"..."}]
using only the exact hrefs listed above. Omit the ACTIONS line entirely if no navigation is relevant.`;

    const {result}=await runTextGenerationJob({task:"chat",quality:"fast",prompt,metadata:{purpose:"lumi_assistant"}});
    const {reply,actions}=parseActions(String(result.output||""));
    return NextResponse.json({reply,actions,provider:result.provider});
  }catch(e:any){
    const status=e?.message==="UNAUTHENTICATED"?401:e?.message?.includes("INSUFFICIENT")?402:e?.message==="ALL_PROVIDERS_FAILED"?503:500;
    return NextResponse.json({error:e?.message||"Lumi couldn't respond"},{status});
  }
}
