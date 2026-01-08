-- Add BTN (Better Than Nothing) workout generator columns to exercises table
-- This allows the BTN generator to pull exercise configuration from the database
-- instead of hardcoded lists

-- Add new columns
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS can_be_btn boolean null default false,
ADD COLUMN IF NOT EXISTS btn_work_rate numeric(5,2) null,              -- reps per minute at median pace
ADD COLUMN IF NOT EXISTS btn_max_reps_per_round integer null,          -- realistic cap per round
ADD COLUMN IF NOT EXISTS btn_rep_options integer[] null,               -- valid rep counts for clean programming
ADD COLUMN IF NOT EXISTS btn_difficulty_tier varchar(20) null,         -- 'highSkill', 'highVolume', 'moderate', 'lowSkill'
ADD COLUMN IF NOT EXISTS btn_weight_degradation_rate numeric(3,2) null; -- weight-based speed penalty (0.7=mild, 0.8=medium, 1.0=high)

-- Add index for BTN filtering
CREATE INDEX IF NOT EXISTS idx_exercises_btn ON public.exercises USING btree (can_be_btn) WHERE can_be_btn = true;

-- Populate BTN data for existing exercises
-- Work rates, max reps, rep options, difficulty tiers, and weight degradation from current BTN generator

-- High Skill exercises
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'highSkill',
  btn_weight_degradation_rate = 0.80
WHERE name = 'Snatch';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 9.00,
  btn_max_reps_per_round = 20,
  btn_rep_options = ARRAY[3, 5, 7, 9, 10, 12, 15, 18, 20],
  btn_difficulty_tier = 'highSkill'
WHERE name = 'Ring Muscle Ups';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'highSkill'
WHERE name = 'Handstand Push-ups';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 6.00,
  btn_max_reps_per_round = 5,
  btn_rep_options = ARRAY[1, 2, 3, 5],
  btn_difficulty_tier = 'highSkill'
WHERE name = 'Rope Climbs';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 4.50,
  btn_max_reps_per_round = 3,
  btn_rep_options = ARRAY[1, 2, 3],
  btn_difficulty_tier = 'highSkill'
WHERE name = 'Legless Rope Climbs';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 7.50,
  btn_max_reps_per_round = 20,
  btn_rep_options = ARRAY[3, 5, 7, 9, 10, 12, 15, 18, 20],
  btn_difficulty_tier = 'highSkill'
WHERE name = 'Bar Muscle Ups';

-- High Volume exercises
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 60.00,
  btn_max_reps_per_round = 100,
  btn_rep_options = ARRAY[15, 20, 25, 30, 35, 40, 50, 60, 75, 100],
  btn_difficulty_tier = 'highVolume'
WHERE name = 'Double Unders';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 20.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'highVolume'
WHERE name = 'Wall Balls';

-- Moderate exercises
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.70
WHERE name = 'Deadlifts';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'moderate'
WHERE name = 'Burpees';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'moderate'
WHERE name = 'Pull-ups';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'moderate'
WHERE name = 'Chest to Bar Pull-ups';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'moderate'
WHERE name = 'Toes to Bar';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 1.00
WHERE name = 'Overhead Squats';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.80
WHERE name = 'Thrusters';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.70
WHERE name = 'Power Cleans';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.80
WHERE name = 'Clean and Jerks';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 24.00,
  btn_max_reps_per_round = 40,
  btn_rep_options = ARRAY[7, 9, 10, 12, 15, 18, 20, 24, 25, 30, 40],
  btn_difficulty_tier = 'moderate'
WHERE name = 'GHD Sit-ups';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 1.00
WHERE name = 'Squat Cleans';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.70
WHERE name = 'Power Snatch';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 20.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'moderate'
WHERE name = 'Push-ups';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 9.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 1.00
WHERE name = 'Squat Snatch';

-- Low Skill exercises
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 21.21,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Box Jumps';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.75,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Box Jump Overs';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Burpee Box Jump Overs';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 20.79,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[6, 8, 10, 12, 18, 20, 24, 30, 36, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Alternating Dumbbell Snatches';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.42,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Dumbbell Thrusters';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Dumbbell Clean and Jerk';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Rowing Calories';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 30.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Kettlebell Swings';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 21.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Kettlebell Snatches';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Bike Calories';

UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Ski Calories';

-- Add comment explaining the columns
COMMENT ON COLUMN public.exercises.can_be_btn IS 'Whether this exercise can be used in BTN (Better Than Nothing) workout generation';
COMMENT ON COLUMN public.exercises.btn_work_rate IS 'Reps per minute at median (50th percentile) pace for BTN time calculations';
COMMENT ON COLUMN public.exercises.btn_max_reps_per_round IS 'Maximum realistic reps per round for BTN workouts';
COMMENT ON COLUMN public.exercises.btn_rep_options IS 'Array of valid rep counts for clean BTN programming (e.g., 12 not 13)';
COMMENT ON COLUMN public.exercises.btn_difficulty_tier IS 'Difficulty tier for BTN pattern restrictions: highSkill, highVolume, moderate, lowSkill';
COMMENT ON COLUMN public.exercises.btn_weight_degradation_rate IS 'Weight-based speed penalty for barbell exercises: 0.7=mild, 0.8=medium, 1.0=high degradation';
