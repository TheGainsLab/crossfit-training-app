-- Add test cycle tracking fields to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS awaiting_test_results BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS awaiting_test_since TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS test_results_submitted_at TIMESTAMPTZ;

-- Add index for cron job queries (find users awaiting test results)
CREATE INDEX IF NOT EXISTS idx_users_awaiting_test
ON public.users(awaiting_test_results, awaiting_test_since)
WHERE awaiting_test_results = TRUE;

-- Add comment explaining the fields
COMMENT ON COLUMN public.users.awaiting_test_results IS 'True when user is in test week window (44 days from cycle end program delivery)';
COMMENT ON COLUMN public.users.awaiting_test_since IS 'Timestamp when test window opened (when cycle-end program was delivered)';
COMMENT ON COLUMN public.users.current_cycle IS 'Current training cycle number (1, 2, 3...). Each cycle is 3 months + test week';
COMMENT ON COLUMN public.users.test_results_submitted_at IS 'Last time user submitted test week results';

-- Create user_notifications table for in-app notifications and feedback notes
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'test_week_results', 'program_ready', 'reminder', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,  -- Additional structured data (changes, program info, etc.)
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Indexes for user_notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id
ON public.user_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
ON public.user_notifications(user_id, read)
WHERE read = FALSE;

-- RLS for user_notifications
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.user_notifications FOR SELECT
USING (user_id IN (
  SELECT id FROM public.users WHERE auth_id = auth.uid()
));

CREATE POLICY "Users can update their own notifications"
ON public.user_notifications FOR UPDATE
USING (user_id IN (
  SELECT id FROM public.users WHERE auth_id = auth.uid()
));

COMMENT ON TABLE public.user_notifications IS 'In-app notifications including test week feedback, program readiness, and reminders';
