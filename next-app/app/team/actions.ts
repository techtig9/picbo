"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {revalidatePath} from "next/cache";

async function logActivity(supabase:any,workspaceId:string,actorId:string,action:string,targetType?:string,targetId?:string){
  await supabase.from("workspace_activity").insert({workspace_id:workspaceId,actor_id:actorId,action,target_type:targetType,target_id:targetId});
}

export async function inviteMember(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const role=String(formData.get("role")||"editor");
  if(!email||!email.includes("@"))throw new Error("VALID_EMAIL_REQUIRED");
  if(!["admin","manager","editor","viewer"].includes(role))throw new Error("INVALID_ROLE");

  const supabase=await createClient();
  const {data:existingMember}=await supabase.from("workspace_members").select("user_id").eq("workspace_id",ws.workspace_id);
  // (Membership is matched by user_id, not email — a pending invite is still
  // useful even if we can't cheaply check "already a member" by email here;
  // the unique(workspace_id,email,status) constraint prevents duplicate pending invites.)
  void existingMember;

  const {data,error}=await supabase.from("workspace_invitations").insert({
    workspace_id:ws.workspace_id,email,role,invited_by:user.id
  }).select("id,token").single();
  if(error){
    if(error.code==="23505")throw new Error("An invitation to this email is already pending");
    throw error;
  }
  await logActivity(supabase,ws.workspace_id,user.id,"invited_member","invitation",data.id);
  revalidatePath("/team");
  return {token:data.token};
}

export async function revokeInvitation(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const id=String(formData.get("id")||"");
  const supabase=await createClient();
  const {error}=await supabase.from("workspace_invitations").update({status:"revoked"}).eq("id",id).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  await logActivity(supabase,ws.workspace_id,user.id,"revoked_invitation","invitation",id);
  revalidatePath("/team");
}

export async function changeMemberRole(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const memberUserId=String(formData.get("userId")||"");
  const role=String(formData.get("role")||"");
  if(!["owner","admin","manager","editor","viewer"].includes(role))throw new Error("INVALID_ROLE");
  const supabase=await createClient();
  const {error}=await supabase.from("workspace_members").update({role}).eq("workspace_id",ws.workspace_id).eq("user_id",memberUserId);
  if(error)throw error;
  await logActivity(supabase,ws.workspace_id,user.id,`changed_role_to_${role}`,"member",memberUserId);
  revalidatePath("/team");
}

export async function removeMember(formData:FormData){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const memberUserId=String(formData.get("userId")||"");
  if(memberUserId===user.id)throw new Error("CANNOT_REMOVE_SELF");
  const supabase=await createClient();
  const {error}=await supabase.from("workspace_members").delete().eq("workspace_id",ws.workspace_id).eq("user_id",memberUserId);
  if(error)throw error;
  await logActivity(supabase,ws.workspace_id,user.id,"removed_member","member",memberUserId);
  revalidatePath("/team");
}

export async function acceptInvitation(token:string){
  const user=await requireUser();
  const supabase=await createClient();
  const {data:invite,error}=await supabase.from("workspace_invitations").select("id,workspace_id,email,role,status,expires_at").eq("token",token).maybeSingle();
  if(error)throw error;
  if(!invite)throw new Error("INVITATION_NOT_FOUND");
  if(invite.status!=="pending")throw new Error("INVITATION_NOT_PENDING");
  if(new Date(invite.expires_at)<new Date())throw new Error("INVITATION_EXPIRED");
  if(user.email?.toLowerCase()!==invite.email.toLowerCase())throw new Error("INVITATION_EMAIL_MISMATCH");

  const {error:memberErr}=await supabase.from("workspace_members").insert({workspace_id:invite.workspace_id,user_id:user.id,role:invite.role});
  if(memberErr&&memberErr.code!=="23505")throw memberErr; // ignore if already a member
  const {error:updateErr}=await supabase.from("workspace_invitations").update({status:"accepted"}).eq("id",invite.id);
  if(updateErr)throw updateErr;
  await logActivity(supabase,invite.workspace_id,user.id,"accepted_invitation","invitation",invite.id);
  return {workspaceId:invite.workspace_id};
}
