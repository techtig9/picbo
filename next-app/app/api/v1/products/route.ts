import {NextResponse} from "next/server";
import {verifyApiKey,beginApiRequest,finishApiRequest} from "@/lib/developer/verify-request";
import {createAdminClient} from "@/lib/supabase/admin";

/**
 * Public API v1.
 *
 * The full loop: bearer key -> hash lookup -> rate limit -> workspace-scoped
 * query -> usage log. Documented on the Developer page.
 *
 * The request is logged *before* the handler runs. It used to be logged only
 * on the way out, so a request whose handler threw was never counted against
 * the rate limit — a caller could exceed the limit indefinitely by sending
 * requests that error.
 */
export async function GET(req:Request){
  const authHeader=req.headers.get("authorization");
  const rawKey=authHeader?.replace(/^Bearer\s+/i,"")||null;
  const auth=await verifyApiKey(rawKey);

  if(!auth.ok){
    return NextResponse.json(
      {error:auth.error},
      {status:auth.status||401,headers:rateLimitHeaders(auth.rateLimit)}
    );
  }

  const logId=await beginApiRequest(auth.apiKeyId!,auth.workspaceId!,"GET","/api/v1/products");

  try{
    const supabase=createAdminClient();
    const {data:products,error}=await supabase.from("products")
      .select("id,name,sku,brand,created_at")
      .eq("workspace_id",auth.workspaceId)
      .order("created_at",{ascending:false})
      .limit(50);

    if(error){
      await finishApiRequest(logId,500);
      return NextResponse.json({error:error.message},{status:500,headers:rateLimitHeaders(auth.rateLimit)});
    }

    await finishApiRequest(logId,200);
    return NextResponse.json({products},{headers:rateLimitHeaders(auth.rateLimit)});
  }catch(e:any){
    await finishApiRequest(logId,500);
    return NextResponse.json({error:"INTERNAL_ERROR"},{status:500,headers:rateLimitHeaders(auth.rateLimit)});
  }
}

/** Standard headers so a client can back off before it gets a 429. */
function rateLimitHeaders(rl?:{limit:number;remaining:number;resetSeconds:number}):Record<string,string>{
  if(!rl)return {};
  return {
    "x-ratelimit-limit":String(rl.limit),
    "x-ratelimit-remaining":String(rl.remaining),
    "x-ratelimit-reset":String(rl.resetSeconds)
  };
}
