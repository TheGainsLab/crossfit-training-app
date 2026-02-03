-- Add missing foreign key relationship between engine_program_day_assignments and workouts
-- This enables PostgREST to automatically join these tables

-- Step 1: Add unique constraint on workouts.day_number
-- (Currently only has composite unique on program_type + day_number)
ALTER TABLE workouts
ADD CONSTRAINT workouts_day_number_unique UNIQUE (day_number);

-- Step 2: Add foreign key from engine_program_day_assignments to workouts
ALTER TABLE engine_program_day_assignments
ADD CONSTRAINT fk_engine_workout_day_number
FOREIGN KEY (engine_workout_day_number) 
REFERENCES workouts(day_number)
ON DELETE CASCADE;

-- Step 3: Reload PostgREST schema cache so it recognizes the new foreign key
NOTIFY pgrst, 'reload schema';
