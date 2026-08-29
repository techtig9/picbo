# Phase 3 — Authentication, Supabase & Workspace Foundation

Implemented:
- Supabase SSR browser/server clients
- auth middleware and protected application routes
- email/password sign-up and sign-in
- sign-out
- environment-variable contract
- profiles
- workspaces
- workspace membership + owner/admin/editor/manager/viewer roles
- RLS policies for workspace-scoped data
- products
- projects + project/products relation
- assets
- default profile/workspace creation triggers
- indexes and secure membership helper functions
- server-side `requireUser()` and current-workspace helpers
- Phase 2 shell preserved

Important setup:
1. Create a Supabase project.
2. Run `supabase/migrations/202608160001_phase3_identity.sql` in Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Fill Supabase URL, anon key and service-role key.
5. Install dependencies and run the app.

The service-role key is server-only and must never be exposed as `NEXT_PUBLIC_*`.
