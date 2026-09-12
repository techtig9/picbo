# Picbo — Final Audit

Date: 2026-09-12
Branch: `claude/picbo-audit-plan-uxl86j`
Phases completed: 5 of 5

---

## 1. Verdict

**Picbo is not 10/10, and I am not going to say it is.**

The master command is explicit: *"Do not claim 10/10 merely because all requested
features exist."* Its acceptance list requires, among other things, that Google login
works, Resend emails work, Paddle webhooks work, and E2E passes. **None of those four
have been observed working**, because this environment has no Google OAuth client, no
Resend key, no Paddle account and no live Supabase project. The code for each is written,
reviewed and unit-tested; the round trip to the third party is unverified.

What can be said with evidence:

- Every **RED** issue found in the Phase 0 audit is closed.
- **150 unit tests**, **69 HTTP smoke tests** and **62 production-audit checks** pass.
- Typecheck and production build are clean.
- The product went from one that **could not have taken a payment** and **never showed a
  user the image they paid for** to one where both paths are implemented correctly.

**Honest overall: 7.9 / 10 verified, with a credible path to 9.5+ once credentials
exist.** The remaining 0.5 is genuine engineering work listed in
`PICBO_REMAINING_ISSUES.md`, not paperwork.

---

## 2. Where this started

The Phase 0 audit scored the repository **≈4.2/10** — below the master document's own
estimate of 7.3, because running the app revealed that subsystems rated 7–8 were
*unreachable at runtime*.

The single most important finding came before any code was read:

> **`next-app` was committed as a gitlink (mode `160000`)** pointing at a commit that
> does not exist, with no `.gitmodules`. `git ls-files` returned 53 files; the
> application is 252. A fresh clone produced an **empty directory**.

Every "PHASE_N_COMPLETION.md" in `docs/` described code that was never in version
control. That is the context for everything below.

---

## 3. Every RED issue, and how it was closed

| ID | Issue | Status | Evidence |
|---|---|---|---|
| RED-01 | Entire Next.js app missing from git (broken gitlink) | **CLOSED** | 252 files restored; audit `REPO-01` |
| RED-02 | Middleware 307-redirected 6 machine subsystems to an HTML sign-in page | **CLOSED** | Measured before/after on a live server; 17 smoke assertions |
| RED-03 | No Google OAuth; `/auth/callback` returned **404** — the white page | **CLOSED (code)** | Callback exists, exchanges the code, every failure path renders a readable error |
| RED-04 | `login.html` accepted **any password**; `billing.html` faked payment success | **CLOSED** | Quarantined, handlers neutralised; audit `MOCK-01/02/03` |
| RED-05 | Resend: **zero** matches repo-wide | **CLOSED (code)** | Server-only transport, templates, DB-level send idempotency |
| RED-06 | Client sent its own credit price (`body.creditCost`) | **CLOSED** | Server-side price table; audit `CREDIT-02` |
| RED-07 | `reserve_credits()` check-then-act race | **CLOSED** | Per-workspace advisory lock (migration 33) |
| RED-08 | **Generated image never shown to the user** | **CLOSED** | Output downloaded, byte-validated, stored, rendered |
| RED-09 | Checkout built a Paddle **Classic** URL while the webhook implements **Billing** | **CLOSED (code)** | Real Billing transaction creation |
| RED-10 | Cancellation never called Paddle — customers kept being charged | **CLOSED (code)** | Paddle called first; nothing recorded if it refuses |
| RED-11 | Root layout `noindex` hid the marketing site | **CLOSED** | Per-route noindex in middleware; sitemap added |
| RED-12 | Health reported `ok` because an env var was non-empty | **CLOSED** | Real probes; 6 distinct failure states |
| RED-13 | `production-audit.mjs` was a stub that always passed | **CLOSED** | 62 checks that each assert a real past failure |
| RED-14 | Structured logger imported **0 times** | **CLOSED** | On auth, email, billing, generation, health paths + redaction |
| RED-15 | No password reset at all | **CLOSED** | Request, confirm and update flows |

---

## 4. Issues found during the work, not in the original audit

These are the ones that matter most, because nobody had flagged them.

### Cross-workspace data leak in the render worker callback
`completeRenderJob()` took the external worker's `storagePath` **verbatim** and created
an `assets` row under the job's workspace. Nothing checked the path belonged to that
workspace, so a worker bug or leaked secret could point workspace A's asset row at
workspace B's object — and A would be handed a signed URL to B's file. A cross-tenant
leak reachable without touching the database.

### Paying customers received no credits
The webhook set plan and status but **never granted credits**. Checkout completed, the
plan changed, the balance stayed at zero. No grant function existed anywhere in the
schema.

### An admin could take over a workspace
`changeMemberRole` accepted `role="owner"` from any member RLS permitted to write — i.e.
any admin. An admin could promote themselves to owner, then remove the real owner.
Entirely inside the RLS boundary, so the database would never have stopped it.

### Four team actions reported success while doing nothing
RLS correctly restricts `workspace_members` to owner/admin — but an UPDATE or DELETE that
RLS filters out **matches zero rows and returns no error**. A viewer clicking "Remove
member" saw success while nothing happened. The same class of bug as the Phase 1
cancellation finding, in four more places.

### Photoshoots reported success before generating anything
Shoots and every shot item were written as `completed` at submission time, before the
provider had returned. A failed shoot displayed as a finished photoshoot with no images.

### The API rate limit could be bypassed by failing
Requests were logged **after** the handler, so any request that threw was never counted.
A caller could exceed the limit indefinitely by sending requests that error.

### The design system's own palette failed accessibility
`#16A34A` measures **3.4:1** on white, `#F59E0B` **2.2:1**, `#EF4444` **3.8:1** — all
below the 4.5:1 AA floor, and all were used as body text.

### My own audit script had a false-positive class
Three checks failed on prose inside their own doc comments. A check a comment can flip to
FAIL is one a comment can flip to PASS. Fixed in the checker, not by rewording.

---

## 5. Final score table

Every category the master command requires, none omitted.

| Category | Phase 0 | **Final** | Target | Basis |
|---|---:|---:|---:|---|
| Product | 8.0 | **8.5** | 10 | Feature surface is broad and now actually reachable |
| Frontend | 4.5 | **8.0** | 10 | Token system, light/dark, real IA; per-page polish uneven |
| Backend | 7.0 | **8.5** | 10 | Durable jobs, validated output, clean separation |
| Auth | 4.0 | **8.5** | 10 | Complete flows; **YELLOW** on the live Google round trip |
| Google OAuth | 0.0 | **8.0** | 10 | Code + regression tests; never run against Google |
| Resend | 0.0 | **8.0** | 10 | Transport, templates, idempotency; no key to send with |
| AI | 8.5 | **9.0** | 10 | Was already strong; capability-aware routing verified |
| Generation | 5.0 | **8.5** | 10 | Output persisted, validated, **displayed**; no live run |
| Database | 8.5 | **9.0** | 10 | RLS 52/52; locking, indexes, reconciliation views added |
| Billing | 2.0 | **8.0** | 10 | Correct Billing API; **YELLOW** on a live transaction |
| Credits | 5.0 | **9.0** | 10 | Concurrency-safe, idempotent, server-priced |
| Jobs | 3.0 | **8.5** | 10 | Durable, pollable, cancellable, sweepable |
| Rendering | 3.0 | **7.5** | 10 | Contract hardened; no worker deployed to test against |
| Security | 4.5 | **8.5** | 10 | Headers, CSP, rate limits, redaction, tenant isolation |
| Testing | 4.0 | **8.0** | 10 | 150 unit + 69 smoke + 62 audit; **E2E never run** |
| Accessibility | 5.0 | **8.0** | 10 | Computed contrast, focus management; no live axe run |
| Performance | 5.0 | **7.0** | 10 | Indexes and caching headers; **no load testing** |
| SEO | 1.5 | **8.5** | 10 | Robots, sitemap, OG/Twitter, canonical, legal indexed |
| Admin | 6.0 | **7.0** | 10 | Guard is correct; panel is thin |
| Developer platform | 6.0 | **8.0** | 10 | Hashed keys, expiry, working limits, headers |
| **Overall** | **≈4.2** | **≈7.9** | 10 | Verified only where evidence exists |

---

## 6. What "not 10/10" actually means

Four things, in order of how much they matter:

1. **No third-party integration has been observed working end to end.** Google, Resend,
   Paddle, the AI providers and Supabase itself are all unverified round trips. This is
   the single biggest gap and it is an access problem, not a code problem.
2. **The E2E suite has never been run.** It is written and the assertions are real, but
   "written" and "passing" are different claims.
3. **No load testing, no live accessibility scan, no visual regression baseline.**
4. **Onboarding does not exist**, and the Figma design research could not be performed.

Full detail, with what each needs, is in `PICBO_REMAINING_ISSUES.md`.

---

## 7. Companion documents

- `PICBO_FINAL_TEST_REPORT.md` — what was run, what passed, what was not run
- `PICBO_PRODUCTION_ENV_CHECKLIST.md` — every variable and pre-launch step
- `PICBO_REMAINING_ISSUES.md` — everything still open, prioritised
- `PICBO_FRONTEND_DESIGN_DECISION.md` — design direction and the Figma blocker
- `next-app/docs/PHASE_{1..5}_COMPLETION.md` — per-phase evidence
