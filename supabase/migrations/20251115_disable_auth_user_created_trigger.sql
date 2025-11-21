-- Disable the trigger that automatically creates user records
-- The API now handles user creation with correct subscription tiers (Option B)
-- This prevents duplicate user creation errors for BTN users
-- 
-- Note: We keep on_auth_user_updated enabled to sync email changes

ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
