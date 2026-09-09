-- Picbo.ai Phase 8: video storyboard, scenes, renders and media tracks.
create table if not exists public.video_projects(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 project_id uuid references public.projects(id) on delete set null,
 created_by uuid not null references auth.users(id),
 name text not null,
 brief jsonb not null default '{}'::jsonb,
 duration_seconds integer not null default 15,
 aspect_ratio text not null default '9:16',
 status text not null default 'draft',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.video_scenes(
 id uuid primary key default gen_random_uuid(),
 video_project_id uuid not null references public.video_projects(id) on delete cascade,
 scene_order integer not null,
 duration_ms integer not null,
 asset_id uuid references public.assets(id) on delete set null,
 motion text not null,
 transition text not null,
 text_overlay text,
 voiceover text,
 visual_prompt text,
 created_at timestamptz not null default now(),
 unique(video_project_id,scene_order)
);
create table if not exists public.video_renders(
 id uuid primary key default gen_random_uuid(),
 video_project_id uuid not null references public.video_projects(id) on delete cascade,
 job_id uuid references public.ai_jobs(id) on delete set null,
 status text not null default 'queued',
 progress integer not null default 0,
 output_asset_id uuid references public.assets(id) on delete set null,
 provider text,
 model text,
 error_code text,
 error_message text,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create table if not exists public.video_tracks(
 id uuid primary key default gen_random_uuid(),
 video_project_id uuid not null references public.video_projects(id) on delete cascade,
 track_type text not null,
 asset_id uuid references public.assets(id) on delete set null,
 start_ms integer not null default 0,
 end_ms integer not null,
 volume numeric(5,2) default 1,
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists video_projects_workspace_idx on public.video_projects(workspace_id,created_at desc);
create index if not exists video_scenes_project_idx on public.video_scenes(video_project_id,scene_order);
create index if not exists video_renders_project_idx on public.video_renders(video_project_id,created_at desc);

alter table public.video_projects enable row level security;
alter table public.video_scenes enable row level security;
alter table public.video_renders enable row level security;
alter table public.video_tracks enable row level security;

create policy "video projects member read" on public.video_projects for select using(public.is_workspace_member(workspace_id));
create policy "video projects editor write" on public.video_projects for all using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])) with check(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "video scenes member read" on public.video_scenes for select using(exists(select 1 from public.video_projects v where v.id=video_project_id and public.is_workspace_member(v.workspace_id)));
create policy "video scenes editor write" on public.video_scenes for all using(exists(select 1 from public.video_projects v where v.id=video_project_id and public.has_workspace_role(v.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check(exists(select 1 from public.video_projects v where v.id=video_project_id and public.has_workspace_role(v.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

create policy "video renders member read" on public.video_renders for select using(exists(select 1 from public.video_projects v where v.id=video_project_id and public.is_workspace_member(v.workspace_id)));
create policy "video renders editor write" on public.video_renders for all using(exists(select 1 from public.video_projects v where v.id=video_project_id and public.has_workspace_role(v.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check(exists(select 1 from public.video_projects v where v.id=video_project_id and public.has_workspace_role(v.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

create policy "video tracks member read" on public.video_tracks for select using(exists(select 1 from public.video_projects v where v.id=video_project_id and public.is_workspace_member(v.workspace_id)));
create policy "video tracks editor write" on public.video_tracks for all using(exists(select 1 from public.video_projects v where v.id=video_project_id and public.has_workspace_role(v.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]))) with check(exists(select 1 from public.video_projects v where v.id=video_project_id and public.has_workspace_role(v.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));
