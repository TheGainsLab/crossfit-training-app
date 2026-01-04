-- Applied Power Test Week Templates
-- 1RM tests for the Strength block during test weeks (week 13, 26, 39...)
-- Technical and Accessories blocks are generated normally

CREATE TABLE IF NOT EXISTS public.applied_power_test_templates (
  id SERIAL PRIMARY KEY,
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 5),
  lift_order INTEGER NOT NULL DEFAULT 1,  -- Order within the day (1st lift, 2nd lift)
  lift_name TEXT NOT NULL,
  test_type TEXT NOT NULL DEFAULT '1RM',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day, lift_order)
);

-- Index for quick lookup by day
CREATE INDEX IF NOT EXISTS idx_applied_power_test_templates_day
ON public.applied_power_test_templates(day);

COMMENT ON TABLE public.applied_power_test_templates IS 'Applied Power 1RM test lifts for test weeks. Each day has 1-2 lifts to test.';

-- Insert the test lifts for each day
-- Day 1: Snatch (1 lift)
-- Day 2: Back Squat, Push Press (2 lifts)
-- Day 3: Bench Press (1 lift)
-- Day 4: Clean and Jerk, Front Squat (2 lifts)
-- Day 5: Deadlift, Strict Press (2 lifts)

INSERT INTO public.applied_power_test_templates (day, lift_order, lift_name, test_type, notes) VALUES
(1, 1, 'Snatch', '1RM', 'Work up to a max single. Full squat snatch.'),
(2, 1, 'Back Squat', '1RM', 'Work up to a max single.'),
(2, 2, 'Push Press', '1RM', 'Work up to a max single.'),
(3, 1, 'Bench Press', '1RM', 'Work up to a max single. Pause at chest.'),
(4, 1, 'Clean and Jerk', '1RM', 'Work up to a max single. Full squat clean, split or push jerk.'),
(4, 2, 'Front Squat', '1RM', 'Work up to a max single.'),
(5, 1, 'Deadlift', '1RM', 'Work up to a max single. Conventional or sumo.'),
(5, 2, 'Strict Press', '1RM', 'Work up to a max single. No leg drive.');
