-- Create nutrition tracking tables for FatSecret integration
-- Migration: create_nutrition_tables

-- Meal type enum for data integrity
create type meal_type_enum as enum ('breakfast', 'lunch', 'dinner', 'snack', 'other');

-- Food entries: Individual food log entries for users
create table if not exists food_entries (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  food_id text not null, -- FatSecret food ID (string format)
  cached_food_id bigint references cached_foods(id) on delete set null,
  food_name text not null,
  serving_id text not null, -- FatSecret serving ID (string format)
  serving_description text,
  number_of_units numeric(6,2) not null default 1,
  -- Macronutrients (stored as numeric, parsed from FatSecret strings)
  calories numeric(8,2),
  protein numeric(6,2), -- grams
  carbohydrate numeric(6,2), -- grams (FatSecret uses "carbohydrate" not "carbs")
  fat numeric(6,2), -- grams
  fiber numeric(6,2), -- grams
  sugar numeric(6,2), -- grams
  -- Micronutrients
  sodium numeric(8,2), -- mg
  -- Metadata
  meal_type meal_type_enum,
  notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Validation constraints
  constraint chk_positive_nutrition check (
    calories >= 0 and 
    protein >= 0 and 
    carbohydrate >= 0 and 
    fat >= 0 and 
    number_of_units > 0
  )
);

comment on table food_entries is 'Individual food log entries for users';
comment on column food_entries.food_id is 'FatSecret food ID (string format)';
comment on column food_entries.serving_id is 'FatSecret serving ID (string format)';
comment on column food_entries.carbohydrate is 'Carbs in grams (FatSecret field name: carbohydrate)';

-- Indexes for food_entries
create index if not exists idx_food_entries_user_id on food_entries(user_id);
create index if not exists idx_food_entries_logged_at on food_entries(user_id, logged_at desc);
create index if not exists idx_food_entries_date on food_entries(user_id, date(logged_at) desc);
create index if not exists idx_food_entries_cached_food on food_entries(cached_food_id) where cached_food_id is not null;

-- Cached foods: Reduce API calls by storing frequently accessed foods
create table if not exists cached_foods (
  id bigserial primary key,
  fatsecret_id text unique not null, -- FatSecret food ID (string format)
  name text not null,
  brand_name text,
  food_type text, -- Generic, Brand, Recipe
  -- Full nutrition data as JSONB (stores all servings and nutrients)
  nutrition_data jsonb not null, -- Full food.get response
  -- Cache metadata
  last_accessed_at timestamptz default now(),
  access_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table cached_foods is 'Cached food data from FatSecret API to reduce API calls';
comment on column cached_foods.fatsecret_id is 'FatSecret food ID (string format)';
comment on column cached_foods.nutrition_data is 'Full FatSecret food.get response stored as JSONB';

-- Indexes for cached_foods
create index if not exists idx_cached_foods_fatsecret_id on cached_foods(fatsecret_id);
create index if not exists idx_cached_foods_name_search on cached_foods using gin(to_tsvector('english', name));
create index if not exists idx_cached_foods_last_accessed on cached_foods(last_accessed_at desc);

-- Daily nutrition summaries: Aggregated daily totals
create table if not exists daily_nutrition (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  date date not null,
  -- Totals from food entries
  total_calories numeric(8,2) default 0,
  total_protein numeric(6,2) default 0, -- grams
  total_carbohydrate numeric(6,2) default 0, -- grams (matches FatSecret field name)
  total_fat numeric(6,2) default 0, -- grams
  total_fiber numeric(6,2) default 0, -- grams
  total_sugar numeric(6,2) default 0, -- grams
  total_sodium numeric(8,2) default 0, -- mg
  -- Calculated fields
  tdee_estimate numeric(8,2), -- Total Daily Energy Expenditure estimate
  bmr_estimate numeric(8,2), -- Basal Metabolic Rate estimate
  surplus_deficit numeric(8,2), -- calories - tdee_estimate (positive = surplus, negative = deficit)
  -- Exercise integration
  exercise_calories_burned numeric(8,2) default 0, -- From workout logs
  adjusted_tdee numeric(8,2), -- TDEE + exercise calories
  net_calories numeric(8,2), -- intake - burned
  -- Metadata
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

comment on table daily_nutrition is 'Daily aggregated nutrition summaries per user';
comment on column daily_nutrition.total_carbohydrate is 'Total carbs in grams (matches FatSecret field name)';
comment on column daily_nutrition.exercise_calories_burned is 'Calories burned from workouts (from workout_calories table)';
comment on column daily_nutrition.net_calories is 'Net calories: total_calories - exercise_calories_burned';

-- Indexes for daily_nutrition
create index if not exists idx_daily_nutrition_user_id on daily_nutrition(user_id);
create index if not exists idx_daily_nutrition_date on daily_nutrition(user_id, date desc);
create index if not exists idx_daily_nutrition_user_date on daily_nutrition(user_id, date);

-- Trigger function to auto-update updated_at (reuse existing if available)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
drop trigger if exists trg_food_entries_updated_at on food_entries;
create trigger trg_food_entries_updated_at
before update on food_entries
for each row execute procedure set_updated_at();

drop trigger if exists trg_cached_foods_updated_at on cached_foods;
create trigger trg_cached_foods_updated_at
before update on cached_foods
for each row execute procedure set_updated_at();

drop trigger if exists trg_daily_nutrition_updated_at on daily_nutrition;
create trigger trg_daily_nutrition_updated_at
before update on daily_nutrition
for each row execute procedure set_updated_at();

-- Function to update cached_foods access tracking
create or replace function update_cached_food_access()
returns trigger as $$
begin
  update cached_foods
  set last_accessed_at = now(),
      access_count = access_count + 1
  where id = new.cached_food_id;
  return new;
end;
$$ language plpgsql;

-- Trigger to track cache hits
drop trigger if exists trg_food_entries_cache_access on food_entries;
create trigger trg_food_entries_cache_access
after insert on food_entries
for each row
when (new.cached_food_id is not null)
execute procedure update_cached_food_access();

-- Function to auto-update daily_nutrition when food_entries change
-- FIXED: Handles INSERT, UPDATE, and DELETE operations
create or replace function update_daily_nutrition()
returns trigger as $$
declare
  entry_date date;
  target_user_id bigint;
begin
  -- Handle INSERT/UPDATE vs DELETE
  if tg_op = 'DELETE' then
    entry_date := date(old.logged_at);
    target_user_id := old.user_id;
  else
    entry_date := date(new.logged_at);
    target_user_id := new.user_id;
  end if;
  
  -- Find or create daily_nutrition record (only on INSERT)
  if tg_op = 'INSERT' then
    insert into daily_nutrition (user_id, date)
    values (target_user_id, entry_date)
    on conflict (user_id, date) do nothing;
  end if;
  
  -- Recalculate totals for this date
  update daily_nutrition
  set
    total_calories = (
      select coalesce(sum(calories), 0)
      from food_entries
      where user_id = target_user_id
        and date(logged_at) = entry_date
    ),
    total_protein = (
      select coalesce(sum(protein), 0)
      from food_entries
      where user_id = target_user_id
        and date(logged_at) = entry_date
    ),
    total_carbohydrate = (
      select coalesce(sum(carbohydrate), 0)
      from food_entries
      where user_id = target_user_id
        and date(logged_at) = entry_date
    ),
    total_fat = (
      select coalesce(sum(fat), 0)
      from food_entries
      where user_id = target_user_id
        and date(logged_at) = entry_date
    ),
    total_fiber = (
      select coalesce(sum(fiber), 0)
      from food_entries
      where user_id = target_user_id
        and date(logged_at) = entry_date
    ),
    total_sugar = (
      select coalesce(sum(sugar), 0)
      from food_entries
      where user_id = target_user_id
        and date(logged_at) = entry_date
    ),
    total_sodium = (
      select coalesce(sum(sodium), 0)
      from food_entries
      where user_id = target_user_id
        and date(logged_at) = entry_date
    ),
    updated_at = now()
  where user_id = target_user_id
    and date = entry_date;
  
  return coalesce(new, old);
end;
$$ language plpgsql;

-- Trigger to auto-update daily summaries (handles INSERT, UPDATE, DELETE)
drop trigger if exists trg_food_entries_update_daily on food_entries;
create trigger trg_food_entries_update_daily
after insert or update or delete on food_entries
for each row execute procedure update_daily_nutrition();
