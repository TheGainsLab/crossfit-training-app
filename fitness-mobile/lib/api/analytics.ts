import { createClient } from '../supabase/client'

export interface RecentSession {
  sessionKey: string
  date: string
  week: number
  day: number
  totalExercises: number
  programId: number | null
  blocks: Array<{ blockName: string; exerciseCount: number }>
}

export async function fetchRecentActivity(
  userId: number,
  limit: number = 25
): Promise<RecentSession[]> {
  const supabase = createClient()

  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })

  if (error) {
    console.error('Error fetching recent activity:', error)
    return []
  }

  if (!performanceData || performanceData.length === 0) {
    return []
  }

  // Process the data to get recent training sessions
  const sessionGroups: { [key: string]: any[] } = {}

  performanceData.forEach((exercise: any) => {
    const programId = exercise.program_id || 0
    const week = exercise.week || 1
    const day = exercise.day || 1
    const sessionKey = `${programId}-W${week}D${day}`

    if (!sessionGroups[sessionKey]) {
      sessionGroups[sessionKey] = []
    }
    sessionGroups[sessionKey].push(exercise)
  })

  const sessions = Object.entries(sessionGroups)
    .map(([sessionKey, exercises]) => {
      const sortedExercises = exercises.sort(
        (a, b) =>
          new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
      )

      const blockGroups: { [key: string]: any[] } = {}
      exercises.forEach((exercise) => {
        const blockName = exercise.block || 'Unknown'
        if (!blockGroups[blockName]) {
          blockGroups[blockName] = []
        }
        blockGroups[blockName].push(exercise)
      })

      const blocks = Object.entries(blockGroups).map(
        ([blockName, blockExercises]) => ({
          blockName,
          exerciseCount: blockExercises.length,
        })
      )

      const firstExercise = sortedExercises[0]
      const week = firstExercise.week
      const day = firstExercise.day
      const programId = firstExercise.program_id || null
      const sessionDate = new Date(firstExercise.logged_at)
        .toISOString()
        .split('T')[0]

      return {
        sessionKey,
        date: sessionDate,
        week,
        day,
        totalExercises: exercises.length,
        programId,
        blocks: blocks.sort((a, b) => a.blockName.localeCompare(b.blockName)),
        mostRecentTimestamp: new Date(firstExercise.logged_at).getTime(),
      }
    })
    .sort((a, b) => b.mostRecentTimestamp - a.mostRecentTimestamp)
    .slice(0, limit)

  return sessions
}

export interface DashboardData {
  totalWorkouts: number
  totalExercises: number
  completionRate: number
  weeksActive: number
  recentTrend: 'improving' | 'declining' | 'stable'
  metconsCompleted: number
  fitnessScore: number | null
}

export async function fetchDashboardData(
  userId: number
): Promise<DashboardData | null> {
  const supabase = createClient()

  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching dashboard data:', error)
    return null
  }

  if (!performanceData || performanceData.length === 0) {
    return {
      totalWorkouts: 0,
      totalExercises: 0,
      completionRate: 0,
      weeksActive: 0,
      recentTrend: 'stable',
      metconsCompleted: 0,
      fitnessScore: null,
    }
  }

  // Group by sessions
  const sessionGroups: { [key: string]: any[] } = {}
  performanceData.forEach((exercise: any) => {
    const programId = exercise.program_id || 0
    const week = exercise.week || 1
    const day = exercise.day || 1
    const sessionKey = `${programId}-W${week}D${day}`
    if (!sessionGroups[sessionKey]) {
      sessionGroups[sessionKey] = []
    }
    sessionGroups[sessionKey].push(exercise)
  })

  const totalWorkouts = Object.keys(sessionGroups).length
  const totalExercises = performanceData.length

  // Get unique weeks
  const weeks = new Set(
    performanceData.map((p: any) => `${p.program_id}-${p.week}`)
  )
  const weeksActive = weeks.size

  // Calculate completion rate (simplified - would need program data for accurate calculation)
  const completionRate = weeksActive > 0 ? Math.min(100, (totalWorkouts / (weeksActive * 5)) * 100) : 0

  // Determine trend (simplified - compare last 2 weeks vs previous 2 weeks)
  const recentTrend: 'improving' | 'declining' | 'stable' = 'stable'

  // Fetch MetCons completed
  const { data: metconData } = await supabase
    .from('program_metcons')
    .select('id')
    .eq('user_id', userId)
  
  const metconsCompleted = metconData?.length || 0

  // Fetch Fitness Score (average percentile from MetCons)
  const { data: metconScoreData } = await supabase
    .from('program_metcons')
    .select('percentile')
    .eq('user_id', userId)
    .not('percentile', 'is', null)
  
  let fitnessScore = null
  if (metconScoreData && metconScoreData.length > 0) {
    const totalPercentile = metconScoreData.reduce(
      (sum: number, m: any) => sum + (parseFloat(m.percentile) || 0),
      0
    )
    fitnessScore = Math.round(totalPercentile / metconScoreData.length)
  }

  return {
    totalWorkouts,
    totalExercises,
    completionRate,
    weeksActive,
    recentTrend,
    metconsCompleted,
    fitnessScore,
  }
}

export interface SkillData {
  name: string
  sessions: Array<{
    week: number
    day: number
    date: string
    sets: number
    reps: number
    rpe: number
    quality: number
    notes?: string
  }>
  totalReps: number
  avgRPE: number
  avgQuality: number
  qualityGrade: string
  daysSinceLast: number
  intakeLevel?: string
}

export async function fetchSkillsAnalytics(
  userId: number,
  timeRange: number = 90
): Promise<{ skillsAnalysis: { skills: Record<string, SkillData> } } | null> {
  const supabase = createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - timeRange)

  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('block', 'SKILLS')
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: true })

  if (error) {
    console.error('Error fetching skills analytics:', error)
    return null
  }

  if (!performanceData || performanceData.length === 0) {
    return { skillsAnalysis: { skills: {} } }
  }

  // Group by exercise name
  const skillsMap: Record<string, SkillData> = {}

  performanceData.forEach((log: any) => {
    const exerciseName = log.exercise_name || 'Unknown'
    if (!skillsMap[exerciseName]) {
      skillsMap[exerciseName] = {
        name: exerciseName,
        sessions: [],
        totalReps: 0,
        avgRPE: 0,
        avgQuality: 0,
        qualityGrade: 'D',
        daysSinceLast: 999,
      }
    }

    const sets = parseInt(log.sets || '1', 10)
    const reps = parseInt(log.reps || '0', 10)
    const totalReps = sets * reps

    skillsMap[exerciseName].sessions.push({
      week: log.week,
      day: log.day,
      date: log.logged_at,
      sets,
      reps,
      rpe: log.rpe || 0,
      quality: log.completion_quality || 0,
      notes: log.result,
    })

    skillsMap[exerciseName].totalReps += totalReps
  })

  // Calculate averages and grades
  Object.values(skillsMap).forEach((skill) => {
    if (skill.sessions.length > 0) {
      skill.avgRPE =
        skill.sessions.reduce((sum, s) => sum + s.rpe, 0) /
        skill.sessions.length
      skill.avgQuality =
        skill.sessions.reduce((sum, s) => sum + s.quality, 0) /
        skill.sessions.length

      // Convert quality to grade
      if (skill.avgQuality >= 3.7) skill.qualityGrade = 'A'
      else if (skill.avgQuality >= 3.3) skill.qualityGrade = 'A-'
      else if (skill.avgQuality >= 2.7) skill.qualityGrade = 'B+'
      else if (skill.avgQuality >= 2.3) skill.qualityGrade = 'B'
      else if (skill.avgQuality >= 1.7) skill.qualityGrade = 'B-'
      else if (skill.avgQuality >= 1.3) skill.qualityGrade = 'C+'
      else if (skill.avgQuality >= 1.0) skill.qualityGrade = 'C'
      else skill.qualityGrade = 'D'

      // Calculate days since last
      const lastSession = skill.sessions[skill.sessions.length - 1]
      const lastDate = new Date(lastSession.date)
      const now = new Date()
      skill.daysSinceLast = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    }
  })

  return { skillsAnalysis: { skills: skillsMap } }
}

export interface StrengthMovement {
  name: string
  sessions: Array<{
    week: number
    day: number
    date: string
    weight: number
    sets: number
    reps: number
    rpe: number
  }>
  maxWeight: number
  currentWeight: number
  averageWeight: number
  totalVolume: number
  avgRPE: number
}

export async function fetchStrengthAnalytics(
  userId: number,
  timeRange: number = 90
): Promise<{ strengthAnalysis: { movements: Record<string, StrengthMovement> } } | null> {
  const supabase = createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - timeRange)

  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('block', 'STRENGTH AND POWER')
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: true })

  if (error) {
    console.error('Error fetching strength analytics:', error)
    return null
  }

  if (!performanceData || performanceData.length === 0) {
    return { strengthAnalysis: { movements: {} } }
  }

  // Group by exercise name
  const movementsMap: Record<string, StrengthMovement> = {}

  performanceData.forEach((log: any) => {
    const exerciseName = log.exercise_name || 'Unknown'
    if (!movementsMap[exerciseName]) {
      movementsMap[exerciseName] = {
        name: exerciseName,
        sessions: [],
        maxWeight: 0,
        currentWeight: 0,
        averageWeight: 0,
        totalVolume: 0,
        avgRPE: 0,
      }
    }

    const weightRaw = parseFloat(log.weight_time || '0')
    // Handle case where weight_time is the string "NaN" or results in NaN
    const weight = isNaN(weightRaw) ? 0 : weightRaw
    const sets = parseInt(log.sets || '1', 10)
    const reps = parseInt(log.reps || '0', 10)
    const volume = weight * sets * reps

    movementsMap[exerciseName].sessions.push({
      week: log.week,
      day: log.day,
      date: log.logged_at,
      weight,
      sets,
      reps,
      rpe: log.rpe || 0,
    })

    movementsMap[exerciseName].maxWeight = Math.max(
      movementsMap[exerciseName].maxWeight,
      weight
    )
    movementsMap[exerciseName].totalVolume += volume
  })

  // Calculate averages and current weight
  Object.values(movementsMap).forEach((movement) => {
    if (movement.sessions.length > 0) {
      movement.currentWeight =
        movement.sessions[movement.sessions.length - 1].weight
      movement.averageWeight =
        movement.sessions.reduce((sum, s) => sum + s.weight, 0) /
        movement.sessions.length
      movement.avgRPE =
        movement.sessions.reduce((sum, s) => sum + s.rpe, 0) /
        movement.sessions.length
    }
  })

  return { strengthAnalysis: { movements: movementsMap } }
}

export async function fetchAccessoriesAnalytics(
  userId: number,
  timeRange: number = 90
): Promise<{ accessoriesAnalysis: { movements: Record<string, StrengthMovement> } } | null> {
  const supabase = createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - timeRange)

  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('block', 'ACCESSORIES')
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: true })

  if (error) {
    console.error('Error fetching accessories analytics:', error)
    return null
  }

  if (!performanceData || performanceData.length === 0) {
    return { accessoriesAnalysis: { movements: {} } }
  }

  // Group by exercise name
  const movementsMap: Record<string, StrengthMovement> = {}

  performanceData.forEach((log: any) => {
    const exerciseName = log.exercise_name || 'Unknown'
    if (!movementsMap[exerciseName]) {
      movementsMap[exerciseName] = {
        name: exerciseName,
        sessions: [],
        maxWeight: 0,
        currentWeight: 0,
        averageWeight: 0,
        totalVolume: 0,
        avgRPE: 0,
      }
    }

    const weightRaw = parseFloat(log.weight_time || '0')
    // Handle case where weight_time is the string "NaN" or results in NaN
    const weight = isNaN(weightRaw) ? 0 : weightRaw
    const sets = parseInt(log.sets || '1', 10)
    const reps = parseInt(log.reps || '0', 10)
    const volume = weight * sets * reps

    movementsMap[exerciseName].sessions.push({
      week: log.week,
      day: log.day,
      date: log.logged_at,
      weight,
      sets,
      reps,
      rpe: log.rpe || 0,
    })

    movementsMap[exerciseName].maxWeight = Math.max(
      movementsMap[exerciseName].maxWeight,
      weight
    )
    movementsMap[exerciseName].totalVolume += volume
  })

  // Calculate averages and current weight
  Object.values(movementsMap).forEach((movement) => {
    if (movement.sessions.length > 0) {
      movement.currentWeight =
        movement.sessions[movement.sessions.length - 1].weight
      movement.averageWeight =
        movement.sessions.reduce((sum, s) => sum + s.weight, 0) /
        movement.sessions.length
      movement.avgRPE =
        movement.sessions.reduce((sum, s) => sum + s.rpe, 0) /
        movement.sessions.length
    }
  })

  return { accessoriesAnalysis: { movements: movementsMap } }
}

export async function fetchTechnicalWorkAnalytics(
  userId: number,
  timeRange: number = 90
): Promise<{ technicalWorkAnalysis: { movements: Record<string, StrengthMovement> } } | null> {
  const supabase = createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - timeRange)

  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('block', 'TECHNICAL WORK')
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: true })

  if (error) {
    console.error('Error fetching technical work analytics:', error)
    return null
  }

  if (!performanceData || performanceData.length === 0) {
    return { technicalWorkAnalysis: { movements: {} } }
  }

  // Group by exercise name
  const movementsMap: Record<string, StrengthMovement> = {}

  performanceData.forEach((log: any) => {
    const exerciseName = log.exercise_name || 'Unknown'
    if (!movementsMap[exerciseName]) {
      movementsMap[exerciseName] = {
        name: exerciseName,
        sessions: [],
        maxWeight: 0,
        currentWeight: 0,
        averageWeight: 0,
        totalVolume: 0,
        avgRPE: 0,
      }
    }

    const weightRaw = parseFloat(log.weight_time || '0')
    // Handle case where weight_time is the string "NaN" or results in NaN
    const weight = isNaN(weightRaw) ? 0 : weightRaw
    const sets = parseInt(log.sets || '1', 10)
    const reps = parseInt(log.reps || '0', 10)
    const volume = weight * sets * reps

    movementsMap[exerciseName].sessions.push({
      week: log.week,
      day: log.day,
      date: log.logged_at,
      weight,
      sets,
      reps,
      rpe: log.rpe || 0,
    })

    movementsMap[exerciseName].maxWeight = Math.max(
      movementsMap[exerciseName].maxWeight,
      weight
    )
    movementsMap[exerciseName].totalVolume += volume
  })

  // Calculate averages and current weight
  Object.values(movementsMap).forEach((movement) => {
    if (movement.sessions.length > 0) {
      movement.currentWeight =
        movement.sessions[movement.sessions.length - 1].weight
      movement.averageWeight =
        movement.sessions.reduce((sum, s) => sum + s.weight, 0) /
        movement.sessions.length
      movement.avgRPE =
        movement.sessions.reduce((sum, s) => sum + s.rpe, 0) /
        movement.sessions.length
    }
  })

  return { technicalWorkAnalysis: { movements: movementsMap } }
}

export interface SessionHistoryRow {
  training_date: string
  exercise_name: string
  sets: string | null
  reps: string | null
  weight_time: string | null
  rpe: number | null
  completion_quality: number | null
}

export async function fetchMovementSessionHistory(
  userId: number,
  exerciseName: string,
  block: string,
  timeRange: number = 90
): Promise<SessionHistoryRow[]> {
  const supabase = createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - timeRange)

  const { data: rows, error } = await supabase
    .from('performance_logs')
    .select('logged_at, exercise_name, sets, reps, weight_time, rpe, completion_quality')
    .eq('user_id', userId)
    .eq('block', block)
    .ilike('exercise_name', exerciseName)
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching movement session history:', error)
    return []
  }

  return (rows || []).map((r: any) => {
    // Sanitize weight_time: convert "NaN" string to null
    let weightTime = r.weight_time
    if (weightTime === 'NaN' || weightTime === 'nan' || weightTime === null) {
      weightTime = null
    }
    
    return {
      training_date: String(r.logged_at).slice(0, 10),
      exercise_name: r.exercise_name,
      sets: r.sets,
      reps: r.reps,
      weight_time: weightTime,
      rpe: r.rpe,
      completion_quality: r.completion_quality,
    }
  })
}

export interface MetConData {
  totalMetCons: number
  avgPercentile: number
  timeDomains: string[]
  heatmapCells: Array<{
    exercise_name: string
    time_range: string
    session_count: number
    avg_percentile: number
  }>
}

export async function fetchMetConAnalytics(
  userId: number
): Promise<MetConData | null> {
  const supabase = createClient()

  // Get MetCon completions WITH percentile and tasks (like web app)
  const { data: metconCompletions, error: metconError } = await supabase
    .from('program_metcons')
    .select('*, metcons(time_range, workout_id, tasks)')
    .eq('user_id', userId)
    .not('percentile', 'is', null)

  if (metconError) {
    console.error('Error fetching MetCon analytics:', metconError)
    return null
  }

  if (!metconCompletions || metconCompletions.length === 0) {
    return {
      totalMetCons: 0,
      avgPercentile: 0,
      timeDomains: [],
      heatmapCells: [],
    }
  }

  // Process heatmap - extract exercises from tasks, just like web app
  const timeDomains = new Set<string>()
  const heatmapMap: Record<string, any> = {}

  ;(metconCompletions as any[]).forEach((completion: any) => {
    const metcon = completion.metcons
    if (!metcon || !metcon.time_range) return

    const percentile = parseFloat(completion.percentile) || 0
    if (percentile === 0) return

    const timeRange = metcon.time_range
    timeDomains.add(timeRange)

    // Extract exercises from tasks (like web app does)
    const tasks = metcon.tasks || []
    tasks.forEach((task: any) => {
      const exerciseName = task.exercise
      if (!exerciseName) return

      const key = `${exerciseName}-${timeRange}`

      if (!heatmapMap[key]) {
        heatmapMap[key] = {
          exercise_name: exerciseName,
          time_range: timeRange,
          session_count: 0,
          total_percentile: 0,
        }
      }

      heatmapMap[key].session_count += 1
      heatmapMap[key].total_percentile += percentile
    })
  })

  // Calculate averages
  const heatmapCells = Object.values(heatmapMap).map((cell: any) => ({
    exercise_name: cell.exercise_name,
    time_range: cell.time_range,
    session_count: cell.session_count,
    avg_percentile:
      cell.session_count > 0
        ? Math.round(cell.total_percentile / cell.session_count)
        : 0,
  }))

  // Calculate overall average percentile from program_metcons directly
  const totalPercentiles = (metconCompletions as any[]).reduce(
    (sum: number, c: any) => sum + (parseFloat(c.percentile) || 0),
    0
  )
  const avgPercentile =
    metconCompletions.length > 0
      ? Math.round(totalPercentiles / metconCompletions.length)
      : 0

  return {
    totalMetCons: metconCompletions.length,
    avgPercentile,
    timeDomains: Array.from(timeDomains),
    heatmapCells,
  }
}

// Fetch Engine Analytics
export async function fetchEngineAnalytics(userId: number, programId?: number): Promise<any | null> {
  const supabase = createClient()

  try {
    // Fetch workout sessions (engine workouts)
    let query = supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
    
    // Filter by program_id if provided (include old sessions with program_id IS NULL for backward compatibility)
    if (programId) {
      query = query.or(`program_id.eq.${programId},program_id.is.null`)
    }
    
    const { data: sessions, error: sessionsError } = await query
      .order('date', { ascending: false })

    if (sessionsError) {
      console.error('Error fetching engine sessions:', sessionsError)
      return null
    }

    // Separate time trials from regular sessions
    const timeTrials = sessions?.filter((s: any) => s.day_type === 'time_trial') || []
    const regularSessions = sessions?.filter((s: any) => s.day_type !== 'time_trial') || []

    // Get unique modalities
    const modalities = [...new Set(sessions?.map((s: any) => s.modality).filter(Boolean))] as string[]

    // Calculate average performance ratio
    const sessionsWithRatio = regularSessions.filter((s: any) => s.performance_ratio !== null)
    const avgPerformanceRatio = sessionsWithRatio.length > 0
      ? sessionsWithRatio.reduce((sum: number, s: any) => sum + parseFloat(s.performance_ratio), 0) / sessionsWithRatio.length
      : null

    return {
      totalSessions: regularSessions.length,
      totalTimeTrials: timeTrials.length,
      avgPerformanceRatio,
      modalities,
      sessions: regularSessions,
      timeTrials,
    }
  } catch (error) {
    console.error('Error in fetchEngineAnalytics:', error)
    return null
  }
}

