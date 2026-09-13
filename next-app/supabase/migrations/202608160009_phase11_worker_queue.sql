alter table public.render_jobs
  add column if not exists attempts integer not null default 0,
  add column if not exists max_attempts integer not null default 3;

create or replace function public.claim_render_job(
  p_worker_id text,
  p_lease_seconds integer default 600
)
returns setof public.render_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from public.render_jobs
    where
      (status = 'queued' or (status = 'processing' and lease_expires_at < now()))
      and attempts < max_attempts
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.render_jobs r
  set
    status = 'processing',
    stage = 'preparing',
    worker_id = p_worker_id,
    lease_expires_at = now() + make_interval(secs => greatest(30,p_lease_seconds)),
    attempts = r.attempts + 1,
    started_at = coalesce(r.started_at, now())
  from candidate
  where r.id = candidate.id
  returning r.*;
end;
$$;

revoke all on function public.claim_render_job(text,integer) from public, anon, authenticated;
grant execute on function public.claim_render_job(text,integer) to service_role;

create index if not exists render_jobs_queue_idx
on public.render_jobs(status,created_at,lease_expires_at);
