# Picbo.ai — Existing Project Migration Map

## Current project assessment

The uploaded project is a polished static prototype, not a production backend. It has:
- 19+ HTML pages
- a substantial shared CSS design system
- a shared JavaScript interaction layer
- detailed PostgreSQL/backend/security specifications
- mocked generation, billing, auth, referrals and admin actions

This is valuable work and should be preserved as the visual/reference baseline.

## Keep

### Visual system
- logo treatment
- dark/light theme concept
- typography hierarchy
- glass/panel treatment
- cyan/violet/teal accent direction
- responsive layout patterns
- accessibility primitives
- loading states
- toast style
- mobile navigation

### Product concepts
- Lumi/AI assistant concept
- credit ledger concept
- workspace/team concept
- Brand Kit
- Explore/inspiration
- library/collections
- referrals
- developer/API page
- admin area
- Paddle billing concept

### Existing documentation
- security checklist
- database concepts
- SEO checklist
- backend service boundaries

## Redesign

### Dashboard
Current: four generation modes.

Target:
- unified command bar
- product-first creation
- campaign creation
- recent products/projects
- active jobs
- AI recommendations
- usage/cost visibility

### Navigation
Current navigation mixes creation, history and account.

Target:
- Create
- Products
- Projects
- Campaigns
- Assets
- Templates
- Inspiration
- Analytics
- Integrations
- Team
- Billing
- Settings

### Generation
Current: mocked delays/toasts.

Target:
- real job creation
- progress
- cancellation
- retry
- credit reservation/refund
- result asset
- versioning

### Lumi
Current: canned browser rules.

Target:
- server-side AI assistant
- RAG for help/docs
- read-only account tools
- no direct billing/credit mutation
- conversation history
- moderation

## Replace

### Tailwind Play CDN for production
Use a build-time CSS strategy in the production Next.js app. The current static fallback is useful during migration but should not remain the primary production architecture.

### Static HTML routing
Migrate to Next.js App Router with shared layouts/components.

### Client-side fake billing
Replace with Paddle server-side integration and signed webhooks.

### Client-side fake auth
Replace with real authentication and server authorization.

### Direct Gemini-only architecture
Replace with the internal AI Router and provider adapters.

### Synchronous generation
Replace with queue-backed jobs.

## Add

- Product Identity
- Product Fidelity
- AI Shot Lists
- Image Studio
- Ad Studio
- Video timeline
- Shorts/Reels/TikTok Studio
- UGC Studio
- Avatar Studio
- Campaign Builder
- Creative Score
- Analytics
- Optimization
- Publishing
- E-commerce integrations
- Competitor/inspiration intelligence
- API/webhooks
- agency mode
- provider cost monitoring
- observability
- consent/moderation
- idempotency and refunds

## Naming recommendation

Keep **Picbo.ai** as the product brand unless a trademark/domain review says otherwise.

Use:
- Picbo Creative Director = assistant
- Picbo Studio = editor
- Picbo Campaigns = campaign system
- Picbo Insights = analytics
- Picbo API = developer platform

Avoid creating too many disconnected product names.

## Critical migration rule

Do not rewrite the existing static pages one-for-one into React components.

Extract reusable patterns first:
- AppShell
- Sidebar
- Topbar
- CommandBar
- GenerationModal
- JobPanel
- ProductPicker
- AssetPicker
- CreditEstimator
- BrandKitPicker
- ExportDialog
- Toast
- EmptyState
- ErrorState
- ConfirmDialog

Then build pages from those primitives.
