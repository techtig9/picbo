-- Picbo.ai Phase 27: RLS audit (§33). Systematically checked every table
-- against SELECT/INSERT/UPDATE/DELETE policy coverage. Found:
--   (a) 6 more tables with RLS fully disabled (world-readable/writable)
--   (b) 9 tables missing the FK constraint on workspace_id
--   (c) a real bug in this project's own Phase 2 code: ai_job_attempts had
--       no INSERT policy, so runGenerationJob's onAttempt callback — which
--       inserts via the regular per-request client, not the service-role
--       client — would have been silently blocked by RLS on every single
--       generation. Usage/cost/latency tracking was structurally broken.

-- (a) Enable RLS + real policies on the remaining 6 unprotected tables.

alter table public.ad_variations enable row level security;
create policy "ad variations member read" on public.ad_variations for select using(public.is_workspace_member(workspace_id));
create policy "ad variations editor write" on public.ad_variations for insert with check(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "ad variations editor update" on public.ad_variations for update using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "ad variations editor delete" on public.ad_variations for delete using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

alter table public.creative_plans enable row level security;
create policy "creative plans member read" on public.creative_plans for select using(public.is_workspace_member(workspace_id));
create policy "creative plans editor write" on public.creative_plans for insert with check(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "creative plans editor delete" on public.creative_plans for delete using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

-- ai_provider_configs holds encrypted_api_key — restrict to admins/owners,
-- not every workspace member, unlike most tenant tables here.
alter table public.ai_provider_configs enable row level security;
create policy "provider configs admin read" on public.ai_provider_configs for select using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy "provider configs admin write" on public.ai_provider_configs for insert with check(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy "provider configs admin update" on public.ai_provider_configs for update using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy "provider configs admin delete" on public.ai_provider_configs for delete using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));

alter table public.ai_usage_events enable row level security;
create policy "usage events member read" on public.ai_usage_events for select using(public.is_workspace_member(workspace_id));

alter table public.render_job_attempts enable row level security;
create policy "render job attempts member read" on public.render_job_attempts for select
using(exists(select 1 from public.render_jobs r where r.id=render_job_id and public.is_workspace_member(r.workspace_id)));

-- system_health_events has no workspace_id at all — it's platform-wide, not
-- tenant data. No regular workspace member should ever see it; platform
-- admins can, everyone else gets nothing (writes only via the service-role
-- admin client, which bypasses RLS, so no insert/update policy is needed).
alter table public.system_health_events enable row level security;
create policy "system health platform admin read" on public.system_health_events for select
using(public.is_platform_admin(auth.uid()));

-- (b) Add the FK constraints that were missing on workspace_id.
alter table public.ad_variations add constraint ad_variations_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.creative_plans add constraint creative_plans_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.workspace_credits add constraint workspace_credits_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.ai_usage_events add constraint ai_usage_events_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.ai_provider_configs add constraint ai_provider_configs_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.analytics_events add constraint analytics_events_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.project_shares add constraint project_shares_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.creative_templates add constraint creative_templates_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.referrals add constraint referrals_inviter_workspace_fk foreign key(inviter_workspace_id) references public.workspaces(id) on delete cascade;
alter table public.referrals add constraint referrals_referred_workspace_fk foreign key(referred_workspace_id) references public.workspaces(id) on delete set null;

-- (c) The real bug: ai_job_attempts needs an INSERT policy, since
-- lib/ai/jobs.ts writes attempts via the regular per-request client.
create policy "attempts editor insert" on public.ai_job_attempts for insert
with check(exists(select 1 from public.ai_jobs j where j.id=job_id and public.has_workspace_role(j.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

-- render_events has the same shape of gap for when the real render worker
-- (built later this phase) starts writing progress events via the regular
-- client rather than a service-role process.
create policy "render events editor insert" on public.render_events for insert
with check(exists(select 1 from public.render_jobs r where r.id=render_job_id and public.has_workspace_role(r.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));
