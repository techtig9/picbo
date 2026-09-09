import {NextResponse} from "next/server";
import {verifyApiKey,logApiRequest} from "@/lib/developer/verify-request";
import {createAdminClient} from "@/lib/supabase/admin";

/**
 * Public API v1 — the first real external endpoint using api_keys auth.
 * Demonstrates the full loop: bearer key -> hash lookup -> rate limit ->
 * scoped query -> usage log. Documented in the Developer page.
 */
export async function GET(req:Request){
  const authHeader=req.headers.get("authorization");
  const rawKey=authHeader?.replace(/^Bearer\s+/i,"")||null;
  const auth=await verifyApiKey(rawKey);
  if(!auth.ok){
    return NextResponse.json({error:auth.error},{status:auth.status||401});
  }

  const supabase=createAdminClient();
  const {data:products,error}=await supabase.from("products").select("id,name,sku,brand,created_at").eq("workspace_id",auth.workspaceId).order("created_at",{ascending:false}).limit(50);
  const status=error?500:200;
  await logApiRequest(auth.apiKeyId!,auth.workspaceId!,"GET","/api/v1/products",status);
  if(error)return NextResponse.json({error:error.message},{status});
  return NextResponse.json({products});
}
