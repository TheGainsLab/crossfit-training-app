-- Add pre_workout and post_workout to meal_type_enum
-- Create food_favorites table
-- Add auto-favorites trigger

-- Step 1: Add new enum values to meal_type_enum
-- Note: ALTER TYPE ... ADD VALUE cannot be rolled back, so we check first
DO $$
BEGIN
  -- Check if 'pre_workout' exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pre_workout' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'meal_type_enum')
  ) THEN
    ALTER TYPE meal_type_enum ADD VALUE 'pre_workout';
  END IF;

  -- Check if 'post_workout' exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'post_workout' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'meal_type_enum')
  ) THEN
    ALTER TYPE meal_type_enum ADD VALUE 'post_workout';
  END IF;
END $$;

-- Step 2: Create food_favorites table
create table if not exists food_favorites (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  food_id text not null, -- FatSecret food ID (string format)
  food_name text not null,
  serving_id text, -- FatSecret serving ID (optional, for default serving)
  serving_description text, -- Optional serving description
  is_auto_favorite boolean not null default false, -- true if auto-added by trigger
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ensure one favorite per user per food
  unique(user_id, food_id)
);

comment on table food_favorites is 'User favorite foods for quick access';
comment on column food_favorites.food_id is 'FatSecret food ID (string format)';
comment on column food_favorites.is_auto_favorite is 'true if automatically added when food is eaten twice in 5 days';

-- Indexes for food_favorites
create index if not exists idx_food_favorites_user_id on food_favorites(user_id);
create index if not exists idx_food_favorites_user_created on food_favorites(user_id, created_at desc);
create index if not exists idx_food_favorites_auto on food_favorites(user_id, is_auto_favorite) where is_auto_favorite = true;

-- Step 3: Apply updated_at trigger to food_favorites
drop trigger if exists trg_food_favorites_updated_at on food_favorites;
create trigger trg_food_favorites_updated_at
before update on food_favorites
for each row execute procedure set_updated_at();

-- Step 4: Create function to auto-add favorites
-- This function checks if a food was logged twice in the last 5 days
-- and automatically adds it to favorites if not already there
create or replace function auto_add_food_favorite()
returns trigger as $$
declare
  recent_count int;
  existing_favorite_id bigint;
begin
  -- Count how many times this food was logged by this user in the last 5 days
  -- (including the current insert)
  select count(*)
  into recent_count
  from food_entries
  where user_id = new.user_id
    and food_id = new.food_id
    and logged_at >= now() - interval '5 days';

  -- If the food was logged at least twice (including this insert) and not already in favorites
  if recent_count >= 2 then
    -- Check if it's already in favorites
    select id into existing_favorite_id
    from food_favorites
    where user_id = new.user_id
      and food_id = new.food_id;

    -- If not in favorites, add it as an auto-favorite
    if existing_favorite_id is null then
      insert into food_favorites (
        user_id,
        food_id,
        food_name,
        serving_id,
        serving_description,
        is_auto_favorite
      )
      values (
        new.user_id,
        new.food_id,
        new.food_name,
        new.serving_id,
        new.serving_description,
        true -- Mark as auto-favorite
      )
      on conflict (user_id, food_id) do nothing; -- Safety check
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

-- Step 5: Create trigger to auto-add favorites after food entry insert
drop trigger if exists trg_food_entries_auto_favorite on food_entries;
create trigger trg_food_entries_auto_favorite
after insert on food_entries
for each row
execute procedure auto_add_food_favorite();

