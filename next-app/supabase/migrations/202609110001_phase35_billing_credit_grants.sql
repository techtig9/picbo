-- Phase 35 — credit grants and adjustments for billing events.
--
-- The Paddle webhook set a subscription's plan and status but never granted
-- the credits the customer had just paid for: checkout completed, the plan
-- changed, and the balance stayed at zero. There was no grant function to call
-- — reserve_credits/refund_credits only cover generation spend.
--
-- Both functions below are idempotent through credit_ledger's
-- unique(workspace_id, idempotency_key). Callers key on the Paddle event id,
-- so a retried webhook delivery cannot grant a second month of credits.

-- Paddle can pause a subscription; the enum had no value for it, so the
-- webhook had nowhere to record that state.
do $$
begin
  if not exists(
    select 1 from pg_enum e
    join pg_type t on t.oid=e.enumtypid
    where t.typname='subscription_status' and e.enumlabel='paused'
  ) then
    alter type public.subscription_status add value 'paused';
  end if;
end $$;

/**
 * Grants credits to a workspace (plan allowance, promo, manual top-up).
 *
 * security definer because the caller is the service-role webhook handler and
 * the ledger has no INSERT policy for normal roles — billing must never be
 * writable from a browser.
 */
create or replace function public.grant_credits(
  wid uuid,
  amount_to_grant integer,
  idem text,
  reason text default null
)
returns bigint language plpgsql security definer set search_path=public
as $$
begin
  if amount_to_grant<=0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;

  -- Same per-workspace lock reserve_credits uses, so a grant landing while a
  -- generation is reserving cannot interleave between that reservation's
  -- balance read and its insert.
  perform pg_advisory_xact_lock(hashtextextended(wid::text,0));

  insert into public.credit_ledger(workspace_id,type,amount,idempotency_key,metadata)
  values(wid,'grant',amount_to_grant,idem,jsonb_build_object('reason',coalesce(reason,'grant')))
  on conflict (workspace_id,idempotency_key) do nothing;

  return public.workspace_credit_balance(wid);
end;
$$;

/**
 * Applies a signed adjustment — the refund/chargeback clawback path.
 *
 * A clawback can legitimately drive a balance below zero: the customer spent
 * credits and then reversed the payment. That debt is recorded honestly rather
 * than silently written off, and reserve_credits' own balance check stops them
 * spending further until it is settled.
 */
create or replace function public.adjust_credits(
  wid uuid,
  delta integer,
  idem text,
  ref uuid default null,
  reason text default null
)
returns bigint language plpgsql security definer set search_path=public
as $$
begin
  if delta=0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;

  perform pg_advisory_xact_lock(hashtextextended(wid::text,0));

  insert into public.credit_ledger(workspace_id,type,amount,reference_id,idempotency_key,metadata)
  values(wid,'adjustment',delta,ref,idem,jsonb_build_object('reason',coalesce(reason,'adjustment')))
  on conflict (workspace_id,idempotency_key) do nothing;

  return public.workspace_credit_balance(wid);
end;
$$;

-- These are service-role operations only. Revoke them from the roles a browser
-- can ever authenticate as, so an anon/authenticated caller cannot mint itself
-- credits even if it discovers the RPC name.
revoke all on function public.grant_credits(uuid,integer,text,text) from public, anon, authenticated;
revoke all on function public.adjust_credits(uuid,integer,text,uuid,text) from public, anon, authenticated;

-- Reconciliation: paid transactions whose credit grant never landed. Should
-- always be empty; anything here is a customer who paid and did not receive
-- what they bought.
create or replace view public.billing_grant_reconciliation as
select
  pe.workspace_id,
  pe.provider_event_id,
  pe.type,
  pe.created_at,
  pe.amount_cents
from public.payment_events pe
where pe.provider='paddle'
  and pe.type in ('subscription.activated','subscription.created','transaction.completed')
  and not exists(
    select 1 from public.credit_ledger cl
    where cl.workspace_id=pe.workspace_id
      and cl.idempotency_key like 'paddle:'||pe.provider_event_id||':%'
  );

comment on view public.billing_grant_reconciliation is
  'Paid Paddle events with no matching credit grant. Non-empty means a customer paid and did not receive credits — investigate before granting manually with grant_credits().';
