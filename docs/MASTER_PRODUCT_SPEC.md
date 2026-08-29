# Picbo.ai — Master Product Specification

## Product position

Picbo.ai is an AI Product-to-Advertising platform:

**Product → Product Identity → Photoshoot → Images → Ads → Video → Shorts/UGC → Campaign → Publish → Analytics → Optimize**

The goal is not to be a generic image generator. The product should own the workflow of turning a product into high-performing marketing creatives.

## Product principles

1. Every important UI action must have a real backend capability or an explicit, clearly labeled beta state.
2. AI providers are abstracted behind an internal AI Router so providers/models can be changed without changing the product.
3. Expensive operations are asynchronous jobs.
4. Credits are ledger-based and idempotent.
5. Product identity/fidelity is a first-class system.
6. Brand Kit is applied automatically where the user permits it.
7. Generated assets remain editable and reusable.
8. Campaigns connect creation, publishing and analytics.
9. Security and authorization are enforced server-side, never only in the UI.
10. Failed AI jobs must be recoverable and refundable.
11. The frontend must never contain provider secrets.
12. Free-tier AI usage is subject to provider terms/quotas; the router must never be designed to bypass limits.

---

# 1. Application areas

## Public
- Home
- Features
- Gallery / inspiration
- Pricing
- About
- Contact
- Help Center
- Changelog
- Legal
- Login
- Register
- Password recovery

## Workspace
- Dashboard
- AI Creative Director
- Products
- Product detail
- Projects
- Campaigns
- Creative Studio
- Photoshoot Studio
- Image Studio
- Ad Studio
- Video Studio
- Shorts / Reels / TikTok Studio
- UGC Studio
- Avatar Studio
- Templates
- Inspiration
- Asset Library
- Brand Kit
- Analytics
- Integrations
- Publishing
- Notifications
- Team
- Billing
- Referrals
- Developer/API
- Settings

## Admin
- Users
- Workspaces
- Subscriptions
- Credits
- AI provider costs
- Jobs
- Errors
- Moderation
- Feature flags
- Coupons
- Analytics
- Support/audit logs

---

# 2. Product system

A product stores:
- name
- SKU
- description
- URL
- price
- category
- features
- benefits
- source images
- source videos
- logo/packaging details
- colors
- dimensions when available
- AI Product Identity
- fidelity settings

Product URL import should extract public product information and create a reviewable draft before saving.

## Product Identity
Create a structured representation of:
- silhouette
- logo
- typography
- packaging
- dominant colors
- materials
- proportions
- distinctive details

Every image/video generation may reference Product Identity.

## Fidelity controls
- preserve logo
- preserve packaging
- preserve text
- preserve shape
- preserve color
- preserve proportions
- reference strength

---

# 3. AI Photoshoot

Inputs:
- product
- reference images
- shot count
- aspect ratio
- style
- location
- lighting
- camera
- lens/look
- composition
- season
- audience

Presets:
- studio
- luxury
- editorial
- lifestyle
- UGC
- outdoor
- seasonal
- minimal
- cinematic
- e-commerce

AI Shot List generates a set such as:
- hero
- close-up
- side
- top-down
- detail
- lifestyle
- scale
- packaging
- social
- banner

Batch generation must be supported through jobs.

---

# 4. Image Studio

Capabilities:
- text-to-image
- product-to-image
- reference-to-image
- background removal
- background replacement
- object removal
- object replacement
- inpainting
- outpainting
- relighting
- recoloring
- shadow generation
- reflection control
- enhancement
- upscaling
- crop
- resize
- smart expansion

Every edit should preserve the original asset and create a version.

---

# 5. Ad Studio

Objectives:
- sales
- awareness
- engagement
- traffic
- lead generation
- launch
- discount
- seasonal promotion

Generate:
- hook
- headline
- primary text
- CTA
- static creative
- multiple variations

Platforms:
- Instagram
- Facebook
- TikTok
- YouTube
- Google
- Amazon
- Shopify/store banners
- generic web banners

---

# 6. Video Studio

Inputs:
- product
- images
- script
- creative brief
- reference creative
- duration
- platform
- voice
- music

Capabilities:
- image-to-video
- product-to-video
- photos-to-video
- script-to-video
- ad-to-video
- storyboard
- scene generation
- voiceover
- captions
- music
- sound effects
- transitions
- animations
- camera motion

15-second ad preset:
- 0–3s hook
- 3–6s product
- 6–10s benefit/proof
- 10–13s hero shot
- 13–15s CTA

The timeline must remain editable.

---

# 7. Shorts / Reels / TikTok

Generate:
- Instagram Reels
- TikTok
- YouTube Shorts
- Facebook Reels

Presets:
- 9:16
- hook-first
- caption-first
- UGC
- product demo
- testimonial
- offer
- before/after

---

# 8. UGC and Avatar Studio

UGC:
- testimonial-style
- review-style
- unboxing concept
- talking-head
- product demo
- influencer-style

Avatar:
- built-in authorized avatars
- user-owned/custom avatars
- voice selection
- language
- lip sync
- script
- background

Require consent/authorization workflows for user-provided likeness and voice.

---

# 9. Creative Remix

Input:
- user-owned/licensed reference creative

Analyze:
- hook
- pacing
- scene structure
- CTA
- text hierarchy
- visual style

Create an original creative using the user's product. Do not copy protected assets.

---

# 10. Campaign Builder

One-click:
**Create Complete Campaign**

Pipeline:
1. understand product
2. build product identity
3. apply brand
4. generate shot list
5. create photos
6. create static ads
7. create hooks/copy
8. create videos
9. create Shorts/Reels
10. score creatives
11. generate variations
12. package campaign
13. optionally publish
14. collect performance
15. recommend optimization

---

# 11. Brand Kit

Store:
- logos
- colors
- fonts
- typography
- tone
- CTA style
- image style
- preferred layouts
- safe-area rules

Brand rules are applied to generation and exports.

---

# 12. Creative scoring and optimization

AI Creative Score:
- hook
- product visibility
- readability
- CTA
- hierarchy
- brand consistency
- platform fit
- clarity

Optimization loop:
**Create → Publish → Measure → Identify winners → Generate variations → Test → Learn**

---

# 13. Competitor/inspiration intelligence

User-visible features:
- inspiration library
- reference creative analysis
- competitor creative tracking where data sources/licensing permit
- trend summaries
- hook patterns
- creative patterns

Do not scrape sources in ways that violate their terms.

---

# 14. Publishing and analytics

Publishing integrations should be added behind provider adapters.

Analytics:
- impressions
- reach
- clicks
- CTR
- CPC
- CPM
- conversions
- CPA
- ROAS
- spend
- revenue
- engagement

AI should summarize performance and recommend the next creative tests.

---

# 15. E-commerce

Integrations:
- Shopify
- WooCommerce
- Amazon
- Etsy
- generic product URL/catalog import

Catalog:
- products
- SKU
- images
- descriptions
- prices
- categories
- campaigns

---

# 16. Team and agency

Workspace hierarchy:
**User → Workspace → Projects → Products/Campaigns**

Roles:
- owner
- admin
- manager
- editor
- viewer

Agency:
- multiple clients/workspaces
- client branding
- approvals
- shared assets
- client analytics

---

# 17. Developer platform

- API keys
- scopes
- usage
- rate limits
- webhooks
- API docs
- job polling
- SDKs later

Core API concepts:
- products
- assets
- generations
- jobs
- campaigns
- exports
- webhooks

---

# 18. Billing and credits

Plans are data-driven, not hardcoded.

Credit ledger:
- signup bonus
- subscription credits
- top-up
- referral
- generation charge
- refund
- admin adjustment
- overage

Rules:
- reserve/authorize before expensive work
- idempotency key for every charge
- refund failed jobs
- never allow negative balance unless an explicit overage policy permits it

---

# 19. AI Router

The application must not hard-code Gemini or fal.ai directly into UI code.

Internal interface:
- task type
- model
- provider
- cost estimate
- latency
- quality
- availability
- quota state

Example routing:
- simple text → eligible free/low-cost model
- complex reasoning → stronger text model
- image generation/editing → image provider
- video generation → video provider
- deterministic animation/transitions → internal renderer

The router may fall back only to legitimately configured providers/models. It must not rotate keys or accounts to evade quotas.

---

# 20. Job architecture

All long-running operations are jobs:
- photoshoot
- batch generation
- video generation
- rendering
- exports
- catalog imports
- publishing
- analytics sync

States:
`queued → running → validating → completed`
or
`queued → running → failed → retrying`
with cancellation support.

---

# 21. Storage

Separate:
- original uploads
- generated assets
- thumbnails
- rendered video
- temporary files

Use signed URLs and lifecycle cleanup for temporary assets.

---

# 22. Security

- server-side authorization
- RLS where applicable
- encrypted secrets
- secure sessions
- rate limits
- signed storage URLs
- MIME/type validation
- file size limits
- webhook signature verification
- audit logs
- abuse controls
- consent records
- moderation
- privacy controls

---

# 23. Reliability

Every provider call needs:
- timeout
- retry policy
- idempotency
- structured error
- fallback policy
- cost logging
- provider/model logging

Every job needs:
- job ID
- progress
- timestamps
- error code
- retry count
- provider/model
- credit reservation
- result asset IDs

---

# 24. Frontend quality bar

The UI should be:
- responsive
- keyboard accessible
- WCAG-conscious
- fast
- autosaving
- undo/redo where editing exists
- optimistic only when safe
- clear loading/progress states
- clear error/retry states
- no fake buttons
- no hidden destructive actions
- consistent empty states
- consistent confirmation dialogs

---

# 25. V1 feature completeness target

V1 should expose the complete product surface:
- product management
- photoshoot
- image generation/editing
- static ads
- 15-second video ads
- Shorts/Reels/TikTok
- UGC
- avatars
- brand kit
- templates
- batch
- campaign builder
- creative score
- analytics
- publishing integrations
- billing/credits
- teams
- API
- admin
- security
- AI routing

Advanced integrations can ship as provider-backed beta modules without changing the navigation or data model.

---

# 26. Engineering rule

Do not create a separate implementation for every button.

Use shared primitives:
- modal
- drawer
- command bar
- asset picker
- product picker
- generation job panel
- progress indicator
- toast
- confirmation
- editor toolbar
- credit estimator
- provider/model status
- export dialog

This keeps the application maintainable as the feature set grows.
