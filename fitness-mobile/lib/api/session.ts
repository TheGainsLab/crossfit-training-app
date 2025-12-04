import { createClient } from '../supabase/client'

export interface Exercise {
  id: number
  exercise_name: string
  sets: string | null
  reps: string | null
  weight_time: string | null
  rpe: number | null
  quality_grade: string | null
  result: string | null
  logged_at: string
}

export interface SessionData {
  sessionInfo: {
    userId: number
    programId: number
    week: number
    day: number
    date: string
    totalExercises: number
    blocks: string[]
  }
  exercises: Record<string, Exercise[]>
  metconData?: {
    metcon_id: number
    user_score: string
    percentile: string
    performance_tier: string
    metcon: {
      workout_id: string
      format: string
      tasks: any[]
    }
  }
  hasMetcons: boolean
}

export async function fetchSessionData(
  sessionId: string
): Promise<SessionData | null> {
  const supabase = createClient()

  // Parse sessionId: "46-37-2-1" → user=46, program=37, week=2, day=1
  const parts = sessionId.split('-').map(Number)
  const [userId, programId, week, day] = parts

  if (!userId || !programId || !week || !day) {
    throw new Error('Invalid session ID format')
  }

  // 1. Get all performance logs for this session
  const { data: performanceLogs, error: performanceError } = await supabase
    .from('performance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('week', week)
    .eq('day', day)
    .order('logged_at')

  if (performanceError) {
    console.error('Error fetching performance logs:', performanceError)
    throw new Error('Failed to fetch session data')
  }

  if (!performanceLogs || performanceLogs.length === 0) {
    return null
  }

  // 2. Check if MetCons exist and get MetCon data
  const hasMetcons = performanceLogs.some((log: any) => log.block === 'METCONS')
  let metconData = null

  if (hasMetcons) {
    // Get program_metcons entry for this session
    const { data: programMetcons, error: programMetconsError } = await supabase
      .from('program_metcons')
      .select('*')
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)
      .single()

    if (programMetcons && !programMetconsError) {
      // Get metcon details from metcons table
      const { data: metconDetails, error: metconDetailsError } = await supabase
        .from('metcons')
        .select('*')
        .eq('id', programMetcons.metcon_id)
        .single()

      if (metconDetails && !metconDetailsError) {
        // Get percentile data
        const { data: percentileData } = await supabase
          .from('exercise_percentile_log')
          .select('percentile, performance_tier')
          .eq('user_id', userId)
          .eq('metcon_id', programMetcons.metcon_id)
          .eq('program_id', programId)
          .eq('week', week)
          .eq('day', day)
          .single()

        metconData = {
          metcon_id: programMetcons.metcon_id,
          user_score: programMetcons.user_score || '',
          percentile: percentileData?.percentile?.toString() || '0',
          performance_tier: percentileData?.performance_tier || 'Average',
          metcon: metconDetails,
        }
      }
    }
  }

  // 3. Group exercises by training block
  const groupedExercises = performanceLogs.reduce((acc, log: any) => {
    const block = log.block || 'OTHER'
    if (!acc[block]) {
      acc[block] = []
    }
    acc[block].push({
      id: log.id,
      exercise_name: log.exercise_name,
      sets: log.sets,
      reps: log.reps,
      weight_time: log.weight_time,
      rpe: log.rpe,
      quality_grade: log.quality_grade,
      result: log.result,
      logged_at: log.logged_at,
    })
    return acc
  }, {} as Record<string, Exercise[]>)

  // 4. Calculate session metadata
  const sessionDate = performanceLogs[0]?.logged_at || ''
  const totalExercises = performanceLogs.length
  const blocks = Object.keys(groupedExercises)

  return {
    sessionInfo: {
      userId,
      programId,
      week,
      day,
      date: sessionDate,
      totalExercises,
      blocks,
    },
    exercises: groupedExercises,
    metconData: metconData || undefined,
    hasMetcons,
  }
}

