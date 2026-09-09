-- Picbo.ai Phase 22: keep workspace_credits in sync with credit_ledger.
--
-- credit_ledger + reserve_credits()/refund_credits()/workspace_credit_balance()
-- (phase 5) is the real, actively-used accounting system. workspace_credits
-- (phase 18) was added later as a fast-read cache for the billing/AI-routing
-- endpoints, but nothing ever wrote to it — every route reading
-- workspace_credits.balance (billing, AI pre-flight check, health check) was
-- reading a value that never moved. This adds the missing sync trigger and
-- makes sure every workspace actually has a row to read.

create or replace function public.sync_workspace_credits_on_ledger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.workspace_credits(workspace_id,balance,lifetime_used,updated_at)
  values(
    new.workspace_id,
    new.amount,
    case when new.amount<0 then -new.amount else 0 end,
    now()
  )
  on conflict(workspace_id) do update set
    balance=public.workspace_credits.balance+new.amount,
    lifetime_used=public.workspace_credits.lifetime_used+(case when new.amount<0 then -new.amount else 0 end),
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_credit_ledger_insert on public.credit_ledger;
create trigger on_credit_ledger_insert
  after insert on public.credit_ledger
  for each row execute procedure public.sync_workspace_credits_on_ledger();

-- Every workspace needs a workspace_credits row to read from, even before its
-- first ledger entry (a brand new workspace with zero activity should read as
-- 0, not 404/missing).
create or replace function public.create_default_workspace_credits()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.workspace_credits(workspace_id,balance,lifetime_used,monthly_limit)
  values(new.id,0,0,0)
  on conflict(workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created_credits on public.workspaces;
create trigger on_workspace_created_credits
  after insert on public.workspaces
  for each row execute procedure public.create_default_workspace_credits();

-- Backfill: any workspace created before this migration (or before phase 18)
-- needs its cache row created and reconciled against its real ledger history.
insert into public.workspace_credits(workspace_id,balance,lifetime_used,monthly_limit)
select w.id,0,0,0 from public.workspaces w
on conflict(workspace_id) do nothing;

update public.workspace_credits wc set
  balance=coalesce((select sum(amount) from public.credit_ledger cl where cl.workspace_id=wc.workspace_id),0),
  lifetime_used=coalesce((select sum(-amount) from public.credit_ledger cl where cl.workspace_id=wc.workspace_id and amount<0),0),
  updated_at=now();

alter table public.workspace_credits enable row level security;
drop policy if exists "workspace credits member read" on public.workspace_credits;
create policy "workspace credits member read" on public.workspace_credits for select using(public.is_workspace_member(workspace_id));
