create table if not exists public.creative_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  video_project_id uuid,
  product_profile jsonb not null default '{}'::jsonb,
  shot_plan jsonb not null default '[]'::jsonb,
  ad_copy jsonb not null default '{}'::jsonb,
  aspect text not null default '9:16',
  duration_ms integer not null default 15000,
  created_at timestamptz not null default now()
);

create index if not exists creative_plans_workspace_idx
on public.creative_plans(workspace_id,created_at desc);
