-- Phase 32 — transactional email delivery log + send idempotency.
--
-- Backs lib/email/auth-emails.ts. Two jobs:
--   1. Idempotency: the unique index below is what stops a double-clicked
--      OAuth link (or two concurrent /auth/callback requests) from emailing
--      the user twice. The claim row is inserted BEFORE the send, so the race
--      is resolved by Postgres rather than by luck.
--   2. Deliverability visibility: a failed send is recorded with its provider
--      error instead of vanishing into a console log, because email failure is
--      deliberately non-fatal to authentication and would otherwise be silent.

create table if not exists public.email_events(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('signup','signin','password_reset','email_verification')),
  -- 'once' for one-time emails; a time-bucket for rate-limited notifications.
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider text not null default 'resend',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- The idempotency guarantee. Insert-before-send means a duplicate request
-- gets 23505 and returns without emailing.
create unique index if not exists email_events_dedupe_uidx
  on public.email_events(user_id,event,dedupe_key);

create index if not exists email_events_user_created_idx
  on public.email_events(user_id,created_at desc);

-- Failed-send triage: "what bounced in the last hour".
create index if not exists email_events_status_created_idx
  on public.email_events(status,created_at desc) where status='failed';

alter table public.email_events enable row level security;

-- A user may read their own delivery history (so Settings can show "we sent a
-- security notice to you at 14:02"). Nobody may write through the anon/authed
-- key: every insert and update comes from the service-role client in
-- lib/email/auth-emails.ts, which bypasses RLS. No policy grants
-- insert/update/delete, so those are denied by default for all normal roles.
drop policy if exists email_events_select_own on public.email_events;
create policy email_events_select_own on public.email_events
  for select using (user_id = auth.uid());
