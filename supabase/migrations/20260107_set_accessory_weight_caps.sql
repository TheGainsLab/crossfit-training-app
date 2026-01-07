-- Set accessory weight caps for all accessory exercises with one_rm_reference
-- Caps are in lbs, converted to kg in code for metric users

-- Leg Strength
UPDATE exercises SET accessory_cap_male = 135, accessory_cap_female = 95 WHERE name = 'Axle Front Rack Lunge';
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 115 WHERE name = 'Back Rack Split Squat';
UPDATE exercises SET accessory_cap_male = 70, accessory_cap_female = 50 WHERE name = 'Dumbbell Overhead Walking Lunges';
UPDATE exercises SET accessory_cap_male = 70, accessory_cap_female = 50 WHERE name = 'Dumbbell Walking Lunges';
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 115 WHERE name = 'Front Rack Split Squat';
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 115 WHERE name = 'Front Rack Walking Lunges';
UPDATE exercises SET accessory_cap_male = 135, accessory_cap_female = 95 WHERE name = 'Overhead Split Squat';
UPDATE exercises SET accessory_cap_male = 135, accessory_cap_female = 95 WHERE name = 'Overhead Walking Lunges';

-- Posterior Chain
UPDATE exercises SET accessory_cap_male = 185, accessory_cap_female = 135 WHERE name = '1 Leg Deadlift';
UPDATE exercises SET accessory_cap_male = 315, accessory_cap_female = 225 WHERE name = 'Clean Pull - Knee Pass';
UPDATE exercises SET accessory_cap_male = 100, accessory_cap_female = 70 WHERE name = 'Dumbbell Deadlift';
UPDATE exercises SET accessory_cap_male = 165, accessory_cap_female = 115 WHERE name = 'Good Morning';
UPDATE exercises SET accessory_cap_male = 315, accessory_cap_female = 225 WHERE name = 'Halting Deadlift' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 315, accessory_cap_female = 225 WHERE name = 'Romanian Deadlift';
UPDATE exercises SET accessory_cap_male = 315, accessory_cap_female = 225 WHERE name = 'Snatch Grip Deadlift';
UPDATE exercises SET accessory_cap_male = 315, accessory_cap_female = 225 WHERE name = 'Snatch Pull - Knee Pass';

-- Upper Back
UPDATE exercises SET accessory_cap_male = 275, accessory_cap_female = 205 WHERE name = 'Barbell Row';
UPDATE exercises SET accessory_cap_male = 100, accessory_cap_female = 70 WHERE name = 'Dumbbell Rows';
UPDATE exercises SET accessory_cap_male = 100, accessory_cap_female = 70 WHERE name = 'Dumbbell Shrugs';
UPDATE exercises SET accessory_cap_male = 225, accessory_cap_female = 165 WHERE name = 'Farmers Carry';
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 115 WHERE name = 'Jefferson Curl';

-- Upper Body Pressing
UPDATE exercises SET accessory_cap_male = 60, accessory_cap_female = 40 WHERE name = '1 DB Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 50, accessory_cap_female = 35 WHERE name = '1 Leg Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 135, accessory_cap_female = 95 WHERE name = 'Axle Shoulder to Overhead';
UPDATE exercises SET accessory_cap_male = 225, accessory_cap_female = 165 WHERE name = 'Bottom up Bench Press';
UPDATE exercises SET accessory_cap_male = 100, accessory_cap_female = 70 WHERE name = 'Dumbbell Bench Press';
UPDATE exercises SET accessory_cap_male = 70, accessory_cap_female = 50 WHERE name = 'Dumbbell Push Press';
UPDATE exercises SET accessory_cap_male = 60, accessory_cap_female = 40 WHERE name = 'Dumbbell Strict Press';
UPDATE exercises SET accessory_cap_male = 70, accessory_cap_female = 50 WHERE name = 'Dumbbell Z Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 60, accessory_cap_female = 40 WHERE name = 'Half-Kneeling DB Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 115 WHERE name = 'Half-Kneeling Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 185, accessory_cap_female = 135 WHERE name = 'Narrow Grip BP';
UPDATE exercises SET accessory_cap_male = 185, accessory_cap_female = 135 WHERE name = 'Negative Bench Press';
UPDATE exercises SET accessory_cap_male = 60, accessory_cap_female = 40 WHERE name = 'Negative Dumbbell Bench';
UPDATE exercises SET accessory_cap_male = 60, accessory_cap_female = 40 WHERE name = 'Seated DB Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 135, accessory_cap_female = 95 WHERE name = 'Seated Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 95 WHERE name = 'Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 115 WHERE name = 'Tempo Strict Press' AND can_be_accessories = true;
UPDATE exercises SET accessory_cap_male = 155, accessory_cap_female = 115 WHERE name = 'Z Press' AND can_be_accessories = true;

-- Upper Body Pulling
UPDATE exercises SET accessory_cap_male = 50, accessory_cap_female = 35 WHERE name = 'Weighted Pull Ups';
