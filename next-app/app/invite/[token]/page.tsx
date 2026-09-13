import {createClient} from "@/lib/supabase/server";
import {acceptInvitation} from "@/app/team/actions";
import {redirect} from "next/navigation";

export default async function AcceptInvite({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();

  if(!user){
    redirect(`/auth/sign-in?next=/invite/${token}`);
  }

  const {data:invite}=await supabase.from("workspace_invitations").select("id,email,role,status,workspaces(name)").eq("token",token).maybeSingle();

  if(!invite){
    return <div className="content"><div className="notice">This invitation link is invalid.</div></div>;
  }
  if(invite.status!=="pending"){
    return <div className="content"><div className="notice">This invitation has already been used or revoked.</div></div>;
  }
  if(user.email?.toLowerCase()!==invite.email.toLowerCase()){
    return <div className="content"><div className="notice">This invitation was sent to {invite.email}, but you're signed in as {user.email}. Sign in with the invited email to accept.</div></div>;
  }

  async function accept(){
    "use server";
    const {workspaceId}=await acceptInvitation(token);
    void workspaceId;
    redirect("/dashboard");
  }

  const workspaceName=Array.isArray(invite.workspaces)?(invite.workspaces[0] as any)?.name:(invite.workspaces as any)?.name;

  return <div className="content">
    <div className="card" style={{maxWidth:480,margin:"60px auto"}}>
      <h2>Join {workspaceName||"this workspace"}</h2>
      <p className="muted">You've been invited as {invite.role}.</p>
      <form action={accept}>
        <button className="btn primary" style={{marginTop:14}}>Accept invitation</button>
      </form>
    </div>
  </div>;
}
