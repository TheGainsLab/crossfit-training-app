-- ==============================================
-- Add unique constraint to user_one_rms table
-- ==============================================
-- This migration adds a unique constraint on (user_id, one_rm_index)
-- to allow upsert operations and prevent duplicate 1RM records per user/exercise

-- First, remove any duplicate records that might exist
-- (keeps the most recent record for each user_id + one_rm_index combination)
DELETE FROM user_one_rms a
USING user_one_rms b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.one_rm_index = b.one_rm_index;

-- Add unique constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_one_rms_user_id_one_rm_index_key'
  ) THEN
    ALTER TABLE user_one_rms
    ADD CONSTRAINT user_one_rms_user_id_one_rm_index_key 
    UNIQUE (user_id, one_rm_index);
  END IF;
END $$;

-- Add comment (only if constraint exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_one_rms_user_id_one_rm_index_key'
  ) THEN
    COMMENT ON CONSTRAINT user_one_rms_user_id_one_rm_index_key ON user_one_rms IS 
    'Ensures each user can only have one 1RM record per exercise index, enabling upsert operations';
  END IF;
END $$;
