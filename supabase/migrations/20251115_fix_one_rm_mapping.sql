-- Fix ai_one_rms_v1 view mapping to match intake form order
-- The previous mapping was incorrect, causing wrong 1RM values to be sent to AI

create or replace view public.ai_one_rms_v1
with (security_invoker=true) as
with mapping as (
  select * from (values
    (0, 'snatch'),                    -- Snatch
    (1, 'power_snatch'),              -- Power Snatch
    (2, 'clean_and_jerk'),            -- Clean and Jerk
    (3, 'power_clean'),               -- Power Clean
    (4, 'clean_only'),                -- Clean (clean only)
    (5, 'jerk_only'),                 -- Jerk (from rack or blocks...)
    (6, 'back_squat'),                -- Back Squat
    (7, 'front_squat'),               -- Front Squat
    (8, 'overhead_squat'),            -- Overhead Squat
    (9, 'deadlift'),                  -- Deadlift
    (10, 'bench_press'),              -- Bench Press
    (11, 'push_press'),               -- Push Press
    (12, 'strict_press'),             -- Strict Press
    (13, 'weighted_pullup')           -- Weighted Pullup
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

