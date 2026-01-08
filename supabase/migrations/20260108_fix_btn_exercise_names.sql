-- Fix BTN configuration for exercises that had name mismatches
-- The original migration used plural/alternate names that don't match the database

-- Deadlift (was: Deadlifts)
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.70
WHERE name = 'Deadlift';

-- Overhead Squat (was: Overhead Squats)
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 1.00
WHERE name = 'Overhead Squat';

-- Power Clean (was: Power Cleans)
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.70
WHERE name = 'Power Clean';

-- Clean and Jerk (was: Clean and Jerks)
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 12.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[3, 5, 10, 12, 15, 20, 25, 30],
  btn_difficulty_tier = 'moderate',
  btn_weight_degradation_rate = 0.80
WHERE name = 'Clean and Jerk';

-- Kettlebell Snatch (was: Kettlebell Snatches)
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 21.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Kettlebell Snatch';

-- Rowing (was: Rowing Calories) - will display as "Rowing Calories" via name mapping
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Rowing';

-- Bike Erg (was: Bike Calories) - will display as "Bike Calories" via name mapping
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Bike Erg';

-- Ski Erg (was: Ski Calories) - will display as "Ski Calories" via name mapping
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 15.00,
  btn_max_reps_per_round = 50,
  btn_rep_options = ARRAY[10, 12, 15, 18, 20, 24, 30, 35, 40, 50],
  btn_difficulty_tier = 'lowSkill'
WHERE name = 'Ski Erg';

-- Pull-ups (kipping or butterfly) (was: Pull-ups) - will display as "Pull-ups" via name mapping
UPDATE public.exercises SET
  can_be_btn = true,
  btn_work_rate = 18.00,
  btn_max_reps_per_round = 30,
  btn_rep_options = ARRAY[5, 7, 9, 10, 12, 15, 18, 20, 24, 30],
  btn_difficulty_tier = 'moderate'
WHERE name = 'Pull-ups (kipping or butterfly)';
