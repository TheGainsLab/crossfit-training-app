-- Drop unused function with backwards logic
-- This function was never called by the application
-- The web app correctly uses direct multiplication of rolling_avg_ratio instead

DROP FUNCTION IF EXISTS get_engine_adjusted_target(BIGINT, VARCHAR, VARCHAR, DECIMAL);

