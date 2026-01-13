-- ==============================================
-- Add program_id to workout_sessions table
-- ==============================================
-- This migration adds program_id to link Engine workout sessions
-- to specific user programs for proper analytics and completion tracking

-- Add program_id column (nullable to allow existing rows)
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS program_id INTEGER NULL;

-- Add foreign key constraint to programs table
ALTER TABLE workout_sessions
ADD CONSTRAINT workout_sessions_program_id_fkey 
FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL;

-- Add index for performance (used in completion checks and analytics)
CREATE INDEX IF NOT EXISTS idx_workout_sessions_program_id 
ON workout_sessions(program_id);

-- Add composite index for common query pattern (user + program + day)
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_program_day 
ON workout_sessions(user_id, program_id, program_day_number) 
WHERE completed = true;

-- Add comment
COMMENT ON COLUMN workout_sessions.program_id IS 'Reference to programs table - links Engine workout to specific user program';
































