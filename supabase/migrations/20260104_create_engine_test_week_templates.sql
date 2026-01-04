-- Engine Test Week Templates
-- Standalone test workouts inserted at week 13, 26, 39...
-- Does NOT affect the Engine day sequence (1-720)
-- Used by Engine and Competitor programs

CREATE TABLE IF NOT EXISTS public.engine_test_week_templates (
  id SERIAL PRIMARY KEY,
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 5),
  day_type TEXT NOT NULL,
  block_count INTEGER NOT NULL DEFAULT 1,
  block_1_params JSONB NOT NULL,
  block_2_params JSONB,
  block_3_params JSONB,
  block_4_params JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day)
);

-- Index for quick lookup by day
CREATE INDEX IF NOT EXISTS idx_engine_test_week_templates_day
ON public.engine_test_week_templates(day);

COMMENT ON TABLE public.engine_test_week_templates IS 'Engine test week workouts (Test 1-5). Delivered with months 3, 6, 9... as week 13, 26, 39...';

-- Insert the 5 test days
-- Day 1: 3 x 1:00 work / 3:00 rest (short anaerobic intervals)
-- Day 2: 1 x 20:00 (long aerobic test)
-- Day 3: 5 x 1:00 work / 1:00 rest (1:1 intervals)
-- Day 4: 1 x 5:00 (medium aerobic test)
-- Day 5: 3 x 3:00 work / 1:00 rest (medium intervals)

INSERT INTO public.engine_test_week_templates (day, day_type, block_1_params) VALUES
(1, 'Test 1', '{"rounds": 3, "workDuration": 60, "restDuration": 180}'),
(2, 'Test 2', '{"rounds": 1, "workDuration": 1200, "restDuration": 0}'),
(3, 'Test 3', '{"rounds": 5, "workDuration": 60, "restDuration": 60}'),
(4, 'Test 4', '{"rounds": 1, "workDuration": 300, "restDuration": 0}'),
(5, 'Test 5', '{"rounds": 3, "workDuration": 180, "restDuration": 60}');
