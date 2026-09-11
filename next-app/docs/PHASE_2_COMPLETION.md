# Phase 2 completion — AI, generation, assets and jobs

Date: 2026-09-11
Branch: `claude/picbo-audit-plan-uxl86j`
Scope: Phase 2 of 5, per `Picbo_Master_Audit_and_Claude_Code_Command.md` §7.

Status legend: **GREEN** = verified working · **YELLOW** = blocked only by a missing
external credential/service · **RED** = broken.

---

## 1. Evidence

| Check | Command | Result |
|---|---|---|
| Typecheck (strict) | `npx tsc --noEmit` | **PASS** — 0 errors |
| Production build | `npx next build` | **PASS** |
| Unit tests | `node --import tsx --test tests/*.test.ts` | **PASS 76/76** (was 41) |
| HTTP smoke tests | `node scripts/smoke-test.mjs` | **PASS 40/40** (was 32) |
| Production audit | `node scripts/production-audit.mjs` | **PASS 32/32** (was 25) |
| Live generation | not run | **YELLOW** — needs provider keys + live Supabase |

One audit failure during this phase was real and worth recording: `SEC-01` went red
because the throwaway `.env.local` I created to run the smoke server was sitting in the
tree. The check did its job; the file was removed.

---

## 2. RED-08 closed — the user can finally see what they paid for

This was the worst failure in the audit. A generation charged credits, and the studio
reported success as the literal string:

> `Job 4f2c… completed. Results are returned by the configured provider.`

The image was never rendered, never downloadable, and never saved anywhere reachable.
The provider's raw JSON went into `ai_jobs.result` — and fal's output URLs expire within
hours, so even that was not a lasting record.

**Now:** provider output is downloaded, validated by its actual bytes, stored in the
private bucket, recorded as an asset with the prompt/provider/model that produced it,
and rendered in the studio with dimensions, size, credits charged, retry and history.

### Output validation (`lib/generation/media-validation.ts`)
Content-Type and filename are both attacker-controlled, so neither is evidence. Formats
are identified by magic bytes against an allow-list. Specifically caught:

| Input | Before | Now |
|---|---|---|
| Provider returns `{"error":"quota exceeded"}` with `content-type: image/png` | stored as an image, user billed | rejected — "The provider returned a text response instead of an image" |
| HTML 502 page from a CDN | stored as an image | rejected |
| `payload.svg` renamed `photo.png` | accepted | rejected — SVG is an active document format and these files are served back from our own origin |
| Provider returns 200 with zero URLs | job marked **completed** | job fails, credits refunded |

SSRF is also closed on this path: the download URL comes from a third-party API
response, so non-HTTPS and private/link-local hosts are refused before any fetch.

---

## 3. Jobs are durable

`runGenerationJob()` did everything inline in one HTTP request — insert, charge, call
the provider, mark complete. A slow generation held the request open until the
serverless function timed out, leaving an orphaned job with credits already spent, no
way to poll, cancel or resume.

Split into:

- **`submitGenerationJob`** — authenticated, RLS-scoped, returns `202` + job id as soon
  as the row is durable. Idempotent: a double-clicked submit returns the original job
  rather than charging twice.
- **`processGenerationJob`** — background, service-role, claims the row by transitioning
  `queued → running` conditionally, so it is safe to call twice and two workers cannot
  both process one job.
- **`runTextGenerationJob`** — text/copy/analysis stays inline, because Lumi and ad copy
  need the text in the same request. Media tasks are refused on this path.

New endpoints: `GET /api/ai/jobs/[id]` (poll), `POST /api/ai/jobs/[id]/cancel`,
`POST /api/ai/jobs/sweep` (cron).

**Cancel is honest.** Only `queued` jobs can be cancelled. Once `running`, the provider
call is in flight and we are being billed for it — refunding there would give back
credits for spend we cannot recover. The API says so rather than pretending.

**The sweep is the safety net.** Background processing runs in the invocation that
accepted the submission; if that is killed (deploy, OOM, timeout) the job strands with
credits reserved. The sweep re-processes stale `queued` jobs and dead-letters stale
`running` ones **with a refund**, refunding *before* marking failed so a partial failure
cannot leave the user silently out of credits.

---

## 4. Uploads replace raw URL entry

The studio used to say: *"Source image URL (from Assets — right-click an image there to
copy its link)"*. That is not a workflow, and it meant the app fetched arbitrary
user-supplied URLs.

Added `POST /api/assets/upload` (byte-validated, quota-enforced, workspace-prefixed
path — the original filename is kept as metadata only and never becomes part of the
storage path) and a drag/drop picker with real upload progress via `XMLHttpRequest`
plus a grid of recent uploads.

---

## 5. Found during Phase 2, not in the original audit

### Cross-workspace asset exposure in the render worker callback (fixed)
`completeRenderJob()` took the external worker's `storagePath` **verbatim** and created
an `assets` row for it under the job's workspace. Nothing checked the path belonged to
that workspace — so a worker bug, or a worker with a leaked secret, could point
workspace A's asset row at workspace B's object, and A would then be handed a signed URL
to B's file. A cross-tenant data leak reachable without touching the database.

`lib/render/output-path.ts` now requires the `<workspace_id>/` prefix and rejects
traversal, absolute paths and backslashes — traversal checked *before* the prefix
comparison, since `<workspace>/../<other>/file.mp4` satisfies `startsWith()` but
resolves elsewhere. 11 tests.

### Photoshoots reported success before generating anything (fixed)
`createPhotoshoot` wrote the shoot and every shot item as `completed` at submission
time, before the provider had returned. A shoot that later failed still displayed as a
finished photoshoot containing no images. They now start `queued`, and the job's real
status drives the UI.

### Worker secret comparison was not constant-time (fixed)
`provided.length===secret.length && provided===secret` — JS string equality
short-circuits on the first differing byte, leaking the length outright and, over enough
requests, the secret. Now hashed and compared with `timingSafeEqual`.

### Client manifest could overwrite the server's credit estimate (hardened)
In `queueVideoRender`, `...(renderManifest || {})` was spread **after**
`estimatedCredits`, and `failRenderJob` refunds whatever `estimatedCredits` says.
`validateRenderManifest` happens to build a whitelist object today, so this was not
exploitable — but the ordering meant any future manifest key could clobber a
server-computed value and inflate a refund. The server value now wins.

### Errors leaked the provider chain
Users were shown raw strings like
`ALL_PROVIDERS_FAILED: groq/gpt-oss-120b (attempt 1): … | cerebras/…`.
`classifyJobFailure()` now maps every failure to an actionable message that states the
refund, and tests assert the provider names never reach the user.

### The asset library never showed an asset
It was a table of kind / status / MIME type / date — an image library with no images.
Now a preview grid.

---

## 6. Files changed

**New** — `lib/generation/media-validation.ts`, `lib/generation/persist-output.ts`,
`lib/render/output-path.ts`, `app/api/ai/jobs/[id]/route.ts`,
`app/api/ai/jobs/[id]/cancel/route.ts`, `app/api/ai/jobs/sweep/route.ts`,
`app/api/assets/route.ts`, `app/api/assets/upload/route.ts`,
`components/creative/SourceImagePicker.tsx`, `components/creative/GenerationResult.tsx`,
`tests/{media-validation,credit-cost,render-output-path}.test.ts`.

**Modified** — `lib/ai/jobs.ts`, `lib/billing/credits.ts`, `lib/storage/quota.ts`,
`lib/render/lifecycle.ts`, `lib/render/worker-auth.ts`, `lib/auth/routes.ts`,
`app/api/ai/generate/route.ts`, `app/create/image/page.tsx`,
`app/create/photoshoot/actions.ts`, `app/assets/page.tsx`, `app/globals.css`,
`app/create/video/render-actions.ts`, four text-generation callers,
`scripts/{smoke-test,production-audit}.mjs`.

---

## 7. Known external-service limitations (YELLOW)

| Item | Blocked by |
|---|---|
| End-to-end image generation | `FAL_KEY` / `GEMINI_API_KEY` + live Supabase Storage |
| Provider fallback under real failures | `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY` |
| Upload → storage round trip | live Supabase project |
| Job sweep against real stuck jobs | live Postgres + cron |
| Render worker end-to-end | deployed FFmpeg worker + `RENDER_WORKER_SECRET` |

The logic is unit-tested and the routes are smoke-tested; what is unverified is the round
trip to third-party services. No RED item has been relabelled YELLOW.

---

## 8. Still RED — deferred, with the phase that owns them

| ID | Issue | Phase |
|---|---|---|
| RED-09 | Paddle checkout URL uses the Classic scheme while the webhook implements Paddle Billing | 3 |
| RED-10 | Cancellation never calls the Paddle API (UI now says "requested", not "cancelled") | 3 |
| RED-12 | Health check reports `ok` because an env var is a non-empty string | 5 |

---

## 9. Phase 2 exit criteria

- [x] Typecheck, build clean
- [x] 76/76 unit tests
- [x] 40/40 smoke tests against a running server
- [x] 32/32 production audit checks
- [x] Generation output is persisted, validated and **displayed**
- [x] Jobs are durable, pollable, cancellable and recoverable
- [x] Credits reserved before provider spend, refunded on every failure path
- [x] Uploads replace raw URL entry
- [x] No mock or placeholder behaviour introduced

**Phase 2 is complete. Ready for Phase 3 (billing, growth, teams, integrations,
developer platform).**
