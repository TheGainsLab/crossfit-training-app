-- Normalize subscription_status to lowercase for consistent filtering
-- Previously, Stripe webhook wrote UPPERCASE ('ACTIVE', 'PENDING') while
-- RevenueCat wrote lowercase ('active', 'canceled', etc.)
UPDATE users
SET subscription_status = LOWER(subscription_status)
WHERE subscription_status IS NOT NULL
  AND subscription_status <> LOWER(subscription_status);
