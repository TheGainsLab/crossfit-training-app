-- Remove the strict CHECK constraint that might be causing query issues
ALTER TABLE program_metcons
DROP CONSTRAINT IF EXISTS check_workout_type_integrity;

-- Add a simpler, more permissive constraint
-- Just ensure BTN workouts have user_id
ALTER TABLE program_metcons
ADD CONSTRAINT check_btn_has_user_id
CHECK (
  workout_type != 'btn' OR (workout_type = 'btn' AND user_id IS NOT NULL)
);

COMMENT ON CONSTRAINT check_btn_has_user_id ON program_metcons IS 
'Ensures BTN workouts must have a user_id. Does not restrict other workout types.';
