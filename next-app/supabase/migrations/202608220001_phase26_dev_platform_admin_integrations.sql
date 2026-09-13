-- Picbo.ai Phase 26: Developer Platform (API keys + request logs), a real
-- platform-admin concept (distinct from per-workspace roles — needed for the
-- Admin dashboard's cross-workspace views), and Integrations connection state.

create table if not exists public.api_keys(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes jsonb not null default '["read","write"]'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_workspace_idx on public.api_keys(workspace_id);
create index if not exists api_keys_hash_idx on public.api_keys(key_hash) where revoked_at is null;

create table if not exists public.api_request_logs(
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  method text not null,
  path text not null,
  status_code integer not null,
  created_at timestamptz not null default now()
);
create index if not exists api_request_logs_key_idx on public.api_request_logs(api_key_id,created_at desc);

alter table public.api_keys enable row level security;
alter table public.api_request_logs enable row level security;

create policy "api keys member read" on public.api_keys for select using(public.is_workspace_member(workspace_id));
create policy "api keys admin write" on public.api_keys for insert with check(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]) and created_by=auth.uid());
create policy "api keys admin update" on public.api_keys for update using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));

create policy "api request logs member read" on public.api_request_logs for select using(public.is_workspace_member(workspace_id));

-- Platform admins (Picbo staff), distinct from workspace_role which is
-- per-workspace. No workspace_role value means "platform staff" — this is
-- a separate, narrow list checked server-side only, never exposed to RLS
-- policies on tenant tables (platform admin reads go through the service-role
-- admin client after an explicit is_platform_admin() check in application code).
create table if not exists public.platform_admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "platform admins self read" on public.platform_admins for select using(user_id=auth.uid());

create or replace function public.is_platform_admin(uid uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.platform_admins where user_id=uid); $$;

-- Integrations connection state (§28). One row per workspace+provider;
-- OAuth tokens are stored encrypted at the application layer before insert,
-- never in plaintext — this table only holds the ciphertext + status.
create table if not exists public.integration_connections(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  external_account_label text,
  encrypted_credentials text,
  settings jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id),
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,provider)
);
alter table public.integration_connections enable row level security;
create policy "integrations member read" on public.integration_connections for select using(public.is_workspace_member(workspace_id));
create policy "integrations admin write" on public.integration_connections for insert with check(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy "integrations admin update" on public.integration_connections for update using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy "integrations admin delete" on public.integration_connections for delete using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
