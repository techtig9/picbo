import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

// Bytes, keyed by plan id (matches lib/billing/plans.ts PlanDefinition.id).
export const STORAGE_QUOTA_BYTES:Record<string,number>={
  free:1*1024*1024*1024, // 1GB
  starter:10*1024*1024*1024, // 10GB
  pro:50*1024*1024*1024, // 50GB
  agency:250*1024*1024*1024 // 250GB
};

export interface StorageUsage{usedBytes:number;quotaBytes:number;plan:string}

export async function getWorkspaceStorageUsage(workspaceId:string):Promise<StorageUsage>{
  const supabase=await createClient();
  const [{data:sub},{data:assets}]=await Promise.all([
    supabase.from("subscriptions").select("plan").eq("workspace_id",workspaceId).maybeSingle(),
    supabase.from("assets").select("size_bytes").eq("workspace_id",workspaceId)
  ]);
  const plan=sub?.plan||"free";
  const usedBytes=(assets||[]).reduce((n:number,a:any)=>n+(Number(a.size_bytes)||0),0);
  return {usedBytes,quotaBytes:STORAGE_QUOTA_BYTES[plan]||STORAGE_QUOTA_BYTES.free,plan};
}

/** Throws a clear error if adding `additionalBytes` would exceed the workspace's plan quota. */
export async function assertStorageQuota(workspaceId:string,additionalBytes:number){
  const usage=await getWorkspaceStorageUsage(workspaceId);
  if(usage.usedBytes+additionalBytes>usage.quotaBytes){
    const usedGb=(usage.usedBytes/1024/1024/1024).toFixed(2);
    const quotaGb=(usage.quotaBytes/1024/1024/1024).toFixed(0);
    throw new Error(`STORAGE_QUOTA_EXCEEDED: using ${usedGb}GB of ${quotaGb}GB on the ${usage.plan} plan. Upgrade or free up space to continue.`);
  }
}

/**
 * Same quota check, but against the service-role client.
 *
 * Background job processing has no request cookie, so it cannot use the
 * user-scoped client. The workspace was already authorised when the job was
 * submitted; this is the quota enforcement for bytes we are about to write on
 * that workspace's behalf.
 */
export async function getWorkspaceStorageUsageAsAdmin(workspaceId:string):Promise<StorageUsage>{
  const supabase=createAdminClient();
  const [{data:sub},{data:assets}]=await Promise.all([
    supabase.from("subscriptions").select("plan").eq("workspace_id",workspaceId).maybeSingle(),
    supabase.from("assets").select("size_bytes").eq("workspace_id",workspaceId)
  ]);
  const plan=sub?.plan||"free";
  const usedBytes=(assets||[]).reduce((n:number,a:any)=>n+(Number(a.size_bytes)||0),0);
  return {usedBytes,quotaBytes:STORAGE_QUOTA_BYTES[plan]||STORAGE_QUOTA_BYTES.free,plan};
}

export async function assertStorageQuotaAsAdmin(workspaceId:string,additionalBytes:number){
  const usage=await getWorkspaceStorageUsageAsAdmin(workspaceId);
  if(usage.usedBytes+additionalBytes>usage.quotaBytes){
    const usedGb=(usage.usedBytes/1024/1024/1024).toFixed(2);
    const quotaGb=(usage.quotaBytes/1024/1024/1024).toFixed(0);
    throw new Error(`STORAGE_QUOTA_EXCEEDED: using ${usedGb}GB of ${quotaGb}GB on the ${usage.plan} plan. Upgrade or free up space to continue.`);
  }
}
