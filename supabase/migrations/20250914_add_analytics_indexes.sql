-- Analytics query indexes

-- performance_logs hot paths
create index if not exists idx_perflogs_user_logged_at on public.performance_logs (user_id, logged_at desc);
create index if not exists idx_perflogs_user_block_logged_at on public.performance_logs (user_id, block, logged_at desc);
create index if not exists idx_perflogs_user_exercise_logged_at on public.performance_logs (user_id, exercise_name, logged_at desc);

-- user_one_rms lookups
create index if not exists idx_useronerms_user_exercise_created on public.user_one_rms (user_id, exercise_name, created_at desc);

-- workout_completions day aggregation
create index if not exists idx_workoutcompletions_user_program_week_day on public.workout_completions (user_id, program_id, week, day);

-- weekly_summaries recency
create index if not exists idx_weekly_summaries_user_week on public.weekly_summaries (user_id, week);

