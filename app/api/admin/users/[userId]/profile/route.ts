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

      // Recent workouts (last 10)
      supabase
        .from('performance_logs')
        .select('id, logged_at, exercise_name, block')
        .eq('user_id', targetId)
        .order('logged_at', { ascending: false })
        .limit(10),

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

    // Fetch recent ENGINE workout sessions with full details
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
      .limit(10)

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
      block: w.block
    })) || []

    const notes = notesResult.data?.map(n => ({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      admin_name: (n.admin as any)?.name || null
    })) || []

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

    return NextResponse.json({
      success: true,
      user,
      subscription: subscription || null,
      engagement,
      recentWorkouts,
      engineSessions,
      notes
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
