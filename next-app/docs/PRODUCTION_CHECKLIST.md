# Picbo Production Launch Checklist

## Security
- [ ] Enable and verify Supabase RLS for every user/workspace-owned table.
- [ ] Never expose provider API keys to the browser.
- [ ] Rotate all development secrets before launch.
- [ ] Configure strict production CORS/origin rules.
- [ ] Validate every API request with schemas.
- [ ] Apply rate limits to AI, upload, render and authentication endpoints.
- [ ] Add abuse/content moderation policies for user-generated media.

## AI & Credits
- [ ] Configure real provider adapters and production API keys.
- [ ] Verify free-provider quotas and fallback rules.
- [ ] Verify paid-provider spending caps.
- [ ] Record every billable AI operation.
- [ ] Test insufficient-credit and provider-failure paths.

## Rendering
- [ ] Run render workers separately from web requests.
- [ ] Enable retry/backoff and dead-letter handling.
- [ ] Clean temporary render files.
- [ ] Enforce maximum upload size, duration and resolution.
- [ ] Verify all social export presets.

## Storage
- [ ] Use private buckets for source assets.
- [ ] Use signed URLs for protected downloads.
- [ ] Configure lifecycle/cleanup rules.
- [ ] Verify image/video MIME types instead of trusting file extensions.

## Reliability
- [ ] Configure health and readiness checks.
- [ ] Monitor queue depth, render duration, failures and provider errors.
- [ ] Configure error tracking and alerting.
- [ ] Test database backup/restore.

## Billing
- [ ] Configure production billing provider/webhooks.
- [ ] Verify webhook signatures and idempotency.
- [ ] Test subscription upgrades, downgrades and cancellations.
- [ ] Test refunds and failed payments.

## Launch
- [ ] Run production build.
- [ ] Run unit/integration/e2e tests.
- [ ] Test mobile and desktop UI.
- [ ] Test onboarding → product upload → generation → editing → export.
- [ ] Test sharing and team permissions.
- [ ] Test every major AI fallback path.
- [ ] Test deletion/export of user data.
- [ ] Verify legal pages, privacy policy and terms.
