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

-- ai_strength_ratios_v1
-- Columns:
--   user_id     integer
--   ratio_key   text   -- e.g., 'front_squat_over_back_squat'
--   value       numeric
--   target      numeric
--   flag        text   -- 'below_target' | 'at_target' | 'above_target'

create or replace view public.ai_strength_ratios_v1
with (security_invoker=true) as
with bw as (
  select user_id, body_weight_lbs from public.ai_user_profile_v1
),
rm as (
  select user_id,
    max(one_rm_lbs) filter (where lift_name='back_squat')     as back_squat,
    max(one_rm_lbs) filter (where lift_name='front_squat')    as front_squat,
    max(one_rm_lbs) filter (where lift_name='snatch')         as snatch,
    max(one_rm_lbs) filter (where lift_name='clean_and_jerk') as clean_and_jerk,
    max(one_rm_lbs) filter (where lift_name='bench_press')    as bench_press,
    max(one_rm_lbs) filter (where lift_name='deadlift')       as deadlift,
    max(one_rm_lbs) filter (where lift_name='strict_press')   as strict_press,
    max(one_rm_lbs) filter (where lift_name='push_press')     as push_press,
    max(one_rm_lbs) filter (where lift_name='power_clean')    as power_clean,
    max(one_rm_lbs) filter (where lift_name='clean_only')     as clean_only,
    max(one_rm_lbs) filter (where lift_name='power_snatch')   as power_snatch,
    max(one_rm_lbs) filter (where lift_name='jerk_only')      as jerk_only
  from public.ai_one_rms_v1
  group by user_id
),
ratios as (
  select
    rm.user_id,
    bw.body_weight_lbs,
    rm.back_squat, rm.front_squat, rm.snatch, rm.clean_and_jerk,
    rm.bench_press, rm.deadlift, rm.strict_press, rm.push_press,
    rm.power_clean, rm.clean_only, rm.power_snatch, rm.jerk_only
  from rm
  left join bw on bw.user_id = rm.user_id
)
select user_id, ratio_key, value, target,
  case when value < target then 'below_target'
       when abs(value - target) <= 0.02 then 'at_target'
       else 'above_target' end as flag
from (
  select user_id, 'front_squat_over_back_squat'::text as ratio_key,
         case when back_squat > 0 then round((front_squat / back_squat)::numeric, 3) else 0 end as value,
         0.85::numeric as target from ratios
  union all
  select user_id, 'snatch_over_back_squat',
         case when back_squat > 0 then round((snatch / back_squat)::numeric, 3) else 0 end,
         0.62 from ratios
  union all
  select user_id, 'cj_over_back_squat',
         case when back_squat > 0 then round((clean_and_jerk / back_squat)::numeric, 3) else 0 end,
         0.74 from ratios
  union all
  select user_id, 'bench_over_bodyweight',
         case when body_weight_lbs > 0 then round((bench_press / body_weight_lbs)::numeric, 3) else 0 end,
         0.90 from ratios
  union all
  select user_id, 'deadlift_over_bodyweight',
         case when body_weight_lbs > 0 then round((deadlift / body_weight_lbs)::numeric, 3) else 0 end,
         2.00 from ratios
  union all
  select user_id, 'push_press_over_strict_press',
         case when strict_press > 0 then round((push_press / strict_press)::numeric, 3) else 0 end,
         1.20 from ratios
  union all
  select user_id, 'power_clean_over_clean_only',
         case when clean_only > 0 then round((power_clean / clean_only)::numeric, 3) else 0 end,
         0.88 from ratios
  union all
  select user_id, 'power_snatch_over_snatch',
         case when snatch > 0 then round((power_snatch / snatch)::numeric, 3) else 0 end,
         0.88 from ratios
  union all
  select user_id, 'jerk_only_over_clean_only',
         case when clean_only > 0 then round((jerk_only / clean_only)::numeric, 3) else 0 end,
         0.90 from ratios
) t
where value > 0;

