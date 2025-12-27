import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

export async function GET() {
  try {
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

    // Calculate date thresholds
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get all active users with their last activity
    // We'll use performance_logs as the primary activity indicator
    // Also check workout_sessions for Engine users

    // First, get users with active subscriptions
    const { data: activeSubscribers, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'active')

    if (subError) {
      console.error('Error fetching subscribers:', subError)
      throw subError
    }

    const activeUserIds = activeSubscribers?.map(s => s.user_id).filter(Boolean) ?? []

    if (activeUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          activeRecently: 0,
          atRisk7Days: 0,
          atRisk14Days: 0,
          critical30Days: 0
        },
        generatedAt: new Date().toISOString()
      })
    }

    // Get last activity for each user from performance_logs
    const { data: perfLogs, error: perfError } = await supabase
      .from('performance_logs')
      .select('user_id, logged_at')
      .in('user_id', activeUserIds)
      .order('logged_at', { ascending: false })

    if (perfError) {
      console.error('Error fetching performance logs:', perfError)
    }

    // Get last activity from workout_sessions (Engine)
    const { data: workoutSessions, error: wsError } = await supabase
      .from('workout_sessions')
      .select('user_id, date')
      .in('user_id', activeUserIds)
      .order('date', { ascending: false })

    if (wsError) {
      console.error('Error fetching workout sessions:', wsError)
    }

    // Build a map of user_id -> last activity date
    const userLastActivity: Map<number, Date> = new Map()

    // Process performance logs
    perfLogs?.forEach(log => {
      if (log.user_id && log.logged_at) {
        const logDate = new Date(log.logged_at)
        const existing = userLastActivity.get(log.user_id)
        if (!existing || logDate > existing) {
          userLastActivity.set(log.user_id, logDate)
        }
      }
    })

    // Process workout sessions
    workoutSessions?.forEach(session => {
      if (session.user_id && session.date) {
        const sessionDate = new Date(session.date)
        const existing = userLastActivity.get(session.user_id)
        if (!existing || sessionDate > existing) {
          userLastActivity.set(session.user_id, sessionDate)
        }
      }
    })

    // Categorize users by engagement
    let activeRecently = 0   // Activity in last 7 days
    let atRisk7Days = 0      // No activity 7-14 days
    let atRisk14Days = 0     // No activity 14-30 days
    let critical30Days = 0   // No activity 30+ days

    activeUserIds.forEach(uid => {
      const lastActivity = userLastActivity.get(uid)

      if (!lastActivity) {
        // No activity ever recorded - critical
        critical30Days++
      } else if (lastActivity >= sevenDaysAgo) {
        activeRecently++
      } else if (lastActivity >= fourteenDaysAgo) {
        atRisk7Days++
      } else if (lastActivity >= thirtyDaysAgo) {
        atRisk14Days++
      } else {
        critical30Days++
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        activeRecently,
        atRisk7Days,
        atRisk14Days,
        critical30Days
      },
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching engagement stats:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
