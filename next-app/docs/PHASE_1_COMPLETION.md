# Phase 1 completion — Audit, architecture, auth and foundation

Date: 2026-09-09
Branch: `claude/picbo-audit-plan-uxl86j`
Scope: Phase 1 of 5, per `Picbo_Master_Audit_and_Claude_Code_Command.md` §7.

Status legend: **GREEN** = verified working · **YELLOW** = blocked only by a missing
external credential/service · **RED** = broken.

---

## 1. Evidence

Every claim below is backed by a command that was run, not by reading the code.

| Check | Command | Result |
|---|---|---|
| Install | `npm install` | PASS |
| Typecheck (strict) | `npx tsc --noEmit` | **PASS** — 0 errors |
| Production build | `npx next build` | **PASS** — compiled successfully |
| Unit tests | `node --import tsx --test tests/*.test.ts` | **PASS 41/41** (was 19) |
| HTTP smoke tests | `BASE_URL=… node scripts/smoke-test.mjs` | **PASS 32/32** against a running production server |
| Production audit | `node scripts/production-audit.mjs` | **PASS 25/25** |
| E2E (Playwright) | not run | **YELLOW** — needs live Supabase + confirmed account |

---

## 2. Issues closed

### RED-01 → GREEN · The Next.js app was missing from git
`next-app` was a gitlink (mode `160000`) pointing at a commit that does not exist,
with no `.gitmodules`. A fresh clone produced an empty directory — the entire
production application was outside version control, invalidating every prior
"phase completion" document. Restored 252 real files; added `.gitignore`.
Guarded by audit check `REPO-01`.

### RED-02 → GREEN · Middleware blocked six subsystems
The matcher covered every path and only a short allow-list was public, so
machine-to-machine endpoints received a 307 redirect to an HTML sign-in page.

| Endpoint | Before | After |
|---|---|---|
| `POST /api/billing/webhook` | 307 → sign-in | 401 (bad signature) / 503 (unconfigured) |
| `POST /api/render-worker/complete` | 307 → sign-in | 401 (missing worker secret) |
| `POST /api/render-worker/fail` | 307 → sign-in | 401 (missing worker secret) |
| `GET /api/health` | 307 → sign-in | 200 JSON |
| `GET /api/v1/products` | 307 → sign-in | 401 (missing bearer key) |
| `GET /robots.txt` | 307, body `/auth/sign-in` | 200 `text/plain` with `Sitemap:` |
| `GET /sitemap.xml` | 307 (route absent) | 200 XML |
| `POST /api/ai/generate` (signed out) | 307 → HTML | **401 JSON** |

Route policy now lives in `lib/auth/routes.ts` so middleware and tests cannot drift.
The matcher skips any path with a file extension. Verified by 11 unit tests and
17 smoke assertions.

### RED-03 → GREEN · Google OAuth and the white page
There was no `signInWithOAuth` call and no `/auth/callback` route: Google returned
users to a **404**, which rendered as a blank dark page.

Added: `app/auth/oauth-actions.ts` (server-side start, so the PKCE verifier lands in
an httpOnly cookie the server callback can read), `app/auth/callback/route.ts`
(`exchangeCodeForSession`, validated `next`, provider-error / cancelled / missing-code /
expired-code handling), `app/auth/auth-error/page.tsx`, and a real Google button on
sign-in and sign-up.

A second, compounding cause was also fixed: middleware redirected **any**
authenticated `/auth*` request to `/dashboard`, which would have swallowed the
callback before the code exchange even after the route existed.

Tests required by the master command, all passing:
- callback route exists (no longer 404)
- failed exchange → readable error page, never a blank screen
- missing code → readable error page
- cancelled Google consent → `reason=cancelled`, explained to the user
- error page renders real content (asserts body size — an almost-empty body *is* the white page)
- callback never redirects off-site (open-redirect defence, 11 unit tests in `tests/safe-redirect.test.ts`)

### RED-04 → GREEN · Mock prototype quarantined
19 root HTML files were one static-host misconfiguration from being live:
`login.html` granted access on **any** password, its "Google"/"Apple" buttons were
`window.location.href='dashboard.html'`, and `billing.html`'s Upgrade button fired a
toast that **faked payment success**. Moved to `legacy-prototype/`, every handler
neutralised, quarantine banner added to all 19, `DO-NOT-DEPLOY.md` written. Audit
checks `MOCK-01/02/03` fail the build if any of it reappears.

### RED-05 → GREEN (code) / YELLOW (delivery) · Resend
Added a server-only transport (`lib/email/client.ts`), branded HTML + plain-text
templates, and exactly two emails: account created, and sign-in security notice with
time, method, device and IP. Sends are claimed in `email_events` **before** dispatch,
so the unique `(user_id, event, dedupe_key)` index resolves duplicate callbacks in the
database rather than by luck. `sendAuthEventEmail` returns `Promise<void>` and catches
everything — a mail outage cannot fail a sign-in that already succeeded.
Actual delivery is YELLOW until `RESEND_API_KEY` exists.

### RED-06 → GREEN · Client set its own credit price
`/api/ai/generate` read `Number(body.creditCost||1)` from the request body, so a client
could request a 10-credit video and pay 1. Cost is now derived server-side from the
task via `creditCostForTask()`. Guarded by audit check `CREDIT-02`.

### RED-07 → GREEN (code) / YELLOW (live verification) · Credit race
`reserve_credits()` did read → check → insert with no lock, so concurrent jobs both
passed the balance check. Added a per-workspace `pg_advisory_xact_lock`, an
idempotent-replay path, and a non-negative balance constraint (applied `NOT VALID`
first so the migration cannot fail on a workspace already negative from the old race,
then validated, with a `RAISE WARNING` naming any that need reconciliation).
Needs a live Postgres to execute against.

### RED-11 / RED-13 / RED-14 / RED-15 → GREEN
- Root layout no longer blanket-`noindex`es the site (it was hiding the landing and
  pricing pages too). Private routes are marked `noindex` centrally in middleware, so a
  new authenticated page cannot ship indexable by forgetting a per-page export.
- `robots.ts` no longer emits `Allow: /` and `Disallow: /` together; `app/sitemap.ts` added.
- `scripts/production-audit.mjs` replaced: was a stub checking four files exist and
  printing `{"ok":true}`; now 25 checks that each assert something that has actually
  broken in this repository.
- `lib/observability/logger.ts` was imported **0 times**; now wired through the auth,
  OAuth, email and billing paths.
- Password reset and email confirmation flows added — neither existed in the production
  app (`/auth/forgot-password` returned 404).

---

## 3. Found during Phase 1, not in the original audit

### Silent write failure on `subscriptions` (RED, fixed)
`public.subscriptions` has a SELECT policy and no UPDATE policy — correct, since
billing state must only be written by the verified webhook. But
`cancelSubscription()` issued the update with the **user-scoped** client, so under RLS
it matched zero rows and returned no error. **The customer was shown a successful
cancellation while nothing changed, locally or at Paddle, and kept being charged.**

The policy was deliberately not loosened. The action now writes through the service
role after an explicit owner/admin check, verifies the row actually changed, and
records `cancellation_requested_at` / `provider_canceled_at`. The UI says
"Cancellation requested — confirming with the payment provider" and only says
"Cancels at end of billing period" once the provider confirms. The Paddle API call
itself is Phase 3; the UI no longer claims otherwise.

### `tsconfig.json` used a deprecated option
`baseUrl` is deprecated and errors under newer TypeScript. Removed — with
`moduleResolution: "bundler"`, `paths` resolve relative to `tsconfig.json`.

### Missing indexes on six workspace-scoped tables
`subscriptions`, `notifications`, `api_request_logs`, `integration_connections`,
`moderation_flags`, `render_media` were each queried by `workspace_id` on a hot path
with no supporting index. `api_request_logs` is read on **every** developer-API request
for the rate-limit count. Indexes added in `202609090003_phase34_rls_audit_fixes.sql`.

### My own audit script had a false-positive class
Three checks failed on prose inside their own doc comments. A check that a comment can
flip to FAIL is one a comment can also flip to PASS, so the checker now strips comments
and tests for the `"use client"` directive at the top of a file rather than anywhere in it.

---

## 4. Supabase / RLS audit result

| Property | Result |
|---|---|
| Tables | 52 |
| RLS enabled | **52 / 52** |
| Tables with no policy at all | 0 |
| SELECT-only tables (writes are service-role only) | 11 — `credit_ledger`, `payment_events`, `subscriptions`, `api_request_logs`, `ai_usage_events`, `moderation_flags`, `platform_admins`, `render_job_attempts`, `system_health_events`, `workspace_credits`, `email_events`. All correct. |
| Foreign keys | 92 (64 `on delete cascade`, 20 `set null`, 8 no action) |
| Security-definer functions | 15, **all** pinning `set search_path` |
| Indexes | 49 → 57 |

The schema is genuinely strong. The two findings above are what the audit turned up.

---

## 5. Files changed

**New** — `lib/auth/routes.ts`, `lib/auth/safe-redirect.ts`, `lib/auth/app-url.ts`,
`lib/email/{client,templates,auth-emails}.ts`, `app/auth/callback/route.ts`,
`app/auth/confirm/route.ts`, `app/auth/oauth-actions.ts`,
`app/auth/{auth-error,forgot-password,reset-password}/page.tsx`,
`components/auth/GoogleButton.tsx`, `app/sitemap.ts`,
`scripts/smoke-test.mjs`, `tests/{auth-routes,safe-redirect}.test.ts`,
migrations `202609090001_phase32_email_events.sql`,
`202609090002_phase33_credit_concurrency.sql`,
`202609090003_phase34_rls_audit_fixes.sql`,
`legacy-prototype/DO-NOT-DEPLOY.md`.

**Modified** — `middleware.ts`, `app/auth/actions.ts`, `app/auth/sign-in/page.tsx`,
`app/auth/sign-up/page.tsx`, `app/layout.tsx`, `app/robots.ts`,
`app/api/ai/generate/route.ts`, `app/billing/actions.ts`, `app/billing/page.tsx`,
`lib/billing/credits.ts`, `app/globals.css`, `scripts/production-audit.mjs`,
`tsconfig.json`, `package.json`, `.env.example`.

**Moved** — 19 HTML files + `assets/` → `legacy-prototype/`.

---

## 6. Known external-service limitations (YELLOW)

| Item | Blocked by |
|---|---|
| Resend delivery | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Google OAuth end-to-end | Google Cloud OAuth client + Supabase Auth provider enabled + redirect URLs registered. The **code path** is verified; the round trip to Google is not. |
| Migrations 32–34 execution | live Postgres |
| Credit concurrency under real load | live Postgres |
| Playwright E2E | live Supabase + pre-confirmed test account |

None of these is a code failure. No RED item has been relabelled YELLOW.

---

## 7. Still RED — deliberately deferred, with the phase that owns them

| ID | Issue | Phase |
|---|---|---|
| RED-08 | Generation jobs run inline in the HTTP request; **the generated image is never shown to the user** | 2 |
| RED-09 | Paddle checkout URL uses the Classic scheme while the webhook implements Paddle Billing | 3 |
| RED-10 | Cancellation never calls the Paddle API (now honestly labelled "requested" in the UI) | 3 |
| RED-12 | Health check reports `ok` because an env var is a non-empty string | 5 |

---

## 8. Phase 1 exit criteria

- [x] `npm install` clean
- [x] Typecheck passes
- [x] Production build passes
- [x] Unit tests pass — 41/41
- [x] Smoke tests pass against a running server — 32/32
- [x] Production audit passes — 25/25
- [x] Google OAuth callback tests pass, including the white-page regression
- [x] No mock authentication or mock payment path remains deployable
- [x] No secrets exposed client-side (audit `MAIL-02`, `SEC-02`)
- [x] Next.js is the single source of truth

**Phase 1 is complete. Ready for Phase 2 (AI, generation, assets and jobs) on your go-ahead.**
