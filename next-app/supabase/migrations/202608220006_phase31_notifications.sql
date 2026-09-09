-- Picbo.ai Phase 31: notifications (§51 page inventory — the header bell
-- icon has had no backing data or click handler since the app shell was
-- first scaffolded).
create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- null = visible to all workspace members
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(workspace_id,user_id,created_at desc);

alter table public.notifications enable row level security;
create policy "notifications recipient read" on public.notifications for select
using(public.is_workspace_member(workspace_id) and (user_id is null or user_id=auth.uid()));
create policy "notifications recipient update" on public.notifications for update
using(user_id=auth.uid());
