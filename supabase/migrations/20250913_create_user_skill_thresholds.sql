-- Create table for per-user skill thresholds used by Skills analytics
create table if not exists public.user_skill_thresholds (
  user_id integer not null,
  skill_name text not null,
  multiplier numeric not null default 1.0,
  updated_at timestamptz not null default now(),
  constraint user_skill_thresholds_pkey primary key (user_id, skill_name)
);

-- Optional: comment for clarity
comment on table public.user_skill_thresholds is 'Per-user multipliers to scale badge thresholds for skills analytics';
comment on column public.user_skill_thresholds.multiplier is 'Difficulty multiplier (e.g., 1.1, 1.21) applied to base thresholds';

