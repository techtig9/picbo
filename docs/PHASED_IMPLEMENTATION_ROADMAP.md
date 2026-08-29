# Picbo.ai — Phased Implementation Roadmap

This roadmap is intentionally ordered so the product can grow without repeatedly rebuilding the same systems.

## Phase 0 — Audit and freeze the product contract
Current state: static HTML/CSS/JS prototype plus backend specification.

Actions:
- inventory every page, button, form and interaction
- classify each feature as keep / redesign / replace / remove
- preserve the current visual direction where it is useful
- remove claims that are not yet backed by a real provider
- define the production stack
- define API and database contracts

Exit criteria:
- no ambiguous ownership of data
- no provider secrets in frontend
- master product specification approved

## Phase 1 — Production foundation (this package)
Build:
- production architecture documents
- domain model
- migration map
- environment contract
- provider abstraction contract
- job/credit rules
- security baseline
- feature flags
- Next.js migration target
- Supabase/Postgres target
- storage/queue/billing/email/provider adapters

Do not delete the static prototype until the new app has parity.

## Phase 2 — Application shell
Build:
- Next.js App Router
- TypeScript
- design tokens
- responsive app shell
- authenticated workspace
- command bar
- notifications
- global search
- workspace/team context
- reusable UI components

## Phase 3 — Auth, workspace, database
Build:
- Supabase Auth or equivalent
- user/workspace/team membership
- roles/permissions
- onboarding
- RLS
- product tables
- project/campaign tables
- asset tables
- brand tables
- audit log

## Phase 4 — Asset and product foundation
Build:
- upload pipeline
- signed storage
- product library
- product URL import
- product identity
- fidelity controls
- asset library
- versions
- collections
- search/filter/tagging

## Phase 5 — AI Router and generation jobs
Build:
- provider adapter interface
- Gemini adapter
- fal.ai/media adapter
- text/image/video task classifier
- quota-aware routing
- cost estimator
- job queue
- retries
- idempotency
- progress events
- failure refunds

## Phase 6 — Image Studio
Build:
- product-to-image
- text-to-image
- reference image
- background removal
- background generation
- editing
- shadows
- relight
- recolor
- upscale
- batch
- shot list
- photoshoot

## Phase 7 — Ad Studio
Build:
- ad objectives
- hooks
- copy
- CTA
- static ad layouts
- platform presets
- variation engine
- brand kit enforcement
- creative scoring

## Phase 8 — Video and Shorts
Build:
- storyboard
- image-to-video
- product video
- 15-second ad builder
- timeline
- animations
- transitions
- captions
- voice
- music
- rendering
- Reels/TikTok/Shorts presets
- batch video jobs

## Phase 9 — UGC, avatars and remix
Build:
- UGC workflows
- authorized avatar workflows
- voice workflows
- consent records
- creative remix
- reference analysis

## Phase 10 — Campaigns and publishing
Build:
- complete campaign builder
- campaign assets
- publishing adapters
- scheduling
- platform exports
- campaign status
- approval workflow

## Phase 11 — Analytics and optimization
Build:
- ad account connectors
- metric ingestion
- creative performance
- A/B testing
- creative score based on performance
- AI recommendations
- winner/loser detection
- automatic variation suggestions

## Phase 12 — E-commerce and agency
Build:
- Shopify
- WooCommerce
- Amazon/Etsy where supported
- catalog sync
- agency workspaces
- client approvals
- white-label foundations

## Phase 13 — Developer platform
Build:
- API keys/scopes
- rate limits
- webhooks
- API docs
- usage dashboard
- job API
- generation API

## Phase 14 — Billing and growth
Build:
- Paddle production
- monthly/yearly plans
- credit top-ups
- invoices
- referrals
- affiliates
- coupons
- trials
- usage limits
- overage controls

## Phase 15 — Admin, observability and launch hardening
Build:
- admin console
- feature flags
- provider cost monitoring
- error monitoring
- audit logs
- moderation
- abuse prevention
- backups
- disaster recovery
- load tests
- security review
- privacy/legal review
- SEO/performance
- accessibility review

## Phase 16 — Autonomous creative agent
Build only after analytics data is reliable:
- AI Creative Director
- campaign planning
- creative recommendations
- automated testing suggestions
- performance-driven creative refresh
- optional AI media buyer with explicit user authorization

## Definition of done
A feature is not done when its button works. It is done when:
- UI exists
- API exists
- database state exists
- authorization exists
- loading/error/empty states exist
- retries exist where relevant
- analytics/logging exists
- credit behavior is correct
- provider cost is tracked
- mobile behavior is correct
- accessibility is acceptable
- tests cover critical paths
- documentation exists
