-- Add unique constraint on (revenuecat_subscriber_id, entitlement_identifier)
-- to prevent duplicate subscription records from concurrent RevenueCat webhook events.
-- Partial index (WHERE both columns are NOT NULL) so Stripe-only rows are unaffected.

-- First, clean up any existing duplicates by keeping only the most recently updated row
DELETE FROM subscriptions a
USING subscriptions b
WHERE a.revenuecat_subscriber_id IS NOT NULL
  AND a.entitlement_identifier IS NOT NULL
  AND a.revenuecat_subscriber_id = b.revenuecat_subscriber_id
  AND a.entitlement_identifier = b.entitlement_identifier
  AND a.updated_at < b.updated_at;

-- Add partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_revenuecat_unique
ON subscriptions (revenuecat_subscriber_id, entitlement_identifier)
WHERE revenuecat_subscriber_id IS NOT NULL AND entitlement_identifier IS NOT NULL;
