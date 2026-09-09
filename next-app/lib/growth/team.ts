export type WorkspaceRole="owner"|"admin"|"editor"|"viewer";
export const ROLE_PERMISSIONS:Record<WorkspaceRole,string[]> = {
 owner:["*"],
 admin:["projects:*","assets:*","billing:*","members:*","analytics:read"],
 editor:["projects:read","projects:write","assets:read","assets:write","renders:create"],
 viewer:["projects:read","assets:read","analytics:read"]
};
export function can(role:WorkspaceRole,permission:string){
 const p=ROLE_PERMISSIONS[role]||[];
 return p.includes("*")||p.includes(permission)||p.some(x=>x.endsWith(":*")&&permission.startsWith(x.slice(0,-1)));
}
