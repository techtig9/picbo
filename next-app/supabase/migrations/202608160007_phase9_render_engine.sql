create table if not exists public.render_jobs(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  engine text not null default 'ffmpeg',
  status text not null default 'queued',
  progress integer not null default 0 check(progress between 0 and 100),
  stage text,
  input_manifest jsonb not null default '{}'::jsonb,
  output_manifest jsonb,
  error_code text,
  error_message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(workspace_id,idempotency_key)
);

create table if not exists public.render_events(
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null references public.render_jobs(id) on delete cascade,
  stage text not null,
  progress integer not null default 0,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists render_jobs_workspace_idx
  on public.render_jobs(workspace_id, created_at desc);

create index if not exists render_events_job_idx
  on public.render_events(render_job_id, created_at);

alter table public.render_jobs enable row level security;
alter table public.render_events enable row level security;

create policy "render jobs member read"
on public.render_jobs for select
using (public.is_workspace_member(workspace_id));

create policy "render jobs editor create"
on public.render_jobs for insert
with check (
  public.has_workspace_role(
    workspace_id,
    array['owner','admin','manager','editor']::public.workspace_role[]
  )
  and created_by = auth.uid()
);

create policy "render jobs editor update"
on public.render_jobs for update
using (
  public.has_workspace_role(
    workspace_id,
    array['owner','admin','manager','editor']::public.workspace_role[]
  )
);

create policy "render events member read"
on public.render_events for select
using (
  exists (
    select 1 from public.render_jobs r
    where r.id = render_job_id
    and public.is_workspace_member(r.workspace_id)
  )
);
