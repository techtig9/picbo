create table if not exists public.ad_variations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  video_project_id uuid,
  name text not null,
  angle text not null,
  hook text,
  cta text,
  preset text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create index if not exists ad_variations_workspace_idx
on public.ad_variations(workspace_id,created_at desc);
