/**
 * Workspace role permissions.
 *
 * Two problems this file had: it declared four roles while the database enum
 * (public.workspace_role) has five, so `can("manager", …)` fell through to an
 * empty permission list and denied a manager everything; and nothing imported
 * it, so it was an unenforced description of intent sitting next to RLS
 * policies that disagreed with it.
 *
 * The role list now matches the database exactly, and the grants mirror the
 * RLS policies rather than restating them differently. RLS is the security
 * boundary; this exists so the UI can hide or disable an action the server
 * would refuse, instead of offering a button that silently does nothing.
 */

export type WorkspaceRole="owner"|"admin"|"manager"|"editor"|"viewer";

/** Matches the order of public.workspace_role, most privileged first. */
export const WORKSPACE_ROLES:readonly WorkspaceRole[]=["owner","admin","manager","editor","viewer"];

export const ROLE_PERMISSIONS:Record<WorkspaceRole,string[]>={
  owner:["*"],
  // Mirrors the "members manage" and billing policies: admins do everything
  // except transfer ownership, which app/team/actions.ts enforces separately.
  admin:["projects:*","assets:*","billing:*","members:*","analytics:read","developer:*","integrations:*"],
  // Mirrors "products editor write" — manager is an editor that can also run
  // campaigns and see analytics, but cannot touch billing or membership.
  manager:["projects:*","assets:*","campaigns:*","renders:create","analytics:read"],
  editor:["projects:read","projects:write","assets:read","assets:write","renders:create"],
  viewer:["projects:read","assets:read","analytics:read"]
};

/**
 * `resource:*` grants every action on that resource; `*` grants everything.
 */
export function can(role:WorkspaceRole,permission:string):boolean{
  const grants=ROLE_PERMISSIONS[role];
  if(!grants)return false; // unknown role denies rather than defaulting open
  if(grants.includes("*"))return true;
  if(grants.includes(permission))return true;
  return grants.some(grant=>{
    if(!grant.endsWith(":*"))return false;
    const prefix=grant.slice(0,-1); // "projects:*" -> "projects:"
    return permission.startsWith(prefix);
  });
}

/** True for the roles allowed to invite, remove and re-role members. */
export function canManageMembers(role:string|undefined):boolean{
  return role==="owner"||role==="admin";
}

/** True for the roles allowed to start a checkout or cancel a subscription. */
export function canManageBilling(role:string|undefined):boolean{
  return role==="owner"||role==="admin";
}
