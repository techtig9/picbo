create table if not exists public.workspace_credits (
  workspace_id uuid primary key,
  balance bigint not null default 0,
  lifetime_used bigint not null default 0,
  monthly_limit bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid,
  task text not null,
  provider_id text not null,
  credits integer not null default 0,
  status text not null default 'completed',
  error_code text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_workspace_idx
on public.ai_usage_events(workspace_id,created_at desc);

create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  provider_id text not null,
  enabled boolean not null default false,
  encrypted_api_key text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,provider_id)
);

create index if not exists ai_provider_configs_workspace_idx
on public.ai_provider_configs(workspace_id);
