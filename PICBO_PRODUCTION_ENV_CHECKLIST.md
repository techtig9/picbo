# Picbo — Production Environment Checklist

Date: 2026-09-12

Everything needed to take Picbo from "builds and passes its tests" to "serving real
customers". Ordered so that each section unblocks the next.

**Never commit real values.** `.env.example` documents every variable; the audit check
`SEC-01` fails the build if an `.env` file appears in the tree.

---

## 0. Vercel deployment — read this first

The project is linked at **techtig/picbo** with **root directory `next-app`** (the repo
is a monorepo; without that setting Vercel builds the wrong folder).

### Two gotchas that will cost you an hour each

**1. Set the variables, then REDEPLOY.** Vercel does not rebuild when you change an
environment variable. Two things here are read at *build* time, not request time:

- `next.config.ts` builds the Content-Security-Policy from `NEXT_PUBLIC_SUPABASE_URL`.
  Set the variable but skip the redeploy and the CSP will still lack your storage
  origin — **every generated image and upload preview will be silently blocked by the
  browser**, with no server-side error to find.
- `NEXT_PUBLIC_*` values are inlined into the client bundle at build time.

After adding variables: Deployments → latest → ⋯ → **Redeploy**.

**2. `NEXT_PUBLIC_APP_URL` must match your real URL exactly.** It is what OAuth redirect
URLs are built from, and a mismatch (http vs https, trailing slash, preview vs production
host) is the most common cause of a failed Google callback.

### Deployment protection

New projects inherit the team default, which is **Vercel Authentication on** — the URL
requires a Vercel login, so it is not publicly shareable. Turn it off at
Project → Settings → Deployment Protection if you want an open demo link.

### What works before any configuration

Thanks to the graceful-degradation fix, an unconfigured deployment is still browsable:

| Route | Unconfigured behaviour |
|---|---|
| `/`, `/pricing`, `/legal/*` | Render normally |
| `/auth/sign-in`, `/auth/sign-up` | Render; submitting will fail until Supabase is set |
| `/dashboard` and other app routes | Redirect to a page explaining what to configure |
| `/api/health/check` | **503 listing exactly which variables are missing** — use this as your progress checklist |
| `/robots.txt`, `/sitemap.xml` | Serve correctly |

### Minimum to make sign-in work

Four variables, then redeploy:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Then run the migrations (§2) — without them, sign-in succeeds but every query fails,
because no tables exist.

---

## 1. Required — the app will not start without these

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Public. Also used to scope the CSP. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | Public by design; RLS is the boundary. |
| `SUPABASE_SERVICE_ROLE_KEY` | same | **Bypasses RLS.** Server-only. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_APP_URL` | Your domain | Must match OAuth redirect URLs **exactly**, including scheme and trailing-slash behaviour. A mismatch is the most common cause of a failed OAuth callback. |

---

## 2. Database — 34 migrations, none yet applied

```bash
supabase link --project-ref <ref>
supabase db push
```

Migrations **32–37 are new in this work** and have never been executed:

| Migration | What it does |
|---|---|
| `202609090001_phase32_email_events` | Send idempotency for auth emails |
| `202609090002_phase33_credit_concurrency` | Advisory lock on `reserve_credits` |
| `202609090003_phase34_rls_audit_fixes` | Cancellation tracking + 7 missing indexes |
| `202609110001_phase35_billing_credit_grants` | `grant_credits`, `adjust_credits`, reconciliation view |
| `202609110002_phase36_api_key_expiry` | API key expiry and rotation |
| `202609120001_phase37_rate_limits` | Durable rate-limit counters |

**Watch for this on `db push`:** migration 33 adds a non-negative balance constraint
`NOT VALID` first, then validates it — unless a workspace is already negative from the
pre-fix race, in which case it raises a `WARNING` instead of failing. If you see that
warning, reconcile those workspaces with `grant_credits()` and then run:

```sql
alter table public.workspace_credits validate constraint workspace_credits_balance_non_negative;
```

### After migrating, verify

```sql
-- Expect 0 rows. Anything here is a customer who paid and got no credits.
select * from public.billing_grant_reconciliation;

-- Expect every table to report true.
select tablename, rowsecurity from pg_tables where schemaname='public' and not rowsecurity;
```

---

## 3. Google OAuth — closes the white-page bug in production

The code is complete; this is configuration.

1. **Google Cloud Console** → Credentials → OAuth 2.0 Client ID (Web application).
2. Authorised redirect URI — **Supabase's** callback, not yours:
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. **Supabase** → Authentication → Providers → Google: paste the client ID and secret.
4. **Supabase** → Authentication → URL Configuration:
   - Site URL: `https://yourdomain.com`
   - Redirect allow-list: `https://yourdomain.com/auth/callback`
5. Verify: sign in with Google → you land on `/dashboard`, not a blank page.

**If it fails:** `/auth/callback` now redirects to `/auth/auth-error` with a specific
reason (`cancelled`, `missing_code`, `exchange_failed`, `provider_error`) instead of
rendering nothing. That reason is the diagnostic.

> Common cause of `exchange_failed`: `NEXT_PUBLIC_APP_URL` not matching the redirect
> allow-list exactly.

---

## 4. Email (Resend)

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | Server-only. Audit `MAIL-02` fails the build if it reaches a client module. |
| `RESEND_FROM_EMAIL` | Must be on a domain verified in Resend, or everything silently lands in spam. |
| `RESEND_FROM_NAME` | Defaults to `Picbo`. |

Verify the domain in Resend (SPF + DKIM) before launch. Leaving these unset disables
email entirely — sign-up and sign-in still work, by design.

Picbo sends exactly **two** transactional emails: account created, and sign-in security
notice.

---

## 5. Billing (Paddle)

| Variable | Notes |
|---|---|
| `PADDLE_ENVIRONMENT` | `sandbox` or `production`. **Separate hosts, keys and secrets** — mixing them silently fails signature verification. |
| `PADDLE_API_KEY` | Paddle → Developer Tools → Authentication |
| `PADDLE_WEBHOOK_SECRET` | Paddle → Notifications → your destination |
| `PADDLE_PRICE_{STARTER,PRO,AGENCY}_{MONTHLY,ANNUAL}` | Six price IDs |

**Set a default payment link** in Paddle → Checkout settings. Without it the transaction
API returns no checkout URL, and the app raises `PADDLE_NO_CHECKOUT_URL` rather than
handing the customer a broken link.

Subscribe the webhook `https://yourdomain.com/api/billing/webhook` to:
`subscription.created`, `subscription.activated`, `subscription.updated`,
`subscription.canceled`, `subscription.past_due`, `subscription.paused`,
`subscription.resumed`, `transaction.completed`, `transaction.payment_failed`,
`adjustment.created`.

### Verify in sandbox before going live
- [ ] Checkout opens and completes
- [ ] Subscription activates **and credits are granted** (this is the step that was missing entirely)
- [ ] A renewal grants credits again
- [ ] Cancellation reaches Paddle — check `provider_canceled_at` gets stamped
- [ ] Resume undoes a scheduled cancellation
- [ ] A failed payment sets `past_due` and notifies the owner
- [ ] A refund claws credits back
- [ ] Replaying a webhook is a no-op (check `payment_events` for one row)

---

## 6. AI providers

At minimum one of the text chain, or Lumi and ad copy cannot function:

| Variable | Role |
|---|---|
| `GROQ_API_KEY` | Text, first in the chain |
| `CEREBRAS_API_KEY` | Text fallback |
| `OPENROUTER_API_KEY` | Text fallback |
| `ANTHROPIC_API_KEY` | **Optional** — the product must work without it |
| `GEMINI_API_KEY` | Vision, product-identity analysis |
| `FAL_KEY` | Image and video generation |

`GET /api/health/check` now tells you the truth about each: `ok`, `degraded`,
`unauthenticated` (key rejected), `quota_exhausted`, `unreachable` or `not_configured`.
A revoked key used to report healthy.

---

## 7. Render worker and scheduled jobs

| Variable | Notes |
|---|---|
| `RENDER_WORKER_SECRET` | Shared secret for worker callbacks **and** the cron endpoints. High-entropy; rotate on a schedule. |
| `RENDER_QUEUE_TIMEOUT_MS` | Default 900000 (15 min) |
| `INTEGRATIONS_ENCRYPTION_KEY` | 32 bytes base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

### Cron — all three are required, not optional

| Schedule | Endpoint | Skipping it means |
|---|---|---|
| every 5 min | `POST /api/ai/jobs/sweep` | Abandoned generations strand credits forever |
| every 5 min | `POST /api/render-worker/sweep` | Failed renders never dead-letter or refund |
| every 15 min | `POST /api/health/check` | No health history to diagnose an incident from |

All three authenticate with `x-render-worker-secret: <RENDER_WORKER_SECRET>`.

Also schedule `select public.prune_rate_limit_counters(24);` daily — without it the
rate-limit table grows unboundedly.

---

## 8. Storage

Buckets are created by migration, but confirm in the dashboard:

- [ ] `picbo-assets` exists and is **private**
- [ ] `render-outputs` exists and is **private**
- [ ] A signed URL works; a raw object URL returns 400

A public bucket would expose every customer's product photography to anyone who guesses
a path.

---

## 9. Pre-launch gates

### Blocking
- [ ] All 34 migrations applied; `billing_grant_reconciliation` returns 0 rows
- [ ] Google sign-in completes and lands on the dashboard
- [ ] Sign-up and sign-in emails arrive from a verified domain
- [ ] A sandbox payment activates a plan **and grants credits**
- [ ] One real generation completes and the image is visible in the library
- [ ] All three cron jobs firing
- [ ] Both buckets private
- [ ] **Legal pages reviewed by a lawyer** — they are accurate but not reviewed
- [ ] `node scripts/production-audit.mjs` → 62/62 against the deployed config

### Strongly recommended
- [ ] Error tracking (Sentry) — `captureError()` is the single wiring point
- [ ] Supabase PITR enabled; a restore actually rehearsed
- [ ] Uptime monitor on `/api/health` (liveness) and `/api/health/check` (deep)
- [ ] Alert on `billing_grant_reconciliation` becoming non-empty
- [ ] Playwright E2E run against staging — it has never been executed

---

## 10. Rollback

1. Vercel → Deployments → promote the previous build.
2. **Migrations do not roll back automatically.** 32–37 are additive (new tables,
   columns, functions), so an older app version tolerates them — with one exception:
   migration 35 adds `paused` to the `subscription_status` enum. An older build that
   reads that value will not recognise it. Do not roll back across migration 35 while
   any subscription is in `paused`.
3. If credits were granted incorrectly, use `adjust_credits()` with a fresh idempotency
   key. Never edit `credit_ledger` by hand — the balance is derived from it.
