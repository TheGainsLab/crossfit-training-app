-- ==============================================
-- Create time_trials table matching original Engine schema
-- ==============================================
-- Replaces engine_time_trials with proper time_trials table
-- Matches original Engine database schema exactly

-- Step 1: Drop the existing engine_time_trials table (if it has no data)
-- Or rename it if you want to keep it
DROP TABLE IF EXISTS engine_time_trials CASCADE;

-- Step 2: Create time_trials table matching original schema
CREATE TABLE time_trials (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL, -- Changed from UUID to BIGINT to match users table
  modality TEXT NOT NULL,
  date DATE NOT NULL,
  total_output INTEGER NOT NULL,
  units TEXT NOT NULL,
  calculated_rpm NUMERIC(8, 2) NOT NULL,
  is_current BOOLEAN NULL DEFAULT true,
  workout_id UUID NULL,
  duration_seconds INTEGER NULL DEFAULT 600,
  created_at TIMESTAMPTZ NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL DEFAULT NOW(),
  peak_heart_rate INTEGER NULL,
  average_heart_rate INTEGER NULL,
  perceived_exertion INTEGER NULL,
  ml_model_trained BOOLEAN NULL DEFAULT false,
  workouts_using_baseline INTEGER NULL DEFAULT 0,
  month_number INTEGER NULL,
  CONSTRAINT time_trials_pkey PRIMARY KEY (id),
  CONSTRAINT time_trials_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT time_trials_modality_check CHECK (
    modality = ANY(ARRAY[
      'echo_bike'::text, 'assault_bike'::text, 'airdyne_bike'::text, 'other_bike'::text,
      'c2_row_erg'::text, 'rogue_row_erg'::text, 'c2_bike_erg'::text, 'c2_ski_erg'::text,
      'motorized_treadmill'::text, 'assault_runner'::text, 'trueform_treadmill'::text,
      'outdoor_run'::text
    ])
  ),
  CONSTRAINT time_trials_perceived_exertion_check CHECK (
    (perceived_exertion >= 1) AND (perceived_exertion <= 10)
  ),
  CONSTRAINT time_trials_units_check CHECK (
    units = ANY(ARRAY['cal'::text, 'watts'::text, 'mph'::text, 'kph'::text, 'miles'::text, 'meters'::text])
  )
);

-- Step 3: Add all indexes
CREATE INDEX IF NOT EXISTS idx_time_trials_user_modality ON time_trials(user_id, modality);
CREATE INDEX IF NOT EXISTS idx_time_trials_current ON time_trials(user_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_time_trials_date ON time_trials(date);
CREATE INDEX IF NOT EXISTS idx_time_trials_workout ON time_trials(workout_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_current_baseline ON time_trials(user_id, modality) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_time_trials_date_desc ON time_trials(user_id, modality, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_trials_ml_status ON time_trials(user_id, modality, ml_model_trained) WHERE ml_model_trained = true;
CREATE INDEX IF NOT EXISTS idx_time_trials_month ON time_trials(user_id, modality, month_number) WHERE month_number IS NOT NULL;

-- Step 4: Add foreign key from workout_sessions to time_trials
ALTER TABLE workout_sessions
ADD CONSTRAINT workout_sessions_time_trial_baseline_id_fkey 
FOREIGN KEY (time_trial_baseline_id) REFERENCES time_trials(id);

COMMENT ON TABLE time_trials IS 'Time trial baseline data for Engine users';
COMMENT ON COLUMN time_trials.user_id IS 'User ID (BIGINT to match users table)';
COMMENT ON COLUMN time_trials.calculated_rpm IS 'Calculated RPM/pace from time trial (cal/min, m/min, or w/min)';
COMMENT ON COLUMN time_trials.is_current IS 'Whether this is the current baseline for the modality';
COMMENT ON COLUMN time_trials.workout_id IS 'Reference to workouts table (UUID)';

-- Note: Trigger will be added when the function exists:
-- CREATE TRIGGER supersede_time_trial_trigger
-- AFTER INSERT ON time_trials FOR EACH ROW
-- EXECUTE FUNCTION supersede_previous_time_trial();

