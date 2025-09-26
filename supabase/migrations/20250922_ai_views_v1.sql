-- AI Views v1: user profile and 1RMs (normalized)
-- These are read-only helper views for the coaching assistant. SECURITY INVOKER so RLS applies.

-- ai_user_profile_v1
-- Columns:
--   user_id            integer
--   units              text            -- 'Metric (kg)' or 'Imperial (lbs)'
--   ability_level      text            -- Beginner/Intermediate/Advanced
--   body_weight_lbs    numeric         -- normalized to lbs
--   equipment          text[]          -- ordered array of equipment names

create or replace view public.ai_user_profile_v1
with (security_invoker=true) as
select
  u.id as user_id,
  case when coalesce(u.units, '') ilike '%kg%'
    then 'Metric (kg)'
    else 'Imperial (lbs)'
  end as units,
  coalesce(u.ability_level, 'Intermediate') as ability_level,
  case when coalesce(u.units, '') ilike '%kg%'
    then round((coalesce(u.body_weight, 0)::numeric * 2.20462)::numeric, 2)
    else coalesce(u.body_weight, 0)
  end as body_weight_lbs,
  coalesce(
    (
      select array_agg(e.equipment_name order by e.equipment_name)
      from public.user_equipment e
      where e.user_id = u.id
    ),
    array[]::text[]
  ) as equipment
from public.users u;

-- ai_one_rms_v1
-- Columns:
--   user_id        integer
--   lift_name      text            -- canonical snake_case lift name
--   one_rm_lbs     numeric         -- normalized to lbs

create or replace view public.ai_one_rms_v1
with (security_invoker=true) as
with mapping as (
  select * from (values
    (0, 'snatch'),
    (1, 'clean_and_jerk'),
    (2, 'back_squat'),
    (3, 'front_squat'),
    (4, 'deadlift'),
    (5, 'bench_press'),
    (6, 'strict_press'),
    (7, 'push_press'),
    (8, 'weighted_pullup'),
    (9, 'jerk_only'),
    (10, 'clean_only'),
    (11, 'power_clean'),
    (12, 'power_snatch'),
    (13, 'overhead_squat')
  ) as t(idx, lift_name)
)
select
  u.id as user_id,
  m.lift_name,
  case when coalesce(u.units, '') ilike '%kg%'
    then round((l.one_rm::numeric * 2.20462)::numeric, 2)
    else l.one_rm::numeric
  end as one_rm_lbs
from public.latest_user_one_rms l
join public.users u on u.id = l.user_id
join mapping m on m.idx = l.one_rm_index
where coalesce(l.one_rm, 0) > 0;

