-- Picbo.ai Phase 25: RLS was never enabled on the phase 19 tables
-- (analytics_events, project_shares, creative_templates, referrals). Without
-- RLS, PostgREST enforces no row-level restriction at all — any authenticated
-- user could read or write any workspace's rows in these tables. Fixing this
-- before building the Templates and Analytics pages on top of them.

alter table public.creative_templates enable row level security;
alter table public.analytics_events enable row level security;
alter table public.project_shares enable row level security;
alter table public.referrals enable row level security;

-- creative_templates: featured/global templates (workspace_id is null) are
-- visible to everyone; a workspace's own templates are visible only to its
-- members. Only members can create/update/delete, and only within their own
-- workspace_id (global featured templates are seed-only, not app-writable).
create policy "templates read own or featured" on public.creative_templates for select
using (workspace_id is null and featured=true or public.is_workspace_member(workspace_id));
create policy "templates editor insert" on public.creative_templates for insert
with check (workspace_id is not null and public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "templates editor update" on public.creative_templates for update
using (workspace_id is not null and public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "templates editor delete" on public.creative_templates for delete
using (workspace_id is not null and public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "analytics events member read" on public.analytics_events for select
using (public.is_workspace_member(workspace_id));
create policy "analytics events editor insert" on public.analytics_events for insert
with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "project shares member read" on public.project_shares for select
using (public.is_workspace_member(workspace_id));
create policy "project shares editor write" on public.project_shares for insert
with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "project shares editor update" on public.project_shares for update
using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "project shares editor delete" on public.project_shares for delete
using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "referrals inviter read" on public.referrals for select
using (public.is_workspace_member(inviter_workspace_id) or public.is_workspace_member(referred_workspace_id));
create policy "referrals inviter insert" on public.referrals for insert
with check (public.is_workspace_member(inviter_workspace_id));

-- A handful of real starter templates so the library isn't empty on day one.
-- These are genuine reusable presets (name/category/definition), not
-- fabricated AI output or usage data.
insert into public.creative_templates(workspace_id,name,category,definition,featured) values
  (null,'Clean Product Launch','ad','{"objective":"awareness","tone":"clean, confident, minimal","audience":"new customers discovering the brand","cta":"Shop the launch","hook":"Meet your new favorite."}'::jsonb,true),
  (null,'Limited-Time Offer','ad','{"objective":"sales","tone":"urgent but premium, not pushy","audience":"past visitors and cart abandoners","cta":"Claim the offer","hook":"For a limited time only."}'::jsonb,true),
  (null,'Studio Hero Shot','photoshoot','{"objective":"catalog","tone":"clean studio lighting, neutral background","audience":"catalog/PDP","cta":"","hook":""}'::jsonb,true),
  (null,'Scroll-Stopping Hook','shorts','{"objective":"engagement","tone":"fast-paced, casual, native to the platform","audience":"cold social audience","cta":"Learn more","hook":"Wait for it…"}'::jsonb,true)
on conflict do nothing;
