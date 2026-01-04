-- Create test_week_templates table for defining test week content by program type
CREATE TABLE IF NOT EXISTS public.test_week_templates (
  id SERIAL PRIMARY KEY,
  program_type TEXT NOT NULL,  -- 'competitor', 'applied_power', 'engine', 'btn'
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 5),
  block_order INTEGER NOT NULL DEFAULT 1,  -- Order of blocks within a day
  block_name TEXT NOT NULL,  -- 'STRENGTH TEST', 'SKILL ASSESSMENT', 'BENCHMARK WOD', etc.
  exercises JSONB NOT NULL DEFAULT '[]',  -- Array of test exercises with details
  instructions TEXT,  -- General instructions for this block
  rest_notes TEXT,  -- Rest recommendations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(program_type, day, block_order)
);

-- Index for efficient lookups by program type
CREATE INDEX IF NOT EXISTS idx_test_week_templates_program_type
ON public.test_week_templates(program_type);

CREATE INDEX IF NOT EXISTS idx_test_week_templates_program_day
ON public.test_week_templates(program_type, day);

COMMENT ON TABLE public.test_week_templates IS 'Templates defining test week content for each program type. Test weeks occur at weeks 13, 26, 39, etc.';
COMMENT ON COLUMN public.test_week_templates.exercises IS 'JSON array of exercises: [{name, testType, notes, warmupProtocol}]';

-- Insert default test week templates for Competitor program
-- Day 1: Lower Body Strength Tests
INSERT INTO public.test_week_templates (program_type, day, block_order, block_name, exercises, instructions, rest_notes) VALUES
('competitor', 1, 1, 'STRENGTH TEST',
  '[
    {"name": "Back Squat", "testType": "1RM", "warmupProtocol": "Empty bar x 10, 40% x 5, 60% x 3, 75% x 2, 85% x 1, 90% x 1, then attempts", "notes": "3-5 attempts at max"},
    {"name": "Front Squat", "testType": "1RM", "warmupProtocol": "Use back squat warmup sets, then 70% x 2, 80% x 1, then attempts", "notes": "2-3 attempts at max"}
  ]'::jsonb,
  'Test lower body strength. Full rest between lifts. Record best successful attempt.',
  'Rest 3-5 minutes between max attempts'
),

-- Day 2: Upper Body Strength + Olympic Lifts
('competitor', 2, 1, 'STRENGTH TEST',
  '[
    {"name": "Strict Press", "testType": "1RM", "warmupProtocol": "Empty bar x 10, 50% x 5, 70% x 3, 80% x 1, then attempts", "notes": "No leg drive"},
    {"name": "Push Press", "testType": "1RM", "warmupProtocol": "After strict press, 80% x 1, then attempts", "notes": "2-3 attempts"}
  ]'::jsonb,
  'Test pressing strength.',
  'Rest 3-4 minutes between attempts'
),
('competitor', 2, 2, 'OLYMPIC LIFT TEST',
  '[
    {"name": "Snatch", "testType": "1RM", "warmupProtocol": "Empty bar drills, then 50% x 2, 65% x 2, 75% x 1, 85% x 1, then attempts", "notes": "Full squat snatch"},
    {"name": "Clean & Jerk", "testType": "1RM", "warmupProtocol": "60% x 2, 75% x 1, 85% x 1, then attempts", "notes": "Full clean, split or push jerk"}
  ]'::jsonb,
  'Test Olympic lifts. Prioritize technique over load.',
  'Rest 2-3 minutes between attempts'
),

-- Day 3: Gymnastics Skills Assessment
('competitor', 3, 1, 'SKILL ASSESSMENT',
  '[
    {"name": "Pull-ups", "testType": "max_reps", "notes": "Strict, kipping, or butterfly - note which style"},
    {"name": "Toes-to-Bar", "testType": "max_reps", "notes": "Unbroken set"},
    {"name": "Handstand Push-ups", "testType": "max_reps", "notes": "Strict or kipping - note which"},
    {"name": "Muscle-ups", "testType": "max_reps", "notes": "Bar or ring - note which. Skip if not acquired"},
    {"name": "Double-unders", "testType": "max_reps", "notes": "Unbroken set"}
  ]'::jsonb,
  'Test gymnastics capacity. Full rest between movements. Record max unbroken reps.',
  'Rest 3-5 minutes between skills'
),
('competitor', 3, 2, 'SKILL ASSESSMENT',
  '[
    {"name": "Handstand Walk", "testType": "max_distance", "notes": "Record total feet/meters. 3 attempts, best counts"},
    {"name": "Pistols", "testType": "max_reps", "notes": "Alternating legs, total reps"}
  ]'::jsonb,
  'Balance and single-leg strength assessment.',
  'Rest as needed'
),

-- Day 4: Conditioning Benchmarks
('competitor', 4, 1, 'BENCHMARK WOD',
  '[
    {"name": "Fran", "testType": "time", "workout": "21-15-9 Thrusters (95/65) + Pull-ups", "notes": "Scale as needed, note scaling"},
    {"name": "Grace", "testType": "time", "workout": "30 Clean & Jerks for time (135/95)", "notes": "Scale as needed, note scaling"}
  ]'::jsonb,
  'Choose ONE benchmark. Fran tests mixed capacity, Grace tests power endurance. Warm up thoroughly.',
  'Full recovery before attempting'
),

-- Day 5: Aerobic Capacity + Deadlift
('competitor', 5, 1, 'STRENGTH TEST',
  '[
    {"name": "Deadlift", "testType": "1RM", "warmupProtocol": "Empty bar x 10, 50% x 5, 70% x 3, 80% x 2, 90% x 1, then attempts", "notes": "Conventional or sumo - note which"}
  ]'::jsonb,
  'Test deadlift. Take your time warming up.',
  'Rest 4-5 minutes between max attempts'
),
('competitor', 5, 2, 'AEROBIC TEST',
  '[
    {"name": "2000m Row", "testType": "time", "notes": "All-out effort. Record time and splits"},
    {"name": "1 Mile Run", "testType": "time", "notes": "Alternative if no rower. Record time"}
  ]'::jsonb,
  'Choose ONE aerobic test based on equipment. This tests engine capacity.',
  'Full warmup including 500m easy row'
);

-- Insert default test week templates for Applied Power program
-- Focused on strength tests only
INSERT INTO public.test_week_templates (program_type, day, block_order, block_name, exercises, instructions, rest_notes) VALUES
('applied_power', 1, 1, 'STRENGTH TEST',
  '[
    {"name": "Back Squat", "testType": "1RM", "warmupProtocol": "Empty bar x 10, 40% x 5, 60% x 3, 75% x 2, 85% x 1, 90% x 1, then attempts", "notes": "3-5 attempts at max"}
  ]'::jsonb,
  'Focus on lower body strength. Take full rest.',
  'Rest 4-5 minutes between attempts'
),
('applied_power', 2, 1, 'STRENGTH TEST',
  '[
    {"name": "Bench Press", "testType": "1RM", "warmupProtocol": "Empty bar x 10, 50% x 5, 70% x 3, 80% x 1, then attempts", "notes": "Pause at chest"},
    {"name": "Strict Press", "testType": "1RM", "warmupProtocol": "After bench, 70% x 1, then attempts", "notes": "No leg drive"}
  ]'::jsonb,
  'Upper body pressing strength.',
  'Rest 3-4 minutes between attempts'
),
('applied_power', 3, 1, 'STRENGTH TEST',
  '[
    {"name": "Deadlift", "testType": "1RM", "warmupProtocol": "Empty bar x 10, 50% x 5, 70% x 3, 80% x 2, 90% x 1, then attempts", "notes": "Conventional or sumo"}
  ]'::jsonb,
  'Posterior chain strength.',
  'Rest 4-5 minutes between attempts'
),
('applied_power', 4, 1, 'STRENGTH TEST',
  '[
    {"name": "Front Squat", "testType": "1RM", "warmupProtocol": "60% x 3, 75% x 2, 85% x 1, then attempts", "notes": "2-3 attempts"},
    {"name": "Push Press", "testType": "1RM", "warmupProtocol": "70% x 2, 80% x 1, then attempts", "notes": "From rack"}
  ]'::jsonb,
  'Additional strength markers.',
  'Rest 3-4 minutes between attempts'
),
('applied_power', 5, 1, 'ACCESSORY TEST',
  '[
    {"name": "Weighted Pull-up", "testType": "1RM", "notes": "Add weight to BW, find max"},
    {"name": "Weighted Dip", "testType": "1RM", "notes": "Add weight to BW, find max"}
  ]'::jsonb,
  'Test relative strength in pulling and pressing.',
  'Rest 3 minutes between attempts'
);

-- Insert default test week templates for Engine program
-- Focused on conditioning tests
INSERT INTO public.test_week_templates (program_type, day, block_order, block_name, exercises, instructions, rest_notes) VALUES
('engine', 1, 1, 'AEROBIC TEST',
  '[
    {"name": "2000m Row", "testType": "time", "notes": "All-out effort. Record time, avg pace, avg watts"}
  ]'::jsonb,
  'Baseline aerobic capacity test. Warm up 5-10 min easy rowing.',
  'Full recovery before test'
),
('engine', 2, 1, 'ANAEROBIC TEST',
  '[
    {"name": "500m Row", "testType": "time", "notes": "Max effort sprint. Record time and peak watts"},
    {"name": "1000m Row", "testType": "time", "notes": "30 min after 500m. Record time and avg pace"}
  ]'::jsonb,
  'Short-duration power tests.',
  'Full recovery between tests (30 min minimum)'
),
('engine', 3, 1, 'MIXED MODAL TEST',
  '[
    {"name": "5 Rounds: 12 Cal Row + 12 Burpees", "testType": "time", "notes": "Record total time and round splits"}
  ]'::jsonb,
  'Tests ability to maintain output across mixed modalities.',
  'Warm up thoroughly'
),
('engine', 4, 1, 'THRESHOLD TEST',
  '[
    {"name": "30 Min Row for Max Meters", "testType": "distance", "notes": "Sustainable pace. Record total meters and avg pace"}
  ]'::jsonb,
  'Aerobic threshold test. Find sustainable pace you can hold.',
  'Light warmup only'
),
('engine', 5, 1, 'RUNNING TEST',
  '[
    {"name": "1 Mile Run", "testType": "time", "notes": "All-out effort"},
    {"name": "5K Run", "testType": "time", "notes": "OR: 30 min after mile test, sustainable pace"}
  ]'::jsonb,
  'Running capacity. Choose one or both based on time.',
  'Warm up with 800m jog'
);

-- Insert default test week templates for BTN program
-- Simplified testing
INSERT INTO public.test_week_templates (program_type, day, block_order, block_name, exercises, instructions, rest_notes) VALUES
('btn', 1, 1, 'STRENGTH TEST',
  '[
    {"name": "Back Squat", "testType": "1RM", "warmupProtocol": "Work up gradually", "notes": "Find a challenging single"}
  ]'::jsonb,
  'Lower body strength baseline.',
  'Rest as needed'
),
('btn', 2, 1, 'STRENGTH TEST',
  '[
    {"name": "Deadlift", "testType": "1RM", "warmupProtocol": "Work up gradually", "notes": "Find a challenging single"},
    {"name": "Strict Press", "testType": "1RM", "warmupProtocol": "Work up gradually", "notes": "Find a challenging single"}
  ]'::jsonb,
  'Pulling and pressing strength.',
  'Rest as needed'
),
('btn', 3, 1, 'SKILL CHECK',
  '[
    {"name": "Pull-ups", "testType": "max_reps", "notes": "Any style, max unbroken"},
    {"name": "Push-ups", "testType": "max_reps", "notes": "Strict form, max unbroken"}
  ]'::jsonb,
  'Bodyweight strength assessment.',
  'Rest 3 min between tests'
),
('btn', 4, 1, 'BENCHMARK WOD',
  '[
    {"name": "Cindy", "testType": "amrap_20", "workout": "5 Pull-ups + 10 Push-ups + 15 Air Squats", "notes": "20 min AMRAP. Scale as needed."}
  ]'::jsonb,
  'Classic benchmark to track progress.',
  'Warm up first'
),
('btn', 5, 1, 'AEROBIC TEST',
  '[
    {"name": "2000m Row", "testType": "time", "notes": "Best effort. Record time."},
    {"name": "1 Mile Run", "testType": "time", "notes": "Alternative if no rower"}
  ]'::jsonb,
  'Cardio capacity test. Choose based on equipment.',
  'Light warmup'
);
