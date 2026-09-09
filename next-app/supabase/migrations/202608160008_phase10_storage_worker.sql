alter table public.render_jobs
  add column if not exists worker_id text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists output_storage_path text,
  add column if not exists output_mime_type text,
  add column if not exists output_size_bytes bigint;

create index if not exists render_jobs_lease_idx
  on public.render_jobs(status, lease_expires_at);

create table if not exists public.render_media(
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null references public.render_jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint,
  duration_ms integer,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists render_media_job_idx on public.render_media(render_job_id,created_at desc);

alter table public.render_media enable row level security;

create policy "render media member read"
on public.render_media for select
using(public.is_workspace_member(workspace_id));

create policy "render media editor write"
on public.render_media for insert
with check(
  public.has_workspace_role(
    workspace_id,
    array['owner','admin','manager','editor']::public.workspace_role[]
  )
);

-- Worker/service-role updates should use the server service-role client.
