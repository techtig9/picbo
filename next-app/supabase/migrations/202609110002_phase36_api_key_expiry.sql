-- Phase 36 — API key expiry and request-log indexing.
--
-- The master spec requires key rotation as well as revocation. api_keys had
-- revoked_at only, so a key was valid forever until someone remembered to
-- revoke it by hand — the usual outcome being long-lived keys in old CI
-- configs that nobody can account for.

alter table public.api_keys
  add column if not exists expires_at timestamptz,
  -- Set when a key is rotated, pointing at its replacement, so a caller still
  -- using the old key can be told which key superseded it.
  add column if not exists rotated_to uuid references public.api_keys(id) on delete set null,
  add column if not exists rotated_at timestamptz;

comment on column public.api_keys.expires_at is
  'Optional expiry. A key past this instant is rejected by verifyApiKey() exactly as a revoked key is.';

-- "Which keys need attention" — expiring soon, or already expired and still
-- not revoked.
create index if not exists api_keys_expiry_idx
  on public.api_keys(expires_at)
  where expires_at is not null and revoked_at is null;

-- The rate-limit count in verifyApiKey() runs on every public API request and
-- filters by (api_key_id, created_at). Phase 34 added this index; repeated
-- here defensively because the limit degrades into a sequential scan without
-- it as the log table grows.
create index if not exists api_request_logs_key_created_idx
  on public.api_request_logs(api_key_id,created_at desc);
