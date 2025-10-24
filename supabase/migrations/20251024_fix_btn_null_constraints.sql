-- Fix NOT NULL constraints for BTN workouts
-- BTN workouts don't have week/day/program_id since they're not part of a program

-- Allow NULL for week, day, and program_id columns
ALTER TABLE program_metcons 
ALTER COLUMN week DROP NOT NULL;

ALTER TABLE program_metcons 
ALTER COLUMN day DROP NOT NULL;

ALTER TABLE program_metcons 
ALTER COLUMN program_id DROP NOT NULL;

-- Add a check constraint to ensure data integrity:
-- Either it's a program metcon (has program_id, week, day) OR a BTN workout (has user_id, no program_id)
ALTER TABLE program_metcons
ADD CONSTRAINT check_workout_type_integrity 
CHECK (
  (workout_type = 'program' AND program_id IS NOT NULL AND week IS NOT NULL AND day IS NOT NULL)
  OR
  (workout_type = 'btn' AND user_id IS NOT NULL AND program_id IS NULL)
  OR
  (workout_type NOT IN ('program', 'btn')) -- Allow other future types
);

COMMENT ON CONSTRAINT check_workout_type_integrity ON program_metcons IS 
'Ensures program metcons have program_id/week/day, while BTN workouts have user_id and no program reference';
