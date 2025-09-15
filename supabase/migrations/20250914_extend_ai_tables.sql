-- Extend modified_workouts with AI attribution and versioning
alter table if exists public.modified_workouts
  add column if not exists source text check (source in ('ai','user','coach')),
  add column if not exists rationale jsonb,
  add column if not exists version integer default 1,
  add column if not exists applied_by_job_id uuid;

-- Extend ai_jobs with action metadata
alter table if exists public.ai_jobs
  add column if not exists action_signature text,
  add column if not exists cooldown_until timestamptz,
  add column if not exists context_hash text,
  add column if not exists metadata jsonb;

