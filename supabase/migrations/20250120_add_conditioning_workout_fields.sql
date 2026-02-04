-- Add conditioning workout support to program_metcons table
-- Conditioning workouts feature cardio machines (Rowing, Bike, Ski)
-- Analytics trapleaecked in units per minute (calories, meters, watts)

-- Add workout_type='conditioning' support
-- Update the check constraint to allow 'conditioning' type
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
  (workout_type NOT IN ('program', 'btn', 'conditioning')) -- Allow other future types
);

-- Add cardio machine type
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS cardio_machine TEXT;
-- Values: 'rowing', 'bike', 'ski', 'assault_bike', 'treadmill', etc.

-- Add duration in seconds/minutes (for conditioning workouts)
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS duration_seconds INT;
-- Duration of the conditioning workout in seconds

-- Add performance metrics (units per minute)
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS calories_per_minute NUMERIC(6, 2);
-- Calories burned per minute

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS meters_per_minute NUMERIC(6, 2);
-- Meters covered per minute (for rowing/skiing)

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS watts_per_minute NUMERIC(6, 2);
-- Watts generated per minute (for bike/assault bike)

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS avg_watts NUMERIC(6, 2);
-- Average watts during the workout

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS total_calories INT;
-- Total calories burned in the workout

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS total_meters INT;
-- Total meters covered (for rowing/skiing)

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS workout_zone TEXT;
-- Intensity zone: 'z1' (aerobic base), 'z2' (aerobic), 'z3' (tempo), 'z4' (threshold), 'z5' (vo2max)

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS target_zone TEXT;
-- Target zone for the workout (what was prescribed)

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS avg_heart_rate INT;
-- Average heart rate during workout

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS max_heart_rate INT;
-- Max heart rate during workout

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS intensity_type TEXT;
-- Workout type: 'steady_state', 'intervals', 'tempo', 'threshold', 'vo2max', 'sprint', etc.

-- Add interval data (for interval-based conditioning workouts)
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS interval_work_seconds INT;
-- Work duration for intervals (e.g., 60 seconds)

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS interval_rest_seconds INT;
-- Rest duration for intervals (e.g., 60 seconds)

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS interval_rounds INT;
-- Number of intervals

ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS interval_results JSONB;
-- Detailed interval results: [{round: 1, calories: 20, watts: 250, avg_watts: 245, ...}]

-- Add indexes for conditioning-specific queries
CREATE INDEX IF NOT EXISTS idx_program_metcons_cardio_machine 
ON program_metcons(cardio_machine) 
WHERE cardio_machine IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_metcons_workout_zone 
ON program_metcons(workout_zone) 
WHERE workout_zone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_metcons_intensity_type 
ON program_metcons(intensity_type) 
WHERE intensity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_metcons_user_conditioning 
ON program_metcons(user_id, workout_type) 
WHERE workout_type = 'conditioning';

-- Add comments
COMMENT ON COLUMN program_metcons.cardio_machine IS 'Cardio machine type for conditioning workouts: rowing, bike, ski, assault_bike, treadmill';
COMMENT ON COLUMN program_metcons.duration_seconds IS 'Duration of conditioning workout in seconds';
COMMENT ON COLUMN program_metcons.calories_per_minute IS 'Average calories per minute for analytics';
COMMENT ON COLUMN program_metcons.meters_per_minute IS 'Average meters per minute for analytics (rowing/skiing)';
COMMENT ON COLUMN program_metcons.watts_per_minute IS 'Average watts per minute for analytics';
COMMENT ON COLUMN program_metcons.avg_watts IS 'Average watts during the workout';
COMMENT ON COLUMN program_metcons.workout_zone IS 'Intensity zone achieved: z1-z5';
COMMENT ON COLUMN program_metcons.target_zone IS 'Target intensity zone prescribed';
COMMENT ON COLUMN program_metcons.intensity_type IS 'Workout structure: steady_state, intervals, tempo, threshold, vo2max, sprint';
COMMENT ON COLUMN program_metcons.interval_results IS 'Detailed interval-by-interval results for interval-based workouts';


