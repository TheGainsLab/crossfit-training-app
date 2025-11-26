-- ==============================================
-- Create all Engine tables matching original schemas exactly
-- ==============================================
-- This migration creates all Engine tables in the correct order
-- to avoid foreign key dependency issues

-- Step 1: Drop existing engine_* tables if they exist
DROP TABLE IF EXISTS engine_user_performance_metrics CASCADE;
DROP TABLE IF EXISTS engine_user_modality_preferences CASCADE;
DROP TABLE IF EXISTS engine_program_mapping CASCADE;
DROP TABLE IF EXISTS engine_time_trials CASCADE;
DROP TABLE IF EXISTS engine_day_types CASCADE;
DROP TABLE IF EXISTS engine_workouts CASCADE;
DROP VIEW IF EXISTS workouts CASCADE;
DROP TABLE IF EXISTS workouts CASCADE;

-- Step 2: Create day_types table (no dependencies)
CREATE TABLE day_types (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  phase_requirement INTEGER NOT NULL,
  block_count INTEGER NULL DEFAULT 1,
  set_rest_seconds INTEGER NULL,
  block_1_params JSONB NOT NULL,
  block_2_params JSONB NULL,
  block_3_params JSONB NULL,
  block_4_params JSONB NULL,
  max_duration_minutes INTEGER NOT NULL,
  is_support_day BOOLEAN NULL DEFAULT false,
  created_at TIMESTAMPTZ NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL DEFAULT NOW(),
  CONSTRAINT day_types_pkey PRIMARY KEY (id),
  CONSTRAINT day_types_block_count_check CHECK (
    (block_count >= 1) AND (block_count <= 4)
  ),
  CONSTRAINT day_types_phase_requirement_check CHECK (
    (phase_requirement >= 1) AND (phase_requirement <= 12)
  )
);

CREATE INDEX IF NOT EXISTS idx_day_types_phase ON day_types(phase_requirement);

-- Step 3: Create program_mapping table (depends on users, but user_id can be null)
CREATE TABLE program_mapping (
  id SERIAL NOT NULL,
  program_type VARCHAR(50) NOT NULL,
  user_id BIGINT NULL, -- Changed from UUID to BIGINT to match users table
  program_day_number INTEGER NOT NULL,
  source_day_number INTEGER NOT NULL,
  month_number INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  CONSTRAINT program_mapping_pkey PRIMARY KEY (id),
  CONSTRAINT program_mapping_program_type_program_day_number_key UNIQUE (program_type, program_day_number),
  CONSTRAINT program_mapping_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_program_user_type ON program_mapping(user_id, program_type) 
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_type_day ON program_mapping(program_type, program_day_number);

CREATE INDEX IF NOT EXISTS idx_program_source_day ON program_mapping(source_day_number);

-- Step 4: Create time_trials table (depends on users)
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

CREATE INDEX IF NOT EXISTS idx_time_trials_user_modality ON time_trials(user_id, modality);
CREATE INDEX IF NOT EXISTS idx_time_trials_current ON time_trials(user_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_time_trials_date ON time_trials(date);
CREATE INDEX IF NOT EXISTS idx_time_trials_workout ON time_trials(workout_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_current_baseline ON time_trials(user_id, modality) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_time_trials_date_desc ON time_trials(user_id, modality, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_trials_ml_status ON time_trials(user_id, modality, ml_model_trained) WHERE ml_model_trained = true;
CREATE INDEX IF NOT EXISTS idx_time_trials_month ON time_trials(user_id, modality, month_number) WHERE month_number IS NOT NULL;

-- Step 5: Create user_modality_preferences table (depends on users)
CREATE TABLE user_modality_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id BIGINT NULL, -- Changed from UUID to BIGINT to match users table
  modality TEXT NOT NULL,
  primary_unit TEXT NOT NULL,
  secondary_unit TEXT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT user_modality_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_modality_preferences_user_id_modality_key UNIQUE (user_id, modality),
  CONSTRAINT user_modality_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_modality_preferences_user_modality ON user_modality_preferences(user_id, modality);

-- Step 6: Create user_performance_metrics table (depends on users)
CREATE TABLE user_performance_metrics (
  user_id BIGINT NOT NULL, -- Changed from UUID to BIGINT to match users table
  day_type VARCHAR(50) NOT NULL,
  modality VARCHAR(50) NOT NULL,
  learned_max_pace NUMERIC(6, 2) NULL,
  rolling_avg_ratio NUMERIC(4, 3) NULL,
  rolling_count INTEGER NULL DEFAULT 0,
  last_5_ratios JSONB NULL, -- Note: original has last_5_ratios, not last_4_ratios
  last_updated TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT NOW(), -- Note: timestamp without time zone, not timestamptz
  CONSTRAINT user_performance_metrics_pkey PRIMARY KEY (user_id, day_type, modality),
  CONSTRAINT user_performance_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Step 7: Create workout_sessions table (depends on users and time_trials)
CREATE TABLE workout_sessions (
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
  CONSTRAINT workout_sessions_time_trial_baseline_id_fkey FOREIGN KEY (time_trial_baseline_id) REFERENCES time_trials(id),
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

-- Add all workout_sessions indexes
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

-- Step 8: Create workouts table (matching original schema exactly)
-- This should be created after day_types since it has a foreign key to it
CREATE TABLE workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  program_type TEXT NOT NULL DEFAULT 'main_5day',
  day_number INTEGER NOT NULL,
  day_type TEXT NOT NULL,
  phase INTEGER NOT NULL,
  block_count INTEGER NULL DEFAULT 1,
  set_rest_seconds INTEGER NULL,
  block_1_params JSONB NOT NULL,
  block_2_params JSONB NULL,
  block_3_params JSONB NULL,
  block_4_params JSONB NULL,
  total_duration_minutes INTEGER NOT NULL,
  base_intensity_percent NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMPTZ NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL DEFAULT NOW(),
  month INTEGER NOT NULL DEFAULT 1,
  avg_work_rest_ratio NUMERIC NULL,
  CONSTRAINT workouts_pkey PRIMARY KEY (id),
  CONSTRAINT workouts_program_type_day_number_key UNIQUE (program_type, day_number),
  CONSTRAINT workouts_day_type_fkey FOREIGN KEY (day_type) REFERENCES day_types(id),
  CONSTRAINT workouts_phase_check CHECK (
    (phase >= 1) AND (phase <= 12)
  ),
  CONSTRAINT workouts_month_check CHECK (
    (month >= 1) AND (month <= 36)
  ),
  CONSTRAINT workouts_day_number_check CHECK (
    (day_number >= 1) AND (day_number <= 720)
  ),
  CONSTRAINT workouts_block_count_check CHECK (
    (block_count >= 1) AND (block_count <= 4)
  )
);

CREATE INDEX IF NOT EXISTS idx_workouts_program_day ON workouts(program_type, day_number);
CREATE INDEX IF NOT EXISTS idx_workouts_day_type ON workouts(day_type);
CREATE INDEX IF NOT EXISTS idx_workouts_phase ON workouts(phase);
CREATE INDEX IF NOT EXISTS idx_workouts_program_phase ON workouts(program_type, phase);
CREATE INDEX IF NOT EXISTS idx_workouts_month ON workouts(month);
CREATE INDEX IF NOT EXISTS idx_workouts_program_month ON workouts(program_type, month);

COMMENT ON TABLE workouts IS 'Deterministic workout templates for Engine program (Day 1, Day 2, etc.)';

COMMENT ON TABLE day_types IS 'Day type definitions for Engine program';
COMMENT ON TABLE program_mapping IS 'Maps days from various program types to base 5-day program days';
COMMENT ON TABLE time_trials IS 'Time trial baseline data for Engine users';
COMMENT ON TABLE user_modality_preferences IS 'User unit preferences per modality';
COMMENT ON TABLE user_performance_metrics IS 'Stores learned performance data for each user, day type, and modality';
COMMENT ON TABLE workout_sessions IS 'Engine workout session data - stores completed conditioning workouts';

