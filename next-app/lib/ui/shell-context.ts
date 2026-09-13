import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace} from "@/lib/auth";
import type {ShellContext} from "@/components/app-shell";

/**
 * Loads the workspace name, credit balance and user initials for the app shell.
 *
 * The shell previously hardcoded the avatar as "SA" for every user and showed
 * no workspace or credit balance at all, despite the design directive calling
 * for both in the top bar. Credits especially: a user about to spend them
 * should not have to open Billing to find out whether they can.
 *
 * Never throws. A shell that fails to load its chrome must still render the
 * page — the alternative is a blank screen because a credits lookup timed out.
 */
export async function getShellContext():Promise<ShellContext>{
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    const ws=await getCurrentWorkspace();

    let credits:number|null=null;
    if(ws?.workspace_id){
      const {data}=await supabase.from("workspace_credits")
        .select("balance").eq("workspace_id",ws.workspace_id).maybeSingle();
      credits=data?.balance??0;
    }

    const workspaceName=(ws as any)?.workspaces?.name||null;

    return {
      workspaceName,
      credits,
      userInitials:initialsFor(
        (user?.user_metadata?.full_name as string|undefined)||null,
        user?.email||null
      )
    };
  }catch{
    return {};
  }
}

/** "Ada Lovelace" -> "AL"; "ada@example.com" -> "A". */
export function initialsFor(fullName:string|null,email:string|null):string{
  const name=(fullName||"").trim();
  if(name){
    const parts=name.split(/\s+/).filter(Boolean);
    if(parts.length===1)return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  }
  const local=(email||"").split("@")[0];
  return local?local.slice(0,2).toUpperCase():"·";
}
