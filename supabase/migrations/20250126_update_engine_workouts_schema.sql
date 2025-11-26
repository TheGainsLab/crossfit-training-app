-- ==============================================
-- Update engine_workouts to match original workouts table schema
-- ==============================================
-- This migration adds all missing fields and constraints to match the original
-- Engine workouts table structure exactly

-- Step 1: Add missing columns
ALTER TABLE engine_workouts
ADD COLUMN IF NOT EXISTS program_type TEXT NOT NULL DEFAULT 'main_5day',
ADD COLUMN IF NOT EXISTS phase INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS set_rest_seconds INTEGER,
ADD COLUMN IF NOT EXISTS block_4_params JSONB,
ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS base_intensity_percent NUMERIC(5, 2) NOT NULL DEFAULT 70.00,
ADD COLUMN IF NOT EXISTS month INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS avg_work_rest_ratio NUMERIC;

-- Step 2: Add check constraints to match original
ALTER TABLE engine_workouts
DROP CONSTRAINT IF EXISTS engine_workouts_phase_check,
DROP CONSTRAINT IF EXISTS engine_workouts_month_check,
DROP CONSTRAINT IF EXISTS engine_workouts_day_number_check,
DROP CONSTRAINT IF EXISTS engine_workouts_block_count_check;

ALTER TABLE engine_workouts
ADD CONSTRAINT engine_workouts_phase_check CHECK (phase >= 1 AND phase <= 12),
ADD CONSTRAINT engine_workouts_month_check CHECK (month >= 1 AND month <= 36),
ADD CONSTRAINT engine_workouts_day_number_check CHECK (day_number >= 1 AND day_number <= 720),
ADD CONSTRAINT engine_workouts_block_count_check CHECK (block_count >= 1 AND block_count <= 4);

-- Step 3: Update unique constraint to match original (program_type, day_number)
ALTER TABLE engine_workouts
DROP CONSTRAINT IF EXISTS engine_workouts_day_number_key;

ALTER TABLE engine_workouts
ADD CONSTRAINT engine_workouts_program_day_number_key UNIQUE (program_type, day_number);

-- Step 4: Add indexes to match original schema
CREATE INDEX IF NOT EXISTS idx_engine_workouts_program_day 
ON engine_workouts(program_type, day_number);

CREATE INDEX IF NOT EXISTS idx_engine_workouts_phase 
ON engine_workouts(phase);

CREATE INDEX IF NOT EXISTS idx_engine_workouts_program_phase 
ON engine_workouts(program_type, phase);

CREATE INDEX IF NOT EXISTS idx_engine_workouts_month 
ON engine_workouts(month);

CREATE INDEX IF NOT EXISTS idx_engine_workouts_program_month 
ON engine_workouts(program_type, month);

-- Step 5: Create workouts view as alias for engine_workouts
-- This provides compatibility with Engine app code that expects 'workouts' table
CREATE OR REPLACE VIEW workouts AS
SELECT 
  id,
  program_type,
  day_number,
  day_type,
  phase,
  block_count,
  set_rest_seconds,
  block_1_params,
  block_2_params,
  block_3_params,
  block_4_params,
  total_duration_minutes,
  base_intensity_percent,
  created_at,
  updated_at,
  month,
  avg_work_rest_ratio
FROM engine_workouts;

COMMENT ON VIEW workouts IS 'View alias for engine_workouts table - provides compatibility with Engine app code';

-- Note: Foreign key to day_types table (workouts.day_type -> day_types.id)
-- will be added separately if/when day_types table is created
-- ALTER TABLE engine_workouts
-- ADD CONSTRAINT engine_workouts_day_type_fkey 
-- FOREIGN KEY (day_type) REFERENCES day_types(id);

