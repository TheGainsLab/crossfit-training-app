-- Historical audit of calorie estimates per workout day
create table if not exists workout_calories (
  program_id int not null,
  week int not null,
  day int not null,
  source text default 'ai',
  low numeric,
  high numeric,
  calories numeric not null,
  created_at timestamptz default now(),
  primary key (program_id, week, day, created_at)
);

-- Helpful index for querying latest entries
create index if not exists workout_calories_program_week_day_idx
  on workout_calories(program_id, week, day, created_at desc);

