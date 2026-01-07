-- Add absolute weight caps for technical exercises
-- Stored in lbs, converted to kg for metric users in code

ALTER TABLE exercises
ADD COLUMN technical_cap_male INTEGER,
ADD COLUMN technical_cap_female INTEGER;

-- Add comment explaining the columns
COMMENT ON COLUMN exercises.technical_cap_male IS 'Max weight in lbs for male users during technical work (prevents heavy technique drills)';
COMMENT ON COLUMN exercises.technical_cap_female IS 'Max weight in lbs for female users during technical work (prevents heavy technique drills)';
