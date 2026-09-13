import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {log} from "@/lib/observability/logger";

/**
 * Data export (GDPR Art. 20 / CCPA).
 *
 * The privacy policy promises this, the master spec lists it as a SaaS
 * essential, and it did not exist.
 *
 * Exports the account's own records as JSON. Reads through the **user-scoped**
 * client on purpose: RLS then guarantees the export can only ever contain data
 * this user is entitled to, so a bug here cannot leak another workspace's
 * content. Using the service-role client would be faster and far more
 * dangerous.
 *
 * Binary assets are referenced by id and metadata rather than embedded —
 * inlining base64 images would make a multi-gigabyte JSON document that no
 * browser can open. The signed download links are available in the app.
 */
export async function GET(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();

  const workspaceId=ws?.workspace_id;

  const [profile,products,projects,assets,jobs,credits,subscription,activity]=await Promise.all([
    supabase.from("profiles").select("*").eq("id",user.id).maybeSingle(),
    workspaceId?supabase.from("products").select("*").eq("workspace_id",workspaceId):emptyResult(),
    workspaceId?supabase.from("projects").select("*").eq("workspace_id",workspaceId):emptyResult(),
    workspaceId
      ? supabase.from("assets")
          .select("id,kind,status,mime_type,size_bytes,metadata,created_at")
          .eq("workspace_id",workspaceId)
      : emptyResult(),
    workspaceId
      ? supabase.from("ai_jobs")
          .select("id,task,status,prompt,created_at,completed_at,error_code")
          .eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(1000)
      : emptyResult(),
    workspaceId
      ? supabase.from("credit_ledger")
          .select("type,amount,created_at").eq("workspace_id",workspaceId)
          .order("created_at",{ascending:false}).limit(5000)
      : emptyResult(),
    workspaceId?supabase.from("subscriptions").select("plan,billing_period,status,current_period_end").eq("workspace_id",workspaceId).maybeSingle():emptyResult(),
    workspaceId?supabase.from("workspace_activity").select("action,created_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(1000):emptyResult()
  ]);

  const exported={
    exportedAt:new Date().toISOString(),
    format:"picbo-account-export-v1",
    notes:[
      "Image and video files are referenced by id and metadata, not embedded. Download them from your asset library.",
      "This export covers the workspace you are currently signed in to."
    ],
    account:{
      id:user.id,
      email:user.email,
      createdAt:user.created_at,
      lastSignInAt:user.last_sign_in_at,
      provider:user.app_metadata?.provider??null
    },
    profile:profile.data??null,
    workspace:workspaceId?{id:workspaceId,role:ws?.role??null}:null,
    subscription:(subscription as any).data??null,
    products:products.data??[],
    projects:projects.data??[],
    assets:assets.data??[],
    generations:jobs.data??[],
    creditLedger:credits.data??[],
    activity:activity.data??[]
  };

  log("info","account.data_exported",{user_id:user.id,workspace_id:workspaceId});

  const filename=`picbo-export-${new Date().toISOString().slice(0,10)}.json`;
  return new NextResponse(JSON.stringify(exported,null,2),{
    headers:{
      "content-type":"application/json; charset=utf-8",
      "content-disposition":`attachment; filename="${filename}"`,
      "cache-control":"no-store"
    }
  });
}

/** Matches the shape of a Supabase query result for the no-workspace case. */
function emptyResult(){
  return Promise.resolve({data:[] as any[],error:null});
}
