-- Picbo.ai Phase 29: content moderation (§34). Logs every flagged prompt for
-- admin review — platform-admin-only, not workspace-visible (a user
-- shouldn't see the internal moderation reasoning, just that their request
-- was blocked).
create table if not exists public.moderation_flags(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  job_id uuid references public.ai_jobs(id) on delete set null,
  task text,
  prompt_excerpt text,
  category text,
  reason text,
  action text not null default 'blocked',
  created_at timestamptz not null default now()
);
create index if not exists moderation_flags_created_idx on public.moderation_flags(created_at desc);

alter table public.moderation_flags enable row level security;
create policy "moderation flags platform admin read" on public.moderation_flags for select
using(public.is_platform_admin(auth.uid()));
