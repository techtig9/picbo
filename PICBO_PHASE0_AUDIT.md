# Picbo.ai — Phase 0 Audit Report

Date: 2026-09-09
Scope: full repository audit against `Picbo_Master_Audit_and_Claude_Code_Command.md` (master specification).
Method: static inspection of all source + **executed** install / typecheck / production build / unit tests / HTTP smoke tests against a running production server.

Status legend (per master command §7):
- **GREEN** = verified working, with evidence
- **YELLOW** = blocked *only* by a missing external credential/service
- **RED** = broken, must be fixed

---

## 1. Executed verification evidence

| Check | Command | Result |
|---|---|---|
| Dependency install | `npm install` | **PASS** (exit 0) |
| TypeScript strict typecheck | `npx tsc --noEmit` | **PASS** (exit 0, 0 errors) |
| Production build | `npx next build` | **PASS** — 35 pages, 37 API routes compiled |
| Unit tests | `node --import tsx --test tests/**/*.test.ts` | **PASS** — 19/19 |
| HTTP smoke tests | `next start` + curl on 13 routes | **FAIL** — see RED-02 |
| E2E (Playwright) | not run | **YELLOW** — requires live Supabase + confirmed test account |

This corrects the master audit's assumption that build/typecheck could not be verified. They pass. The codebase is
structurally sound; the failures below are **behavioural**, not compile-time — which is exactly why they survived
20+ "phase completion" documents.

---

## 2. Current score

| Area | Master doc est. | **Verified actual** | Target |
|---|---:|---:|---:|
| Product scope/features | 8.5 | **8.0** | 10 |
| UI/UX/design system | 8.5 | **3.5** | 10 |
| Responsive/mobile UX | 8 | **4.0** | 10 |
| Accessibility | 8.5 | **5.0** | 10 |
| Frontend architecture | 7.5 | **4.5** | 10 |
| Authentication | 5.5 | **4.0** | 10 |
| Google OAuth | 2 | **0.0** | 10 |
| Email/Resend | 2 | **0.0** | 10 |
| AI provider routing | 8.5 | **8.5** | 10 |
| Image/video generation | 7.5 | **5.0** | 10 |
| Supabase/database/RLS | 8.5 | **8.5** | 10 |
| Billing/Paddle | 7 | **2.0** | 10 |
| Credit/usage system | 8 | **5.0** | 10 |
| Background jobs/rendering | 7.5 | **3.0** | 10 |
| Testing/QA | 7 | **4.0** | 10 |
| Security | 7.5 | **4.5** | 10 |
| Observability/production ops | 6.5 | **2.5** | 10 |
| SEO/public marketing | 7 | **1.5** | 10 |
| Repo integrity / source of truth | (not rated) | **0.0** | 10 |
| **Overall production readiness** | **~7.3** | **≈4.2 / 10** | 10 |

The score is *lower* than the master document's estimate because the master document was a static read.
Running the app reveals that several subsystems rated 7–8 (billing, rendering, health, SEO, developer API)
are **unreachable at runtime** and therefore score near zero regardless of code quality.

Scores that went UP or held: AI routing and Supabase/RLS are genuinely strong and correctly rated.

---

## 3. RED issues — broken, must be fixed

### RED-01 — The entire Next.js application is MISSING from git
`next-app` is committed as a **gitlink (mode 160000)** pointing at commit `88ff257e…` which does not exist in
this repository, with no `.gitmodules`. `git ls-files` returns 53 files; the application is 252 files.

Consequence: a fresh `git clone` of `techtig9/picbo` yields **an empty `next-app/` directory**. The production
application exists only inside the uploaded zip. Any CI, any deploy, any new developer gets nothing.
This single defect invalidates every "phase completion" claim in `docs/`.
Evidence: `git ls-files -s next-app` → `160000 88ff257eecc5da6882a5e31d7248ec9488d474b7 0 next-app`.

### RED-02 — `middleware.ts` blocks every machine-to-machine endpoint
`middleware.ts` matches all paths and treats only `/`, `/pricing`, `/invite/*`, `/share/*`, `/auth*`, `/api/auth*`
as public. Everything else without a session cookie is 307-redirected to `/auth/sign-in`.

**Measured against a running production build:**

| Endpoint | Expected | **Actual** | Impact |
|---|---|---|---|
| `POST /api/billing/webhook` | 200/401 | **307 → /auth/sign-in** | **Paddle webhooks never arrive. No subscription can ever activate, cancel, renew or grant credits.** |
| `POST /api/render-worker/complete` | 200/401 | **307 → /auth/sign-in** | **The FFmpeg worker can never report success. Every video render hangs until swept.** |
| `POST /api/render-worker/fail` | 200/401 | **307** | Failures never recorded, credits never refunded. |
| `GET /api/render-worker/sweep` | 200 | **307** | Dead-letter cron is a no-op. |
| `GET /api/health` | 200 | **307** | Load balancer / uptime monitoring cannot health-check. |
| `GET /api/health/ready` | 200/503 | **307** | Readiness probe broken (k8s/Vercel). |
| `GET /api/v1/products` | 200/401 | **307** | **The entire public Developer API is dead.** API keys are unusable. |
| `GET /robots.txt` | `text/plain` | **307, body = `/auth/sign-in`** | **Crawlers are redirected off robots.txt.** |
| `GET /sitemap.xml` | XML | **307** (route also absent) | No sitemap. |

One ~10-line bug causes six independent subsystem outages. This is the highest-leverage fix in the repository.

### RED-03 — Google OAuth does not exist; `/auth/callback` returns 404
- No `signInWithOAuth` call anywhere (`grep` → 0 hits).
- No `/auth/callback` route. Measured: `GET /auth/callback?code=abc123` → **HTTP 404**.
- No `exchangeCodeForSession` anywhere.
- **This is the reported "white page"**: Google redirects the user back to a route that does not exist, and
  `app/not-found.tsx` renders a near-empty dark page on a dark background — visually a blank screen.
- Compounding bug: `middleware.ts` redirects any authenticated request under `/auth*` to `/dashboard`. Even once
  a callback route exists, if a session cookie is present it will be bounced **before the code exchange runs**,
  producing an intermittent, hard-to-diagnose login failure.
- The sign-in page has no Google button at all.

### RED-04 — Static HTML prototype ships fake authentication and fake payments
19 HTML files sit at the repository root and are directly deployable.
- `login.html:61` — `onsubmit="event.preventDefault(); window.location.href='dashboard.html'"` → **any email and
  any password grants access.** No authentication whatsoever.
- `login.html:85-86` — "Google" and "Apple" buttons are `window.location.href='dashboard.html'`.
- `billing.html:154` — "Upgrade" button fires `picboToast('Switched to Business')` → **fake payment success**,
  explicitly forbidden by the master command.
- `forgot-password.html`, `register.html`, `admin.html` are the same pattern.

Deploying this repo to any static host (or misconfiguring a rewrite) exposes a passwordless door to a fake
dashboard on the picbo.ai domain.

### RED-05 — Resend / transactional email: 0% implemented
`grep -ril resend` over the entire application → **zero matches**. No mail service, no templates, no
`RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` in `.env.example`, no sign-up or sign-in
notification, no delivery logging, no send-idempotency table.

### RED-06 — Client controls its own credit price
`app/api/ai/generate/route.ts:7`:
```ts
const result = await runGenerationJob(request, Number(body.creditCost || 1));
```
The **browser sends the price**. `app/create/image/page.tsx:25` sends `creditCost: 1`. A user can request a
`video` task (server-side cost 10) and pay 1 credit, indefinitely. Server-side cost tables exist in
`lib/billing/credits.ts` (`DEFAULT_CREDIT_COSTS`) and are simply **never consulted** on this route.
Direct revenue leak and unbounded provider-cost exposure.

### RED-07 — Credit deduction is not concurrency-safe
`reserve_credits()` (`202608160003_phase5_ai_engine.sql:68`) does read-then-check-then-insert with **no row lock**:
```sql
select public.workspace_credit_balance(wid) into bal;
if bal < amount_to_charge then raise exception 'INSUFFICIENT_CREDITS'; end if;
insert into public.credit_ledger(...);
```
Two concurrent requests both read the same balance and both pass the check. A workspace with 1 credit can run N
parallel generations. The master command explicitly requires "concurrency-safe deduction" and "no negative balance".
No `FOR UPDATE`, no advisory lock, no balance CHECK constraint.

### RED-08 — Generation jobs are not durable; the user never sees the output
- `runGenerationJob` runs the *entire* lifecycle **inline inside one HTTP request**. `queued → running →
  validating → completed` are four sequential UPDATEs in the same request. There is no queue, no worker, no
  resumability, no cancel. A video generation will hit the serverless function timeout and lose the job.
- `app/create/image/page.tsx` renders the result as a **string**:
  `` `Job ${j.jobId} completed. Results are returned by the configured provider.` ``
  **The generated image is never displayed.** No preview, no download, no save-to-library, no history, no
  lineage, no retry, no progress, no provider/model shown, no credit usage shown.
  The core product loop does not deliver its output to the user.

### RED-09 — Paddle checkout URL is the wrong API generation
`lib/billing/payment-provider.ts` builds `https://checkout.paddle.com/checkout?items=…`. That is the **Paddle
Classic** URL scheme. The webhook handler and signature verification implement **Paddle Billing** (`paddle-signature:
ts=…;h1=…`, `subscription.activated`, `custom_data`). Paddle Billing requires creating a transaction server-side
and opening checkout via `Paddle.js` / `_ptxn`. This checkout URL will not open a valid checkout.

### RED-10 — "Cancel subscription" never contacts Paddle
`app/billing/actions.ts:cancelSubscription` only sets `cancel_at_period_end` on the **local** `subscriptions` row.
No Paddle API call. The customer sees "cancelled" and **keeps getting charged**. This is a chargeback and
consumer-protection exposure, not just a bug.

### RED-11 — Whole site is `noindex`, including the marketing pages
`app/layout.tsx` sets `robots:{index:false,follow:false}` at the **root layout**. `/` and `/pricing` override it,
but combined with RED-02 (robots.txt 307s) and the absent `app/sitemap.ts`, public SEO is non-functional.
`app/robots.ts` also emits `Allow: /` and `Disallow: /` simultaneously — a contradictory directive most crawlers
resolve as "block everything".
No Open Graph, no Twitter/X cards, no canonical URLs, no structured data anywhere in the app.

### RED-12 — Health checks report "healthy" because an env var is set
`app/api/health/check/route.ts:checkAiProviders()` returns `status:"ok"` if **any one** of
`GROQ_API_KEY`/`CEREBRAS_API_KEY`/`OPENROUTER_API_KEY` is a non-empty string. It never calls a provider.
A revoked, expired or quota-exhausted key reports GREEN. `checkRenderQueue` destructures `count` without error
handling — a failing query yields `null` and silently reports `ok`.
Master command: *"Never call a service healthy merely because a key exists."*

### RED-13 — `scripts/production-audit.mjs` is a stub that always passes
The "production audit script" checks only that `package.json`, `.env.example`, `README.md` and `supabase/` exist,
then prints `{"ok": true}`. It has been cited as evidence of production readiness. It verifies nothing.

### RED-14 — Structured logging exists but is never used
`lib/observability/logger.ts` is imported **0 times** across the codebase. There is no request ID propagation, no
job ID in logs, no provider metric emission, no error tracking (no Sentry), no alerting. Observability is a file,
not a system.

### RED-15 — No password reset flow in the production app
`/auth/forgot-password` → **404** (measured). No `resetPasswordForEmail` call anywhere. Only the mock
`forgot-password.html` exists. Users who forget their password are permanently locked out.

---

## 4. YELLOW issues — correct code, blocked only by an external credential/service

| ID | Item | Blocked by |
|---|---|---|
| Y-01 | Playwright E2E suite (`e2e/full-flow.spec.ts`, 17-step flow) | live Supabase project + pre-confirmed test account (`E2E_TEST_EMAIL`) |
| Y-02 | Paddle webhook signature verification (implementation is **correct** HMAC-SHA256 over `ts:body`) | `PADDLE_WEBHOOK_SECRET` + Paddle sandbox account |
| Y-03 | Live AI provider fallback chain (router logic verified by unit test with mocked 429s) | `GROQ_API_KEY` / `CEREBRAS_API_KEY` / `OPENROUTER_API_KEY` |
| Y-04 | fal.ai / Gemini image + video generation | `FAL_KEY`, `GEMINI_API_KEY` |
| Y-05 | FFmpeg render worker end-to-end (worker code exists in `workers/video-renderer/`) | deployed worker container + `RENDER_WORKER_SECRET` |
| Y-06 | Supabase RLS cross-workspace isolation tests (`supabase/tests/cross_workspace_rls.sql`) | live Postgres to execute against |
| Y-07 | Shopify / Meta integration OAuth | `SHOPIFY_CLIENT_ID`/`SECRET`, `META_APP_ID`/`SECRET` |
| Y-08 | Google OAuth provider configuration | Google Cloud OAuth client + Supabase Auth provider enabled (code fix is RED-03, config is YELLOW) |
| Y-09 | Figma design-direction research | Figma **is connected** (account: Saad Saad Ali, "View" seat, starter tier) — read/screenshot works; write operations may be seat-limited |

Per the master command, none of the RED items above are permitted to be re-labelled YELLOW.

---

## 5. Missing features (specified in master command §5, absent in code)

**Auth / SaaS essentials**
- Google OAuth · OAuth callback · password reset · email verification resend · session-refresh handling
- 2FA architecture · account deletion · data export · privacy controls · onboarding flow

**Email**
- Entire Resend integration · branded HTML+text templates · sign-up email · login-security email
- delivery logging · send idempotency

**Generation / Studio**
- Output preview, download/export, save-to-library, version lineage, retry, cancel
- Drag/drop upload · Supabase Storage asset picker · upload progress · dimension/type/size validation
- Batch generation · variations · seed · negative prompt (UI) · quality selector · credit estimate
- Durable job queue + worker · progress polling · dead-letter surfacing

**Billing**
- Working Paddle Billing checkout · invoices · billing portal · refunds · chargebacks · failed-payment dunning
- Plan→credit grant on activation · entitlement enforcement · upgrade/downgrade proration · customer mapping

**Frontend / design system**
- Design tokens (spacing, radii, typography scale, shadows, motion, z-index, breakpoints) — currently 7 CSS vars
- Light-first theme (spec requires `#F8FAFC`/`#FFFFFF`/`#0B1220`/`#6D5EF8`/`#06B6D4`); app is **dark-only**
- Command palette (⌘K) — the search box is decorative and non-functional
- Workspace switcher · credits display in top bar · contextual right panel
- Motion system (spec lists 20 required animation categories; ~4 exist) · "creative pulse" generation animation
- Card state system (hover/focus/active/disabled/loading/empty/error)
- Mobile bottom navigation / sheets · focus trap + Escape on the mobile drawer
- 44 files use ad-hoc inline `style={{}}` instead of a shared system

**SEO / public**
- `app/sitemap.ts` · Open Graph · Twitter cards · canonical URLs · JSON-LD structured data · OG images

**Ops / security**
- Rate limiting on user-facing routes (only the developer API has one, and it is race-prone)
- Error tracking (Sentry) · request/job ID propagation · provider cost & latency dashboards · alerting
- Upload scanning · backup/DR runbook · secret rotation

**Testing**
- 19 unit tests total. Missing: auth tests, **Google OAuth callback tests (explicitly required)**, email tests,
  credit-concurrency tests, Paddle webhook tests, storage tests, security tests, accessibility tests, RLS tests in CI

---

## 6. What is genuinely GREEN (do not rewrite)

- **AI provider router** (`lib/ai/router.ts`) — capability-aware model registry, correct Groq→Cerebras→OpenRouter→
  Claude chain, dead-provider short-circuit on `AUTH_ERROR`/`MISSING_KEY`, exponential backoff, vision-capability
  filtering so image inputs never reach a text-only model, per-attempt telemetry hook. Genuinely 8.5/10.
- **Supabase schema** — 51 tables, **RLS enabled on 51/51** (verified by diffing `create table` against
  `enable row level security`). Workspace isolation helpers, `security definer` + `set search_path` on functions.
- **Integration credential encryption** — correct AES-256-GCM with random IV and auth tag, fails closed.
- **API key storage** — SHA-256 hashed, plaintext returned once, prefix-only display, revocation supported.
- **Paddle webhook signature verification** — correct scheme, `timingSafeEqual`, throws contained.
- **Build/typecheck/tests** — all pass cleanly under TS strict mode.

---

## 7. Proposed Phase 1 — Audit, architecture, auth and foundation

Ordered by leverage. Each step ends with typecheck + build + unit tests + HTTP smoke tests re-run.

**1.1 Restore repository integrity (fixes RED-01)** — *prerequisite for everything*
- Replace the broken `next-app` gitlink with the real 252 source files; add `.gitignore`.
- Verify `git clone` → `npm ci` → `npm run build` works from scratch.

**1.2 Fix middleware (fixes RED-02 — 6 subsystems restored by one change)**
- Narrow the matcher to exclude `_next`, static assets, `robots.txt`, `sitemap.xml`, `favicon`.
- Explicit public allowlist for `/api/billing/webhook`, `/api/render-worker/*`, `/api/health*`, `/api/v1/*`
  (each already enforces its own auth: signature, shared secret, API key).
- API routes return **401 JSON**, never a 307 to an HTML page.
- Exempt `/auth/callback` and `/auth/confirm` from the authenticated→`/dashboard` bounce.
- **Tests:** HTTP assertions for all 13 routes measured above.

**1.3 Real Google OAuth + the white-page fix (fixes RED-03)**
- `signInWithOAuth({provider:'google', redirectTo:/auth/callback?next=…})` + a Google button on sign-in/sign-up.
- New `app/auth/callback/route.ts`: `exchangeCodeForSession`, validated `next` (must start with `/`, reject `//`
  and `/\`), OAuth error/`error_description` handling, cancelled and expired-code handling.
- Failure renders a **useful error page**, never a blank one.
- **Tests (explicitly required by the master command):** start OAuth → callback → exchange → session → safe
  redirect → dashboard loads; and invalid/expired/cancelled callback → readable error, not a white page.

**1.4 Resend transactional email (fixes RED-05)**
- Server-only `lib/email/` service + `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME`.
- Branded HTML + plain-text templates. **Only two events**: new sign-up, and sign-in (with IP/UA/time security detail).
- `email_events` table with a unique send key → no duplicate notifications.
- Email failure is caught and logged; **it must never break authentication**.
- Key never reaches the browser.

**1.5 Harden auth (fixes RED-15)**
- Password reset request + update routes/pages; email verification confirm route.
- Session refresh, unauthorized handling, account deletion.

**1.6 Neutralize the mock prototype (fixes RED-04)**
- Move all 19 root HTML files to `legacy-prototype/` with a `DO-NOT-DEPLOY.md`, strip the fake auth/payment
  handlers, and add a build guard so the static mock can never be deployed as production.
- Next.js becomes the sole source of truth. Salvage design assets only.

**1.7 Supabase/RLS audit + credit-safety groundwork (starts RED-07)**
- Review all 35 migrations for FKs, indexes, cascade behaviour, constraints.
- Add `FOR UPDATE` row locking + a non-negative balance constraint to `reserve_credits`, with a concurrency test.
  *(Full credit/job work lands in Phase 2.)*

**1.8 Foundational build/config hygiene**
- Remove `robots:{index:false}` from the root layout (RED-11 groundwork).
- Replace `scripts/production-audit.mjs` with a real audit that fails on the checks above (RED-13).
- Wire `lib/observability/logger.ts` into auth + API error paths with request IDs (RED-14 groundwork).

**Deliberately NOT in Phase 1:** provider/generation/jobs (Phase 2), Paddle/teams/dev-platform (Phase 3),
design system/Figma/animation (Phase 4), security/perf/SEO/launch (Phase 5).

**Phase 1 exit criteria:** `npm ci` + typecheck + build + unit tests pass; all 13 smoke-tested routes return the
correct status; Google OAuth callback tests pass; Resend tests pass with a mocked transport; no mock authentication
or mock payment path remains deployable; `PHASE_1_COMPLETION.md` records files changed, tests run, results, and
external-service limitations.
