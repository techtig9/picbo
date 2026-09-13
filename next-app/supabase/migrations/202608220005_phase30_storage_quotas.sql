-- Picbo.ai Phase 30: storage quotas (§35). assets had no size tracking at
-- all, so there was no way to enforce a per-workspace storage limit.
alter table public.assets add column if not exists size_bytes bigint;
create index if not exists assets_workspace_size_idx on public.assets(workspace_id) include (size_bytes);
