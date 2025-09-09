create table if not exists user_preferences (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  three_month_goals text,
  monthly_primary_goal text,
  preferred_metcon_exercises jsonb,
  avoided_exercises jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_preferences_user_id on user_preferences(user_id);

-- Trigger to auto-update updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_preferences_updated_at on user_preferences;
create trigger trg_user_preferences_updated_at
before update on user_preferences
for each row execute procedure set_updated_at();
