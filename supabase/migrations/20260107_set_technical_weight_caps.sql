-- Set technical weight caps for all technical exercises
-- Caps are in lbs, converted to kg in code for metric users

-- Back Squat technical drills
UPDATE exercises SET technical_cap_male = 185, technical_cap_female = 135 WHERE name = '1.5 Back Squat';
UPDATE exercises SET technical_cap_male = 165, technical_cap_female = 135 WHERE name = 'Back Squat Hold (:10)';

-- Multi-dependency squat drills
UPDATE exercises SET technical_cap_male = 60, technical_cap_female = 35 WHERE name = '1 Dumbbell O H S';
UPDATE exercises SET technical_cap_male = 60, technical_cap_female = 35 WHERE name = 'Goblet Squat';
UPDATE exercises SET technical_cap_male = 95, technical_cap_female = 65 WHERE name = 'Kang Squat';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Thrusters';

-- Clean and Jerk technical drills
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = '1.5 Squat Clean Thruster';
UPDATE exercises SET technical_cap_male = 185, technical_cap_female = 135 WHERE name = 'Clean (Only)';
UPDATE exercises SET technical_cap_male = 185, technical_cap_female = 135 WHERE name = 'Clean High Pulls';
UPDATE exercises SET technical_cap_male = 185, technical_cap_female = 135 WHERE name = 'Clean Pulls';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Hang Cleans';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Hang Power Cleans';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Jerk - Behind Neck';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Jerk - Dip Pause';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Jerk - Eye Level';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Jerk - Power';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Jerk - Split Pause';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Jerk (Only)';
UPDATE exercises SET technical_cap_male = 165, technical_cap_female = 125 WHERE name = 'Pause Clean Pulls (at knee)';
UPDATE exercises SET technical_cap_male = 165, technical_cap_female = 125 WHERE name = 'Power Clean';
UPDATE exercises SET technical_cap_male = 165, technical_cap_female = 125 WHERE name = 'Power Clean to Front Squat';
UPDATE exercises SET technical_cap_male = 95, technical_cap_female = 65 WHERE name = 'Split Press';

-- Deadlift technical drills
UPDATE exercises SET technical_cap_male = 225, technical_cap_female = 165 WHERE name = 'Halting Deadlift';
UPDATE exercises SET technical_cap_male = 225, technical_cap_female = 165 WHERE name = 'Pause Deadlift';
UPDATE exercises SET technical_cap_male = 225, technical_cap_female = 165 WHERE name = 'Tempo Deadlift (3 sec)';

-- Front Squat technical drills
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = '1.5 Front Squat';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Front Squat Hold (:10)';

-- Press technical drills
UPDATE exercises SET technical_cap_male = 50, technical_cap_female = 35 WHERE name = '1 DB Strict Press';
UPDATE exercises SET technical_cap_male = 35, technical_cap_female = 25 WHERE name = '1 Leg Strict Press';
UPDATE exercises SET technical_cap_male = 50, technical_cap_female = 35 WHERE name = 'Dumbbell Z Press';
UPDATE exercises SET technical_cap_male = 50, technical_cap_female = 35 WHERE name = 'Half-Kneeling DB Strict Press';
UPDATE exercises SET technical_cap_male = 95, technical_cap_female = 65 WHERE name = 'Half-Kneeling Strict Press';
UPDATE exercises SET technical_cap_male = 50, technical_cap_female = 35 WHERE name = 'Seated DB Strict Press';
UPDATE exercises SET technical_cap_male = 95, technical_cap_female = 65 WHERE name = 'Seated Strict Press';
UPDATE exercises SET technical_cap_male = 95, technical_cap_female = 65 WHERE name = 'Tempo Strict Press';
UPDATE exercises SET technical_cap_male = 95, technical_cap_female = 65 WHERE name = 'Z Press';

-- Snatch technical drills
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = '1.5 Overhead Squat';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Hang Snatch';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Overhead Squat Hold (:10)';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Pause Snatch Pulls';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Power Snatch';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Power Snatch to Overhead Squat';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Press Snatch Balance';
UPDATE exercises SET technical_cap_male = 155, technical_cap_female = 115 WHERE name = 'Snatch Balance';
UPDATE exercises SET technical_cap_male = 185, technical_cap_female = 135 WHERE name = 'Snatch High Pulls';
UPDATE exercises SET technical_cap_male = 185, technical_cap_female = 135 WHERE name = 'Snatch Pulls';
UPDATE exercises SET technical_cap_male = 75, technical_cap_female = 55 WHERE name = 'Sotts Press';
UPDATE exercises SET technical_cap_male = 75, technical_cap_female = 55 WHERE name = 'Klokov Press';

-- Overhead Squat (null technical_dependency)
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Overhead Squat';
UPDATE exercises SET technical_cap_male = 135, technical_cap_female = 95 WHERE name = 'Overhead Squat w Pause';
