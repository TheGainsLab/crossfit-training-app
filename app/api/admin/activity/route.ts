import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

interface BlockDetail {
  blockName: string
  exercises: string[]
}

interface ActivityItem {
  id: string
  userId: number
  userName: string | null
  userEmail: string | null
  userTier: string | null
  timestamp: string
  week: number
  day: number
  blocks: BlockDetail[]
  summary: string
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
    const userIdFilter = searchParams.get('userId') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000)

    // Fetch recent performance logs (BTN workouts) - include week and day
    let perfLogs: any[] | null = null
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
          logged_at,
          week,
          day
        `)
        .gte('logged_at', sinceDate.toISOString())
        .order('logged_at', { ascending: false })
        .limit(200)

      if (blockFilter) {
        perfLogsQuery = perfLogsQuery.eq('block', blockFilter)
      }

      const result = await perfLogsQuery
      perfLogs = result.data
      if (result.error) {
        console.error('Error fetching performance logs:', result.error)
      }
    }

    // Fetch recent Engine sessions
    let engineSessions: any[] | null = null
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
          performance_ratio,
          program_day_number,
          program_id,
          program_version,
          modality
        `)
        .eq('completed', true)
        .gte('date', sinceDate.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(100)

      engineSessions = result.data
      if (result.error) {
        console.error('Error fetching engine sessions:', result.error)
      }
    }

    // Build Engine day number -> (week, day) lookup from program_metcons
    const engineWeekDayMap = new Map<string, { week: number; day: number }>()
    if (engineSessions && engineSessions.length > 0) {
      const programIds = [...new Set(engineSessions.map(s => s.program_id).filter(Boolean))]
      if (programIds.length > 0) {
        const { data: engineMappings } = await supabase
          .from('program_metcons')
          .select('program_id, program_day_number, week, day')
          .eq('workout_type', 'conditioning')
          .in('program_id', programIds)

        engineMappings?.forEach((m: any) => {
          if (m.program_day_number != null && m.week != null && m.day != null) {
            engineWeekDayMap.set(`${m.program_id}-${m.program_day_number}`, {
              week: m.week,
              day: m.day
            })
          }
        })
      }
    }

    // Fetch recent MetCon completions
    let metconCompletions: any[] | null = null
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
      if (result.error) {
        console.error('Error fetching metcon completions:', result.error)
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
    const usersMap = new Map<number, { name: string | null, email: string | null, tier: string | null }>()
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, subscription_tier')
        .in('id', Array.from(userIds))

      users?.forEach((u: any) => {
        usersMap.set(u.id, {
          name: u.name,
          email: u.email,
          tier: u.subscription_tier
        })
      })
    }

    // Group everything by user + week + day into training day cards
    // Key: "userId-week-day"
    const trainingDays = new Map<string, {
      userId: number
      week: number
      day: number
      timestamp: number  // most recent across all blocks
      blocks: Map<string, string[]>  // blockName -> exercise details
    }>()

    const getOrCreateDay = (userId: number, week: number, day: number, timestamp: number) => {
      const key = `${userId}-${week}-${day}`
      let entry = trainingDays.get(key)
      if (!entry) {
        entry = { userId, week, day, timestamp, blocks: new Map() }
        trainingDays.set(key, entry)
      }
      if (timestamp > entry.timestamp) {
        entry.timestamp = timestamp
      }
      return entry
    }

    // Process BTN performance logs
    perfLogs?.forEach(log => {
      if (!log.user_id || !log.week || !log.day) return
      const user = usersMap.get(log.user_id)
      if (tierFilter && user?.tier !== tierFilter) return
      if (userIdFilter && log.user_id !== parseInt(userIdFilter)) return

      const ts = new Date(log.logged_at).getTime()
      const entry = getOrCreateDay(log.user_id, log.week, log.day, ts)

      const blockName = log.block || 'UNKNOWN'
      if (!entry.blocks.has(blockName)) {
        entry.blocks.set(blockName, [])
      }

      // Build exercise detail string
      let detail = log.exercise_name || ''
      const wt = log.weight_time
      if (wt && wt !== 'NaN' && wt !== 'nan') {
        detail += ` @ ${wt}`
      }
      if (log.sets && log.reps) detail += ` ${log.sets}x${log.reps}`
      else if (log.reps) detail += ` x ${log.reps}`

      if (detail) {
        entry.blocks.get(blockName)!.push(detail)
      }
    })

    // Process Engine sessions
    engineSessions?.forEach(session => {
      if (!session.user_id) return
      const user = usersMap.get(session.user_id)
      if (tierFilter && user?.tier !== tierFilter) return
      if (userIdFilter && session.user_id !== parseInt(userIdFilter)) return

      // Look up week/day from program_metcons mapping
      const mapping = session.program_id && session.program_day_number
        ? engineWeekDayMap.get(`${session.program_id}-${session.program_day_number}`)
        : null

      if (!mapping) return  // Can't place this session in a training day

      const ts = new Date(session.date).getTime()
      const entry = getOrCreateDay(session.user_id, mapping.week, mapping.day, ts)

      if (!entry.blocks.has('ENGINE')) {
        entry.blocks.set('ENGINE', [])
      }

      const details: string[] = []
      if (session.day_type) {
        details.push(session.day_type.charAt(0).toUpperCase() + session.day_type.slice(1).replace(/_/g, ' '))
      }
      if (session.modality) {
        details.push(session.modality.replace(/_/g, ' '))
      }
      if (session.actual_pace && session.target_pace) {
        const pct = ((session.actual_pace / session.target_pace) * 100).toFixed(0)
        details.push(`${pct}% of target pace`)
      } else if (session.total_output) {
        details.push(`Output: ${session.total_output}`)
      }

      entry.blocks.get('ENGINE')!.push(details.join(' — '))
    })

    // Process MetCon completions
    metconCompletions?.forEach(mc => {
      const mcUserId = (mc.programs as any)?.user_id
      if (!mcUserId || !mc.week || !mc.day) return
      const user = usersMap.get(mcUserId)
      if (tierFilter && user?.tier !== tierFilter) return
      if (userIdFilter && mcUserId !== parseInt(userIdFilter)) return

      const ts = new Date(mc.completed_at).getTime()
      const entry = getOrCreateDay(mcUserId, mc.week, mc.day, ts)

      if (!entry.blocks.has('METCON')) {
        entry.blocks.set('METCON', [])
      }

      const workoutId = (mc.metcons as any)?.workout_id || ''
      const format = (mc.metcons as any)?.format || ''
      const label = workoutId || format || 'MetCon'
      const parts: string[] = [label]
      if (mc.user_score) parts.push(`Score: ${mc.user_score}`)
      if (mc.percentile) parts.push(`${mc.percentile}th percentile`)
      if (mc.performance_tier) parts.push(mc.performance_tier)

      entry.blocks.get('METCON')!.push(parts.join(' — '))
    })

    // Convert to ActivityItem array
    const activityItems: ActivityItem[] = []

    trainingDays.forEach((entry, key) => {
      const user = usersMap.get(entry.userId)

      // Apply block filter: only include days that have the filtered block
      if (blockFilter && !entry.blocks.has(blockFilter)) return

      // Build blocks array in display order
      const blockOrder = ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'ENGINE', 'METCON']
      const blocks: BlockDetail[] = []
      for (const blockName of blockOrder) {
        const exercises = entry.blocks.get(blockName)
        if (exercises && exercises.length > 0) {
          blocks.push({ blockName, exercises })
        }
      }
      // Add any blocks not in the predefined order
      entry.blocks.forEach((exercises, blockName) => {
        if (!blockOrder.includes(blockName) && exercises.length > 0) {
          blocks.push({ blockName, exercises })
        }
      })

      const blockNames = blocks.map(b => b.blockName)
      const summary = `Week ${entry.week}, Day ${entry.day}: ${blockNames.join(', ')}`

      activityItems.push({
        id: key,
        userId: entry.userId,
        userName: user?.name || null,
        userEmail: user?.email || null,
        userTier: user?.tier || null,
        timestamp: new Date(entry.timestamp).toISOString(),
        week: entry.week,
        day: entry.day,
        blocks,
        summary
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
