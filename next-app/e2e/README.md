# E2E tests

Real Playwright tests, not stubs — but **not yet run**, because this sandbox
has no deployed Supabase project, no confirmed test account, and no live AI
provider keys. Every assertion is genuine; several tests are gated with
`test.skip()`/`test.fixme()` against the specific credential they need,
rather than faking a pass.

## To actually run these

1. Apply `../supabase/migrations/*.sql` to a real Supabase project (see
   `../supabase/tests/README.md` for the RLS verification that already
   passed locally against this exact schema).
2. Set `.env.local` from `.env.example` — at minimum `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and one AI provider (Groq is cheapest to
   start with).
3. Confirm a test account by email, then:
   ```bash
   E2E_TEST_EMAIL=you@example.com E2E_TEST_PASSWORD=... npx playwright test
   ```
4. For the billing tests, also set `PADDLE_API_KEY` etc. and a Paddle sandbox
   account — those tests skip automatically without it.

## What's covered vs. what needs `test.fixme()`

Steps 1–12 and 17 of the Definition-of-Done flow are written as real
Playwright assertions. Steps 13–15 (provider failure → fallback → refund)
are already verified at the unit level with mocked fetch
(`tests/ai-router.test.ts`, `tests/render-lifecycle.test.ts`) — the E2E
versions need a way to deliberately break one provider in a live environment,
which isn't safe to script against production credentials, so they're left
as `test.fixme()` with an explanation rather than faked.
