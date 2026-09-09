import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace,requireUser} from "@/lib/auth";
import {updateProfile,updateWorkspaceName,changePassword,deleteWorkspace} from "./actions";

export default async function Settings(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const {data:profile}=await supabase.from("profiles").select("display_name,email").eq("id",user.id).maybeSingle();
  const {data:workspace}=await supabase.from("workspaces").select("name,slug,created_at").eq("id",ws!.workspace_id).maybeSingle();
  const canManageWorkspace=ws?.role==="owner"||ws?.role==="admin";

  return <AppShell><div className="content">
    <div className="eyebrow">ACCOUNT</div>
    <h1 className="title">Settings</h1>
    <p className="muted">Manage your profile, workspace and account.</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>Profile</h3>
        <p className="muted">{profile?.email||user.email}</p>
        <form action={updateProfile} className="form">
          <label>Display name<input name="displayName" defaultValue={profile?.display_name||""} placeholder="Your name"/></label>
          <button className="btn primary">Save profile</button>
        </form>
      </div>

      <div className="card">
        <h3>Password</h3>
        <form action={changePassword} className="form">
          <label>New password<input name="newPassword" type="password" minLength={8} required/></label>
          <label>Confirm password<input name="confirmPassword" type="password" minLength={8} required/></label>
          <button className="btn primary">Update password</button>
        </form>
      </div>

      <div className="card">
        <h3>Workspace</h3>
        <p className="muted">Created {workspace?.created_at?new Date(workspace.created_at).toLocaleDateString():"—"} · {workspace?.slug}</p>
        {canManageWorkspace?
          <form action={updateWorkspaceName} className="form">
            <label>Workspace name<input name="name" defaultValue={workspace?.name||""} required/></label>
            <button className="btn primary">Rename workspace</button>
          </form>
        :
          <p className="muted">Only owners and admins can rename the workspace.</p>
        }
      </div>
    </div>

    {ws?.role==="owner"&&<div className="card" style={{marginTop:16,maxWidth:520}}>
      <h3>Danger zone</h3>
      <p className="muted">Permanently delete this workspace and everything in it. This can't be undone, and only works if you're the only member.</p>
      <form action={deleteWorkspace} className="form">
        <label>Type "{workspace?.name}" to confirm<input name="confirmName" placeholder={workspace?.name||""} required/></label>
        <button className="btn">Delete workspace</button>
      </form>
    </div>}
  </div></AppShell>;
}
