import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace,requireUser} from "@/lib/auth";
import {InviteForm} from "./InviteForm";
import {changeMemberRole,removeMember,revokeInvitation} from "./actions";

const ROLE_LABEL:Record<string,string>={owner:"Owner",admin:"Admin",manager:"Manager",editor:"Editor",viewer:"Viewer"};

export default async function Team(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  const supabase=await createClient();
  const canManage=ws?.role==="owner"||ws?.role==="admin";

  const [{data:members},{data:invites},{data:activity}]=await Promise.all([
    supabase.from("workspace_members").select("user_id,role,created_at,profiles(email,display_name)").eq("workspace_id",ws!.workspace_id).order("created_at"),
    supabase.from("workspace_invitations").select("id,email,role,status,created_at").eq("workspace_id",ws!.workspace_id).eq("status","pending").order("created_at",{ascending:false}),
    supabase.from("workspace_activity").select("id,actor_id,action,created_at").eq("workspace_id",ws!.workspace_id).order("created_at",{ascending:false}).limit(15)
  ]);

  return <AppShell><div className="content">
    <div className="eyebrow">WORKSPACE</div>
    <h1 className="title">Team &amp; Agency</h1>
    <p className="muted">Manage who has access to this workspace and what they can do.</p>

    <div className="grid three" style={{marginTop:22}}>
      <div className="card">
        <h3>Members</h3>
        <table className="table">
          <thead><tr><th>Person</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {(members||[]).map((m:any)=>(
              <tr key={m.user_id}>
                <td>{m.profiles?.display_name||m.profiles?.email||"Unknown"}{m.user_id===user.id?" (you)":""}</td>
                <td>
                  {canManage&&m.role!=="owner"&&m.user_id!==user.id?
                    <form action={changeMemberRole} style={{display:"inline"}}>
                      <input type="hidden" name="userId" value={m.user_id}/>
                      <select name="role" defaultValue={m.role} onChange={e=>e.target.form?.requestSubmit()}>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </form>
                  :
                    <span className="status">{ROLE_LABEL[m.role]||m.role}</span>
                  }
                </td>
                <td>
                  {canManage&&m.role!=="owner"&&m.user_id!==user.id&&
                    <form action={removeMember}>
                      <input type="hidden" name="userId" value={m.user_id}/>
                      <button className="icon" aria-label="Remove member" style={{width:24,height:24,fontSize:12}}>✕</button>
                    </form>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage?
        <div className="card">
          <h3>Invite a teammate</h3>
          <InviteForm/>
          {(invites||[]).length>0&&<>
            <h3 style={{marginTop:18}}>Pending invitations</h3>
            {invites!.map((inv:any)=>(
              <div key={inv.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--line)"}}>
                <span className="muted">{inv.email} · {ROLE_LABEL[inv.role]}</span>
                <form action={revokeInvitation}>
                  <input type="hidden" name="id" value={inv.id}/>
                  <button className="btn" style={{padding:"4px 10px",fontSize:12}}>Revoke</button>
                </form>
              </div>
            ))}
          </>}
        </div>
      :
        <div className="card">
          <h3>Invite a teammate</h3>
          <p className="muted">Only workspace owners and admins can invite new members.</p>
        </div>
      }

      <div className="card">
        <h3>Activity log</h3>
        {(!activity||activity.length===0)?
          <p className="muted">No activity yet.</p>
        :
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {activity.map((a:any)=>(
              <div key={a.id} className="muted" style={{fontSize:12}}>
                {a.action.replace(/_/g," ")} · {new Date(a.created_at).toLocaleString()}
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  </div></AppShell>;
}
