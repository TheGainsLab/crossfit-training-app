import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

interface ActivityItem {
  id: string
  type: 'btn' | 'engine' | 'metcon'
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
    const blockFilter = searchParams.get('block') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000)

    // Fetch recent performance logs (BTN workouts) - skip if filtering for ENGINE or METCON only
    let perfLogs: any[] | null = null
    let perfError: any = null
    if (!blockFilter || (blockFilter !== 'ENGINE' && blockFilter !== 'METCON')) {
      let perfLogsQuery = supabase
        .from('performance_logs')
        .select(`
          id,
          user_id,
          block,
          exercise_name,
          weight_time,
          reps,
          sets,
          result,
          logged_at
        `)
        .gte('logged_at', sinceDate.toISOString())
        .order('logged_at', { ascending: false })
        .limit(200)

      // Apply block filter for specific BTN blocks
      if (blockFilter) {
        perfLogsQuery = perfLogsQuery.eq('block', blockFilter)
      }

      const result = await perfLogsQuery
      perfLogs = result.data
      perfError = result.error

      if (perfError) {
        console.error('Error fetching performance logs:', perfError)
      }
    }

    // Fetch recent Engine sessions (only if no block filter or filtering for ENGINE)
    let engineSessions: any[] | null = null
    let engineError: any = null
    if (!blockFilter || blockFilter === 'ENGINE') {
      const result = await supabase
        .from('workout_sessions')
        .select(`
          id,
          user_id,
          date,
          day_type,
          completed,
          total_output,
          actual_pace,
          target_pace,
          performance_ratio
        `)
        .eq('completed', true)
        .gte('date', sinceDate.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(100)

      engineSessions = result.data
      engineError = result.error

      if (engineError) {
        console.error('Error fetching engine sessions:', engineError)
      }
    }

    // Fetch recent MetCon completions (only if no block filter or filtering for METCON)
    let metconCompletions: any[] | null = null
    let metconError: any = null
    if (!blockFilter || blockFilter === 'METCON') {
      const result = await supabase
        .from('program_metcons')
        .select(`
          id,
          program_id,
          week,
          day,
          user_score,
          percentile,
          completed_at,
          metcon_id,
          performance_tier,
          metcons (
            workout_id,
            time_range,
            format
          ),
          programs (
            user_id
          )
        `)
        .not('completed_at', 'is', null)
        .gte('completed_at', sinceDate.toISOString())
        .order('completed_at', { ascending: false })
        .limit(100)

      metconCompletions = result.data
      metconError = result.error

      if (metconError) {
        console.error('Error fetching metcon completions:', metconError)
      }
    }

    // Collect all unique user IDs
    const userIds = new Set<number>()
    perfLogs?.forEach(log => log.user_id && userIds.add(log.user_id))
    engineSessions?.forEach(session => session.user_id && userIds.add(session.user_id))
    metconCompletions?.forEach(mc => {
      const mcUserId = (mc.programs as any)?.user_id
      if (mcUserId) userIds.add(mcUserId)
    })

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
      if (!logs || logs.length === 0) return

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
          // Only show weight_time if it's a valid value (not NaN string, not empty)
          const wt = log.weight_time
          if (wt && wt !== 'NaN' && wt !== 'nan') {
            detail += ` @ ${wt}`
          }
          if (log.sets && log.reps) detail += ` ${log.sets}x${log.reps}`
          else if (log.reps) detail += ` x ${log.reps}`
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

    // Add Engine sessions with performance data
    engineSessions?.forEach(session => {
      if (!session.user_id) return
      const user = usersMap.get(session.user_id)

      // Apply tier filter
      if (tierFilter && user?.tier !== tierFilter) return

      // Build details with performance metrics
      const details: string[] = []
      if (session.actual_pace) {
        details.push(`Pace: ${session.actual_pace}`)
      }
      if (session.total_output) {
        details.push(`Output: ${session.total_output}`)
      }
      if (session.performance_ratio) {
        const pct = (session.performance_ratio * 100).toFixed(0)
        details.push(`Performance: ${pct}%`)
      }

      activityItems.push({
        id: `engine-${session.id}`,
        type: 'engine',
        userId: session.user_id,
        userName: user?.name || null,
        userEmail: user?.email || null,
        userTier: user?.tier || null,
        timestamp: new Date(session.date).toISOString(),
        block: 'ENGINE',
        summary: `ENGINE: ${session.day_type || 'Workout'} session`,
        details
      })
    })

    // Add MetCon completions
    metconCompletions?.forEach(mc => {
      const mcUserId = (mc.programs as any)?.user_id
      if (!mcUserId) return
      const user = usersMap.get(mcUserId)

      // Apply tier filter
      if (tierFilter && user?.tier !== tierFilter) return

      const workoutId = (mc.metcons as any)?.workout_id || ''
      const timeRange = (mc.metcons as any)?.time_range || ''
      const format = (mc.metcons as any)?.format || ''
      const tier = mc.performance_tier || ''

      // Build summary - use workout_id as identifier, or format
      const metconLabel = workoutId || format || 'MetCon'

      // Build details
      const details: string[] = []
      if (mc.user_score) {
        details.push(`Score: ${mc.user_score}`)
      }
      if (mc.percentile) {
        details.push(`Percentile: ${mc.percentile}%`)
      }
      if (tier) {
        details.push(`Tier: ${tier}`)
      }
      if (timeRange) {
        details.push(`Time: ${timeRange}`)
      }

      activityItems.push({
        id: `metcon-${mc.id}`,
        type: 'metcon',
        userId: mcUserId,
        userName: user?.name || null,
        userEmail: user?.email || null,
        userTier: user?.tier || null,
        timestamp: mc.completed_at,
        block: 'METCON',
        summary: `METCON: ${metconLabel}`,
        details
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
      },
      debug: {
        perfLogsCount: perfLogs?.length ?? 0,
        perfError: perfError?.message || null,
        engineSessionsCount: engineSessions?.length ?? 0,
        engineError: engineError?.message || null,
        metconCount: metconCompletions?.length ?? 0,
        metconError: metconError?.message || null,
        uniqueUserIds: userIds.size,
        sinceDate: sinceDate.toISOString()
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
