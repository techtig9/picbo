import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {getIntegration} from "@/lib/integrations/registry";
import {encryptCredentials} from "@/lib/integrations/crypto";

export async function GET(req:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;
  const url=new URL(req.url);
  const code=url.searchParams.get("code");
  const stateRaw=url.searchParams.get("state");
  const oauthError=url.searchParams.get("error");

  const adapter=getIntegration(provider);
  const supabase=await createClient();

  async function fail(workspaceId:string|undefined,message:string){
    if(workspaceId){
      await supabase.from("integration_connections").upsert({
        workspace_id:workspaceId,provider,status:"error",last_error:message,updated_at:new Date().toISOString()
      },{onConflict:"workspace_id,provider"});
    }
    return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(message)}`,req.url));
  }

  if(!stateRaw)return fail(undefined,"Missing OAuth state");
  let state:{workspaceId:string;shop?:string};
  try{state=JSON.parse(Buffer.from(stateRaw,"base64url").toString("utf8"))}
  catch{return fail(undefined,"Invalid OAuth state")}

  if(oauthError)return fail(state.workspaceId,`${adapter?.label||provider} declined: ${oauthError}`);
  if(!adapter)return fail(state.workspaceId,"Unknown integration provider");
  if(!code)return fail(state.workspaceId,"Missing authorization code");

  try{
    const redirectUri=`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${provider}/callback`;
    const result=await (adapter as any).exchangeCode(code,redirectUri,state.shop);
    const encrypted=encryptCredentials(JSON.stringify({accessToken:result.accessToken,refreshToken:result.refreshToken}));

    const {data:{user}}=await supabase.auth.getUser();
    await supabase.from("integration_connections").upsert({
      workspace_id:state.workspaceId,provider,status:"connected",
      external_account_label:result.accountLabel,encrypted_credentials:encrypted,
      connected_by:user?.id,connected_at:new Date().toISOString(),last_error:null,
      updated_at:new Date().toISOString()
    },{onConflict:"workspace_id,provider"});
    await supabase.from("workspace_activity").insert({workspace_id:state.workspaceId,actor_id:user?.id,action:`connected_${provider}`});

    return NextResponse.redirect(new URL("/integrations?connected="+provider,req.url));
  }catch(e:any){
    return fail(state.workspaceId,e.message||"Connection failed");
  }
}
