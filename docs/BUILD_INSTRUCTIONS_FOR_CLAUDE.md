# Instructions for Claude Code — turning this into a live product

This repo contains a **complete, production-quality frontend** (12 static
HTML/CSS/JS pages) and full backend specs. Nothing here calls a real
database, sends real email, or generates real AI content yet — every
"Generate" button, Paddle checkout, and admin action is a working UI mock.
Use this file as the task list to make it real.

## Recommended order of work

### 1. Scaffold the app
- Initialize a Next.js 14 (App Router) + TypeScript project.
- Port all 12 pages (`index`, `login`, `register`, `onboarding`,
  `dashboard`, `billing`, `referrals`, `team`, `admin`, `help`, `legal`,
  `404`) into `app/` routes. Keep the existing markup, class names, and
  `assets/css/style.css` / `assets/js/main.js` largely intact — the design
  system is deliberate.
- Split `main.js`'s DOM logic into React state/handlers page by page as
  you port each route.

### 2. Database, auth & Lumi's knowledge base
- Set up PostgreSQL with `pgvector` and run the DDL in
  `docs/DATABASE_SCHEMA.md`.
- Implement register/verify/login/Google OAuth per
  `docs/BACKEND_ARCHITECTURE.md` §3.
- On verified signup: grant 500 signup credits, send the registration
  notification email to `techtig9@gmail.com` (see §7 of that doc for the
  exact field list).
- Index the Help Center content into `help_articles` (with embeddings) so
  Lumi has something real to retrieve from before wiring up the chat
  widget itself.

### 3. Credit system
- Implement the ledger pattern from `docs/DATABASE_SCHEMA.md` — no mutable
  integer credit column.
- Replace the hardcoded numbers in `index.html`'s pricing section,
  `dashboard.html`'s sidebar, and `billing.html` with values fetched from
  `GET /api/pricing`, so frontend and backend never drift.
- Implement the 7-day Pro trial (grant 2,500 trial credits, auto-revert to
  Free at day 7 if no payment method is added — never auto-charge).

### 4. Generation pipeline
- Stand up the job queue (BullMQ/Redis or Inngest).
- Implement Photo generation first (fastest path to a demoable product),
  then Ad Creative, then Product Photoshoot.
- Build the Remotion/FFmpeg compositing pipeline for Animated Ad last —
  it depends on photo generation already working, and is the most
  operationally complex piece (rendering infra, not just an API call).
- Replace `dashboard.html`'s `#genBtn` mock with a real request → job ID →
  poll `/api/jobs/:id` → render into "Recent creations."

### 5. Lumi (AI assistant)
- Wire the chat widget (already built in every page's HTML/CSS/JS) to
  `POST /api/assistant/chat`.
- Implement retrieval against `help_articles`, plus the read-only
  account-lookup function-calling tools described in
  `docs/BACKEND_ARCHITECTURE.md` §5.
- Keep the canned-response rules currently in `main.js`'s `LUMI_RULES` as
  a offline/fallback behavior if the Gemini call fails — graceful
  degradation is better than a broken widget.

### 6. Billing (Paddle)
- Build Paddle Checkout integration behind `billing.html`'s plan cards and
  `index.html`'s payment modal (currently a UI-only mock).
- Build the webhook handler, invoice history, and overage billing for
  Business/Agency accounts.
- Wire dunning: a failed renewal shows a "payment past due" state with a
  3-day grace period before downgrade to Free.

### 7. Growth systems
- Referral tracking (`referrals.html` is already built — wire the referral
  code generation, click tracking, and the 300/300 credit reward).
- Affiliate application + admin approval + payout release (the admin
  panel's Affiliates tab already has the approval UI).
- Team invites (`team.html`'s invite form is built — wire it to a real
  invite-email flow and `team_members` row).
- Lifecycle emails (welcome, activation nudge, low-credit warning, win-back).

### 8. Admin panel
- Gate `/admin` behind `role IN ('admin','owner')` server-side.
- Replace every hardcoded row in `admin.html`'s tables (users,
  transactions, affiliate payouts, moderation queue, feature flags,
  coupons) with real queries.
- Seed Saad Ali's account with `role='owner'` directly in the database.

### 9. Security & SEO pass
- Work through `docs/SECURITY.md` and `docs/SEO.md` before launch —
  especially: Paddle webhook signature verification, server-side role
  checks on every team/admin route, and Lumi's read-only tool boundary.

### 10. Polish
- Swap every `picsum.photos` placeholder (hero thumbnails, category cards,
  testimonial/team avatars, the founder photo) for real assets.
- Re-test the full flow end to end: register → verify → onboard →
  generate a photo → generate a photoshoot → hit a credit limit →
  subscribe via Paddle → generate an animated ad → invite a teammate →
  share a referral link → ask Lumi a question at each step.

## What NOT to change
- The design tokens in `:root` (`assets/css/style.css`) — palette,
  typography, spacing, and animation timing are deliberate. Extend the
  system, don't replace it.
- The credit cost table and plan pricing, unless the business decides to
  change them — and if so, update `docs/BACKEND_ARCHITECTURE.md` §4 and
  the `credit_costs`/`plans` tables together, never just the frontend.
- Lumi's read-only tool boundary (see Security doc) — this is a safety
  property, not an implementation detail to relax for convenience.
