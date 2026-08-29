# Picbo.ai — Security Checklist

## Authentication
- Hash passwords with **bcrypt (cost ≥ 12)** or **argon2id**. Google-only
  accounts have `password_hash = null` — don't allow password login on
  those without first requiring a password to be set.
- Verification codes: hashed at rest, expire in 15 minutes, single-use,
  rate-limited to 5 attempts before requiring a resend.
- Sessions: httpOnly, `Secure`, `SameSite=Lax` cookies (or short-lived JWT
  + refresh token). Never store auth tokens in `localStorage`.
- Rate-limit `/api/auth/login` and `/api/auth/register` per-IP and
  per-email.
- 2FA (TOTP) available to all users, **required** for `role IN ('admin',
  'owner')` accounts.

## Authorization
- Every admin route (`/api/admin/*`) checks `role IN ('admin','owner')`
  **server-side** on every request.
- Every team route checks the requester's `team_members.role` server-side
  — an Editor should never be able to hit an Owner-only endpoint (billing
  changes, member removal) even if the frontend hides the button.
- Scope all data queries by the authenticated session's `user_id`/`team_id`,
  never by a client-supplied ID in the request body.
- `role = 'owner'` is not assignable through any API — set directly in the
  database.

## Payments (Paddle)
- Verify every Paddle webhook signature before processing it — an
  unverified webhook is an open door to granting free subscriptions.
- Never trust a client-side "I'm on plan X" claim; always check
  `subscriptions.status` and `plan_code` server-side before granting
  access to a gated feature.
- Overage billing (Business/Agency) must respect the customer's
  self-configured spend cap — stop accruing overage charges once the cap
  is hit and notify the user, don't silently keep billing.

## Affiliate payouts (manual, outside Paddle)
- Since affiliate payouts aren't processed through Paddle, log the
  approving admin (`reviewed_by`-equivalent) for every release in
  `audit_logs`, and require a second admin's approval above a reasonable
  payout threshold to reduce fraud/error risk.

## Lumi (AI assistant)
- Lumi's function-calling tools are **read-only** — it can look up plan,
  credits, and job history, but has no code path that can modify billing,
  credits, or account state. Enforce this in the tool definitions
  themselves, not just the system prompt.
- Run the same content-moderation pass on Lumi's inputs and outputs that
  generation prompts get.
- Log every conversation (`assistant_chats`) for admin spot-review; treat
  Lumi output the same as user-generated content for abuse-monitoring
  purposes.

## File uploads (reference photos, e.g. for Product Photoshoot)
- Validate MIME type and extension both.
- Enforce per-plan upload size limits and total storage quota per
  user/team.
- Re-encode uploaded images server-side before sending to Gemini where
  practical, rather than passing the raw file straight through.

## API & infrastructure
- HTTPS everywhere (HSTS enabled).
- CORS restricted to `picbo.ai` and approved app domains — not `*`.
- Rate-limit generation endpoints, the public API (Business/Agency API
  keys), and auth endpoints **separately** — they have very different
  abuse profiles and costs.
- Clamp all user-supplied numeric params server-side — animated-ad
  duration is always exactly 15 seconds regardless of client input;
  photoshoot angle count has a hard max regardless of what's requested.
- Use parameterized queries / an ORM (Prisma) everywhere.
- Only trust `X-Forwarded-For` when behind a trusted proxy (Vercel/
  Cloudflare) — this feeds the "IP" field in the registration notification
  email, so get it right or that field will be wrong.
- Keep all provider keys (Gemini, Paddle, email) in environment variables
  or a secrets manager — never in the repo or shipped to the client bundle.
- API keys issued to Business/Agency customers (`api_keys` table) are
  hashed at rest, scoped, and independently rate-limited per key.

## Content safety
- Run Gemini's moderation/safety settings on every prompt and uploaded
  reference image before generation — block sexual content involving
  minors, non-consensual imagery, and requests for weapons/extremist
  content, regardless of plan.
- Watermark free-plan exports server-side (baked into the file), not just
  hidden in the UI.
- Flag likely trademark/logo-infringement prompts (e.g. "generate the
  Nike swoosh") into the moderation queue rather than blocking outright —
  a human call, logged in `audit_logs` once resolved.

## Email
- Verify sending-domain SPF/DKIM/DMARC so verification, lifecycle, and the
  `techtig9@gmail.com` registration-notification emails don't land in spam.
- Password-reset links expire in ≤ 1 hour and are single-use.

## Secrets & compliance
- Rotate provider API keys periodically and immediately on any suspected
  leak.
- GDPR: "download my data" export and account deletion with a 30-day grace
  period before permanent purge — the `on delete cascade` foreign keys in
  DATABASE_SCHEMA.md handle most of the cascade automatically.
- Cookie-consent banner for EU/UK visitors, matching the categories listed
  in `legal.html#cookies`.
