-- Phase 34 — fixes found by the Phase 1 Supabase/RLS audit.
--
-- Audit result for the record: 52 tables, RLS enabled on 52/52, policies
-- present on all of them, 92 foreign keys (64 cascade / 20 set null), and all
-- 15 security-definer functions pin `set search_path`. The schema is in good
-- shape. The two items below are what the audit actually turned up.

-- ── 1. Silent write failure on subscriptions ────────────────────────────────
--
-- public.subscriptions has a SELECT policy and nothing else, which is correct:
-- billing state must only ever be written by the verified Paddle webhook via
-- the service-role client, never by a browser.
--
-- But app/billing/actions.ts:cancelSubscription() issued
--     supabase.from("subscriptions").update({cancel_at_period_end:true})
-- with the *user-scoped* client. Under RLS that matches zero rows and returns
-- no error, so the user was shown a successful cancellation while nothing
-- changed — in the local database or at Paddle.
--
-- The policy is deliberately NOT loosened. The application now performs this
-- write through the service role after an explicit owner check, and records
-- the request here so provider-side cancellation is auditable and can be
-- reconciled when the Paddle API call lands in Phase 3.

alter table public.subscriptions
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancellation_requested_by uuid references auth.users(id) on delete set null,
  -- Set only once the provider confirms; a row with cancellation_requested_at
  -- but no provider_canceled_at is a cancellation the customer asked for that
  -- Paddle has not yet acted on, i.e. someone is still being billed.
  add column if not exists provider_canceled_at timestamptz;

comment on column public.subscriptions.cancellation_requested_at is
  'When the customer requested cancellation in-app. Until provider_canceled_at is set, the subscription is still live at the payment provider and the customer is still being charged.';

-- Reconciliation queue: requested but not yet confirmed by the provider.
create index if not exists subscriptions_pending_cancellation_idx
  on public.subscriptions(cancellation_requested_at)
  where cancellation_requested_at is not null and provider_canceled_at is null;

-- ── 2. Missing indexes on workspace-scoped tables ───────────────────────────
--
-- Every one of these is queried by workspace_id on a hot path (page load,
-- per-request rate limiting, or the notification bell) and had no supporting
-- index, so each was a sequential scan that degrades as the table grows.

create index if not exists subscriptions_workspace_idx
  on public.subscriptions(workspace_id);

create index if not exists notifications_workspace_user_idx
  on public.notifications(workspace_id,user_id,created_at desc);

-- Read on every authenticated developer-API request for the rate-limit count,
-- which filters by api_key_id and created_at.
create index if not exists api_request_logs_key_created_idx
  on public.api_request_logs(api_key_id,created_at desc);

create index if not exists api_request_logs_workspace_created_idx
  on public.api_request_logs(workspace_id,created_at desc);

create index if not exists integration_connections_workspace_idx
  on public.integration_connections(workspace_id);

create index if not exists moderation_flags_workspace_created_idx
  on public.moderation_flags(workspace_id,created_at desc);

create index if not exists render_media_workspace_idx
  on public.render_media(workspace_id);
