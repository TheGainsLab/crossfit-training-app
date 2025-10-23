-- Add BTN workout support to program_metcons table
-- This allows BTN users to save generated workouts with the same infrastructure as Premium metcons

-- Add workout_type column to distinguish BTN workouts from program metcons
ALTER TABLE program_metcons 
ADD COLUMN IF NOT EXISTS workout_type TEXT DEFAULT 'program';

-- Add BTN-specific fields
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS workout_name TEXT,
ADD COLUMN IF NOT EXISTS workout_format TEXT,
ADD COLUMN IF NOT EXISTS time_domain TEXT,
ADD COLUMN IF NOT EXISTS exercises JSONB,
ADD COLUMN IF NOT EXISTS rounds INT,
ADD COLUMN IF NOT EXISTS amrap_time INT,
ADD COLUMN IF NOT EXISTS pattern TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS result TEXT,
ADD COLUMN IF NOT EXISTS result_time TEXT,
ADD COLUMN IF NOT EXISTS result_rounds INT,
ADD COLUMN IF NOT EXISTS result_reps INT;

-- Add user_id column for BTN workouts (program metcons get this via program_id)
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);

-- Backfill existing metcons as 'program' type
UPDATE program_metcons 
SET workout_type = 'program' 
WHERE workout_type IS NULL;

-- Add indexes for BTN queries
CREATE INDEX IF NOT EXISTS idx_program_metcons_workout_type 
ON program_metcons(workout_type);

CREATE INDEX IF NOT EXISTS idx_program_metcons_user_type 
ON program_metcons(user_id, workout_type) 
WHERE workout_type = 'btn';

CREATE INDEX IF NOT EXISTS idx_program_metcons_time_domain 
ON program_metcons(time_domain) 
WHERE time_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_metcons_user_id
ON program_metcons(user_id)
WHERE user_id IS NOT NULL;

-- Add comment to explain the table's dual purpose
COMMENT ON TABLE program_metcons IS 'Stores both Premium program metcons (workout_type=program) and BTN generated workouts (workout_type=btn). Premium metcons link via program_id, BTN workouts link via user_id.';

COMMENT ON COLUMN program_metcons.workout_type IS 'Type of workout: program (Premium metcon), btn (BTN generated), custom (user-created, future)';

COMMENT ON COLUMN program_metcons.user_id IS 'Direct user link for BTN workouts. Premium metcons use program_id -> programs.user_id relationship.';
