-- Fix skill_index for scaling exercises that were NULL
-- These exercises should use the skill_index of the skill they scale for

-- Single Unders scales for Double Unders (skill_index: 0)
UPDATE exercises 
SET skill_index = 0 
WHERE name = 'Single Unders' AND skill_index IS NULL;

-- Bench Dips scales for Push-ups (skill_index: 6)
UPDATE exercises 
SET skill_index = 6 
WHERE name = 'Bench Dips' AND skill_index IS NULL;

-- Hanging Knee Raise scales for Toes to Bar (skill_index: 2)
UPDATE exercises 
SET skill_index = 2 
WHERE name = 'Hanging Knee Raise' AND skill_index IS NULL;

-- Inchworm scales for Wall Walks (skill_index: 14)
UPDATE exercises 
SET skill_index = 14 
WHERE name = 'Inchworm' AND skill_index IS NULL;

-- Dip Bar Dips - scales for Ring Dips (skill_index: 7)
-- This is a judgment call - could also be Strict Ring Dips (8), but Ring Dips is more common
UPDATE exercises 
SET skill_index = 7 
WHERE name = 'Dip Bar Dips' AND skill_index IS NULL;

