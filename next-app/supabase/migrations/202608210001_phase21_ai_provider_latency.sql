-- Picbo.ai Phase 21: latency tracking for AI provider attempts.
-- ai_job_attempts already tracks provider/model/attempt_no/status/cost_usd (phase 5);
-- this adds latency so the new Groq -> Cerebras -> OpenRouter -> optional Claude
-- fallback chain can be evaluated on speed as well as cost/success rate.
alter table public.ai_job_attempts add column if not exists latency_ms integer;
create index if not exists ai_job_attempts_provider_idx on public.ai_job_attempts(provider,created_at desc);
