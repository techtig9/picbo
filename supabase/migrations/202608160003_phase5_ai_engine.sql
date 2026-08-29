-- Picbo.ai Phase 5: AI jobs, idempotency, provider attempts and credits.
create type public.generation_job_status as enum ('queued','running','validating','completed','failed','retrying','cancelled');
create type public.credit_entry_type as enum ('grant','charge','refund','topup','referral','adjustment');

create table if not exists public.ai_jobs(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 task text not null,
 quality text not null default 'fast',
 status public.generation_job_status not null default 'queued',
 prompt text,
 request jsonb not null default '{}'::jsonb,
 result jsonb,
 error_code text,
 error_message text,
 progress integer not null default 0 check(progress between 0 and 100),
 idempotency_key text not null,
 created_at timestamptz not null default now(),
 started_at timestamptz,
 completed_at timestamptz,
 unique(workspace_id,idempotency_key)
);
create table if not exists public.ai_job_attempts(
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.ai_jobs(id) on delete cascade,
 provider text not null,
 model text not null,
 attempt_no integer not null,
 status text not null,
 request_id text,
 error_code text,
 error_message text,
 cost_usd numeric(12,6),
 created_at timestamptz not null default now()
);
create table if not exists public.credit_ledger(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 type public.credit_entry_type not null,
 amount integer not null,
 reference_id uuid,
 idempotency_key text not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(workspace_id,idempotency_key)
);
create index if not exists ai_jobs_workspace_created_idx on public.ai_jobs(workspace_id,created_at desc);
create index if not exists ai_job_attempts_job_idx on public.ai_job_attempts(job_id);
create index if not exists credit_ledger_workspace_idx on public.credit_ledger(workspace_id,created_at desc);

alter table public.ai_jobs enable row level security;
alter table public.ai_job_attempts enable row level security;
alter table public.credit_ledger enable row level security;

create policy "ai jobs member read" on public.ai_jobs for select using(public.is_workspace_member(workspace_id));
create policy "ai jobs editor create" on public.ai_jobs for insert with check(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]) and created_by=auth.uid());
create policy "ai jobs editor update" on public.ai_jobs for update using(public.has_workspace_role(workspace_id,array['owner','admin','manager','editor']::public.workspace_role[]));

create policy "attempts member read" on public.ai_job_attempts for select using(exists(select 1 from public.ai_jobs j where j.id=job_id and public.is_workspace_member(j.workspace_id)));

create policy "credits member read" on public.credit_ledger for select using(public.is_workspace_member(workspace_id));

create or replace function public.workspace_credit_balance(wid uuid)
returns bigint language sql stable security definer set search_path=public
as $$ select coalesce(sum(amount),0) from public.credit_ledger where workspace_id=wid; $$;

create or replace function public.reserve_credits(wid uuid,amount_to_charge integer,idem text,ref uuid)
returns bigint language plpgsql security definer set search_path=public
as $$ declare bal bigint; begin
 if amount_to_charge<=0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
 if not public.is_workspace_member(wid) then raise exception 'NOT_A_MEMBER'; end if;
 select public.workspace_credit_balance(wid) into bal;
 if bal<amount_to_charge then raise exception 'INSUFFICIENT_CREDITS'; end if;
 insert into public.credit_ledger(workspace_id,type,amount,reference_id,idempotency_key) values(wid,'charge',-amount_to_charge,ref,idem) on conflict do nothing;
 return public.workspace_credit_balance(wid);
end; $$;

create or replace function public.refund_credits(wid uuid,amount_to_refund integer,idem text,ref uuid)
returns bigint language plpgsql security definer set search_path=public
as $$ begin
 if amount_to_refund<=0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
 insert into public.credit_ledger(workspace_id,type,amount,reference_id,idempotency_key) values(wid,'refund',amount_to_refund,ref,idem) on conflict do nothing;
 return public.workspace_credit_balance(wid);
end; $$;
