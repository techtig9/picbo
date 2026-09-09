alter table public.render_media
  add column if not exists platform text,
  add column if not exists variation_name text,
  add column if not exists export_metadata jsonb not null default '{}'::jsonb;

create index if not exists render_media_platform_idx
on public.render_media(workspace_id,platform,created_at desc);

create index if not exists render_jobs_batch_idx
on public.render_jobs(workspace_id,video_project_id,created_at desc);
