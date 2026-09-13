-- Picbo.ai Phase 3: identity, workspaces, membership and core records.
create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner','admin','manager','editor','viewer');
create type public.project_status as enum ('draft','active','archived');
create type public.asset_status as enum ('processing','ready','failed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  sku text,
  description text,
  brand text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  status public.project_status not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_products (
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key(project_id,product_id)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null,
  status public.asset_status not null default 'processing',
  storage_path text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists products_workspace_idx on public.products(workspace_id);
create index if not exists projects_workspace_idx on public.projects(workspace_id);
create index if not exists assets_workspace_idx on public.assets(workspace_id);

create or replace function public.is_workspace_member(wid uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members wm where wm.workspace_id=wid and wm.user_id=auth.uid()); $$;

create or replace function public.has_workspace_role(wid uuid, roles public.workspace_role[])
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members wm where wm.workspace_id=wid and wm.user_id=auth.uid() and wm.role=any(roles)); $$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.products enable row level security;
alter table public.projects enable row level security;
alter table public.project_products enable row level security;
alter table public.assets enable row level security;

create policy "profiles self read" on public.profiles for select using (id=auth.uid());
create policy "profiles self update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

create policy "workspace members read" on public.workspaces for select using (owner_id=auth.uid() or public.is_workspace_member(id));
create policy "workspace owners update" on public.workspaces for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "workspace owners delete" on public.workspaces for delete using (owner_id=auth.uid());

create policy "members read" on public.workspace_members for select using (user_id=auth.uid() or public.is_workspace_member(workspace_id));
create policy "members manage" on public.workspace_members for all using (public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));

create policy "products member read" on public.products for select using (public.is_workspace_member(workspace_id));
create policy "products editor write" on public.products for all using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "projects member read" on public.projects for select using (public.is_workspace_member(workspace_id));
create policy "projects editor write" on public.projects for all using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "project products member read" on public.project_products for select using (exists(select 1 from public.projects p where p.id=project_id and public.is_workspace_member(p.workspace_id)));
create policy "project products editor write" on public.project_products for all using (exists(select 1 from public.projects p where p.id=project_id and public.has_workspace_role(p.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check (exists(select 1 from public.projects p where p.id=project_id and public.has_workspace_role(p.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

create policy "assets member read" on public.assets for select using (public.is_workspace_member(workspace_id));
create policy "assets editor write" on public.assets for all using (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_default_workspace()
returns trigger language plpgsql security definer set search_path=public
as $$ declare wid uuid; base_slug text; begin
 base_slug:=lower(regexp_replace(coalesce(split_part(new.email,'@',1),'workspace'),'[^a-zA-Z0-9]+','-','g'));
 base_slug:=trim(both '-' from base_slug)||'-'||substr(new.id::text,1,8);
 insert into public.workspaces(name,slug,owner_id) values('My Workspace',base_slug,new.id) returning id into wid;
 insert into public.workspace_members(workspace_id,user_id,role) values(wid,new.id,'owner');
 return new; end; $$;
drop trigger if exists on_auth_user_workspace on auth.users;
create trigger on_auth_user_workspace after insert on auth.users for each row execute procedure public.create_default_workspace();
