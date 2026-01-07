-- Add absolute weight caps for accessory exercises
-- Stored in lbs, converted to kg for metric users in code

ALTER TABLE exercises
ADD COLUMN accessory_cap_male INTEGER,
ADD COLUMN accessory_cap_female INTEGER;

COMMENT ON COLUMN exercises.accessory_cap_male IS 'Max weight in lbs for male users during accessory work (prevents dangerous loads on single-leg, isolation movements)';
COMMENT ON COLUMN exercises.accessory_cap_female IS 'Max weight in lbs for female users during accessory work (prevents dangerous loads on single-leg, isolation movements)';
