-- Extend modified_workouts with preview/apply metadata and weekly read index

alter table if exists public.modified_workouts
  add column if not exists is_preview boolean default true,
  add column if not exists applied_at timestamptz,
  add column if not exists source text,
  add column if not exists signature text;

-- Helpful for weekly preview reads
create index if not exists idx_modified_workouts_user_program_week
  on public.modified_workouts(user_id, program_id, week);

