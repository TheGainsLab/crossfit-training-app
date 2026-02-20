-- Account deletion RPC (Apple Guideline 5.1.1v)
-- Deletes all user data in a single transaction so it's all-or-nothing.
-- Called from the mobile client: supabase.rpc('delete_user_account')

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer  -- runs with table-owner privileges so RLS doesn't block deletes
as $$
declare
  v_user_id   bigint;
  v_auth_id   uuid := auth.uid();
  v_conv_ids  uuid[];
begin
  -- Resolve the internal user id
  select id into v_user_id
    from public.users
   where auth_id = v_auth_id;

  if v_user_id is null then
    raise exception 'User record not found for auth_id %', v_auth_id;
  end if;

  -- Collect conversation ids for cascading message deletes
  select coalesce(array_agg(id), '{}')
    into v_conv_ids
    from public.support_conversations
   where user_id = v_user_id;

  -- 1. Support / chat
  delete from public.support_messages
   where conversation_id = any(v_conv_ids);
  delete from public.support_conversations
   where user_id = v_user_id;

  -- 2. Nutrition (child → parent)
  delete from public.meal_template_items  where user_id = v_user_id;
  delete from public.meal_templates       where user_id = v_user_id;
  delete from public.food_entries          where user_id = v_user_id;
  delete from public.food_favorites        where user_id = v_user_id;
  delete from public.favorite_restaurants  where user_id = v_user_id;
  delete from public.hidden_restaurants    where user_id = v_user_id;
  delete from public.favorite_brands       where user_id = v_user_id;
  delete from public.hidden_brands         where user_id = v_user_id;

  -- 3. Training / workout data
  delete from public.performance_logs   where user_id = v_user_id;
  delete from public.workout_sessions   where user_id = v_user_id;
  delete from public.program_metcons    where user_id = v_user_id;
  delete from public.programs           where user_id = v_user_id;

  -- 4. Engine-specific data
  delete from public.engine_program_day_assignments where user_id = v_user_id;
  delete from public.time_trials                    where user_id = v_user_id;
  delete from public.user_modality_preferences      where user_id = v_user_id;
  delete from public.user_performance_metrics       where user_id = v_user_id;

  -- 5. User preferences & profile
  delete from public.user_equipment   where user_id = v_user_id;
  delete from public.user_one_rms     where user_id = v_user_id;
  delete from public.user_skills      where user_id = v_user_id;
  delete from public.user_preferences where user_id = v_user_id;
  delete from public.user_profiles    where user_id = v_user_id;
  delete from public.intake_drafts    where user_id = v_user_id;

  -- 6. Subscriptions
  delete from public.subscriptions where user_id = v_user_id;

  -- 7. Delete the parent users row
  delete from public.users where id = v_user_id;

  -- 8. Delete the auth user (removes from auth.users)
  -- This is safe because security definer gives us superuser-level access
  delete from auth.users where id = v_auth_id;
end;
$$;

-- Only authenticated users can call this, and auth.uid() scopes it to themselves
revoke all on function public.delete_user_account() from anon;
grant execute on function public.delete_user_account() to authenticated;
