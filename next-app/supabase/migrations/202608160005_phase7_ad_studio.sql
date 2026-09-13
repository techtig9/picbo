-- Picbo.ai Phase 7: Ad Studio and campaign creative domain.
create table if not exists public.ad_briefs(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 project_id uuid references public.projects(id) on delete set null,
 created_by uuid not null references auth.users(id),
 objective text not null,
 brief jsonb not null default '{}'::jsonb,
 status text not null default 'draft',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.ad_variants(
 id uuid primary key default gen_random_uuid(),
 brief_id uuid not null references public.ad_briefs(id) on delete cascade,
 platform text not null,
 format text not null,
 headline text,
 primary_text text,
 description text,
 cta text,
 visual_direction text,
 asset_id uuid references public.assets(id) on delete set null,
 score numeric(5,2),
 status text not null default 'draft',
 created_at timestamptz not null default now()
);
create table if not exists public.ad_exports(
 id uuid primary key default gen_random_uuid(),
 brief_id uuid not null references public.ad_briefs(id) on delete cascade,
 variant_id uuid references public.ad_variants(id) on delete set null,
 asset_id uuid references public.assets(id) on delete set null,
 platform text not null,
 format text not null,
 width integer,
 height integer,
 status text not null default 'queued',
 created_at timestamptz not null default now()
);
create index if not exists ad_briefs_workspace_idx on public.ad_briefs(workspace_id,created_at desc);
create index if not exists ad_variants_brief_idx on public.ad_variants(brief_id);
create index if not exists ad_exports_brief_idx on public.ad_exports(brief_id);

alter table public.ad_briefs enable row level security;
alter table public.ad_variants enable row level security;
alter table public.ad_exports enable row level security;

create policy "ad briefs member read" on public.ad_briefs for select using(public.is_workspace_member(workspace_id));
create policy "ad briefs editor write" on public.ad_briefs for all using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "ad variants member read" on public.ad_variants for select using(exists(select 1 from public.ad_briefs b where b.id=brief_id and public.is_workspace_member(b.workspace_id)));
create policy "ad variants editor write" on public.ad_variants for all using(exists(select 1 from public.ad_briefs b where b.id=brief_id and public.has_workspace_role(b.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check(exists(select 1 from public.ad_briefs b where b.id=brief_id and public.has_workspace_role(b.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

create policy "ad exports member read" on public.ad_exports for select using(exists(select 1 from public.ad_briefs b where b.id=brief_id and public.is_workspace_member(b.workspace_id)));
create policy "ad exports editor write" on public.ad_exports for all using(exists(select 1 from public.ad_briefs b where b.id=brief_id and public.has_workspace_role(b.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check(exists(select 1 from public.ad_briefs b where b.id=brief_id and public.has_workspace_role(b.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));
