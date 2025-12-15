-- ==============================================
-- Setup webhook trigger for program_generation_jobs
-- ==============================================
-- This migration sets up automatic triggering of the program-generation-worker
-- edge function when new jobs are inserted with status = 'pending'

-- Enable pg_net extension (for HTTP requests from database)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable pg_cron extension (for backup cron job)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to invoke worker with job_id
-- Uses Supabase Vault to get service role key securely
CREATE OR REPLACE FUNCTION trigger_program_worker()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT := 'https://onulmoxjoynunzctzsug.supabase.co';
  service_key TEXT;
  worker_url TEXT;
  response_id BIGINT;
BEGIN
  -- Only trigger for pending jobs
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Try to get service role key from vault first, then settings, then fallback
  BEGIN
    -- Try vault (if available)
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to settings
    BEGIN
      service_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      -- Last resort: log warning and return (don't fail the insert)
      RAISE WARNING 'Service role key not found in vault or settings. Webhook trigger will not work.';
      RETURN NEW;
    END;
  END;

  -- Construct worker URL
  worker_url := supabase_url || '/functions/v1/program-generation-worker';

  -- Make async HTTP POST request to worker with job_id
  SELECT net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('job_id', NEW.id)
  ) INTO response_id;

  -- Log the trigger (optional - can be removed in production)
  RAISE NOTICE 'Triggered worker for job_id: %, response_id: %', NEW.id, response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to trigger worker for job_id %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS on_job_inserted ON program_generation_jobs;
DROP TRIGGER IF EXISTS trg_program_generation_jobs_webhook ON program_generation_jobs;

-- Create trigger on job insert
CREATE TRIGGER trg_program_generation_jobs_webhook
  AFTER INSERT ON program_generation_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_program_worker();

COMMENT ON FUNCTION trigger_program_worker() IS 
  'Triggers program-generation-worker edge function when a new pending job is inserted';

COMMENT ON TRIGGER trg_program_generation_jobs_webhook ON program_generation_jobs IS 
  'Automatically triggers worker when new pending jobs are inserted';
