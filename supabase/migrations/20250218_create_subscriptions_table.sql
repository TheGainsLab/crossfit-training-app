-- Add is_trial_period column to existing subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS is_trial_period BOOLEAN DEFAULT FALSE;

-- Add index for trial queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial 
ON public.subscriptions(is_trial_period) 
WHERE is_trial_period = TRUE;

