import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

interface ActivityItem {
  id: string
  type: 'btn' | 'engine'
  userId: number
  userName: string | null
  userEmail: string | null
  userTier: string | null
  timestamp: string
  block: string | null
  summary: string
  details: string[]
}

export async function GET(request: NextRequest) {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const tierFilter = searchParams.get('tier') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000)

    // Fetch recent performance logs (BTN workouts)
    const { data: perfLogs, error: perfError } = await supabase
      .from('performance_logs')
      .select(`
        id,
        user_id,
        block,
        exercise_name,
        weight,
        reps_completed,
        result,
        logged_at
      `)
      .gte('logged_at', sinceDate.toISOString())
      .order('logged_at', { ascending: false })
      .limit(200)

    if (perfError) {
      console.error('Error fetching performance logs:', perfError)
    }

    // Fetch recent Engine sessions
    const { data: engineSessions, error: engineError } = await supabase
      .from('workout_sessions')
      .select(`
        id,
        user_id,
        date,
        duration_minutes,
        session_type
      `)
      .gte('date', sinceDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(100)

    if (engineError) {
      console.error('Error fetching engine sessions:', engineError)
    }

    // Collect all unique user IDs
    const userIds = new Set<number>()
    perfLogs?.forEach(log => log.user_id && userIds.add(log.user_id))
    engineSessions?.forEach(session => session.user_id && userIds.add(session.user_id))

    // Fetch user details
    let usersMap = new Map<number, { name: string | null, email: string | null, tier: string | null }>()
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, subscription_tier')
        .in('id', Array.from(userIds))

      users?.forEach(u => {
        usersMap.set(u.id, {
          name: u.name,
          email: u.email,
          tier: u.subscription_tier
        })
      })
    }

    // Group performance logs by user and block for the same day
    const perfByUserBlockDay = new Map<string, typeof perfLogs>()
    perfLogs?.forEach(log => {
      if (!log.user_id || !log.logged_at) return
      const day = new Date(log.logged_at).toISOString().split('T')[0]
      const key = `${log.user_id}-${log.block || 'UNKNOWN'}-${day}`
      if (!perfByUserBlockDay.has(key)) {
        perfByUserBlockDay.set(key, [])
      }
      perfByUserBlockDay.get(key)!.push(log)
    })

    // Build activity items from grouped performance logs
    const activityItems: ActivityItem[] = []

    perfByUserBlockDay.forEach((logs, key) => {
      const [userIdStr, block] = key.split('-')
      const userId = parseInt(userIdStr)
      const user = usersMap.get(userId)

      // Apply tier filter
      if (tierFilter && user?.tier !== tierFilter) return

      // Get the most recent timestamp for this group
      const mostRecent = logs.reduce((latest, log) => {
        const logTime = new Date(log.logged_at).getTime()
        return logTime > latest ? logTime : latest
      }, 0)

      // Build summary of exercises
      const exercises = logs.map(log => log.exercise_name).filter(Boolean)
      const uniqueExercises = [...new Set(exercises)]
      const summary = `${block}: ${uniqueExercises.slice(0, 3).join(', ')}${uniqueExercises.length > 3 ? ` +${uniqueExercises.length - 3} more` : ''}`

      // Build details with weights/reps
      const details = logs
        .filter(log => log.exercise_name)
        .slice(0, 5)
        .map(log => {
          let detail = log.exercise_name || ''
          if (log.weight) detail += ` @ ${log.weight}lb`
          if (log.reps_completed) detail += ` x ${log.reps_completed}`
          return detail
        })

      activityItems.push({
        id: `perf-${key}`,
        type: 'btn',
        userId,
        userName: user?.name || null,
        userEmail: user?.email || null,
        userTier: user?.tier || null,
        timestamp: new Date(mostRecent).toISOString(),
        block,
        summary,
        details
      })
    })

    // Add Engine sessions
    engineSessions?.forEach(session => {
      if (!session.user_id) return
      const user = usersMap.get(session.user_id)

      // Apply tier filter
      if (tierFilter && user?.tier !== tierFilter) return

      activityItems.push({
        id: `engine-${session.id}`,
        type: 'engine',
        userId: session.user_id,
        userName: user?.name || null,
        userEmail: user?.email || null,
        userTier: user?.tier || null,
        timestamp: new Date(session.date).toISOString(),
        block: 'ENGINE',
        summary: `ENGINE: ${session.session_type || 'Workout'} session`,
        details: session.duration_minutes ? [`Duration: ${session.duration_minutes} min`] : []
      })
    })

    // Sort by timestamp descending
    activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply limit
    const limitedItems = activityItems.slice(0, limit)

    return NextResponse.json({
      success: true,
      activity: limitedItems,
      meta: {
        hours,
        totalItems: activityItems.length,
        returnedItems: limitedItems.length
      }
    })

  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
