-- Picbo.ai Phase 24: profiles.email + cross-member visibility.
-- The Team page needs to show who's on a workspace, but `profiles` never
-- stored email (only display_name/avatar_url), and its only RLS policy was
-- "read your own row" — a workspace member had no way to see their
-- teammates' profiles at all.

alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
  insert into public.profiles(id,email) values(new.id,new.email)
  on conflict(id) do update set email=excluded.email;
  return new;
end; $$;

-- Backfill existing profiles created before this migration.
update public.profiles p set email=u.email
from auth.users u
where u.id=p.id and p.email is null;

drop policy if exists "profiles workspace peers read" on public.profiles;
create policy "profiles workspace peers read" on public.profiles for select
using (
  id=auth.uid()
  or exists(
    select 1 from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id=mine.workspace_id
    where mine.user_id=auth.uid() and theirs.user_id=profiles.id
  )
);
