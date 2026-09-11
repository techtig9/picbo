# Phase 3 completion — Billing, growth, teams, integrations and developer platform

Date: 2026-09-11
Branch: `claude/picbo-audit-plan-uxl86j`
Scope: Phase 3 of 5, per `Picbo_Master_Audit_and_Claude_Code_Command.md` §7.

Status legend: **GREEN** = verified working · **YELLOW** = blocked only by a missing
external credential/service · **RED** = broken.

---

## 1. Evidence

| Check | Result |
|---|---|
| Typecheck (strict) | **PASS** — 0 errors |
| Production build | **PASS** |
| Unit tests | **PASS 100/100** (was 76) |
| HTTP smoke tests | **PASS 40/40** |
| Production audit | **PASS 40/40** (was 32) |
| Live Paddle sandbox | not run | **YELLOW** — no Paddle account available |

---

## 2. RED-09 closed — checkout was calling the wrong Paddle product

`createCheckoutUrl` built a **Paddle Classic** URL:

```
https://checkout.paddle.com/checkout?items=[…]&customer_email=…
```

while the webhook handler implements **Paddle Billing** (`Paddle-Signature: ts=…;h1=…`,
`subscription.activated`, `custom_data`). Those are two different products with
incompatible APIs. That link could never have opened a valid Billing checkout — so in
its current state the product could not have taken a single payment.

Paddle Billing does not accept a checkout URL assembled from query parameters. A
transaction is now created server-side through `POST /transactions` and the customer is
sent to the checkout URL Paddle returns. That also keeps price and plan
server-authoritative: `custom_data` (workspace, plan, period) is set from values we
looked up ourselves, never from the request body, so a customer cannot check out as
another workspace or on a plan they did not pay for.

Sandbox and production are separate hosts with separate keys, so `PADDLE_ENVIRONMENT`
was added — mixing them silently fails signature verification, which is a miserable
thing to debug.

---

## 3. RED-10 closed — cancellation now reaches Paddle

Phase 1 found that `cancelSubscription` wrote with the user-scoped client against a
table with no UPDATE policy, so it matched zero rows and reported success. That was
fixed then. What remained was worse: **nothing ever told Paddle.** A customer clicked
cancel, saw a confirmation, and kept being charged.

The Paddle call now happens **first**. If Paddle refuses, no local cancellation is
recorded and the user is told plainly that nothing changed — rather than leaving the
database claiming a cancellation that does not exist at the payment provider.

`provider_canceled_at` is only stamped when Paddle reports the subscription as actually
canceled, not when it merely accepts the schedule. The billing page reads that
distinction: *"Scheduled to cancel at the end of this billing period"* until Paddle
confirms, *"Cancelled"* after.

Added `resumeSubscription` so a scheduled cancellation can be undone before it takes
effect — the standard save-the-customer path, and it was missing entirely.

---

## 4. Customers now receive the credits they paid for

The webhook set a subscription's plan and status but **never granted credits**. A
customer could complete checkout, watch their plan change, and still have a balance of
zero. There was no grant function to call — `reserve_credits`/`refund_credits` only
cover generation spend.

Added `grant_credits()` and `adjust_credits()` (migration 35), both idempotent through
`credit_ledger`'s unique `(workspace_id, idempotency_key)` and both taking the same
per-workspace advisory lock `reserve_credits` uses, so a grant landing mid-generation
cannot interleave with a reservation's balance read. Both are revoked from `anon` and
`authenticated`: a browser must never be able to mint credits even if it learns the RPC
name.

Webhook coverage went from 3 events to 10:

| Event | Behaviour |
|---|---|
| `subscription.created` / `.activated` | activate, **grant the plan's credits** |
| `subscription.updated` | sync plan, status and Paddle's own `scheduled_change` |
| `subscription.resumed` | reactivate |
| `subscription.canceled` | mark canceled, stamp `provider_canceled_at` |
| `subscription.past_due` / `.paused` | reflect the state (`paused` added to the enum) |
| `transaction.completed` | **grant renewal credits**, extend the period |
| `transaction.payment_failed` | mark past-due, notify the owner |
| `adjustment.created` | refund/chargeback → **claw back credits** |

Two correctness details worth recording:

- **Idempotency is the insert, not a check.** The handler inserts the `payment_events`
  row and treats `23505` as "already processed". Checking-then-inserting leaves a window
  where two concurrent deliveries both pass the check and both grant credits.
- **Signature freshness.** A valid HMAC with an old timestamp is now rejected
  (±5 minutes). The idempotency index already made a replay a no-op, but idempotency is
  a second line of defence, not a reason to accept an arbitrarily old signature.

Added `billing_grant_reconciliation` — a view listing paid events with no matching
credit grant. It should always be empty; anything in it is a customer who paid and did
not receive what they bought.

---

## 5. Found during Phase 3, not in the original audit

### Team actions reported success while doing nothing (fixed)
RLS correctly restricts `workspace_members` to owner/admin. But an UPDATE or DELETE that
RLS filters out **matches zero rows and returns no error** — so a viewer clicking
"Remove member" or "Change role" saw a successful action while nothing happened. This is
the same silent-no-op class as Phase 1's cancellation bug, in four more places.

### An admin could take over a workspace (fixed)
`changeMemberRole` accepted `role="owner"` from any member RLS allowed to write —
i.e. any **admin**. An admin could promote themselves to owner and then remove the real
owner. Entirely inside the RLS boundary, so the database would never have stopped it.
Ownership transfer is now owner-only.

### A workspace could be left with no owner (fixed)
Nothing stopped demoting or removing the last owner. A workspace with no owner cannot be
billed, transferred or deleted. `assertNotLastOwner` now blocks both paths.

### `can()` denied managers everything (fixed)
`ROLE_PERMISSIONS` declared four roles while `public.workspace_role` has five, so
`can("manager", …)` fell through to an empty list. The module was also imported by
nothing — an unenforced description of intent sitting beside RLS policies that disagreed
with it. Now matches the enum, mirrors the policies, and gates the billing UI so the app
stops offering buttons the server will refuse.

### The API rate limit could be bypassed by failing (fixed)
`logApiRequest` ran **after** the handler, so any request whose handler threw was never
counted. A caller could exceed the limit indefinitely by sending requests that error.
Requests are now recorded before handling, with the status filled in afterwards, and
standard `x-ratelimit-*` headers are returned so clients can back off before a 429.

### API keys never expired (fixed)
`api_keys` had `revoked_at` only, so a key was valid forever unless revoked by hand —
the usual outcome being long-lived keys in old CI configs nobody can account for.
Migration 36 adds `expires_at`, `rotated_to` and `rotated_at`; expired keys are rejected
exactly as revoked ones are.

---

## 6. Known external-service limitations (YELLOW)

| Item | Blocked by |
|---|---|
| Live checkout → payment → activation | Paddle sandbox account + `PADDLE_API_KEY`, price ids |
| Webhook delivery end-to-end | Paddle sandbox + a public URL for Paddle to reach |
| Cancellation and resume against Paddle | same |
| Credit grant on real payment | same + live Postgres |
| Migrations 35–36 execution | live Postgres |
| Shopify / Meta integration OAuth | `SHOPIFY_CLIENT_ID`/`SECRET`, `META_APP_ID`/`SECRET` |

Signature verification, price resolution, environment selection, permission logic and
plan/credit rules are all unit-tested. What is unverified is the round trip to Paddle.
No RED item has been relabelled YELLOW.

---

## 7. Still RED — deferred

| ID | Issue | Phase |
|---|---|---|
| RED-12 | Health check reports `ok` because an env var is a non-empty string | 5 |

---

## 8. Phase 3 exit criteria

- [x] Typecheck, build clean
- [x] 100/100 unit tests
- [x] 40/40 smoke tests
- [x] 40/40 production audit checks
- [x] Checkout uses the Paddle Billing API
- [x] Cancellation reaches the payment provider before being recorded locally
- [x] Paying customers are granted credits, idempotently
- [x] Failed payments, refunds and chargebacks handled
- [x] Team permissions enforced in the app, not only silently by RLS
- [x] Developer platform rate limit cannot be bypassed; keys can expire

**Phase 3 is complete. Ready for Phase 4 (frontend and product excellence).**
