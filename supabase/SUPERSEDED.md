# Superseded — do not edit migrations here

This directory (`/supabase/migrations`, at the repo root) contained phases 3–8
of the schema (workspaces, products, ai_jobs, brand_kits, video_projects, etc).
It was never wired into deployment: `next-app/supabase/migrations` only had
phase 9 onward, whose foreign keys reference tables that were only ever
defined in *this* directory — meaning the actual app's migration set could
never have run successfully against a real Supabase project, and nothing
built on `ai_jobs`, `video_projects`, `products`, `workspaces`, etc. could
have worked end-to-end.

**Fixed on 2026-08-22**: phases 3–8 were copied into
`next-app/supabase/migrations/` (same filenames, same timestamps — they sort
correctly ahead of phase 9). That directory is now the single canonical
migration history for this project.

This directory is kept only so nothing is silently deleted. Do not add new
migrations here, and do not point `supabase link` / `supabase db push` at
the repo root — always run Supabase CLI commands from inside `next-app/`.
