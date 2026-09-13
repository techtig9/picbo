-- Phase 37 — per-subject rate limiting.
--
-- Only the developer API had a limit. Every authenticated route — generation,
-- Lumi, uploads, password reset — was unbounded. Credits cap spend but not
-- request volume, and uploads cost no credits at all, so nothing stopped a
-- workspace filling storage as fast as its connection allowed.
--
-- Counted here rather than in application memory because a serverless
-- instance's in-process counter resets on every cold start, which stops
-- limiting exactly when traffic is highest.

create table if not exists public.rate_limit_counters(
  -- The thing being limited: a user id, a workspace id, or an IP for
  -- unauthenticated routes.
  subject text not null,
  action text not null,
  -- Fixed window. Chosen over a sliding log because the counter stays one row
  -- per subject/action/window instead of one row per request, which matters
  -- when the limiter itself must not become the bottleneck.
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (subject,action,window_start)
);

-- Cleanup scans by age.
create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters(window_start);

alter table public.rate_limit_counters enable row level security;
-- No policy: this table is service-role only. A browser must never be able to
-- read its own counter (which reveals the limit) or write it (which defeats
-- the limit entirely).

/**
 * Consumes one unit and returns the new count for the current window.
 *
 * The increment is a single atomic upsert. A read-then-write would let two
 * concurrent requests both read the same count and both write count+1,
 * which is the same check-then-act race that let concurrent generations
 * overspend a workspace's credits before Phase 33.
 */
create or replace function public.consume_rate_limit(
  subject text,
  action_name text,
  max_requests integer,
  window_seconds integer
)
returns integer language plpgsql security definer set search_path=public
as $$
declare
  bucket timestamptz;
  new_count integer;
begin
  if window_seconds<=0 then raise exception 'INVALID_WINDOW'; end if;

  -- Floor "now" to the start of the current fixed window.
  bucket:=to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds);

  insert into public.rate_limit_counters(subject,action,window_start,count)
  values(subject,action_name,bucket,1)
  on conflict (subject,action,window_start)
  do update set count=public.rate_limit_counters.count+1
  returning count into new_count;

  return new_count;
end;
$$;

revoke all on function public.consume_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;

/**
 * Removes expired windows. Call periodically alongside the job sweep; without
 * it this table grows unboundedly, one row per subject per action per window.
 */
create or replace function public.prune_rate_limit_counters(older_than_hours integer default 24)
returns integer language plpgsql security definer set search_path=public
as $$
declare removed integer;
begin
  delete from public.rate_limit_counters
  where window_start < now() - make_interval(hours => greatest(1,older_than_hours));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_rate_limit_counters(integer)
  from public, anon, authenticated;
