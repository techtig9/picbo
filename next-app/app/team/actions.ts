"use server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {log} from "@/lib/observability/logger";

/**
 * Team management.
 *
 * RLS already restricts these tables to owner/admin (`members manage`,
 * `invitations admin write`). But an UPDATE or DELETE that RLS filters out
 * matches **zero rows and returns no error** — so a viewer clicking "Remove
 * member" previously saw a successful action while nothing happened. The
 * explicit role checks below exist so the user is told the truth; RLS remains
 * the actual security boundary.
 *
 * Two rules RLS cannot express are enforced here as well:
 *   - a workspace must never be left with no owner
 *   - an admin must not be able to promote themselves to owner
 */

const ASSIGNABLE_ROLES=["admin","manager","editor","viewer"] as const;
const ALL_ROLES=["owner",...ASSIGNABLE_ROLES] as const;

async function logActivity(
  supabase:any,workspaceId:string,actorId:string,action:string,targetType?:string,targetId?:string
){
  await supabase.from("workspace_activity").insert({
    workspace_id:workspaceId,actor_id:actorId,action,target_type:targetType,target_id:targetId
  });
}

/** Throws a message the user can act on, rather than letting RLS no-op silently. */
function assertManagesMembers(role:string|undefined){
  if(role!=="owner"&&role!=="admin"){
    throw new Error("Only workspace owners and admins can manage team members.");
  }
}

export async function inviteMember(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  assertManagesMembers(ws.role);

  const email=String(formData.get("email")||"").trim().toLowerCase();
  const role=String(formData.get("role")||"editor");
  if(!email||!email.includes("@"))throw new Error("Enter a valid email address.");
  if(!(ASSIGNABLE_ROLES as readonly string[]).includes(role)){
    // "owner" is deliberately absent: ownership is transferred, never invited.
    throw new Error("That role can't be assigned by invitation.");
  }

  const supabase=await createClient();
  const {data,error}=await supabase.from("workspace_invitations").insert({
    workspace_id:ws.workspace_id,email,role,invited_by:user.id
  }).select("id,token").single();

  if(error){
    if(error.code==="23505")throw new Error("An invitation to this email is already pending.");
    throw error;
  }

  await logActivity(supabase,ws.workspace_id,user.id,"invited_member","invitation",data.id);
  log("info","team.invited",{workspace_id:ws.workspace_id,role});
  revalidatePath("/team");
  return {token:data.token};
}

export async function revokeInvitation(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  assertManagesMembers(ws.role);

  const id=String(formData.get("id")||"");
  const supabase=await createClient();
  const {data,error}=await supabase.from("workspace_invitations")
    .update({status:"revoked"})
    .eq("id",id).eq("workspace_id",ws.workspace_id).eq("status","pending")
    .select("id");

  if(error)throw error;
  if(!data||data.length===0)throw new Error("That invitation no longer exists or has already been used.");

  await logActivity(supabase,ws.workspace_id,user.id,"revoked_invitation","invitation",id);
  revalidatePath("/team");
}

export async function changeMemberRole(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  assertManagesMembers(ws.role);

  const memberUserId=String(formData.get("userId")||"");
  const role=String(formData.get("role")||"");
  if(!(ALL_ROLES as readonly string[]).includes(role))throw new Error("Unknown role.");

  // Only an owner may create another owner. RLS lets any admin write this
  // table, so without this check an admin could promote themselves to owner
  // and then remove the real owner — a privilege escalation entirely inside
  // the RLS boundary.
  if(role==="owner"&&ws.role!=="owner"){
    throw new Error("Only the workspace owner can transfer ownership.");
  }

  const admin=createAdminClient();
  const {data:target}=await admin.from("workspace_members")
    .select("user_id,role").eq("workspace_id",ws.workspace_id).eq("user_id",memberUserId).maybeSingle();
  if(!target)throw new Error("That person isn't a member of this workspace.");
  if(target.role===role)return; // nothing to do

  // An admin must not be able to demote an owner.
  if(target.role==="owner"&&ws.role!=="owner"){
    throw new Error("Only the workspace owner can change the owner's role.");
  }

  // A workspace with no owner cannot be billed, deleted or transferred, and
  // nothing in the schema prevents reaching that state.
  if(target.role==="owner"&&role!=="owner"){
    await assertNotLastOwner(admin,ws.workspace_id,memberUserId);
  }

  const supabase=await createClient();
  const {data,error}=await supabase.from("workspace_members")
    .update({role}).eq("workspace_id",ws.workspace_id).eq("user_id",memberUserId).select("user_id");

  if(error)throw error;
  if(!data||data.length===0)throw new Error("Could not update that member's role.");

  await logActivity(supabase,ws.workspace_id,user.id,`changed_role_to_${role}`,"member",memberUserId);
  log("info","team.role_changed",{workspace_id:ws.workspace_id,new_role:role});
  revalidatePath("/team");
}

export async function removeMember(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  assertManagesMembers(ws.role);

  const memberUserId=String(formData.get("userId")||"");
  if(memberUserId===user.id)throw new Error("You can't remove yourself. Ask another owner or admin to do it.");

  const admin=createAdminClient();
  const {data:target}=await admin.from("workspace_members")
    .select("user_id,role").eq("workspace_id",ws.workspace_id).eq("user_id",memberUserId).maybeSingle();
  if(!target)throw new Error("That person isn't a member of this workspace.");

  if(target.role==="owner"){
    if(ws.role!=="owner")throw new Error("Only the workspace owner can remove another owner.");
    await assertNotLastOwner(admin,ws.workspace_id,memberUserId);
  }

  const supabase=await createClient();
  const {data,error}=await supabase.from("workspace_members")
    .delete().eq("workspace_id",ws.workspace_id).eq("user_id",memberUserId).select("user_id");

  if(error)throw error;
  if(!data||data.length===0)throw new Error("Could not remove that member.");

  await logActivity(supabase,ws.workspace_id,user.id,"removed_member","member",memberUserId);
  log("info","team.member_removed",{workspace_id:ws.workspace_id});
  revalidatePath("/team");
}

async function assertNotLastOwner(
  admin:ReturnType<typeof createAdminClient>,workspaceId:string,excludingUserId:string
){
  const {count}=await admin.from("workspace_members")
    .select("user_id",{count:"exact",head:true})
    .eq("workspace_id",workspaceId).eq("role","owner").neq("user_id",excludingUserId);
  if((count||0)===0){
    throw new Error("This is the workspace's only owner. Promote someone else to owner first.");
  }
}

/**
 * Accepts an invitation.
 *
 * The email check matters: the token alone must not be enough, or anyone who
 * obtains a forwarded invite link joins the workspace as whoever it was
 * addressed to.
 */
export async function acceptInvitation(token:string){
  const user=await requireUser();
  const supabase=await createClient();

  const {data:invite,error}=await supabase.from("workspace_invitations")
    .select("id,workspace_id,email,role,status,expires_at").eq("token",token).maybeSingle();
  if(error)throw error;
  if(!invite)throw new Error("INVITATION_NOT_FOUND");
  if(invite.status!=="pending")throw new Error("INVITATION_NOT_PENDING");
  if(new Date(invite.expires_at)<new Date())throw new Error("INVITATION_EXPIRED");
  if(user.email?.toLowerCase()!==invite.email.toLowerCase())throw new Error("INVITATION_EMAIL_MISMATCH");

  const {error:memberErr}=await supabase.from("workspace_members")
    .insert({workspace_id:invite.workspace_id,user_id:user.id,role:invite.role});
  if(memberErr&&memberErr.code!=="23505")throw memberErr; // already a member is fine

  const {error:updateErr}=await supabase.from("workspace_invitations")
    .update({status:"accepted"}).eq("id",invite.id);
  if(updateErr)throw updateErr;

  await logActivity(supabase,invite.workspace_id,user.id,"accepted_invitation","invitation",invite.id);
  log("info","team.invitation_accepted",{workspace_id:invite.workspace_id,role:invite.role});
  return {workspaceId:invite.workspace_id};
}
