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
  case when value < target then 'below_target' else 'above_target' end as flag
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

-- ai_strength_summary_v1 (last 56 days)
-- Aggregated per user and exercise within a rolling window
-- Columns: user_id, exercise_name, distinct_days_in_range, avg_rpe, max_weight_lbs,
--          avg_top_set_weight_lbs, total_sets, total_reps, total_volume_lbs, last_session_at

create or replace view public.ai_strength_summary_v1
with (security_invoker=true) as
with base as (
  select
    pl.user_id,
    pl.exercise_name,
    pl.logged_at::date as d,
    pl.logged_at,
    pl.rpe,
    pl.completion_quality,
    -- parse sets
    coalesce(nullif(regexp_replace(coalesce(pl.sets::text, ''), '[^0-9]', '', 'g'), '')::int, 1) as sets_n,
    -- parse reps (prefer high end of ranges like 8-10)
    coalesce((regexp_match(coalesce(pl.reps::text,''), '(\d+)\s*[-–]\s*(\d+)'))[2]::int,
             nullif(regexp_replace(coalesce(pl.reps::text,''), '[^0-9]', '', 'g'), '')::int, 0) as reps_n,
    -- parse weight/time as weight, skip if looks like time (contains ':')
    case when coalesce(pl.weight_time::text,'') like '%:%' then 0
         else coalesce(nullif(regexp_replace(coalesce(pl.weight_time::text,''), '[^0-9\.]', '', 'g'), '')::numeric, 0)
    end as raw_weight,
    u.units
  from public.performance_logs pl
  join public.users u on u.id = pl.user_id
  where pl.block = 'STRENGTH AND POWER'
    and pl.logged_at >= now() - interval '56 days'
), base2 as (
  select *,
    case when coalesce(units,'') ilike '%kg%'
         then round((raw_weight * 2.20462)::numeric, 2)
         else raw_weight end as weight_lbs
  from base
), day_max as (
  select user_id, exercise_name, d, max(weight_lbs) as day_max_weight
  from base2
  group by user_id, exercise_name, d
)
select
  b.user_id,
  b.exercise_name,
  count(distinct b.d) as distinct_days_in_range,
  round(avg(nullif(b.rpe,0))::numeric, 2) as avg_rpe,
  round(avg(nullif(b.completion_quality,0))::numeric, 2) as avg_quality,
  max(b.weight_lbs) as max_weight_lbs,
  round(avg(dm.day_max_weight)::numeric, 2) as avg_top_set_weight_lbs,
  sum(b.sets_n) as total_sets,
  sum(b.sets_n * b.reps_n) as total_reps,
  sum((b.sets_n * b.reps_n) * b.weight_lbs) as total_volume_lbs,
  max(b.logged_at) as last_session_at
from base2 b
left join day_max dm on dm.user_id = b.user_id and dm.exercise_name = b.exercise_name and dm.d = b.d
group by b.user_id, b.exercise_name;

-- ai_skills_summary_v1 (last 56 days)
-- Columns: user_id, skill_name, distinct_days_in_range, avg_rpe, avg_quality, total_sets, total_reps, last_date

create or replace view public.ai_skills_summary_v1
with (security_invoker=true) as
with base as (
  select
    pl.user_id,
    pl.exercise_name as skill_name,
    pl.logged_at::date as d,
    pl.rpe,
    pl.completion_quality,
    coalesce(nullif(regexp_replace(coalesce(pl.sets::text, ''), '[^0-9]', '', 'g'), '')::int, 1) as sets_n,
    coalesce((regexp_match(coalesce(pl.reps::text,''), '(\d+)\s*[-–]\s*(\d+)'))[2]::int,
             nullif(regexp_replace(coalesce(pl.reps::text,''), '[^0-9]', '', 'g'), '')::int, 0) as reps_n,
    pl.logged_at
  from public.performance_logs pl
  where pl.block = 'SKILLS'
    and pl.logged_at >= now() - interval '56 days'
)
select
  user_id,
  skill_name,
  count(distinct d) as distinct_days_in_range,
  round(avg(nullif(rpe,0))::numeric, 2) as avg_rpe,
  round(avg(nullif(completion_quality,0))::numeric, 2) as avg_quality,
  sum(sets_n) as total_sets,
  sum(sets_n * reps_n) as total_reps,
  max(logged_at)::timestamp as last_date
from base
group by user_id, skill_name;

-- ai_metcons_summary_v1 (last 56 days)
-- Columns: user_id, completions, avg_percentile

create or replace view public.ai_metcons_summary_v1
with (security_invoker=true) as
select
  p.user_id,
  count(*)::int as completions,
  case when count(*) > 0 then round(avg(pm.percentile)::numeric, 2) else null end as avg_percentile
from public.program_metcons pm
join public.programs p on p.id = pm.program_id
where pm.completed_at is not null
  and pm.completed_at >= now() - interval '56 days'
group by p.user_id;

-- ai_metcon_heatmap_v1 (last 56 days) - detailed per completion rows
-- Columns: user_id, week, completed_at, time_range, percentile, level, required_equipment, workout_id, format, workout_notes, tasks

create or replace view public.ai_metcon_heatmap_v1
with (security_invoker=true) as
select
  p.user_id,
  pm.week,
  pm.completed_at,
  m.time_range,
  pm.percentile,
  m.level,
  m.required_equipment,
  m.workout_id,
  m.format,
  m.workout_notes,
  m.tasks
from public.program_metcons pm
join public.programs p on p.id = pm.program_id
left join public.metcons m on m.id = pm.metcon_id
where pm.completed_at is not null
  and pm.completed_at >= now() - interval '56 days';

-- ai_upcoming_program_v1 (uncompleted days from latest program)
-- Columns: user_id, program_id, week, day, block, exercises jsonb, metcon jsonb

create or replace view public.ai_upcoming_program_v1
with (security_invoker=true) as
with latest as (
  select distinct on (p.user_id) p.user_id, p.id as program_id, p.program_data
  from public.programs p
  order by p.user_id, p.id desc
),
weeks as (
  select l.user_id, l.program_id, w as week_json
  from latest l,
  jsonb_array_elements((l.program_data::jsonb)->'weeks') as w
),
days as (
  select user_id, program_id, (week_json->>'week')::int as week, d as day_json
  from weeks,
  jsonb_array_elements(week_json->'days') as d
),
completed as (
  select pl.user_id, pl.program_id, pl.week, pl.day
  from public.performance_logs pl
  where pl.program_id is not null
  union
  select p.user_id, pm.program_id, pm.week, pm.day
  from public.program_metcons pm
  join public.programs p on p.id = pm.program_id
  where pm.completed_at is not null
),
upcoming as (
  select d.user_id, d.program_id, d.week, (d.day_json->>'day')::int as day, d.day_json
  from days d
  left join completed c on c.user_id = d.user_id and c.program_id = d.program_id and c.week = (d.week) and c.day = (d.day_json->>'day')::int
  where c.user_id is null
),
blocks as (
  select user_id, program_id, week, day,
         jsonb_array_elements(day_json->'blocks') as block_json
  from upcoming
)
select
  user_id,
  program_id,
  week,
  day,
  coalesce(block_json->>'blockName', block_json->>'block') as block,
  (block_json->'exercises') as exercises,
  case when block_json ? 'metconData' then jsonb_build_object(
    'workout_id', (block_json->'metconData'->>'workoutId'),
    'format', (block_json->'metconData'->>'workoutFormat'),
    'time_range', (block_json->'metconData'->>'timeRange'),
    'level', (block_json->'metconData'->>'level'),
    'required_equipment', (block_json->'metconData'->'requiredEquipment')
  ) else null end as metcon
from blocks;

