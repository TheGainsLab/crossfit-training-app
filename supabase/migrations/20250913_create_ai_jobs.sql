-- Queue table for asynchronous AI jobs (context refresh, etc.)
create table if not exists public.ai_jobs (
  id bigserial primary key,
  user_id integer not null,
  job_type text not null, -- e.g., 'context_refresh'
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique, -- optional unique key to prevent duplicates
  status text not null default 'pending', -- pending | running | completed | failed
  scheduled_for timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_jobs is 'Lightweight job queue for AI/background tasks';
comment on column public.ai_jobs.dedupe_key is 'Unique key to deduplicate enqueues (e.g., context_refresh:<user_id>)';

create index if not exists ai_jobs_status_idx on public.ai_jobs(status);
create index if not exists ai_jobs_user_idx on public.ai_jobs(user_id);

