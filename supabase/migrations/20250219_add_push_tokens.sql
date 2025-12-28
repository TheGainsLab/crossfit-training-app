-- Add push token support for mobile push notifications
-- Enables sending notifications when coaches message athletes

-- Add push token columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS push_token TEXT,
ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- Index for efficient push token lookups
CREATE INDEX IF NOT EXISTS idx_users_push_token 
ON public.users(push_token) 
WHERE push_token IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.users.push_token IS 'Expo push notification token for mobile app';
COMMENT ON COLUMN public.users.push_token_updated_at IS 'Timestamp when push token was last updated';

