import {createClient as createSupabaseClient} from "@supabase/supabase-js";

/**
 * Service-role client that bypasses RLS — for trusted server contexts only
 * (webhook handlers, background workers), never exposed to a request that
 * carries user input without independent verification (e.g. a verified
 * webhook signature). Never import this into anything reachable from a
 * plain authenticated request — use lib/supabase/server.ts for that, which
 * correctly enforces RLS as the requesting user.
 */
export function createAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey){
    throw new Error("SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be configured for admin/service operations");
  }
  return createSupabaseClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
}
