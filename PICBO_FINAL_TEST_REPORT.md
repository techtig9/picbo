# Picbo — Final Test Report

Date: 2026-09-12
Branch: `claude/picbo-audit-plan-uxl86j`

This report separates **what was executed** from **what exists but has never run**. That
distinction is the whole point of the document.

---

## 1. Executed — results

| Suite | Command | Result |
|---|---|---|
| Dependency install | `npm install` | **PASS** |
| TypeScript (strict) | `npx tsc --noEmit` | **PASS** — 0 errors |
| Production build | `npx next build` | **PASS** — 40 pages, 47 API routes |
| Unit / integration | `node --import tsx --test tests/*.test.ts` | **PASS — 150 / 150** |
| HTTP smoke | `node scripts/smoke-test.mjs` against `next start` | **PASS — 69 / 69** |
| Production audit | `node scripts/production-audit.mjs` | **PASS — 62 / 62** |

### Growth across phases

| | Phase 0 | P1 | P2 | P3 | P4 | **P5** |
|---|---:|---:|---:|---:|---:|---:|
| Unit tests | 19 | 41 | 76 | 100 | 124 | **150** |
| Smoke tests | 0 | 32 | 40 | 40 | 52 | **69** |
| Audit checks | 0* | 25 | 32 | 40 | 52 | **62** |

\* The original `production-audit.mjs` checked that four files existed and printed
`{"ok": true}` unconditionally. It could not fail.

---

## 2. Unit test coverage by area

| File | Tests | What it protects |
|---|---:|---|
| `auth-routes.test.ts` | 11 | The six subsystems middleware was 307-ing to sign-in |
| `safe-redirect.test.ts` | 11 | Open-redirect defence on the OAuth callback |
| `media-validation.test.ts` | 14 | JSON/HTML error bodies being stored and billed as images |
| `credit-cost.test.ts` | 10 | Server-side pricing; failure messages not leaking the provider chain |
| `render-output-path.test.ts` | 11 | Cross-workspace asset exposure via the render worker |
| `paddle-webhook.test.ts` | 11 | Signature verification, replay freshness, Billing config |
| `team-permissions.test.ts` | 11 | Role permissions, plan/credit invariants |
| `navigation.test.ts` | 13 | IA size, palette coverage, active-state correctness |
| `contrast.test.ts` | 11 | WCAG ratios computed from the real token file |
| `health-probes.test.ts` | 15 | RED-12 — a revoked key must not read healthy |
| `logger-redaction.test.ts` | 13 | Secrets and signed URLs never reaching the log drain |
| `ai-router.test.ts` | 8 | Provider fallback chain under simulated failures |
| `provider-errors.test.ts` | 6 | Retryable vs. permanent error classification |
| `moderation.test.ts` | 4 | Prompt safety classification |
| `render-lifecycle.test.ts` | 3 | Render backoff behaviour |

Three of these test suites assert that a **past bug stays fixed** in a way that is easy to
regress: `contrast.test.ts` asserts the raw brand colours *fail* as text (so nobody
"simplifies" the accessible variants away), `credit-cost.test.ts` asserts user-facing
errors never contain provider names, and `health-probes.test.ts` asserts a 401 from a
provider maps to `unauthenticated` rather than `ok`.

---

## 3. Smoke tests — measured against a running production server

The most valuable results in this report, because they are the ones static analysis
could not have produced. Each was a **measured production failure** before the fix.

| Endpoint | Before | After |
|---|---|---|
| `POST /api/billing/webhook` | 307 → sign-in | 401 (bad signature) |
| `POST /api/render-worker/complete` | 307 → sign-in | 401 (missing secret) |
| `POST /api/render-worker/fail` | 307 → sign-in | 401 |
| `GET /api/health` | 307 → sign-in | 200 JSON |
| `GET /api/v1/products` | 307 → sign-in | 401 |
| `GET /robots.txt` | 307, body `/auth/sign-in` | 200 text/plain + Sitemap |
| `GET /sitemap.xml` | 307 (absent) | 200 XML |
| `GET /auth/callback?code=…` | **404** (the white page) | 307 → readable error page |
| `POST /api/ai/generate` signed out | 307 → HTML | **401 JSON** |

Plus, added in later phases: security headers, CSP framing block, no-store on API
responses, legal pages public and indexed, data export requiring a session, and the deep
health check leaking neither secrets nor queue depth to anonymous callers.

---

## 4. NOT executed — and why

**This section is the reason the final audit does not claim 10/10.**

| Test | Blocked by | Consequence |
|---|---|---|
| **Playwright E2E (17-step flow)** | Live Supabase + a pre-confirmed test account | The suite is written with real assertions and has **never run**. "Written" ≠ "passing". |
| **Google OAuth round trip** | Google Cloud OAuth client + Supabase provider enabled | The callback, error paths and open-redirect defence are tested; the trip to Google is not. |
| **Resend delivery** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | No email has been sent. Templates and idempotency are unit-tested only. |
| **Paddle checkout → payment → activation** | Paddle sandbox account | No transaction created, no webhook received, no credit granted by a real payment. |
| **Migration execution (34 files)** | Live Postgres | SQL is reviewed but **never applied**. Migrations 32–37 are entirely new. |
| **RLS cross-workspace tests** | Live Postgres | `supabase/tests/cross_workspace_rls.sql` exists and has not been run. |
| **Credit concurrency under load** | Live Postgres | The advisory lock is correct by inspection; contention is unproven. |
| **Render worker end-to-end** | Deployed FFmpeg worker | The contract is hardened and unit-tested; no worker exists to test against. |
| **Live accessibility scan (axe/Lighthouse)** | A deployed URL | Contrast is computed; structure is asserted by test. No live audit. |
| **Load / performance testing** | Load-testing environment | No p95 latency figure, no throughput ceiling, no idea where this breaks. |
| **Visual regression** | Screenshot baseline | No protection against a CSS change silently breaking a page. |
| **Real-device responsive** | Physical devices | Breakpoints implemented at all nine specified widths; never opened on a phone. |

---

## 5. Failures encountered during this work

Recorded because a test report with no failures in it is usually a test report nobody
ran.

| # | Failure | Cause | Resolution |
|---|---|---|---|
| 1 | Typecheck failed with `JSX element implicitly has type 'any'` | `node_modules` deleted before a commit; `npx` resolved a global TypeScript | Reinstalled; stopped deleting `node_modules` |
| 2 | `baseUrl` deprecation error | Newer global TS than the pinned version | Removed `baseUrl` — redundant under `moduleResolution: bundler` |
| 3 | Smoke: "Callback never redirects off-site" | **Real bug** — the callback forwarded an unsanitised `next` into the error URL | Sanitised before forwarding |
| 4 | Smoke: robots/Google assertions failing | Test bug — 400-char body truncation | Widened the capture |
| 5 | Smoke re-run still failed after the fix | Stale server on the port (`EADDRINUSE`); old code was still serving | Killed it; **the fix was real, the verification was not** |
| 6 | Audit: 3 checks failed | The checker matched prose in its own doc comments | Strips comments; tests the `"use client"` directive positionally |
| 7 | Audit: `SEC-01` failed | My own throwaway `.env.local` in the tree | Removed — the check did its job |
| 8 | Smoke: dark theme / reduced motion "missing" | Minifier strips quotes (`data-theme=dark`); CSS bundle is 27KB vs a 20KB body cap | Matched both forms; read asset bodies whole |

Item 5 is worth dwelling on: for one run the code was correct and the test was
still reporting the old behaviour. Without checking the server log, that would have been
recorded as a fix that did not work — or worse, a failure that was "flaky".

---

## 6. How to reproduce

```bash
cd next-app
npm install
npx tsc --noEmit                     # expect: 0 errors
npx next build                       # expect: Compiled successfully
node --import tsx --test tests/*.test.ts   # expect: 150 pass, 0 fail
node scripts/production-audit.mjs    # expect: 62/62

# Smoke tests need a running server:
printf 'NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co\n
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder\n
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3111\n' > .env.local
npx next build && npx next start -p 3111 &
BASE_URL=http://127.0.0.1:3111 node scripts/smoke-test.mjs   # expect: 69/69
rm .env.local                        # or SEC-01 will (correctly) fail
```

Placeholder Supabase values are deliberate: the smoke suite tests routing, headers and
error paths, all of which must behave correctly **without** a live backend.
