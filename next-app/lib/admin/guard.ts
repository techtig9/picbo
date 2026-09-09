import {createClient} from "@/lib/supabase/server";
import {requireUser} from "@/lib/auth";
import {redirect} from "next/navigation";

/** Redirects non-platform-admins away. Secure by default: the platform_admins table starts empty. */
export async function requirePlatformAdmin(){
  const user=await requireUser();
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("is_platform_admin",{uid:user.id});
  if(error||!data)redirect("/dashboard");
  return user;
}
