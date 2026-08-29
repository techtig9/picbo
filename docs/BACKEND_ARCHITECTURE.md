# Picbo.ai — Backend Architecture

This describes the real backend that should sit behind the frontend in this
package. The frontend (12 pages, fully interactive) is built; nothing below
exists yet — it's the spec to build against. This supersedes any earlier
version of this document that referenced a token system or manual
JazzCash/EasyPaisa/NayaPay payments — Picbo.ai now runs on a credit system
billed through Paddle.

## 1. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Port the existing static pages into Next.js routes/components |
| Database | PostgreSQL (Supabase, Neon, or RDS) with `pgvector` | Relational integrity for credits/subscriptions/teams; `pgvector` powers Lumi's retrieval |
| ORM | Prisma | Type-safe schema matches DATABASE_SCHEMA.md directly |
| Auth | Email/password + Google OAuth + email verification | Custom, or NextAuth/Lucia |
| File storage | Cloudflare R2 or AWS S3 | Generated photos/ad creatives/photoshoot sets/animated ad MP4s, uploaded product references |
| Queue | Redis + BullMQ (or Inngest) | Photoshoot sets and animated-ad rendering are multi-step and must never block a request |
| Email | Resend or SendGrid | Verification, lifecycle emails, dunning notices |
| AI | **Google Gemini API — the only AI provider** | Text/voice input, prompt-engineering follow-ups, image generation, ad copywriting, and Lumi (the assistant) all run on Gemini |
| Video-ad assembly | Remotion (React-based) or FFmpeg | Deterministic, non-AI compositing of Gemini-generated stills into the fixed 15-second animated ad |
| Payments | Paddle (Billing) | Merchant of Record — handles global tax/VAT; used for subscriptions and credit top-ups |
| Hosting | Vercel (frontend + API routes) or Docker Compose on a VPS | |

## 2. Service boundaries

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│  Frontend    │ ───► │  API (Next.js)     │ ───► │  PostgreSQL     │
│  (this repo) │      │                    │      │  (+ pgvector)   │
│              │ ◄─── │                    │ ◄─── │                │
└─────────────┘      └────────┬─────────┘      └────────────────┘
                               │
                 ┌─────────────┼─────────────┬───────────────┐
                 ▼             ▼             ▼               ▼
          ┌───────────┐ ┌────────────┐ ┌───────────┐ ┌──────────────┐
          │  Redis /   │ │  S3 / R2    │ │  Resend /  │ │  Paddle       │
          │  job queue │ │  file store │ │  email     │ │  (billing)    │
          └─────┬─────┘ └────────────┘ └───────────┘ └──────────────┘
                │
                ▼
      ┌──────────────────────────┐
      │  Generation workers        │
      │  → Gemini (photos, ad copy)│
      │  → Remotion/FFmpeg          │
      │    (animated ad assembly)   │
      └──────────────────────────┘
```

Generation is always **async**. The API enqueues a job and returns a job ID
immediately; the frontend polls `GET /api/jobs/:id` and renders the result
when `status = "completed"`. This is why the dashboard's Generate button
shows an "in progress" shimmer state — that's the real UX, not filler.

## 3. Core API surface

```
POST   /api/auth/register              → create user, send verification email
POST   /api/auth/verify                → confirm code, activate account, grant 500 signup credits
POST   /api/auth/login                 → session/JWT
POST   /api/auth/google                → OAuth callback
POST   /api/auth/logout
POST   /api/auth/enable-2fa / verify-2fa

GET    /api/me                         → profile + credit balance + plan
PATCH  /api/me                         → update profile
GET    /api/me/creations               → paginated history

POST   /api/generate/photo             → { prompt, style, aspectRatio, refImageUrl? } → jobId
POST   /api/generate/ad-creative       → { prompt, formats[], brandKitId? } → jobId
POST   /api/generate/photoshoot        → { refImageUrl, angleCount } → jobId
POST   /api/generate/animated-ad       → { imageIds[], transitionStyle, captions?, musicTrack? } → jobId
GET    /api/jobs/:id                   → { status, progress, resultUrl?, creditsCharged }

POST   /api/assistant/chat             → Lumi — { message, threadId? } → { reply, sources[] }

GET    /api/pricing                    → plan + credit-cost source of truth (never hardcode in frontend)
POST   /api/billing/checkout           → Paddle Checkout session (subscription or top-up)
POST   /api/billing/webhook            → Paddle webhook handler
GET    /api/billing/invoices           → invoice history
POST   /api/billing/topup              → credit top-up purchase

POST   /api/teams/invite               → invite a member
PATCH  /api/teams/members/:id          → change role
DELETE /api/teams/members/:id          → remove member

GET    /api/referrals/code             → the user's referral link
GET    /api/referrals/history
POST   /api/affiliates/apply

POST   /api/dev/api-keys               → create/revoke (Business/Agency only)
POST   /api/dev/webhooks               → register/list

# Admin only (role = 'owner' | 'admin')
GET    /api/admin/users
GET    /api/admin/subscriptions
GET    /api/admin/payments             → read-only Paddle transaction log
GET    /api/admin/affiliates/payouts
POST   /api/admin/affiliates/payouts/:id/release
GET    /api/admin/moderation-queue
POST   /api/admin/feature-flags
POST   /api/admin/coupons
GET    /api/admin/analytics            → MRR, churn, LTV, credit-usage-by-action
```

## 4. Credit accounting — a ledger, not a raw counter

Never mutate `users.creditsBalance` directly from generation code. Every
change is a row in `credit_transactions`; the balance is either a
materialized column updated in the same DB transaction as the ledger
insert, or computed with `SUM(amount)`. This gives you an audit trail,
idempotent retries, and a clean way to answer "why did my balance change"
support questions (which Lumi can also answer directly via the same table).

Credit costs live in a `credit_costs` config table, not hardcoded, so
pricing can change without a redeploy:

| key | credits |
|---|---|
| `photo.simple` | 40 |
| `photo.complex` | 80 |
| `ad_creative.single` | 120 |
| `ad_creative.bundle` | 300 |
| `photoshoot.set` | 350 |
| `animated_ad.15s` | 500 |
| `edit.retouch` | 60 |
| `copywriting.only` | 15 |
| `voice_prompt` | 20 |
| `lumi.chat` | 0 (unmetered) |

## 5. Lumi — the AI assistant

Lumi is Gemini with a different system prompt and tool access than the
generation endpoints, plus a retrieval layer:

1. **Index** the Help Center content and FAQ into `pgvector` at build/deploy
   time (or on content change).
2. On each message, embed the user's question, retrieve the top-k relevant
   chunks, and include them in the Gemini context so answers stay grounded.
3. Give Lumi **read-only** function-calling access to the user's plan,
   credit balance, and recent job history (`GET /api/me`,
   `GET /api/me/creations`) — never write access to billing or credits.
4. Route any account-changing intent ("cancel my plan") to a real UI
   action/link rather than letting Lumi perform it directly.
5. Log every conversation to `assistant_chats` for admin quality/abuse
   review, and run the same content-moderation pass on Lumi's inputs and
   outputs that generation prompts get.

## 6. Manual vs. automatic money flows

**Automatic (Paddle):** all subscription billing and credit top-ups.
Paddle is Merchant of Record, so tax/VAT is handled for you. Webhooks sync
`subscriptions` and log every transaction to `payments` — this is a
read-only view for admins (see the Admin Panel's Payments tab), not a
manual-approval queue.

**Manual (admin-reviewed):** affiliate payouts. Paddle does not run your
affiliate program — that's tracked in `affiliates`/`affiliate_payouts` and
paid out separately (bank transfer, PayPal, or Wise), approved from the
Admin Panel's Referrals & Affiliates tab.

## 7. Registration notification email

On every successful, verified registration, send an email to
`techtig9@gmail.com` containing: name, email, registration timestamp
(ISO 8601 + human readable), country, plan (`free` at signup), and IP
address (from a trusted proxy header — see SECURITY.md). Enqueue this as a
background job so a slow email provider never blocks the registration
response.

## 8. Generation worker responsibilities

1. Pull job from queue.
2. Re-check the user's credit balance (it may have changed since the
   request was queued).
3. Charge credits only after a successful Gemini response (or hold a
   pending debit and reconcile — pick one pattern and document it).
4. For photos/ad creatives/photoshoots: call Gemini, store the result in
   object storage, write a `creations` row.
5. For animated ads: call Gemini for each still image in the sequence,
   then hand the set to the Remotion/FFmpeg pipeline with the chosen
   transition style, captions, and music track; render to a fixed
   15-second, 1080p MP4; store and record the result the same way.
6. Update job status; the frontend's poll (or a websocket/SSE push) picks
   up the `completed` state.

## 9. Environment configuration

```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
GOOGLE_OAUTH_CLIENT_ID= / GOOGLE_OAUTH_CLIENT_SECRET=
GEMINI_API_KEY=
RESEND_API_KEY= (or SENDGRID_API_KEY)
ADMIN_NOTIFICATION_EMAIL=techtig9@gmail.com
S3_BUCKET= / R2_BUCKET=
S3_ACCESS_KEY= / S3_SECRET_KEY=
PADDLE_API_KEY= / PADDLE_WEBHOOK_SECRET=
APP_BASE_URL=https://picbo.ai
```
