-- Picbo.ai Phase 23: SaaS backbone schema for Campaigns, Team invitations,
-- Billing (subscriptions/payment history) and a workspace activity log.
-- None of these tables existed anywhere in the schema before this migration —
-- the corresponding pages (Campaigns, Team, Billing) were static placeholder
-- shells with no backing data model at all.

create type public.campaign_status as enum ('draft','active','paused','archived');
create type public.invitation_status as enum ('pending','accepted','revoked','expired');
create type public.subscription_plan as enum ('free','starter','pro','agency');
create type public.billing_period as enum ('monthly','annual');
create type public.subscription_status as enum ('active','trialing','past_due','canceled');

create table if not exists public.campaigns(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid not null references auth.users(id),
  name text not null,
  objective text not null,
  audience jsonb not null default '{}'::jsonb,
  status public.campaign_status not null default 'draft',
  budget_cents bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creative variants of a campaign reuse the existing ad_briefs/ad_variants
-- system rather than duplicating creative storage — a campaign is a
-- marketing wrapper (objective/audience/budget/status) around one or more
-- ad briefs already produced in Ad Studio.
create table if not exists public.campaign_ad_briefs(
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ad_brief_id uuid not null references public.ad_briefs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(campaign_id,ad_brief_id)
);

create table if not exists public.workspace_invitations(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'editor',
  invited_by uuid not null references auth.users(id),
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '14 days'),
  unique(workspace_id,email,status)
);

create table if not exists public.workspace_activity(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workspace_activity_workspace_idx on public.workspace_activity(workspace_id,created_at desc);

create table if not exists public.subscriptions(
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  billing_period public.billing_period not null default 'monthly',
  status public.subscription_status not null default 'active',
  provider text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  type text not null,
  amount_cents bigint,
  currency text default 'usd',
  status text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);
create index if not exists payment_events_workspace_idx on public.payment_events(workspace_id,created_at desc);

create index if not exists campaigns_workspace_idx on public.campaigns(workspace_id,created_at desc);
create index if not exists workspace_invitations_workspace_idx on public.workspace_invitations(workspace_id,status);

alter table public.campaigns enable row level security;
alter table public.campaign_ad_briefs enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_activity enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;

create policy "campaigns member read" on public.campaigns for select using(public.is_workspace_member(workspace_id));
create policy "campaigns editor write" on public.campaigns for insert with check(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]) and created_by=auth.uid());
create policy "campaigns editor update" on public.campaigns for update using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));
create policy "campaigns editor delete" on public.campaigns for delete using(public.has_workspace_role(workspace_id,array['owner','admin','manager']::public.workspace_role[]));

create policy "campaign briefs member read" on public.campaign_ad_briefs for select using(exists(select 1 from public.campaigns c where c.id=campaign_id and public.is_workspace_member(c.workspace_id)));
create policy "campaign briefs editor write" on public.campaign_ad_briefs for insert with check(exists(select 1 from public.campaigns c where c.id=campaign_id and public.has_workspace_role(c.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));
create policy "campaign briefs editor delete" on public.campaign_ad_briefs for delete using(exists(select 1 from public.campaigns c where c.id=campaign_id and public.has_workspace_role(c.workspace_id,array['owner','admin','manager','editor']::public.workspace_role[])));

create policy "invitations member read" on public.workspace_invitations for select using(public.is_workspace_member(workspace_id));
create policy "invitations admin write" on public.workspace_invitations for insert with check(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]) and invited_by=auth.uid());
create policy "invitations admin update" on public.workspace_invitations for update using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));

create policy "activity member read" on public.workspace_activity for select using(public.is_workspace_member(workspace_id));
create policy "activity member insert" on public.workspace_activity for insert with check(public.is_workspace_member(workspace_id) and (actor_id=auth.uid() or actor_id is null));

create policy "subscriptions member read" on public.subscriptions for select using(public.is_workspace_member(workspace_id));

create policy "payment events member read" on public.payment_events for select using(public.is_workspace_member(workspace_id));

-- Every workspace should read as "on the Free plan" by default, same reasoning
-- as workspace_credits in phase 22 — a row must exist before the first
-- checkout, not just after.
create or replace function public.create_default_subscription()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.subscriptions(workspace_id,plan,billing_period,status)
  values(new.id,'free','monthly','active')
  on conflict(workspace_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_workspace_created_subscription on public.workspaces;
create trigger on_workspace_created_subscription
  after insert on public.workspaces
  for each row execute procedure public.create_default_subscription();

insert into public.subscriptions(workspace_id,plan,billing_period,status)
select w.id,'free','monthly','active' from public.workspaces w
on conflict(workspace_id) do nothing;

-- Owners/admins can accept their own pending invitation by matching auth email
-- (used by the invitation-acceptance flow — a user isn't a workspace member
-- yet, so they can only see/act on an invite addressed to their own email).
create policy "invitations invitee read own" on public.workspace_invitations for select
using (email=(select email from auth.users where id=auth.uid()) and status='pending');
