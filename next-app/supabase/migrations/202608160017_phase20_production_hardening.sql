create table if not exists public.system_health_events (
 id uuid primary key default gen_random_uuid(),
 service text not null,
 status text not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists system_health_events_created_idx
on public.system_health_events(created_at desc);

create table if not exists public.render_job_attempts (
 id uuid primary key default gen_random_uuid(),
 render_job_id uuid not null,
 attempt integer not null,
 status text not null,
 error_code text,
 error_message text,
 started_at timestamptz not null default now(),
 finished_at timestamptz
);
create index if not exists render_job_attempts_job_idx
on public.render_job_attempts(render_job_id,attempt desc);
