-- Create technical_exercise_focus table for deterministic technical work selection
-- Maps (exercise_name, main_lift, focus_category) for ratio-driven exercise selection

CREATE TABLE IF NOT EXISTS technical_exercise_focus (
  id SERIAL PRIMARY KEY,
  exercise_name TEXT NOT NULL,
  main_lift TEXT NOT NULL,
  focus_category TEXT NOT NULL,
  UNIQUE(exercise_name, main_lift, focus_category)
);

-- Snatch
INSERT INTO technical_exercise_focus (exercise_name, main_lift, focus_category) VALUES
  ('Snatch Pulls', 'Snatch', 'snatch_strength'),
  ('Snatch High Pulls', 'Snatch', 'snatch_strength'),
  ('Pause Snatch Pulls', 'Snatch', 'snatch_strength'),
  ('Hang Power Snatch', 'Snatch', 'snatch_receiving'),
  ('Power Snatch', 'Snatch', 'snatch_receiving'),
  ('Power Snatch to Overhead Squat', 'Snatch', 'snatch_receiving'),
  ('Snatch Balance', 'Snatch', 'snatch_receiving'),
  ('Press Snatch Balance', 'Snatch', 'snatch_receiving'),
  ('1.5 Overhead Squat', 'Snatch', 'snatch_overhead'),
  ('Overhead Squat Hold (:10)', 'Snatch', 'snatch_overhead'),
  ('Overhead Squat w Pause', 'Snatch', 'snatch_overhead'),
  ('Sotts Press', 'Snatch', 'snatch_overhead'),
  ('Overhead Squat', 'Snatch', 'snatch_overhead'),
  ('Klokov Press', 'Snatch', 'snatch_overhead')
ON CONFLICT (exercise_name, main_lift, focus_category) DO NOTHING;

-- Clean and Jerk
INSERT INTO technical_exercise_focus (exercise_name, main_lift, focus_category) VALUES
  ('Clean Pulls', 'Clean and Jerk', 'cj_strength'),
  ('Clean High Pulls', 'Clean and Jerk', 'cj_strength'),
  ('Pause Clean Pulls (at knee)', 'Clean and Jerk', 'cj_strength'),
  ('1.5 Front Squat', 'Clean and Jerk', 'cj_strength'),
  ('1.5 Squat Clean Thruster', 'Clean and Jerk', 'cj_strength'),
  ('Power Clean', 'Clean and Jerk', 'cj_receiving'),
  ('Hang Power Cleans', 'Clean and Jerk', 'cj_receiving'),
  ('Hang Cleans', 'Clean and Jerk', 'cj_receiving'),
  ('Power Clean to Front Squat', 'Clean and Jerk', 'cj_receiving'),
  ('Clean (Only)', 'Clean and Jerk', 'cj_receiving'),
  ('Jerk (Only)', 'Clean and Jerk', 'cj_jerk'),
  ('Jerk - Behind Neck', 'Clean and Jerk', 'cj_jerk'),
  ('Jerk - Dip Pause', 'Clean and Jerk', 'cj_jerk'),
  ('Jerk - Eye Level', 'Clean and Jerk', 'cj_jerk'),
  ('Jerk - Power', 'Clean and Jerk', 'cj_jerk'),
  ('Jerk - Split Pause', 'Clean and Jerk', 'cj_jerk'),
  ('Split Press', 'Clean and Jerk', 'cj_jerk')
ON CONFLICT (exercise_name, main_lift, focus_category) DO NOTHING;

-- Back Squat
INSERT INTO technical_exercise_focus (exercise_name, main_lift, focus_category) VALUES
  ('1.5 Back Squat', 'Back Squat', 'position'),
  ('Back Squat Hold (:10)', 'Back Squat', 'position'),
  ('Kang Squat', 'Back Squat', 'position'),
  ('1 Dumbbell O H S', 'Back Squat', 'overhead'),
  ('Goblet Squat', 'Back Squat', 'overhead'),
  ('Thrusters', 'Back Squat', 'overhead')
ON CONFLICT (exercise_name, main_lift, focus_category) DO NOTHING;

-- Front Squat
INSERT INTO technical_exercise_focus (exercise_name, main_lift, focus_category) VALUES
  ('1.5 Front Squat', 'Front Squat', 'front_rack'),
  ('Front Squat Hold (:10)', 'Front Squat', 'front_rack'),
  ('Goblet Squat', 'Front Squat', 'front_rack'),
  ('Kang Squat', 'Front Squat', 'front_rack'),
  ('1 Dumbbell O H S', 'Front Squat', 'overhead_complex'),
  ('Thrusters', 'Front Squat', 'overhead_complex')
ON CONFLICT (exercise_name, main_lift, focus_category) DO NOTHING;

-- Press (Strict Press, Push Press, Press - family match)
INSERT INTO technical_exercise_focus (exercise_name, main_lift, focus_category) VALUES
  ('1 DB Strict Press', 'Press', 'stability_unilateral'),
  ('1 Leg Strict Press', 'Press', 'stability_unilateral'),
  ('Half-Kneeling DB Strict Press', 'Press', 'stability_unilateral'),
  ('Half-Kneeling Strict Press', 'Press', 'stability_unilateral'),
  ('Seated DB Strict Press', 'Press', 'stability_unilateral'),
  ('Z Press', 'Press', 'strict_strength'),
  ('Dumbbell Z Press', 'Press', 'strict_strength'),
  ('Seated Strict Press', 'Press', 'strict_strength'),
  ('Tempo Strict Press', 'Press', 'strict_strength')
ON CONFLICT (exercise_name, main_lift, focus_category) DO NOTHING;

-- Also map Press-focused exercises to Strict Press and Push Press for family fallback
INSERT INTO technical_exercise_focus (exercise_name, main_lift, focus_category)
SELECT exercise_name, 'Strict Press'::text, focus_category FROM technical_exercise_focus WHERE main_lift = 'Press'
ON CONFLICT (exercise_name, main_lift, focus_category) DO NOTHING;

INSERT INTO technical_exercise_focus (exercise_name, main_lift, focus_category)
SELECT exercise_name, 'Push Press'::text, focus_category FROM technical_exercise_focus WHERE main_lift = 'Press'
ON CONFLICT (exercise_name, main_lift, focus_category) DO NOTHING;

-- Overhead Squat and Overhead Squat w Pause have technical_dependency null; set Snatch so they pass TECHNICAL WORK filter
UPDATE exercises
SET technical_dependency = CASE
  WHEN technical_dependency IS NULL OR array_length(technical_dependency, 1) IS NULL THEN ARRAY['Snatch']::text[]
  WHEN NOT ('Snatch' = ANY(technical_dependency)) THEN technical_dependency || ARRAY['Snatch']::text[]
  ELSE technical_dependency
END
WHERE name IN ('Overhead Squat', 'Overhead Squat w Pause');
