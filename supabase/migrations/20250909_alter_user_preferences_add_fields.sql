-- Extend user_preferences with planning fields
alter table user_preferences
  add column if not exists training_days_per_week int default 5,
  add column if not exists primary_strength_lifts text[],
  add column if not exists emphasized_strength_lifts text[];

-- Basic sanity: clamp invalid frequencies on read paths in app logic (not enforced here)
