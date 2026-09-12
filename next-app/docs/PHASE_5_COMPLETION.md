# Phase 5 completion — Production hardening and launch

Date: 2026-09-12
Branch: `claude/picbo-audit-plan-uxl86j`
Scope: Phase 5 of 5, per `Picbo_Master_Audit_and_Claude_Code_Command.md` §7.

---

## 1. Evidence

| Check | Result |
|---|---|
| Typecheck (strict) | **PASS** — 0 errors |
| Production build | **PASS** — 40 pages, 47 API routes |
| Unit tests | **PASS 150/150** (was 124) |
| HTTP smoke tests | **PASS 69/69** (was 52) |
| Production audit | **PASS 62/62** (was 52) |

---

## 2. RED-12 closed — health checks now tell the truth

The old check called the AI chain `ok` whenever one of three environment variables was a
non-empty string, **without ever contacting a provider**. A revoked, expired or
quota-exhausted key reported GREEN — worse than having no health check, because it
actively says the broken thing is fine. It also destructured `count` from queue queries
without handling failure, so a failing query produced `null` and read as an empty queue.

Every dependency is now actually contacted, with the distinct states the spec asks for:

| State | Means |
|---|---|
| `not_configured` | No credential — expected in some environments, not a failure |
| `unreachable` | Network or DNS failure |
| `unauthenticated` | **Credential present and rejected** — the case that used to read `ok` |
| `quota_exhausted` | Authenticated, out of quota |
| `degraded` | Working but slow or partial |
| `ok` | Reachable, authenticated, able to serve its task |

Two details worth noting: probes hit **list/models** endpoints, never generation, so a
health check never spends money or consumes quota; and **capability** is reported
separately from configuration — a workspace with only a text key configured cannot
generate an image, and the endpoint says so rather than reporting a green chain.

Queue depth is returned **only** to an authenticated caller. It was previously public.

---

## 3. Rate limiting — everything except the developer API was unbounded

Credits cap *spend*, not request volume. A script could hammer Lumi until the balance
ran out, and **uploads cost no credits at all**, so nothing stopped a workspace filling
storage as fast as its connection allowed.

| Route | Limit |
|---|---|
| `/api/ai/generate` | 30 / min per user |
| `/api/lumi/chat` | 20 / min |
| `/api/assets/upload` | 40 / 5 min |
| Password reset | 5 / 15 min |

Counted in Postgres, not in memory: a serverless instance's in-process counter resets on
every cold start, which stops limiting exactly when traffic is highest. The increment is
a single atomic upsert — a read-then-write would be the same check-then-act race that let
concurrent generations overspend credits before Phase 33.

**Fails open** on an infrastructure error, deliberately: a limiter that cannot reach its
store should not take the product down. The failure is logged so it is visible.

---

## 4. Security headers — there were none

CSP, HSTS, `nosniff`, referrer policy, permissions policy, `frame-ancestors 'none'`, and
`no-store` on all API responses so signed URLs and per-user JSON cannot be held in a
shared cache.

The CSP is scoped to what Picbo actually needs rather than copied wholesale: `img-src`
allows the Supabase storage origin, `frame-src` allows Paddle's checkout iframe, and
`connect-src` allows Supabase and the Paddle API.

**`'unsafe-inline'` on `script-src` is a real, acknowledged weakening** — Next inlines
hydration bootstrap and the pre-paint theme script must be inline. It is recorded as
**P1-2** in `PICBO_REMAINING_ISSUES.md` rather than quietly skipped.

---

## 5. Observability — the logger is now safe to use

The module existed but was imported by **zero** files. It is now on the auth, email,
billing, generation, rate-limit and health paths, with two things that make the output
usable:

- **Request correlation** from an incoming `x-request-id`, so one user's failing
  generation can be followed across submission, provider attempts, validation and storage.
- **Redaction.** Metadata is scrubbed centrally — by key name, by secret-shaped value
  (Bearer tokens, `sk-`, `pk_live_`, JWTs, Paddle keys), and by stripping signature
  parameters from signed URLs while keeping the path. Relying on every call site to
  remember what is sensitive is not a plan. 13 tests.

`captureError()` is a single choke point so wiring Sentry later means editing one
function.

---

## 6. Legal, deletion and export — all missing, all required

No legal pages existed at all, which blocks both Paddle onboarding and Google OAuth
verification.

- **Privacy policy** — written to describe what the code *actually does*: the real
  sub-processors, real retention periods, and the fact that Picbo sets no tracking
  cookies (which is why there is no consent banner).
- **Terms** — including the credit refund behaviour the code genuinely implements.
- **Data export** (`/api/me/export`) — reads through the **user-scoped** client on
  purpose, so RLS guarantees an export can only contain the caller's own data. The
  service-role client would be faster and far more dangerous.
- **Account deletion** — there was a `deleteWorkspace`, but no way for a person to remove
  *themselves*. Refuses if it would orphan or delete other members' work; deletes storage
  **before** database rows, since the rows are what tell us which objects exist.

Both pages say on their face that they are not lawyer-reviewed. That is **P0-3**.

---

## 7. Deliverables

- `PICBO_FINAL_AUDIT.md` — verdict, every RED closed, full score table
- `PICBO_FINAL_TEST_REPORT.md` — what ran, what did not, and the 8 failures hit on the way
- `PICBO_PRODUCTION_ENV_CHECKLIST.md` — every variable, migration caveat and launch gate
- `PICBO_REMAINING_ISSUES.md` — 4 P0, 7 P1, 8 P2, 7 P3

---

## 8. Phase 5 exit criteria

- [x] Security audit and headers
- [x] Rate limiting and abuse prevention
- [x] Observability with redaction
- [x] SEO complete (robots, sitemap, OG, canonical, legal indexed)
- [x] Legal pages, data export, account deletion
- [x] Health checks that contact real dependencies
- [x] 150/150 unit, 69/69 smoke, 62/62 audit
- [x] All four deliverable documents
- [ ] **E2E — never run** (P0-4)
- [ ] **No live third-party verification** (P0-1)
- [ ] **Backup/recovery not rehearsed** (P1-4)

**All five phases are complete. The product is not certified production-ready, and
`PICBO_FINAL_AUDIT.md` says so plainly: 7.9/10 verified, with the gap being access to
real services rather than unwritten code.**
