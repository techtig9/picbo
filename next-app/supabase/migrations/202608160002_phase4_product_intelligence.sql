-- Picbo.ai Phase 4: product intelligence, references, brand controls and storage.
create table if not exists public.product_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  kind text not null default 'reference',
  label text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.product_identity (
  product_id uuid primary key references public.products(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  canonical_asset_id uuid references public.assets(id) on delete set null,
  identity_status text not null default 'draft',
  logo_rules jsonb not null default '{}'::jsonb,
  packaging_rules jsonb not null default '{}'::jsonb,
  text_rules jsonb not null default '{}'::jsonb,
  shape_rules jsonb not null default '{}'::jsonb,
  color_rules jsonb not null default '{}'::jsonb,
  proportion_rules jsonb not null default '{}'::jsonb,
  prompt_context text,
  negative_constraints text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  logo_asset_id uuid references public.assets(id) on delete set null,
  colors jsonb not null default '[]'::jsonb,
  fonts jsonb not null default '[]'::jsonb,
  voice jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.asset_folders(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.asset_folder_items (
  folder_id uuid not null references public.asset_folders(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  primary key(folder_id,asset_id)
);

create index if not exists product_refs_product_idx on public.product_references(product_id);
create index if not exists brand_kits_workspace_idx on public.brand_kits(workspace_id);
create index if not exists asset_folders_workspace_idx on public.asset_folders(workspace_id);

alter table public.product_references enable row level security;
alter table public.product_identity enable row level security;
alter table public.brand_kits enable row level security;
alter table public.asset_folders enable row level security;
alter table public.asset_folder_items enable row level security;

create policy "product refs member read" on public.product_references for select using (public.is_workspace_member(workspace_id));
create policy "product refs editor write" on public.product_references for all using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "identity member read" on public.product_identity for select using (public.is_workspace_member(workspace_id));
create policy "identity editor write" on public.product_identity for all using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "brand kits member read" on public.brand_kits for select using (public.is_workspace_member(workspace_id));
create policy "brand kits manager write" on public.brand_kits for all using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "folders member read" on public.asset_folders for select using (public.is_workspace_member(workspace_id));
create policy "folders editor write" on public.asset_folders for all using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "folder items member read" on public.asset_folder_items for select using (exists(select 1 from public.asset_folders f where f.id=folder_id and public.is_workspace_member(f.workspace_id)));
create policy "folder items editor write" on public.asset_folder_items for all using (exists(select 1 from public.asset_folders f where f.id=folder_id and public.has_workspace_role(f.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check (exists(select 1 from public.asset_folders f where f.id=folder_id and public.has_workspace_role(f.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

-- Private storage bucket. Objects should be accessed through signed URLs.
insert into storage.buckets (id,name,public) values ('picbo-assets','picbo-assets',false) on conflict (id) do update set public=false;

create policy "picbo asset objects read" on storage.objects for select using (
  bucket_id='picbo-assets' and exists(
    select 1 from public.assets a
    where a.storage_path=name and public.is_workspace_member(a.workspace_id)
  )
);
create policy "picbo asset objects upload" on storage.objects for insert with check (
  bucket_id='picbo-assets' and auth.uid() is not null
);
create policy "picbo asset objects update" on storage.objects for update using (
  bucket_id='picbo-assets' and auth.uid() is not null
);
create policy "picbo asset objects delete" on storage.objects for delete using (
  bucket_id='picbo-assets' and auth.uid() is not null
);
