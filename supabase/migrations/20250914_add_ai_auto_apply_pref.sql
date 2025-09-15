-- Add user preference for auto-applying low-risk AI recommendations
alter table if exists public.user_preferences
  add column if not exists ai_auto_apply_low_risk boolean not null default false;

