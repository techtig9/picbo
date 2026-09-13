-- Picbo.ai Phase 6: photoshoot/image generation domain.
create table if not exists public.creative_shoots(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 name text not null,
 request jsonb not null default '{}'::jsonb,
 status text not null default 'draft',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.creative_shot_items(
 id uuid primary key default gen_random_uuid(),
 shoot_id uuid not null references public.creative_shoots(id) on delete cascade,
 job_id uuid references public.ai_jobs(id) on delete set null,
 shot_type text not null,
 aspect_ratio text not null,
 prompt text,
 status text not null default 'queued',
 asset_id uuid references public.assets(id) on delete set null,
 variant_no integer not null default 1,
 created_at timestamptz not null default now()
);
create table if not exists public.asset_versions(
 id uuid primary key default gen_random_uuid(),
 asset_id uuid not null references public.assets(id) on delete cascade,
 parent_asset_id uuid references public.assets(id) on delete set null,
 operation text not null,
 instruction text,
 metadata jsonb not null default '{}'::jsonb,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists creative_shoots_workspace_idx on public.creative_shoots(workspace_id,created_at desc);
create index if not exists shot_items_shoot_idx on public.creative_shot_items(shoot_id);
create index if not exists asset_versions_asset_idx on public.asset_versions(asset_id,created_at desc);

alter table public.creative_shoots enable row level security;
alter table public.creative_shot_items enable row level security;
alter table public.asset_versions enable row level security;

create policy "shoots member read" on public.creative_shoots for select using(public.is_workspace_member(workspace_id));
create policy "shoots editor write" on public.creative_shoots for all using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "shot items member read" on public.creative_shot_items for select using(exists(select 1 from public.creative_shoots s where s.id=shoot_id and public.is_workspace_member(s.workspace_id)));
create policy "shot items editor write" on public.creative_shot_items for all using(exists(select 1 from public.creative_shoots s where s.id=shoot_id and public.has_workspace_role(s.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check(exists(select 1 from public.creative_shoots s where s.id=shoot_id and public.has_workspace_role(s.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

create policy "asset versions member read" on public.asset_versions for select using(exists(select 1 from public.assets a where a.id=asset_id and public.is_workspace_member(a.workspace_id)));
create policy "asset versions editor write" on public.asset_versions for all using(exists(select 1 from public.assets a where a.id=asset_id and public.has_workspace_role(a.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check(exists(select 1 from public.assets a where a.id=asset_id and public.has_workspace_role(a.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));
