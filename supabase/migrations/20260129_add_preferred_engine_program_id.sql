-- ==============================================
-- Add preferred_engine_program_id to users table
-- ==============================================
-- This column stores the user's preferred Engine program selection
-- (e.g., 'main_5day', 'endurance', 'hyrox', '3day_varied')

ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_engine_program_id TEXT;

-- Add foreign key constraint to engine_programs table
-- Note: This assumes engine_programs table exists with id as TEXT primary key
ALTER TABLE users
ADD CONSTRAINT users_preferred_engine_program_id_fkey
FOREIGN KEY (preferred_engine_program_id) REFERENCES engine_programs(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_preferred_engine_program
ON users(preferred_engine_program_id)
WHERE preferred_engine_program_id IS NOT NULL;

COMMENT ON COLUMN users.preferred_engine_program_id IS 'Reference to engine_programs.id - the selected Engine program variant';
