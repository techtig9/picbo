# RLS regression tests

`cross_workspace_rls.sql` is a real, runnable test — not documentation. It
creates two workspaces (Alice, Bob) via the actual signup trigger, then runs
14 assertions as the non-superuser `authenticated` role (impersonating each
user via `app.current_user_id`, the same mechanism Supabase's real
`auth.uid()` reads from) confirming:

- Alice can read her own data, not Bob's (SELECT isolation)
- Alice cannot UPDATE, DELETE, or INSERT into Bob's workspace
- `reserve_credits()` rejects a non-member
- Storage object delete/update is properly workspace-scoped (this test
  caught a real bug — see phase 28 migration)
- A user with no workspace membership at all sees nothing
- `is_platform_admin()` is false by default, true only once explicitly granted
- `ai_job_attempts` INSERT works for a workspace editor (this test caught a
  real bug — see phase 27 migration, Phase 2's own attempt-logging code was
  silently blocked by a missing policy)
- A non-owner cannot insert attempts against another workspace's job

## Running it

Requires a Postgres instance with the `auth`/`storage` schemas (a real
Supabase project already has these; for local Postgres you need a small shim
— ask Claude to regenerate `00_auth_shim.sql` from this conversation, or use
`supabase start` if you have the Supabase CLI, which provides these for free).

```bash
psql -d your_test_db -f 00_auth_shim.sql   # local Postgres only — skip for real Supabase
for f in ../migrations/*.sql; do psql -d your_test_db -f "$f"; done
psql -d your_test_db -f cross_workspace_rls.sql
```

Every test line prints `EXPECT <value>` next to its result — read the output,
there's no automated pass/fail assertion (kept intentionally simple/readable
over adding a test framework dependency for 14 checks).
