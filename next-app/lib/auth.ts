import {createClient} from "@/lib/supabase/server";
export async function requireUser(){const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw new Error("UNAUTHENTICATED");return user;}
export async function getCurrentWorkspace(){const user=await requireUser();const supabase=await createClient();const {data}=await supabase.from("workspace_members").select("workspace_id,role,workspaces(id,name,slug)").eq("user_id",user.id).limit(1).maybeSingle();return data;}
