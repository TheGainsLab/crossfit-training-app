-- Add daily_calories to program_workouts for saving AI calorie estimates
alter table if exists program_workouts
  add column if not exists daily_calories numeric;

