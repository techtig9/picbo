-- Phase 33 — make credit reservation concurrency-safe.
--
-- The previous reserve_credits() was a textbook check-then-act race:
--
--     select public.workspace_credit_balance(wid) into bal;   -- reads
--     if bal < amount_to_charge then raise ...; end if;       -- checks
--     insert into public.credit_ledger(...);                  -- acts
--
-- Nothing held a lock between the read and the insert, and credit_ledger is
-- append-only so there is no row to lock implicitly. Two concurrent
-- generations both read the same balance, both passed the check, and both
-- inserted. A workspace with 1 credit could run N parallel jobs and finish
-- with a negative balance — real provider spend against credits that were
-- never bought.
--
-- Fix: serialise reservations per workspace with a transaction-scoped
-- advisory lock. Chosen over SELECT ... FOR UPDATE because the balance is a
-- sum over many rows rather than a single row, and over SERIALIZABLE because
-- it does not force callers to handle retry on 40001. The lock is released
-- automatically at commit or rollback, and is scoped to one workspace_id so
-- unrelated workspaces never contend.

create or replace function public.reserve_credits(wid uuid,amount_to_charge integer,idem text,ref uuid)
returns bigint language plpgsql security definer set search_path=public
as $$
declare
  bal bigint;
  already_charged boolean;
begin
  if amount_to_charge<=0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
  if not public.is_workspace_member(wid) then raise exception 'NOT_A_MEMBER'; end if;

  -- Serialise every reservation for this workspace. Held until the
  -- transaction ends, so the read/check/insert below is atomic against any
  -- other reserve_credits or refund_credits for the same workspace.
  perform pg_advisory_xact_lock(hashtextextended(wid::text,0));

  -- Idempotent replay: the caller retried with the same key. Return the
  -- current balance without charging again, and without raising, so a client
  -- retry after a network timeout is safe.
  select exists(
    select 1 from public.credit_ledger
    where workspace_id=wid and idempotency_key=idem
  ) into already_charged;
  if already_charged then
    return public.workspace_credit_balance(wid);
  end if;

  select public.workspace_credit_balance(wid) into bal;
  if bal<amount_to_charge then raise exception 'INSUFFICIENT_CREDITS'; end if;

  insert into public.credit_ledger(workspace_id,type,amount,reference_id,idempotency_key)
  values(wid,'charge',-amount_to_charge,ref,idem)
  on conflict (workspace_id,idempotency_key) do nothing;

  return public.workspace_credit_balance(wid);
end;
$$;

-- refund_credits takes the same lock so a refund can never interleave between
-- another reservation's balance read and its insert.
create or replace function public.refund_credits(wid uuid,amount_to_refund integer,idem text,ref uuid)
returns bigint language plpgsql security definer set search_path=public
as $$
begin
  if amount_to_refund<=0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(wid::text,0));
  insert into public.credit_ledger(workspace_id,type,amount,reference_id,idempotency_key)
  values(wid,'refund',amount_to_refund,ref,idem)
  on conflict (workspace_id,idempotency_key) do nothing;
  return public.workspace_credit_balance(wid);
end;
$$;

-- Defence in depth. Even if a future code path bypasses reserve_credits, the
-- workspace_credits cache (kept in sync by the phase 22 trigger) can never
-- show a negative balance without the write failing loudly.
--
-- Applied NOT VALID first so the migration cannot fail on a workspace that is
-- already negative from the race this migration fixes; validate separately
-- after reconciling any such workspace.
do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='workspace_credits_balance_non_negative'
  ) then
    alter table public.workspace_credits
      add constraint workspace_credits_balance_non_negative
      check (balance >= 0) not valid;
  end if;
end $$;

-- Report any workspace already driven negative by the pre-fix race, so it is
-- reconciled deliberately rather than silently written off.
do $$
declare bad_count integer;
begin
  select count(*) into bad_count from public.workspace_credits where balance<0;
  if bad_count>0 then
    raise warning 'CREDIT RECONCILIATION REQUIRED: % workspace(s) have a negative credit balance from the pre-Phase-33 race. Grant compensating credits, then run: alter table public.workspace_credits validate constraint workspace_credits_balance_non_negative;',bad_count;
  else
    execute 'alter table public.workspace_credits validate constraint workspace_credits_balance_non_negative';
  end if;
end $$;
