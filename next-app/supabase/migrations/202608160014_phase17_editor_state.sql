alter table public.video_projects
  add column if not exists editor_state jsonb not null default '{}'::jsonb;

create index if not exists video_projects_workspace_updated_idx
on public.video_projects(workspace_id,updated_at desc);
