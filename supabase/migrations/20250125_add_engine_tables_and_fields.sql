-- ==============================================
-- ENGINE DATABASE INTEGRATION MIGRATION
-- ==============================================
-- This migration adds Engine-specific tables and columns
-- Engine workout sessions will use program_metcons with workout_type='conditioning'

-- ==============================================
-- STEP 1: Add Engine columns to users table
-- ==============================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS engine_program_version VARCHAR(50) DEFAULT '5-day',
ADD COLUMN IF NOT EXISTS engine_selected_3day_days JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS engine_current_day INTEGER,
ADD COLUMN IF NOT EXISTS engine_months_unlocked INTEGER DEFAULT 1;

COMMENT ON COLUMN users.engine_program_version IS 'Engine program version: 5-day or 3-day';
COMMENT ON COLUMN users.engine_selected_3day_days IS 'Array of day numbers selected for 3-day program version';
COMMENT ON COLUMN users.engine_current_day IS 'Current day number in Engine program';
COMMENT ON COLUMN users.engine_months_unlocked IS 'Number of months unlocked based on subscription';

CREATE INDEX IF NOT EXISTS idx_users_engine_program_version ON users(engine_program_version);

-- ==============================================
-- STEP 2: Add Engine-specific fields to program_metcons
-- ==============================================
-- These fields are needed to store Engine workout session data

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS actual_pace NUMERIC(6, 2),
ADD COLUMN IF NOT EXISTS target_pace NUMERIC(6, 2),
ADD COLUMN IF NOT EXISTS performance_ratio NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS modality TEXT,
ADD COLUMN IF NOT EXISTS units TEXT,
ADD COLUMN IF NOT EXISTS perceived_exertion INTEGER,
ADD COLUMN IF NOT EXISTS program_day_number INTEGER,
ADD COLUMN IF NOT EXISTS program_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS engine_workout_id BIGINT,
ADD COLUMN IF NOT EXISTS day_type TEXT,
ADD COLUMN IF NOT EXISTS avg_work_rest_ratio NUMERIC(6, 2),
ADD COLUMN IF NOT EXISTS workout_data JSONB;

COMMENT ON COLUMN program_metcons.actual_pace IS 'Actual pace achieved (cal/min, m/min, or w/min depending on modality)';
COMMENT ON COLUMN program_metcons.target_pace IS 'Target pace for the workout';
COMMENT ON COLUMN program_metcons.performance_ratio IS 'Performance ratio: actual_pace / target_pace';
COMMENT ON COLUMN program_metcons.modality IS 'Cardio modality: rowing, bike, ski, assault_bike, treadmill';
COMMENT ON COLUMN program_metcons.units IS 'Units for pace: cal (calories), m (meters), w (watts)';
COMMENT ON COLUMN program_metcons.perceived_exertion IS 'Rate of perceived exertion (RPE) 1-10';
COMMENT ON COLUMN program_metcons.program_day_number IS 'Sequential day number in Engine program (1-N)';
COMMENT ON COLUMN program_metcons.program_version IS 'Engine program version: 5-day or 3-day';
COMMENT ON COLUMN program_metcons.engine_workout_id IS 'Reference to engine_workouts table';
COMMENT ON COLUMN program_metcons.day_type IS 'Engine day type: aerobic, anaerobic, threshold, etc.';
COMMENT ON COLUMN program_metcons.avg_work_rest_ratio IS 'Average work:rest ratio for interval workouts';
COMMENT ON COLUMN program_metcons.workout_data IS 'Full workout session data including intervals (JSONB)';

-- Add indexes for Engine queries
CREATE INDEX IF NOT EXISTS idx_program_metcons_engine_workout_id 
ON program_metcons(engine_workout_id) 
WHERE engine_workout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_metcons_program_day_number 
ON program_metcons(program_day_number) 
WHERE program_day_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_metcons_day_type 
ON program_metcons(day_type) 
WHERE day_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_metcons_modality 
ON program_metcons(modality) 
WHERE modality IS NOT NULL;

-- ==============================================
-- STEP 3: Create engine_workouts table
-- ==============================================
CREATE TABLE IF NOT EXISTS engine_workouts (
  id BIGSERIAL PRIMARY KEY,
  day_number INTEGER NOT NULL,
  day_type VARCHAR(50) NOT NULL,
  block_1_params JSONB,
  block_2_params JSONB,
  block_3_params JSONB,
  block_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_number)
);

COMMENT ON TABLE engine_workouts IS 'Deterministic workout templates for Engine program (Day 1, Day 2, etc.)';
COMMENT ON COLUMN engine_workouts.day_number IS 'Day number in 5-day program (1-720)';
COMMENT ON COLUMN engine_workouts.day_type IS 'Day type: aerobic, anaerobic, threshold, time_trial, etc.';
COMMENT ON COLUMN engine_workouts.block_1_params IS 'Block 1 parameters (rounds, paceRange, durations, etc.)';
COMMENT ON COLUMN engine_workouts.block_2_params IS 'Block 2 parameters (if multi-block workout)';
COMMENT ON COLUMN engine_workouts.block_3_params IS 'Block 3 parameters (if multi-block workout)';

CREATE INDEX IF NOT EXISTS idx_engine_workouts_day_number ON engine_workouts(day_number);
CREATE INDEX IF NOT EXISTS idx_engine_workouts_day_type ON engine_workouts(day_type);

-- ==============================================
-- STEP 4: Create engine_day_types table
-- ==============================================
CREATE TABLE IF NOT EXISTS engine_day_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  phase_requirement INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE engine_day_types IS 'Day type definitions for Engine program';
COMMENT ON COLUMN engine_day_types.name IS 'Day type name: aerobic, anaerobic, threshold, etc.';
COMMENT ON COLUMN engine_day_types.phase_requirement IS 'Phase requirement for this day type';

CREATE INDEX IF NOT EXISTS idx_engine_day_types_name ON engine_day_types(name);

-- ==============================================
-- STEP 5: Create engine_time_trials table
-- ==============================================
CREATE TABLE IF NOT EXISTS engine_time_trials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  modality VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  is_current BOOLEAN DEFAULT true,
  units VARCHAR(10) NOT NULL,
  baseline_pace NUMERIC(6, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE engine_time_trials IS 'Time trial baseline data for Engine users';
COMMENT ON COLUMN engine_time_trials.modality IS 'Cardio modality: rowing, bike, ski';
COMMENT ON COLUMN engine_time_trials.is_current IS 'Whether this is the current baseline for the modality';
COMMENT ON COLUMN engine_time_trials.baseline_pace IS 'Baseline pace from time trial (cal/min, m/min, or w/min)';

CREATE INDEX IF NOT EXISTS idx_engine_time_trials_user_id ON engine_time_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_engine_time_trials_user_modality_current 
ON engine_time_trials(user_id, modality, is_current) 
WHERE is_current = true;

-- ==============================================
-- STEP 6: Create engine_program_mapping table
-- ==============================================
CREATE TABLE IF NOT EXISTS engine_program_mapping (
  id SERIAL PRIMARY KEY,
  program_type VARCHAR(50) NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  program_day_number INTEGER NOT NULL,
  source_day_number INTEGER NOT NULL,
  month_number INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  UNIQUE(program_type, program_day_number),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE engine_program_mapping IS 'Maps days from various program types to base 5-day program days';
COMMENT ON COLUMN engine_program_mapping.program_type IS 'Program type: 3-day (system) or user-custom-{uuid} (user custom)';
COMMENT ON COLUMN engine_program_mapping.user_id IS 'NULL for system programs, user ID for custom programs';
COMMENT ON COLUMN engine_program_mapping.program_day_number IS 'Sequential day number in the program (1-432 for 3-day, 1-720 for 5-day)';
COMMENT ON COLUMN engine_program_mapping.source_day_number IS 'Source day number from base 5-day program (1-720)';

CREATE INDEX IF NOT EXISTS idx_engine_program_mapping_type_day 
ON engine_program_mapping(program_type, program_day_number);

CREATE INDEX IF NOT EXISTS idx_engine_program_mapping_source_day 
ON engine_program_mapping(source_day_number);

CREATE INDEX IF NOT EXISTS idx_engine_program_mapping_user_type 
ON engine_program_mapping(user_id, program_type) 
WHERE user_id IS NOT NULL;

-- ==============================================
-- STEP 7: Create engine_user_performance_metrics table
-- ==============================================
CREATE TABLE IF NOT EXISTS engine_user_performance_metrics (
  user_id BIGINT NOT NULL,
  day_type VARCHAR(50) NOT NULL,
  modality VARCHAR(50) NOT NULL,
  learned_max_pace NUMERIC(6, 2),
  rolling_avg_ratio NUMERIC(4, 3),
  rolling_count INTEGER DEFAULT 0,
  last_4_ratios JSONB,
  sample_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, day_type, modality),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE engine_user_performance_metrics IS 'Stores learned performance data for each user, day type, and modality';
COMMENT ON COLUMN engine_user_performance_metrics.learned_max_pace IS 'For max effort days: learned actual max capability';
COMMENT ON COLUMN engine_user_performance_metrics.rolling_avg_ratio IS 'Average PR of last 4 sessions of this day type';
COMMENT ON COLUMN engine_user_performance_metrics.last_4_ratios IS 'Array of last 4 performance ratios for trend analysis';

CREATE INDEX IF NOT EXISTS idx_engine_user_perf_metrics_user_day_modality 
ON engine_user_performance_metrics(user_id, day_type, modality);

-- ==============================================
-- STEP 8: Create engine_user_modality_preferences table
-- ==============================================
CREATE TABLE IF NOT EXISTS engine_user_modality_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  modality VARCHAR(50) NOT NULL,
  units VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, modality)
);

COMMENT ON TABLE engine_user_modality_preferences IS 'User unit preferences per modality (cal, m, w)';
COMMENT ON COLUMN engine_user_modality_preferences.modality IS 'Cardio modality: rowing, bike, ski';
COMMENT ON COLUMN engine_user_modality_preferences.units IS 'Preferred units: cal (calories), m (meters), w (watts)';

CREATE INDEX IF NOT EXISTS idx_engine_user_modality_prefs_user_id 
ON engine_user_modality_preferences(user_id);

-- ==============================================
-- STEP 9: Update program_metcons constraint to include conditioning
-- ==============================================
-- This should already be done by 20250120_add_conditioning_workout_fields.sql
-- But we'll ensure it's correct
ALTER TABLE program_metcons
DROP CONSTRAINT IF EXISTS check_workout_type_integrity;

ALTER TABLE program_metcons
ADD CONSTRAINT check_workout_type_integrity 
CHECK (
  (workout_type = 'program' AND program_id IS NOT NULL AND week IS NOT NULL AND day IS NOT NULL)
  OR
  (workout_type = 'btn' AND user_id IS NOT NULL AND program_id IS NULL)
  OR
  (workout_type = 'conditioning' AND user_id IS NOT NULL AND program_id IS NULL)
  OR
  (workout_type NOT IN ('program', 'btn', 'conditioning'))
);

-- ==============================================
-- STEP 10: Create performance metrics functions
-- ==============================================

-- Function: Update performance metrics after session save
CREATE OR REPLACE FUNCTION update_engine_performance_metrics(
  p_user_id BIGINT,
  p_day_type VARCHAR,
  p_modality VARCHAR,
  p_performance_ratio DECIMAL,
  p_actual_pace DECIMAL DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_last_ratios JSONB;
  v_avg_ratio DECIMAL;
  v_count INTEGER;
  v_max_effort BOOLEAN := FALSE;
BEGIN
  -- Check if this is a max effort day
  v_max_effort := p_day_type IN ('anaerobic', 'time_trial', 'rocket_races_a', 'rocket_races_b');
  
  -- Get current metrics
  SELECT rolling_avg_ratio, rolling_count, last_4_ratios
  INTO v_avg_ratio, v_count, v_last_ratios
  FROM engine_user_performance_metrics
  WHERE user_id = p_user_id 
    AND day_type = p_day_type 
    AND modality = p_modality;
  
  -- Initialize if doesn't exist
  IF v_last_ratios IS NULL THEN
    v_last_ratios := '[]'::JSONB;
  END IF;
  
  -- For max effort days: update learned_max_pace using actual pace (not ratio)
  IF v_max_effort AND p_actual_pace IS NOT NULL THEN
    -- Add actual pace to ratios array for max effort days
    v_last_ratios := v_last_ratios || jsonb_build_array(p_actual_pace);
    
    -- Keep only last 4
    v_last_ratios := (
      SELECT jsonb_agg(value ORDER BY ordinality DESC)
      FROM jsonb_array_elements(v_last_ratios) WITH ORDINALITY AS t(value, ordinality)
      WHERE ordinality <= 4
    );
    
    -- Calculate new rolling average (average of last 4 actual paces)
    SELECT AVG(value::numeric) 
    INTO v_avg_ratio
    FROM jsonb_array_elements(v_last_ratios);
    
    -- Update count
    v_count := LEAST(COALESCE(v_count, 0) + 1, 4);
    
    -- Update or insert
    INSERT INTO engine_user_performance_metrics (
      user_id, day_type, modality, 
      learned_max_pace, rolling_avg_ratio, rolling_count, last_4_ratios, sample_count, last_updated
    )
    VALUES (
      p_user_id, p_day_type, p_modality,
      v_avg_ratio, -- learned_max_pace (actual average pace)
      NULL, -- rolling_avg_ratio is NULL for max effort days
      v_count,
      v_last_ratios,
      COALESCE((SELECT sample_count FROM engine_user_performance_metrics WHERE user_id = p_user_id AND day_type = p_day_type AND modality = p_modality), 0) + 1,
      NOW()
    )
    ON CONFLICT (user_id, day_type, modality) 
    DO UPDATE SET
      learned_max_pace = EXCLUDED.learned_max_pace,
      rolling_avg_ratio = NULL, -- Keep NULL for max effort days
      rolling_count = EXCLUDED.rolling_count,
      last_4_ratios = EXCLUDED.last_4_ratios,
      sample_count = engine_user_performance_metrics.sample_count + 1,
      last_updated = NOW();
      
  ELSE
    -- For non-max effort days: update rolling average using performance ratio
    -- Add new ratio to array (keep last 4)
    v_last_ratios := v_last_ratios || jsonb_build_array(p_performance_ratio);
    
    -- Keep only last 4
    v_last_ratios := (
      SELECT jsonb_agg(r ORDER BY idx DESC)
      FROM (
        SELECT value as r, row_number() OVER (ORDER BY idx DESC) as idx
        FROM jsonb_array_elements(v_last_ratios) WITH ORDINALITY AS t(value, idx)
      ) sub
      WHERE idx <= 4
    );
    
    -- Calculate new rolling average
    SELECT AVG(value::numeric) 
    INTO v_avg_ratio
    FROM jsonb_array_elements(v_last_ratios);
    
    -- Update count
    v_count := LEAST(COALESCE(v_count, 0) + 1, 4);
    
    -- Update or insert
    INSERT INTO engine_user_performance_metrics (
      user_id, day_type, modality, 
      rolling_avg_ratio, rolling_count, last_4_ratios, sample_count, last_updated
    )
    VALUES (
      p_user_id, p_day_type, p_modality,
      v_avg_ratio, v_count, v_last_ratios,
      COALESCE((SELECT sample_count FROM engine_user_performance_metrics WHERE user_id = p_user_id AND day_type = p_day_type AND modality = p_modality), 0) + 1,
      NOW()
    )
    ON CONFLICT (user_id, day_type, modality) 
    DO UPDATE SET
      rolling_avg_ratio = EXCLUDED.rolling_avg_ratio,
      rolling_count = EXCLUDED.rolling_count,
      last_4_ratios = EXCLUDED.last_4_ratios,
      sample_count = engine_user_performance_metrics.sample_count + 1,
      last_updated = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_engine_performance_metrics IS 'Updates rolling average performance ratios after each Engine workout session';

-- Function: Get adjusted target pace based on user's historical performance
CREATE OR REPLACE FUNCTION get_engine_adjusted_target(
  p_user_id BIGINT,
  p_day_type VARCHAR,
  p_modality VARCHAR,
  p_base_target DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  v_avg_ratio DECIMAL;
  v_learned_max DECIMAL;
BEGIN
  -- Get user's historical performance for this day type and modality
  SELECT rolling_avg_ratio, learned_max_pace
  INTO v_avg_ratio, v_learned_max
  FROM engine_user_performance_metrics
  WHERE user_id = p_user_id 
    AND day_type = p_day_type 
    AND modality = p_modality;
  
  -- If we have learned max for max effort days, use it
  IF v_learned_max IS NOT NULL AND p_day_type IN ('anaerobic', 'time_trial', 'rocket_races_a', 'rocket_races_b') THEN
    RETURN v_learned_max * 1.0;
  END IF;
  
  -- If we have average ratio, adjust base target
  IF v_avg_ratio IS NOT NULL AND v_avg_ratio != 0 THEN
    -- If user consistently underperforms (PR < 0.85), increase target slightly
    -- If user consistently overperforms (PR > 1.10), decrease target slightly
    IF v_avg_ratio < 0.85 THEN
      RETURN p_base_target * 1.05; -- 5% easier
    ELSIF v_avg_ratio > 1.10 THEN
      RETURN p_base_target * 0.95; -- 5% harder
    ELSE
      RETURN p_base_target * v_avg_ratio; -- Use their average
    END IF;
  END IF;
  
  -- Default: return base target
  RETURN p_base_target;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_engine_adjusted_target IS 'Returns adjusted target pace based on user historical performance for the day type and modality';
