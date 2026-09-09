create table if not exists public.analytics_events (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 project_id uuid,
 event_name text not null,
 value numeric not null default 0,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists analytics_events_workspace_idx on public.analytics_events(workspace_id,created_at desc);

create table if not exists public.project_shares (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 project_id uuid not null,
 token text not null unique,
 permission text not null default 'view',
 expires_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists project_shares_project_idx on public.project_shares(project_id);

create table if not exists public.creative_templates (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid,
 name text not null,
 category text not null,
 definition jsonb not null default '{}'::jsonb,
 featured boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists creative_templates_category_idx on public.creative_templates(category,featured);

create table if not exists public.referrals (
 id uuid primary key default gen_random_uuid(),
 inviter_workspace_id uuid not null,
 referral_code text not null unique,
 referred_workspace_id uuid,
 status text not null default 'created',
 reward_credits bigint not null default 0,
 created_at timestamptz not null default now()
);
