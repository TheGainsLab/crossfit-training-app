import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params
    const supabase = await createClient()

    // Authenticate
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permission
    const userIsAdmin = await isAdmin(supabase, userId)
    if (!userIsAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const targetId = parseInt(targetUserId)
    if (isNaN(targetId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Fetch user data - only select columns that exist in users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        ability_level,
        subscription_tier,
        subscription_status,
        created_at,
        auth_id,
        current_program
      `)
      .eq('id', targetId)
      .single()

    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch subscription data
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`
        id,
        status,
        is_trial_period,
        plan,
        entitlement_identifier,
        billing_interval,
        subscription_start,
        current_period_end,
        canceled_at,
        platform
      `)
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Fetch performance logs for engagement data
    const [perfLogsResult, workouts7dResult, workouts30dResult, recentWorkoutsResult, notesResult] = await Promise.all([
      // Last activity
      supabase
        .from('performance_logs')
        .select('logged_at')
        .eq('user_id', targetId)
        .order('logged_at', { ascending: false })
        .limit(1),

      // Workouts in last 7 days
      supabase
        .from('performance_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetId)
        .gte('logged_at', sevenDaysAgo.toISOString()),

      // Workouts in last 30 days
      supabase
        .from('performance_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetId)
        .gte('logged_at', thirtyDaysAgo.toISOString()),

      // All workouts (no limit for admin analytics)
      supabase
        .from('performance_logs')
        .select('id, logged_at, exercise_name, block, rpe, week, day, program_id')
        .eq('user_id', targetId)
        .order('logged_at', { ascending: false }),

      // Admin notes
      supabase
        .from('admin_notes')
        .select(`
          id,
          content,
          created_at,
          admin:users!admin_notes_admin_id_fkey(name)
        `)
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })
    ])

    // Also check workout_sessions for Engine users
    const { data: workoutSessions } = await supabase
      .from('workout_sessions')
      .select('date')
      .eq('user_id', targetId)
      .order('date', { ascending: false })
      .limit(1)

    // Fetch all ENGINE workout sessions with full details (no limit for admin analytics)
    const { data: recentEngineSessions } = await supabase
      .from('workout_sessions')
      .select(`
        id,
        date,
        day_type,
        modality,
        total_output,
        actual_pace,
        target_pace,
        performance_ratio,
        total_work_seconds,
        total_rest_seconds,
        peak_heart_rate,
        average_heart_rate,
        perceived_exertion,
        units,
        completed
      `)
      .eq('user_id', targetId)
      .eq('completed', true)
      .order('date', { ascending: false })

    // Calculate last activity
    let lastActivity: Date | null = null

    if (perfLogsResult.data?.[0]?.logged_at) {
      lastActivity = new Date(perfLogsResult.data[0].logged_at)
    }

    if (workoutSessions?.[0]?.date) {
      const sessionDate = new Date(workoutSessions[0].date)
      if (!lastActivity || sessionDate > lastActivity) {
        lastActivity = sessionDate
      }
    }

    const daysSinceActivity = lastActivity
      ? Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
      : null

    // Calculate streak (simplified - consecutive days with activity)
    let streak = 0
    if (lastActivity && daysSinceActivity !== null && daysSinceActivity <= 1) {
      streak = 1 // At least 1 if active today or yesterday
      // Could enhance this with actual streak calculation
    }

    const engagement = {
      days_since_activity: daysSinceActivity,
      last_activity: lastActivity?.toISOString() || null,
      workouts_7d: workouts7dResult.count ?? 0,
      workouts_30d: workouts30dResult.count ?? 0,
      streak,
      completion_rate: null // Could calculate if we have scheduled vs completed
    }

    const recentWorkouts = recentWorkoutsResult.data?.map(w => ({
      id: w.id,
      logged_at: w.logged_at,
      exercise_name: w.exercise_name,
      block: w.block,
      rpe: w.rpe,
      week: w.week,
      day: w.day,
      program_id: w.program_id
    })) || []

    const notes = notesResult.data?.map(n => ({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      admin_name: (n.admin as any)?.name || null
    })) || []

    // Fetch MetCon completions from program_metcons
    const { data: metconCompletions } = await supabase
      .from('program_metcons')
      .select(`
        id,
        metcon_id,
        result_type,
        result_value,
        result_time,
        percentile,
        created_at,
        metcon:metcons(name, tasks)
      `)
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })

    // Calculate MetCon stats
    const metconsCompleted = metconCompletions?.length || 0
    // Count total tasks across all MetCon completions
    // Each exercise in each MetCon counts as 1 task
    let metconTaskCount = 0
    metconCompletions?.forEach((completion: any) => {
      const tasks = completion.metcon?.tasks
      if (Array.isArray(tasks)) {
        metconTaskCount += tasks.length
      }
    })

    // Format ENGINE sessions for display
    const engineSessions = recentEngineSessions?.map(session => ({
      id: session.id,
      date: session.date,
      day_type: session.day_type,
      modality: session.modality,
      total_output: session.total_output,
      actual_pace: session.actual_pace,
      target_pace: session.target_pace,
      performance_ratio: session.performance_ratio,
      total_work_seconds: session.total_work_seconds,
      total_rest_seconds: session.total_rest_seconds,
      peak_heart_rate: session.peak_heart_rate,
      average_heart_rate: session.average_heart_rate,
      perceived_exertion: session.perceived_exertion,
      units: session.units
    })) || []

    // Fetch additional profile data for athlete view
    const [oneRMsResult, skillsResult, userProfileResult, userDetailsResult] = await Promise.all([
      // 1RMs from user_one_rms table
      supabase
        .from('user_one_rms')
        .select('one_rm_index, exercise_name, one_rm')
        .eq('user_id', targetId),

      // Skills from user_skills table
      supabase
        .from('user_skills')
        .select('skill_name, skill_level')
        .eq('user_id', targetId),

      // Profile data from user_profiles table (contains benchmarks and other intake data)
      supabase
        .from('user_profiles')
        .select('profile_data, generated_at')
        .eq('user_id', targetId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single(),

      // Additional user details (height, age, body_weight, gender, units, conditioning_benchmarks)
      supabase
        .from('users')
        .select('height, age, body_weight, gender, units, conditioning_benchmarks, equipment')
        .eq('id', targetId)
        .single()
    ])

    // Format 1RMs
    const liftMapping: { [key: number]: string } = {
      0: 'snatch',
      1: 'clean_and_jerk',
      2: 'power_snatch',
      3: 'power_clean',
      4: 'clean_only',
      5: 'jerk_only',
      6: 'back_squat',
      7: 'front_squat',
      8: 'overhead_squat',
      9: 'deadlift',
      10: 'bench_press',
      11: 'push_press',
      12: 'strict_press',
      13: 'weighted_pullup'
    }

    const oneRMs: { [key: string]: number | null } = {}
    if (oneRMsResult.data) {
      oneRMsResult.data.forEach((rm: any) => {
        const fieldName = liftMapping[rm.one_rm_index]
        if (fieldName) {
          oneRMs[fieldName] = rm.one_rm
        }
      })
    }

    // Format skills
    const skills: { [key: string]: string } = {}
    if (skillsResult.data) {
      skillsResult.data.forEach((skill: any) => {
        skills[skill.skill_name] = skill.skill_level
      })
    }

    // Get benchmarks from conditioning_benchmarks or profile_data
    const benchmarks = userDetailsResult.data?.conditioning_benchmarks ||
      userProfileResult.data?.profile_data?.benchmarks || {}

    // Get user_summary from profile_data (this is where intake data is stored)
    const userSummary = userProfileResult.data?.profile_data?.user_summary || {}

    // Build athlete profile data - check users table first, then fall back to profile_data.user_summary
    const athleteProfile = {
      // Physical stats (users table or profile_data.user_summary)
      height: userDetailsResult.data?.height || null,
      age: userDetailsResult.data?.age || null,
      body_weight: userDetailsResult.data?.body_weight || userSummary.body_weight || null,
      gender: userDetailsResult.data?.gender || userSummary.gender || null,
      units: userDetailsResult.data?.units || userSummary.units || 'Imperial (lbs)',
      equipment: userDetailsResult.data?.equipment || userSummary.equipment || [],

      // 1RMs
      oneRMs,

      // Skills
      skills,

      // Benchmarks
      benchmarks,

      // Additional intake data from profile
      skillsAssessment: userProfileResult.data?.profile_data?.skills_assessment || null,
      technicalFocus: userProfileResult.data?.profile_data?.technical_focus || null,
      accessoryNeeds: userProfileResult.data?.profile_data?.accessory_needs || null,

      // When profile was generated
      profileGeneratedAt: userProfileResult.data?.generated_at || null
    }

    // Fetch user's training programs
    const { data: programsData } = await supabase
      .from('programs')
      .select('id, generated_at, program_data, weeks_generated')
      .eq('user_id', targetId)
      .order('generated_at', { ascending: false })

    // Collect all metconIds from program data to fetch MetCon details
    const metconIds = new Set<number>()
    programsData?.forEach((p: any) => {
      const weeks = p.program_data?.weeks || []
      weeks.forEach((week: any) => {
        const days = week.days || []
        days.forEach((day: any) => {
          if (day.metconData?.metconId) {
            metconIds.add(day.metconData.metconId)
          }
        })
      })
    })

    // Fetch MetCon details from metcons table
    let metconLookup: { [key: number]: any } = {}
    if (metconIds.size > 0) {
      const { data: metconsData } = await supabase
        .from('metcons')
        .select('id, name, format, tasks, time_cap, rx_weights')
        .in('id', Array.from(metconIds))

      if (metconsData) {
        metconsData.forEach((m: any) => {
          metconLookup[m.id] = m
        })
      }
    }

    // Format programs for admin view with enriched MetCon data
    const programs = programsData?.map((p: any) => {
      const programData = p.program_data || { weeks: [] }

      // Enrich metconData in each day with full MetCon details
      const enrichedWeeks = (programData.weeks || []).map((week: any) => ({
        ...week,
        days: (week.days || []).map((day: any) => {
          if (day.metconData?.metconId && metconLookup[day.metconData.metconId]) {
            const metcon = metconLookup[day.metconData.metconId]
            return {
              ...day,
              metconData: {
                ...day.metconData,
                name: metcon.name,
                format: metcon.format,
                tasks: metcon.tasks,
                timeCap: metcon.time_cap,
                rxWeights: metcon.rx_weights
              }
            }
          }
          return day
        })
      }))

      return {
        id: p.id,
        generatedAt: p.generated_at,
        weeksGenerated: p.weeks_generated || [],
        programData: { weeks: enrichedWeeks }
      }
    }) || []

    return NextResponse.json({
      success: true,
      user,
      subscription: subscription || null,
      engagement,
      recentWorkouts,
      engineSessions,
      notes,
      athleteProfile,
      metconStats: {
        completed: metconsCompleted,
        taskCount: metconTaskCount
      },
      programs
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
