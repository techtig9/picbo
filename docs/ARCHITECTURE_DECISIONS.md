# Picbo.ai — Architecture Decisions

## Decision 001 — Production framework
Use Next.js App Router + TypeScript for the production application.

Reason:
- shared layouts/components
- server-side API routes
- strong deployment story
- suitable for SaaS dashboards
- easy Vercel deployment

## Decision 002 — Database
Use PostgreSQL through Supabase for the initial production stack.

Reason:
- relational data
- Row Level Security
- storage/auth integrations
- pgvector option
- easy operational footprint

## Decision 003 — AI
Use an internal provider abstraction.

Initial providers:
- Gemini for eligible text/reasoning tasks
- fal.ai for image/video model access where appropriate

Do not promise unlimited free generation.

## Decision 004 — Video
Use AI models for generative media and a deterministic rendering layer for:
- transitions
- text animation
- captions
- audio mixing
- fixed-duration compositions

This reduces AI cost and increases repeatability.

## Decision 005 — Jobs
Long-running generation is asynchronous.

Initial queue can be Inngest or Redis/BullMQ depending deployment needs. Do not make the browser responsible for the job itself.

## Decision 006 — Billing
Paddle is the billing system of record for subscriptions/top-ups. Webhook events are verified server-side.

## Decision 007 — Credits
Credits use an append-only ledger and idempotency keys.

## Decision 008 — Frontend migration
The existing HTML/CSS/JS prototype remains the visual reference until the Next.js application reaches feature parity. This prevents accidental loss of existing design work.

## Decision 009 — Product moat
The core differentiator is Product-to-Campaign:
one product should be able to produce a complete, brand-consistent campaign and later learn from performance.

## Decision 010 — Security
No provider secret, billing secret, database service key or storage secret is ever sent to the browser.
