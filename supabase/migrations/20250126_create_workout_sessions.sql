-- ==============================================
-- Create workout_sessions table for Engine app
-- ==============================================
-- This table stores Engine workout session data (not metcons)
-- Matches original Engine database schema

CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL, -- Changed from UUID to BIGINT to match users table
  workout_id UUID NULL,
  date DATE NOT NULL,
  program_day INTEGER NULL,
  user_phase INTEGER NULL,
  modality TEXT NOT NULL,
  time_trial_baseline_id UUID NULL,
  target_pace NUMERIC(8, 2) NULL DEFAULT NULL::NUMERIC,
  actual_pace NUMERIC(8, 2) NULL DEFAULT NULL::NUMERIC,
  total_output INTEGER NULL,
  calculated_rpm NUMERIC(8, 2) NULL DEFAULT NULL::NUMERIC,
  completed BOOLEAN NULL DEFAULT false,
  workout_data JSONB NULL,
  created_at TIMESTAMPTZ NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL DEFAULT NOW(),
  day_type TEXT NULL,
  peak_heart_rate INTEGER NULL,
  average_heart_rate INTEGER NULL,
  perceived_exertion INTEGER NULL,
  prediction_type TEXT NULL,
  ml_confidence NUMERIC(4, 3) NULL,
  formula_target_pace NUMERIC(8, 2) NULL,
  ml_predicted_pace NUMERIC(8, 2) NULL,
  performance_ratio NUMERIC(6, 4) NULL,
  block_count INTEGER NULL DEFAULT 1,
  total_work_seconds INTEGER NULL,
  total_rest_seconds INTEGER NULL,
  avg_work_rest_ratio NUMERIC(6, 3) NULL,
  has_max_effort BOOLEAN NULL DEFAULT false,
  has_polarized BOOLEAN NULL DEFAULT false,
  has_flux BOOLEAN NULL DEFAULT false,
  week_number INTEGER NULL,
  days_since_time_trial INTEGER NULL,
  program_version VARCHAR(50) NULL,
  program_day_number INTEGER NULL,
  units TEXT NULL,
  CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT workout_sessions_perceived_exertion_check CHECK (
    (perceived_exertion >= 1) AND (perceived_exertion <= 10)
  ),
  CONSTRAINT workout_sessions_prediction_type_check CHECK (
    prediction_type = ANY(ARRAY['formula'::text, 'ml'::text, 'blended'::text])
  ),
  CONSTRAINT workout_sessions_units_check CHECK (
    units = ANY(ARRAY['cal'::text, 'watts'::text, 'mph'::text, 'kph'::text, 'miles'::text, 'meters'::text])
  ),
  CONSTRAINT workout_sessions_days_since_time_trial_check CHECK (days_since_time_trial >= 0),
  CONSTRAINT workout_sessions_week_number_check CHECK (
    (week_number >= 1) AND (week_number <= 4)
  ),
  CONSTRAINT workout_sessions_ml_confidence_check CHECK (
    (ml_confidence >= 0::NUMERIC) AND (ml_confidence <= 1::NUMERIC)
  ),
  CONSTRAINT workout_sessions_modality_check CHECK (
    modality = ANY(ARRAY[
      'echo_bike'::text, 'assault_bike'::text, 'airdyne_bike'::text, 'other_bike'::text,
      'c2_row_erg'::text, 'rogue_row_erg'::text, 'c2_bike_erg'::text, 'c2_ski_erg'::text,
      'motorized_treadmill'::text, 'assault_runner'::text, 'trueform_treadmill'::text,
      'outdoor_delete'::text
    ])
  )
);

-- Add all indexes
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(date);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_program_day ON workout_sessions(program_day);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_modality ON workout_sessions(modality);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_workout ON workout_sessions(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_baseline ON workout_sessions(time_trial_baseline_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_completed ON workout_sessions(completed);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_program_day ON workout_sessions(user_id, program_day);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_modality ON workout_sessions(user_id, modality);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_day_type ON workout_sessions(day_type);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_day_type ON workout_sessions(user_id, day_type);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date_day_type ON workout_sessions(date, day_type);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_peak_hr ON workout_sessions(peak_heart_rate) 
WHERE peak_heart_rate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_avg_hr ON workout_sessions(average_heart_rate) 
WHERE average_heart_rate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_rpe ON workout_sessions(perceived_exertion) 
WHERE perceived_exertion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_hr_performance ON workout_sessions(
  user_id, day_type, peak_heart_rate, average_heart_rate, perceived_exertion
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_ml_training ON workout_sessions(
  user_id, modality, completed, prediction_type, program_day
) WHERE completed = true AND performance_ratio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_day_structure ON workout_sessions(
  day_type, block_count, has_max_effort, has_polarized, has_flux
) WHERE completed = true;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_ml_confidence ON workout_sessions(
  user_id, ml_confidence, prediction_type, performance_ratio
) WHERE ml_confidence IS NOT NULL AND completed = true;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_performance_analysis ON workout_sessions(
  user_id, day_type, modality, performance_ratio, week_number
) WHERE performance_ratio IS NOT NULL AND completed = true;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_work_rest ON workout_sessions(
  user_id, modality, avg_work_rest_ratio, performance_ratio
) WHERE avg_work_rest_ratio IS NOT NULL AND completed = true;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_temporal ON workout_sessions(
  user_id, modality, week_number, days_since_time_trial, performance_ratio
) WHERE completed = true AND week_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_workout_data_blocks ON workout_sessions 
USING GIN (workout_data jsonb_path_ops) WHERE workout_data IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_baseline_lookup ON workout_sessions(
  time_trial_baseline_id, completed
) WHERE completed = true;

-- Note: Foreign key to time_trials table will be added when time_trials table is created
-- ALTER TABLE workout_sessions
-- ADD CONSTRAINT workout_sessions_time_trial_baseline_id_fkey 
-- FOREIGN KEY (time_trial_baseline_id) REFERENCES time_trials(id);

-- Note: Triggers will be added when the referenced functions exist:
-- - increment_user_workout_count()
-- - auto_populate_ml_fields()
-- - increment_time_trial_workout_count()

COMMENT ON TABLE workout_sessions IS 'Engine workout session data - stores completed conditioning workouts';
COMMENT ON COLUMN workout_sessions.user_id IS 'User ID (BIGINT to match users table)';
COMMENT ON COLUMN workout_sessions.workout_id IS 'Reference to workouts table (UUID)';
COMMENT ON COLUMN workout_sessions.program_day_number IS 'Sequential day number in Engine program';
COMMENT ON COLUMN workout_sessions.program_version IS 'Engine program version: 5-day or 3-day';

