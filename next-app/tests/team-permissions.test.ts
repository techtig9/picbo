import test from "node:test";
import assert from "node:assert/strict";
import {can,canManageBilling,canManageMembers,ROLE_PERMISSIONS,WORKSPACE_ROLES} from "../lib/growth/team";
import {planById,PLANS} from "../lib/billing/plans";

/**
 * ROLE_PERMISSIONS declared four roles while public.workspace_role has five,
 * so `can("manager", …)` fell through to an empty list and denied a manager
 * everything. Nothing imported the module either, so it was an unenforced
 * description sitting next to RLS policies that disagreed with it.
 */

test("every database role is represented",()=>{
  // If the enum gains a role and this map does not, that role silently loses
  // every permission.
  for(const role of WORKSPACE_ROLES){
    assert.ok(ROLE_PERMISSIONS[role],`no permissions defined for "${role}"`);
  }
  assert.deepEqual([...WORKSPACE_ROLES],["owner","admin","manager","editor","viewer"]);
});

test("manager has real permissions, not an empty set",()=>{
  assert.equal(can("manager","projects:write"),true);
  assert.equal(can("manager","assets:read"),true);
  assert.ok(ROLE_PERMISSIONS.manager.length>0);
});

test("owner can do everything",()=>{
  for(const permission of ["projects:write","billing:write","members:write","anything:at:all"]){
    assert.equal(can("owner",permission),true);
  }
});

test("a wildcard grant covers actions on that resource only",()=>{
  assert.equal(can("admin","projects:delete"),true);
  assert.equal(can("manager","campaigns:publish"),true);
  // "projects:*" must not leak into a different resource.
  assert.equal(can("editor","projects:read"),true);
  assert.equal(can("editor","billing:read"),false);
});

test("a viewer cannot write anything",()=>{
  for(const permission of ["projects:write","assets:write","billing:write","members:write","renders:create"]){
    assert.equal(can("viewer",permission),false,`viewer must not have ${permission}`);
  }
});

test("only owners and admins touch billing or membership",()=>{
  // These gate the UI so it does not offer a button the server will refuse —
  // the same silent-no-op that made "Remove member" look like it worked for a
  // viewer while RLS filtered the delete to zero rows.
  assert.equal(canManageBilling("owner"),true);
  assert.equal(canManageBilling("admin"),true);
  assert.equal(canManageBilling("manager"),false);
  assert.equal(canManageBilling("editor"),false);
  assert.equal(canManageBilling("viewer"),false);
  assert.equal(canManageBilling(undefined),false);

  assert.equal(canManageMembers("owner"),true);
  assert.equal(canManageMembers("admin"),true);
  assert.equal(canManageMembers("manager"),false);
  assert.equal(canManageMembers(undefined),false);
});

test("an unknown role is denied rather than defaulting open",()=>{
  assert.equal(can("superuser" as any,"projects:read"),false);
  assert.equal(canManageBilling("superuser"),false);
});

test("a partial permission string does not match a wildcard by prefix accident",()=>{
  // "projects:*" grants "projects:" — it must not grant "projectsecrets:read".
  assert.equal(can("editor","projectsecrets:read"),false);
  assert.equal(can("manager","projectsecrets:read"),false);
});

/** Plan definitions back the credit grant the webhook makes on payment. */

test("every paid plan grants more credits than free",()=>{
  const free=planById("free");
  for(const plan of PLANS.filter(p=>p.id!=="free")){
    assert.ok(plan.creditsPerMonth>free.creditsPerMonth,`${plan.id} must beat free`);
  }
});

test("plan credits increase with price",()=>{
  const paid=PLANS.filter(p=>p.id!=="free").sort((a,b)=>a.monthlyPriceCents-b.monthlyPriceCents);
  for(let i=1;i<paid.length;i++){
    assert.ok(
      paid[i].creditsPerMonth>paid[i-1].creditsPerMonth,
      `${paid[i].id} costs more than ${paid[i-1].id} but grants no more credits`
    );
  }
});

test("an unknown plan id falls back to free rather than throwing",()=>{
  // The webhook reads the plan from Paddle custom_data; an unrecognised value
  // must not crash the handler or grant an arbitrary allowance.
  assert.equal(planById("enterprise-unknown").id,"free");
});

test("annual billing is cheaper per month than monthly",()=>{
  for(const plan of PLANS.filter(p=>p.monthlyPriceCents>0)){
    assert.ok(
      Math.round(plan.annualPriceCents/12)<plan.monthlyPriceCents,
      `${plan.id} annual should be a discount on monthly`
    );
  }
});
