-- Fix unrealistic rep counts in skills exercises program_notes
-- Based on review of all can_be_skills exercises

-- Crossover Double Unders (skill_index 0, Advanced)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Intermediate', '2x15',
  'Advanced', '2x20',
  'Elite', '2x30'
) WHERE name = 'Crossover Double Unders' AND can_be_skills = true;

-- Double Unders (skill_index 0, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x15',
  'Intermediate', '2x25',
  'Advanced', '2x35',
  'Elite', '2x35'
) WHERE name = 'Double Unders' AND can_be_skills = true;

-- Single Unders (skill_index 0, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x15',
  'Intermediate', '2x25',
  'Advanced', '2x35',
  'Elite', '2x35'
) WHERE name = 'Single Unders' AND can_be_skills = true;

-- Wall Balls (skill_index 1, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x15',
  'Intermediate', '2x20',
  'Advanced', '2x25',
  'Elite', '2x25'
) WHERE name = 'Wall Balls' AND can_be_skills = true;

-- Toes to Bar (skill_index 2, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x8',
  'Intermediate', '2x12',
  'Advanced', '2x20',
  'Elite', '2x25'
) WHERE name = 'Toes to Bar' AND can_be_skills = true;

-- Hanging Knee Raise (skill_index 2, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x8',
  'Intermediate', '2x10',
  'Advanced', '2x12',
  'Elite', '2x15'
) WHERE name = 'Hanging Knee Raise' AND can_be_skills = true;

-- Sit-ups (skill_index 2, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x10',
  'Intermediate', '2x10',
  'Advanced', '2x15',
  'Elite', '2x20'
) WHERE name = 'Sit-ups' AND can_be_skills = true;

-- V-ups (skill_index 2, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x10',
  'Intermediate', '2x15',
  'Advanced', '2x20',
  'Elite', '2x20'
) WHERE name = 'V-ups' AND can_be_skills = true;

-- Chest to Bar Pull-ups (skill_index 3, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x8',
  'Intermediate', '2x12',
  'Advanced', '2x20',
  'Elite', '2x25'
) WHERE name = 'Chest to Bar Pull-ups' AND can_be_skills = true;

-- Pull-ups kipping or butterfly (skill_index 3, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x8',
  'Intermediate', '2x12',
  'Advanced', '2x20',
  'Elite', '2x25'
) WHERE name = 'Pull-ups (kipping or butterfly)' AND can_be_skills = true;

-- Negative Pull-ups (skill_index 5, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x2',
  'Intermediate', '3x2',
  'Advanced', '3x3',
  'Elite', '3x3'
) WHERE name = 'Negative Pull-ups' AND can_be_skills = true;

-- Push-ups (skill_index 6, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x8',
  'Intermediate', '2x12',
  'Advanced', '2x20',
  'Elite', '2x25'
) WHERE name = 'Push-ups' AND can_be_skills = true;

-- Bench Dips (skill_index 6, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x5',
  'Intermediate', '2x8',
  'Advanced', '2x12',
  'Elite', '2x15'
) WHERE name = 'Bench Dips' AND can_be_skills = true;

-- Dip Bar Dips (skill_index 7, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x3',
  'Intermediate', '3x4',
  'Advanced', '2x8',
  'Elite', '2x10'
) WHERE name = 'Dip Bar Dips' AND can_be_skills = true;

-- Strict Ring Dips (skill_index 7, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x3',
  'Intermediate', '3x4',
  'Advanced', '2x8',
  'Elite', '2x12'
) WHERE name = 'Strict Ring Dips' AND can_be_skills = true;

-- Ring Dips (skill_index 7, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x3',
  'Intermediate', '2x6',
  'Advanced', '2x10',
  'Elite', '2x15'
) WHERE name = 'Ring Dips' AND can_be_skills = true;

-- Deficit Handstand Push-ups 4" (skill_index 9, Advanced)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x2',
  'Intermediate', '3x4',
  'Advanced', '2x8',
  'Elite', '2x12'
) WHERE name = 'Deficit Handstand Push-ups (4")' AND can_be_skills = true;

-- Handstand Push-ups (skill_index 9, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x4',
  'Intermediate', '2x10',
  'Advanced', '2x15',
  'Elite', '2x20'
) WHERE name = 'Handstand Push-ups' AND can_be_skills = true;

-- Strict Handstand Push-ups (skill_index 9, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x3',
  'Intermediate', '2x6',
  'Advanced', '2x10',
  'Elite', '2x15'
) WHERE name = 'Strict Handstand Push-ups' AND can_be_skills = true;

-- Wall Facing Handstand Push-ups (skill_index 9, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x3',
  'Intermediate', '2x6',
  'Advanced', '2x10',
  'Elite', '2x15'
) WHERE name = 'Wall Facing Handstand Push-ups' AND can_be_skills = true;

-- Strict Deficit Handstand Push-ups (skill_index 11, Elite)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x2',
  'Intermediate', '2x4',
  'Advanced', '3x5',
  'Elite', '2x10'
) WHERE name = 'Strict Deficit Handstand Push-ups' AND can_be_skills = true;

-- Alternating Pistols (skill_index 12, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x8',
  'Intermediate', '2x8',
  'Advanced', '2x20',
  'Elite', '2x25'
) WHERE name = 'Alternating Pistols' AND can_be_skills = true;

-- Air Squats (skill_index 12, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x12',
  'Intermediate', '2x20',
  'Advanced', '2x20',
  'Elite', '2x25'
) WHERE name = 'Air Squats' AND can_be_skills = true;

-- GHD Sit-ups (skill_index 13, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x8',
  'Intermediate', '2x12',
  'Advanced', '2x20',
  'Elite', '2x25'
) WHERE name = 'GHD Sit-ups' AND can_be_skills = true;

-- Wall Walks (skill_index 14, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x2',
  'Intermediate', '3x4',
  'Advanced', '2x6',
  'Elite', '2x8'
) WHERE name = 'Wall Walks' AND can_be_skills = true;

-- Inchworm (skill_index 14, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x2',
  'Intermediate', '3x3',
  'Advanced', '2x5',
  'Elite', '2x6'
) WHERE name = 'Inchworm' AND can_be_skills = true;

-- Strict Ring Muscle Ups (skill_index 15, Elite)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '4x1',
  'Intermediate', '2x3',
  'Advanced', '3x3',
  'Elite', '3x4'
) WHERE name = 'Strict Ring Muscle Ups' AND can_be_skills = true;

-- Ring Muscle Ups (skill_index 15, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x2',
  'Intermediate', '3x4',
  'Advanced', '2x8',
  'Elite', '2x10'
) WHERE name = 'Ring Muscle Ups' AND can_be_skills = true;

-- Bar Muscle Ups (skill_index 16, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x2',
  'Intermediate', '3x4',
  'Advanced', '2x8',
  'Elite', '2x10'
) WHERE name = 'Bar Muscle Ups' AND can_be_skills = true;

-- Legless Rope Climbs (skill_index 17, Advanced)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Intermediate', '3x2',
  'Advanced', '3x2',
  'Elite', '2x4'
) WHERE name = 'Legless Rope Climbs' AND can_be_skills = true;

-- Rope Climbs (skill_index 17, Beginner)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '3x3',
  'Intermediate', '2x6',
  'Advanced', '2x8',
  'Elite', '2x10'
) WHERE name = 'Rope Climbs' AND can_be_skills = true;

-- Seated Legless Rope Climbs (skill_index 17, Elite)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '4x1',
  'Intermediate', '2x2',
  'Advanced', '3x2',
  'Elite', '2x35'
) WHERE name = 'Seated Legless Rope Climbs' AND can_be_skills = true;

-- Freestanding Handstand Hold (skill_index 18, Advanced)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Intermediate', '2x30s',
  'Advanced', '2x45s',
  'Elite', '2x60s'
) WHERE name = 'Freestanding Handstand Hold' AND can_be_skills = true;

-- Wall Facing Handstand Hold (skill_index 18, Novice)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Beginner', '2x15s',
  'Intermediate', '2x30s',
  'Advanced', '2x45s',
  'Elite', '2x60s'
) WHERE name = 'Wall Facing Handstand Hold' AND can_be_skills = true;

-- Pegboard Ascent (skill_index 21, Advanced)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Intermediate', '2x2',
  'Advanced', '2x3',
  'Elite', '2x5'
) WHERE name = 'Pegboard Ascent' AND can_be_skills = true;

-- Handstand Walk 10m or 25' (skill_index 22, Intermediate)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Intermediate', '2x2',
  'Advanced', '2x3',
  'Elite', '2x5'
) WHERE name = 'Handstand Walk (10m or 25'')' AND can_be_skills = true;

-- Handstand Walk over Obstacle (skill_index 25, Elite)
UPDATE exercises SET program_notes = jsonb_build_object(
  'Intermediate', '2x2',
  'Advanced', '2x3',
  'Elite', '2x4'
) WHERE name = 'Handstand Walk over Obstacle' AND can_be_skills = true;
