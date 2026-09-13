# Picbo — Remaining Issues

Date: 2026-09-12

Everything still open, prioritised. Nothing here is hidden in a completion report.

Severity:
- **P0** — blocks launch
- **P1** — fix within the first weeks of production
- **P2** — quality and scale work
- **P3** — nice to have

---

## P0 — blocks launch

### P0-1 · No third-party integration has been observed working
**The single largest gap in this engagement.**

Google OAuth, Resend, Paddle, the AI providers and Supabase itself are all unverified
round trips. Every one is implemented, reviewed and unit-tested; none has been run
against the real service, because this environment has no credentials for any of them.

*Not a code defect — an access problem.* Until it is closed, no claim of production
readiness is defensible.

**To close:** work through `PICBO_PRODUCTION_ENV_CHECKLIST.md` against a staging
environment. Budget half a day.

### P0-2 · 34 migrations have never been applied
Including six written in this work (32–37), which add the credit advisory lock, credit
grants, rate-limit counters, API key expiry and seven missing indexes. The SQL is
reviewed but unexecuted, and a migration that has never run is a migration that might
not run.

Watch for the reconciliation warning in migration 33 (§2 of the checklist).

### P0-3 · Legal pages are not lawyer-reviewed
Privacy policy and terms now exist and accurately describe what the code does — sub-
processors, retention, credit refund behaviour. They have **not** been reviewed by a
qualified lawyer, and both say so on the page. Paddle and Google OAuth verification will
both ask for them.

### P0-4 · The E2E suite has never run
`e2e/full-flow.spec.ts` covers the 17-step flow with real assertions. It has never been
executed. "Written" and "passing" are different claims and the test report keeps them
apart.

**To close:** a staging Supabase project and a pre-confirmed test account.

---

## P1 — first weeks of production

### P1-1 · No error tracking
`captureError()` exists as a single choke point and currently writes a structured log
line. There is no Sentry or equivalent, so a production exception is only visible to
whoever is reading logs at the time.

**To close:** wire a tracker inside `captureError()` — every call site is already
correct, so this is one function, not a codebase sweep.

### P1-2 · CSP allows `'unsafe-inline'` on scripts
A real, acknowledged weakening. Next's App Router inlines hydration bootstrap, and the
pre-paint theme script must be inline to avoid a flash of the wrong theme. This
materially reduces the CSP's value against XSS.

**To close:** per-request nonces generated in middleware and threaded into the script
tags. Meaningful work; worth doing.

### P1-3 · No load testing
No p95 latency figure, no throughput ceiling, no knowledge of where this breaks. The
likely first bottleneck is the rate-limit counter under contention, since every
authenticated request now touches it.

### P1-4 · No backup restore rehearsal
Supabase PITR is available but unconfigured, and an unrehearsed restore is not a backup.

### P1-5 · Admin panel is thin
The guard is correct (`platform_admins` starts empty, so it is secure by default), but
the panel itself does not cover the surface the master command lists — coupons, feature
flags, cost/margin monitoring, moderation queue.

### P1-6 · No onboarding flow
Listed under Phase 4 in the master command. A new user lands on an empty dashboard with
no guided first action.

**Deliberately not invented.** Building it properly needs product decisions — what a new
user must do first, whether it is skippable, whether it seeds a sample product — that
belong to you, not to me.

### P1-7 · Figma design research could not be performed
The directive requires shortlisting and scoring 3–5 Figma references. The connection
authenticates (View seat, starter tier) but every read tool needs a `fileKey`, no design
file was provided, and a View seat cannot create one.

**To close:** send a Figma file URL, a community UI-kit key, or upgrade the seat.

---

## P2 — quality and scale

### P2-1 · No live accessibility scan
Contrast is computed from the real token file and structure is asserted by test, but no
axe or Lighthouse run against a deployed URL has happened. Those catch things static
analysis cannot — focus order, live-region behaviour, real screen-reader output.

### P2-2 · No visual regression baseline
Nothing protects against a CSS change silently breaking a page.

### P2-3 · Per-page composition is uneven
The token system re-themed all 40 routes at once — the high-leverage 80%. Individual
page layout has not had a pass: Analytics chart styling, several empty states, and the
video editor are the weakest.

### P2-4 · Rate limits are per-user, not per-workspace or per-IP
A workspace with ten members gets ten times the limit, and unauthenticated routes
(password reset) are limited per-user, which is meaningless before sign-in.

**To close:** add IP-based limiting for pre-auth routes; consider workspace-level caps.

### P2-5 · Background jobs run in the request invocation
`after()` returns the response immediately, but processing is still bounded by the
function timeout. The sweep endpoint recovers anything abandoned, so nothing is lost —
but a long video generation will be swept and retried rather than completing first time.

**To close:** a real queue (Supabase queues, QStash, or a worker service).

### P2-6 · No dead-letter visibility for users
Failed generations refund credits and mark the job failed. A user cannot see a list of
their failed jobs or retry from history — only from the studio session that created it.

### P2-7 · Image Studio does not offer batch or variations
`ai_jobs` supports it and the credit model handles it; the UI submits one generation at
a time.

### P2-8 · Webhook handler failure has no automatic replay
On a handler exception the route returns 500 so Paddle retries — but the
`payment_events` row already exists, so the retry is treated as a duplicate. Recovery is
the `billing_grant_reconciliation` view, which must be monitored.

**To close:** move the idempotency claim to commit *after* the handler succeeds, or add
a replay worker driven by the reconciliation view.

---

## P3 — nice to have

- **P3-1** TypeScript is not pinned (`^5.7.2` resolved to 5.9.3, which changed
  `baseUrl` behaviour mid-session). Pin it.
- **P3-2** No CI pipeline. Every check in this work runs locally; nothing enforces them
  on a pull request.
- **P3-3** No OG images — link unfurls have metadata but no picture.
- **P3-4** Lumi accepts client-supplied `assistant` turns in its history, so a client can
  forge what "Lumi previously said". Action hrefs are allow-listed so the blast radius is
  small, but it should be server-side.
- **P3-5** `lib/growth/team.ts` is used only for UI gating; server-side checks are
  written inline. Routing them through `can()` would keep one source of truth.
- **P3-6** No API versioning strategy beyond the `/api/v1` prefix.
- **P3-7** Storage quota is checked before upload but never recalculated after deletion.

---

## Closed — for the record

Every RED issue from the Phase 0 audit, plus eight found during the work:

| Found in | Issue |
|---|---|
| Phase 0 | All 15 RED issues (see `PICBO_FINAL_AUDIT.md` §3) |
| Phase 1 | `cancelSubscription` wrote through RLS and silently affected 0 rows |
| Phase 1 | Six workspace-scoped tables missing indexes on hot paths |
| Phase 2 | **Cross-workspace asset exposure** via the render worker callback |
| Phase 2 | Photoshoots reported `completed` before generating anything |
| Phase 2 | Worker secret compared with non-constant-time string equality |
| Phase 3 | **Paying customers received no credits** |
| Phase 3 | **An admin could promote themselves to owner** and remove the real owner |
| Phase 3 | Four team actions reported success while RLS filtered the write to 0 rows |
| Phase 3 | API rate limit bypassable by sending requests that error |
| Phase 4 | The design palette's own semantic colours failed WCAG AA as text |
