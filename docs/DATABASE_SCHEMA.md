# Picbo.ai — Database Schema (PostgreSQL)

Copy-paste-ready DDL. UUIDs everywhere for public-facing IDs.

```sql
create extension if not exists "pgcrypto";
create extension if not exists "vector"; -- pgvector, for Lumi's retrieval layer

-- ============================================================
-- USERS & AUTH
-- ============================================================
create table users (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             citext unique not null,
  password_hash     text,                    -- null if Google-only account
  google_id         text unique,
  role              text not null default 'user',   -- 'user' | 'admin' | 'owner'
  email_verified_at timestamptz,
  two_factor_secret text,
  country           text,
  ip_at_signup      inet,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table email_verification_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  ip         inet,
  user_agent text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TEAMS / WORKSPACES
-- ============================================================
create table teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references users(id),
  plan_code  text not null default 'free',
  created_at timestamptz not null default now()
);

create table team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null default 'editor',   -- 'owner' | 'admin' | 'editor' | 'viewer'
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table brand_kits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  team_id     uuid references teams(id) on delete cascade,
  logo_url    text,
  colors      jsonb,
  font_family text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PLANS & SUBSCRIPTIONS
-- ============================================================
create table plans (
  code                text primary key,   -- 'free' | 'starter' | 'pro' | 'business' | 'agency'
  name                text not null,
  price_usd_cents     int not null,
  monthly_credits     int not null,
  supports_overage    boolean not null default false,
  is_active           boolean not null default true
);

insert into plans (code, name, price_usd_cents, monthly_credits, supports_overage) values
  ('free',     'Free',     0,     500,     false),
  ('starter',  'Starter',  1400,  8000,    false),
  ('pro',      'Pro',      2900,  25000,   false),
  ('business', 'Business', 5900,  70000,   true),
  ('agency',   'Agency',   19900, 200000,  true);

create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references users(id) on delete cascade,
  team_id               uuid references teams(id) on delete cascade,
  plan_code             text not null references plans(code),
  status                text not null default 'active', -- active | trialing | past_due | cancelled
  billing_interval      text not null default 'monthly', -- monthly | yearly
  paddle_subscription_id text,
  paddle_customer_id     text,
  trial_ends_at         timestamptz,
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz,
  overage_enabled       boolean not null default false,
  overage_spend_cap_usd int,
  created_at            timestamptz not null default now()
);
create index on subscriptions(user_id);

-- ============================================================
-- CREDITS — LEDGER, NOT A RAW COUNTER
-- ============================================================
create table credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  amount      int not null,             -- positive = credit, negative = debit
  reason      text not null,            -- 'signup_bonus' | 'subscription_credit' | 'topup' | 'referral_bonus' | 'generation_charge' | 'refund' | 'overage' | 'admin_adjustment'
  ref_id      uuid,                     -- creations.id, payments.id, or referrals.id
  created_at  timestamptz not null default now()
);
create index on credit_transactions(user_id, created_at);

create view user_credit_balance as
  select user_id, coalesce(sum(amount), 0) as balance
  from credit_transactions
  group by user_id;

create table credit_costs (
  key     text primary key,   -- 'photo.simple', 'animated_ad.15s', etc.
  credits int not null
);
insert into credit_costs (key, credits) values
  ('photo.simple', 40), ('photo.complex', 80),
  ('ad_creative.single', 120), ('ad_creative.bundle', 300),
  ('photoshoot.set', 350), ('animated_ad.15s', 500),
  ('edit.retouch', 60), ('copywriting.only', 15), ('voice_prompt', 20);

-- ============================================================
-- GENERATION JOBS & CREATIONS
-- ============================================================
create table jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  team_id          uuid references teams(id),
  type             text not null,   -- 'photo' | 'ad_creative' | 'photoshoot' | 'animated_ad'
  status           text not null default 'queued', -- queued | processing | completed | failed
  prompt           text,
  style            text,
  aspect_ratio     text,
  reference_file_url text,
  credits_charged  int,
  error_message    text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index on jobs(user_id, created_at desc);
create index on jobs(status);

create table creations (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references jobs(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  team_id        uuid references teams(id),
  type           text not null,
  file_url       text not null,
  thumbnail_url  text,
  resolution     text,                  -- 'standard' | 'hd' | '4k'
  is_watermarked boolean not null default false,
  brand_kit_id   uuid references brand_kits(id),
  created_at     timestamptz not null default now()
);
create index on creations(user_id, created_at desc);

-- ============================================================
-- LUMI (AI ASSISTANT)
-- ============================================================
create table assistant_chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  messages   jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table help_articles (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  embedding  vector(768),   -- match your embedding model's dimension
  updated_at timestamptz not null default now()
);

-- ============================================================
-- GROWTH: REFERRALS & AFFILIATES
-- ============================================================
create table referrals (
  id             uuid primary key default gen_random_uuid(),
  referrer_id    uuid not null references users(id) on delete cascade,
  referee_id     uuid references users(id) on delete cascade,
  status         text not null default 'signed_up', -- signed_up | subscribed | rewarded
  credit_awarded int,
  created_at     timestamptz not null default now()
);

create table affiliates (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  code             text unique not null,
  commission_rate  numeric(4,2) not null default 0.20,
  status           text not null default 'pending',  -- pending | approved | rejected
  created_at       timestamptz not null default now()
);

create table affiliate_payouts (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount_cents int not null,
  status       text not null default 'pending',  -- pending | paid
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- BILLING (Paddle) & DEVELOPER ACCESS
-- ============================================================
create table payments (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  paddle_transaction_id  text unique,
  type                   text not null,   -- 'subscription' | 'topup'
  amount_cents           int not null,
  status                 text not null,   -- 'paid' | 'refunded' | 'past_due'
  created_at             timestamptz not null default now()
);
create index on payments(user_id, created_at);

create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade,
  team_id      uuid references teams(id) on delete cascade,
  key_hash     text not null unique,
  scopes       text[] not null default '{}',
  rate_limit   int not null default 60,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

create table webhooks (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  url        text not null,
  events     text[] not null,
  secret     text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- OPERATIONS
-- ============================================================
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references teams(id),
  actor_id    uuid references users(id),
  action      text not null,
  target_type text,
  target_id   uuid,
  created_at  timestamptz not null default now()
);

create table feedback_surveys (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  creation_id uuid references creations(id),
  rating     smallint,       -- e.g. -1 / +1 for thumbs down/up, or 0-10 for NPS
  comment    text,
  created_at timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       text not null,
  message    text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, read_at);

create table feature_flags (
  key         text primary key,
  rollout_pct int not null default 0,
  enabled_for text[] default '{}',  -- plan codes with guaranteed access, e.g. {'pro','business','agency'}
  updated_at  timestamptz not null default now()
);

create table coupons (
  code           text primary key,
  paddle_coupon_id text,
  description    text,
  status         text not null default 'active',  -- active | expired
  created_at     timestamptz not null default now()
);
```

## Notes

- `citext` requires `create extension citext;` for case-insensitive email
  uniqueness — swap for `text` + a lowercased unique index if avoiding it.
- Never store the verification code or password in plaintext.
- All monetary values are stored in **cents** as integers, never floats.
- `role = 'owner'` is reserved for Saad Ali's account and should be seeded
  manually, never settable via any API endpoint.
- `credit_costs` and `plans` are config tables, not enums — this is what
  lets pricing change without a redeploy, and what `GET /api/pricing`
  should read from directly rather than duplicating values in frontend code.
