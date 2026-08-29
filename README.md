# Picbo.ai — Production Transformation Program

> **Phase 1 foundation added.** The existing static prototype is preserved as the visual baseline. The production target is a complete AI Product-to-Advertising platform, not only a photo generator.

## What changed in this phase

- Added a complete master product specification.
- Added a phased implementation roadmap designed to prevent missing dependencies.
- Audited the existing prototype and documented what to keep, redesign, replace and add.
- Added an AI provider abstraction contract.
- Added architecture decisions.
- Added a production environment-variable contract.
- Added a backend-foundation directory without falsely claiming that the production backend already exists.

## Important

The existing browser prototype still contains mocked authentication, billing and generation behavior. Those are intentionally not presented as production-ready. They will be replaced phase-by-phase.

## Phase order

1. Foundation and architecture
2. Next.js application shell
3. Auth/workspaces/database
4. Products/assets
5. AI Router/jobs
6. Image Studio/photoshoots
7. Ad Studio
8. Video/Shorts
9. UGC/avatars/remix
10. Campaigns/publishing
11. Analytics/optimization
12. E-commerce/agency
13. Developer platform
14. Billing/growth
15. Admin/security/launch hardening
16. Autonomous creative agent

See `docs/PHASED_IMPLEMENTATION_ROADMAP.md`.

---

# Picbo.ai — Frontend Prototype + Production Backend Spec

A complete, handcrafted frontend for Picbo.ai — a Dark Cyber / Tech design
system (Space Grotesk at bold weights + Instrument Serif accent + Instrument
Sans + JetBrains Mono, a true-black surface scale, an electric
cyan-blue-magenta circuit palette with a matrix-green standalone accent, a
circuit-grid + scanline backdrop, neon glow on interactive states, and HUD
corner-bracket accents) — photos, ad creatives, product photoshoots, and
15-second animated ads, generated through Gemini, billed through Paddle,
with a built-in AI assistant (Lumi), a community Explore gallery, and a
Developer/API page — plus the exact backend architecture, database schema,
security checklist, and SEO plan needed to make it real.

**Tailwind CSS:** loaded via the Tailwind Play CDN (`cdn.tailwindcss.com`)
with `preflight` disabled and a theme extension mapping Tailwind's utility
classes onto this site's actual design tokens (`font-display`, `font-accent`,
`text-violet`, etc.), so utility classes and the custom component CSS
(`.glass`, `.btn-primary`, and so on) share one source of truth instead of
fighting each other. ~150 ad-hoc inline `style="..."` attributes were
converted to consistent Tailwind utilities, snapped to Tailwind's spacing
scale, across all 19 pages — this is also what caught and fixed a real
inconsistency where several section sub-headings were using the wrong font
variable (`font-display` instead of the intended `font-accent` serif-italic
treatment used everywhere else).

Because the Play CDN is explicitly documented by Tailwind as unsuitable for
production reliability (a blocked/slow/offline CDN just breaks styling),
`assets/css/style.css` also ships a same-origin fallback layer that defines
matching CSS for every Tailwind utility class actually used on the site —
so layout and typography are correct whether or not the CDN loads. The
`tailwind.config` assignment itself is also guarded (`if (window.tailwind)`)
so a blocked CDN never throws a JS error.

**Accessibility & usability:** every text/background pairing in the
palette is verified against WCAG AA contrast (4.5:1 for body text, 3:1
for large text) — including catching and fixing a real bug where white
button text sat on a too-bright cyan fill at 1.54:1 contrast. All 19
pages have a skip-to-content link, password fields have a show/hide
toggle, and the dashboard's four generation modes show a plain-language
description (and credit cost) before you pick one.

## What's real vs. mocked

**Real, working in the browser right now:**
- Every page's layout, animation, and responsive behavior (dot-grid
  texture, blurred gradient blobs, glass panels, kinetic word-reveal
  headline, scroll reveals, card tilt, spring-eased hovers, page-load
  screen, and fade transitions between pages)
- Dark/light theme toggle, mobile nav, FAQ accordion, Monthly/Yearly
  pricing toggle, category tabs
- **Lumi**, the AI assistant widget — open the bubble on any page and ask
  it about credits, pricing, animated ads, or photoshoots; it replies from
  a small built-in rule set (a real backend swaps this for Gemini + RAG)
- The Paddle-style checkout modal (method switch removed — this is a card
  checkout mock now, not the old JazzCash manual-payment flow)
- Onboarding multi-step flow, referral link copy, team invite form, credit
  top-up buttons — all with realistic UI feedback (toasts, state changes)
- Full client-side interaction layer in `assets/js/main.js`

**Mocked — needs the real backend described in `/docs`:**
- Account creation, email verification, Google login (no real database yet)
- The registration notification email to `techtig9@gmail.com`
- Photo / Ad Creative / Product Photoshoot / Animated Ad generation (the
  dashboard's Generate button simulates a delay, then shows a toast)
- Lumi's real Gemini-backed responses and account-aware answers (currently
  a small canned rule set in `main.js`)
- Paddle checkout, subscriptions, credit top-ups, and invoices
- Affiliate payouts, referral credit rewards, team member management
- Admin analytics, moderation queue, feature flags, and coupons

## File structure

```
picbo/
├── index.html         Landing — announcement bar, nav, hero, trusted-by,
│                       features, how-it-works, gallery (Photos/Ad
│                       Creatives/Photoshoots/Animated Ads), pricing
│                       (Free/Starter/Pro/Business + Agency banner,
│                       Monthly/Yearly toggle), testimonials, FAQ,
│                       founder, about/contact, footer, Paddle checkout
│                       modal
├── login.html            Login
├── forgot-password.html  Password reset request + confirmation
├── register.html         Register + mock email verification step
├── onboarding.html        5-step onboarding
├── dashboard.html          Generation studio — 4 modes (Photo, Ad
│                          Creative, Product Photoshoot, Animated Ad),
│                          credit balance, recent creations
├── billing.html            Plan management, usage bar, credit top-ups,
│                          overage toggle, invoice history
├── referrals.html          Referral link, stats, referral history,
│                          affiliate program application
├── team.html                Team members, roles, invite form, activity log
├── library.html              Unified Creations / Prompt History / Saved
│                          Prompts / Collections, tab + hash routing
├── notifications.html         Notification feed, mark-all-read
├── settings.html               Profile, password, 2FA toggle, notification
│                          preferences, download-my-data, delete account
├── admin.html                Admin — MRR/churn/LTV, credit-usage-by-action
│                          margin tracker, Paddle transaction log,
│                          affiliate payout approvals, moderation queue,
│                          feature flags, coupons, users
├── help.html                 Help Center — search, topic cards, Ask-Lumi
│                          banner, FAQ
├── developer.html               API keys, code snippets (cURL/Node/Python),
│                          webhook endpoints — Business/Agency feature
├── explore.html                 Community gallery of photos, ad creatives,
│                          and animated ads, filterable by type
├── changelog.html               Public "what's new" log
├── legal.html                 Terms, Privacy, Refund, and Cookie policy
│                          (single page, anchor navigation)
├── 404.html                    Branded error page
├── robots.txt                   Real, deployable (previously only documented)
├── sitemap.xml                  Real, deployable (previously only documented)
├── assets/
│   ├── css/style.css           Full design system + Lumi widget +
│   │                          billing/referral/team/legal page styles
│   └── js/main.js              All interactivity — Lumi chat logic,
│                              billing toggle, checkout modal, top-ups,
│                              referral copy, team invite, dashboard demo
└── docs/
    ├── BACKEND_ARCHITECTURE.md     Services, API surface, credit ledger,
    │                              Lumi's retrieval layer, Paddle vs.
    │                              manual-affiliate money flows
    ├── DATABASE_SCHEMA.md          Full PostgreSQL DDL — teams, referrals,
    │                              affiliates, Lumi tables, feature flags
    ├── SECURITY.md                  Auth, authorization, Paddle webhooks,
    │                              Lumi's read-only tool boundary
    ├── SEO.md                       robots.txt / sitemap / structured
    │                              data / performance checklist
    └── BUILD_INSTRUCTIONS_FOR_CLAUDE.md   Ordered task list to turn this
                                            into a live product
```

## Running it locally

No build step. Either open `index.html` directly, or serve the folder:

```bash
cd picbo
python3 -m http.server 8080
# visit http://localhost:8080
```

## Brand details already wired in

- **Billing:** Paddle (Merchant of Record) — Free / Starter $14 / Pro $29
  (most popular) / Business $59 / Agency $199, all with a Monthly/Yearly
  toggle (~17% off yearly) and a 7-day no-card Pro trial
- **Credits:** 40 (simple photo) / 80 (complex photo) / 120–300 (ad
  creative) / 350 (photoshoot set) / 500 (animated ad, 15 sec) — Lumi and
  exports are free
- **AI:** Google Gemini — the sole AI provider, for generation, ad
  copywriting, and Lumi
- **Founder:** Saad Ali, shown in the Founder section (placeholder photo —
  swap before launch)
- **Contact:** Techtig9@gmail.com, +92 348 8597892, @techtig9 (Instagram),
  Techtig (Facebook)
- **Freelance:** Fiverr, Upwork, Freelancer — all linked as `@techtig`

## Next step

Read `docs/BUILD_INSTRUCTIONS_FOR_CLAUDE.md` — it's an ordered task list
for wiring the real backend (auth, database, credit ledger, Gemini
generation, Lumi, Paddle billing, teams, referrals, admin panel) behind
this frontend.
