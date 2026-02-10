-- Enable Row Level Security on subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read only their own subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));
