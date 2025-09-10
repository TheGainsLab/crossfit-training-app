-- Add per-day intensity bias to program_workouts (-2..+2 typical)
alter table program_workouts
  add column if not exists intensity_bias smallint default 0;
