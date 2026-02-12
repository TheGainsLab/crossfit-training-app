-- Add unique constraint on stripe_subscription_id to prevent duplicate subscription
-- records from race conditions between webhook handlers.
-- Uses a partial index (WHERE stripe_subscription_id IS NOT NULL) so RevenueCat
-- subscriptions (which don't have a stripe_subscription_id) are unaffected.

-- First, clean up any existing duplicates by keeping only the most recently updated row
DELETE FROM subscriptions a
USING subscriptions b
WHERE a.stripe_subscription_id IS NOT NULL
  AND a.stripe_subscription_id = b.stripe_subscription_id
  AND a.updated_at < b.updated_at;

-- Add partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id_unique
ON subscriptions (stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;
