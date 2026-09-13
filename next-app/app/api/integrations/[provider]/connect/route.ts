import {NextResponse} from "next/server";
import {getCurrentWorkspace} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {getIntegration} from "@/lib/integrations/registry";
import crypto from "crypto";

export async function GET(req:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)return NextResponse.redirect(new URL("/auth/sign-in",req.url));
  if(ws.role!=="owner"&&ws.role!=="admin"){
    return NextResponse.redirect(new URL("/integrations?error=Only+owners+and+admins+can+connect+integrations",req.url));
  }

  const adapter=getIntegration(provider);
  if(!adapter||!adapter.configured){
    return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(`${adapter?.label||provider} isn't configured yet`)}`,req.url));
  }

  const url=new URL(req.url);
  const shop=url.searchParams.get("shop")||undefined;
  const redirectUri=`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`;

  // State encodes workspace + a random nonce + (for Shopify) the shop domain,
  // so the callback can verify origin without a server-side session store.
  const state=Buffer.from(JSON.stringify({workspaceId:ws.workspace_id,nonce:crypto.randomBytes(8).toString("hex"),shop})).toString("base64url");

  try{
    const authUrl=(adapter as any).buildAuthUrl(redirectUri,state,shop);
    const supabase=await createClient();
    await supabase.from("integration_connections").upsert({
      workspace_id:ws.workspace_id,provider,status:"connecting",updated_at:new Date().toISOString()
    },{onConflict:"workspace_id,provider"});
    return NextResponse.redirect(authUrl);
  }catch(e:any){
    return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(e.message)}`,req.url));
  }
}
