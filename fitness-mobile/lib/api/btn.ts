import { createClient } from '../supabase/client'

export interface BTNWorkout {
  id: number
  workout_name: string
  workout_format: string
  time_domain: string
  exercises: Array<{
    name?: string
    exercise?: string
    reps?: string | number
    weight?: string | number
  }>
  rounds: number | null
  amrap_time: number | null
  pattern: string | null
  user_score: string | null
  result_time: string | null
  result_rounds: number | null
  result_reps: number | null
  notes: string | null
  completed_at: string | null
  created_at: string
  percentile: string | null
  performance_tier: string | null
  median_score: string | null
  excellent_score: string | null
}

export interface BTNWorkoutStats {
  total: number
  completed: number
  incomplete: number
  completionRate: number
}

export interface BTNWorkoutsResponse {
  success: boolean
  workouts: BTNWorkout[]
  stats: BTNWorkoutStats
}

// =============================================================================
// SCORE PARSING UTILITIES
// =============================================================================

/**
 * Parse workout score to a comparable numeric value
 */
function parseWorkoutScore(score: string, format: string): { value: number; type: 'time' | 'reps' | 'rounds_reps' } {
  const cleanScore = score.trim().toLowerCase()
  
  // AMRAP format: "8 rounds + 15", "5+23", "10+0"
  if (format === 'AMRAP') {
    const roundsMatch = cleanScore.match(/(\d+)\s*(?:rounds?\s*)?(?:\+|plus)\s*(\d+)/)
    if (roundsMatch) {
      const rounds = parseInt(roundsMatch[1])
      const reps = parseInt(roundsMatch[2])
      return { 
        value: rounds * 1000 + reps, // Convert to comparable number
        type: 'rounds_reps' 
      }
    }
    // Just rounds: "8 rounds", "10"
    const roundsOnly = cleanScore.match(/(\d+)/)
    if (roundsOnly) {
      return {
        value: parseInt(roundsOnly[1]) * 1000,
        type: 'rounds_reps'
      }
    }
  }
  
  // Time format: "6:45", "12:34"
  if (cleanScore.includes(':')) {
    const parts = cleanScore.split(':').map(p => parseInt(p))
    if (parts.length === 2) {
      // MM:SS format - convert to total seconds
      return { 
        value: parts[0] * 60 + parts[1], 
        type: 'time' 
      }
    }
  }
  
  throw new Error(`Unable to parse workout score: ${score}`)
}

/**
 * Parse benchmark score (median or excellent)
 */
function parseBenchmarkScore(benchmarkStr: string, format: string): number {
  if (!benchmarkStr) return 0
  
  const cleaned = benchmarkStr.toString().trim()
  
  // AMRAP: "8+15" or "10+0"
  if (format === 'AMRAP') {
    const roundsMatch = cleaned.match(/(\d+)\+(\d+)/)
    if (roundsMatch) {
      const rounds = parseInt(roundsMatch[1])
      const reps = parseInt(roundsMatch[2])
      return rounds * 1000 + reps
    }
  }
  
  // Time format: "6:45"
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(p => parseInt(p))
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1] // Convert to seconds
    }
  }
  
  return parseFloat(cleaned) || 0
}

// =============================================================================
// PERCENTILE CALCULATION
// =============================================================================

/**
 * Calculate percentile using normal distribution
 * Same formula as Premium (/api/metcons/complete)
 */
function calculatePercentile(userScore: number, median: number, excellent: number, lowerIsBetter: boolean): number {
  // Calculate standard deviation from 50th and 90th percentile
  // In normal distribution: p90 ≈ mean + 1.28 × std_dev
  // So: std_dev ≈ (p90 - p50) / 1.28
  const stdDev = Math.abs(excellent - median) / 1.28
  
  if (stdDev === 0) return 50 // If no variation, assume median
  
  // Calculate Z-score
  const zScore = (userScore - median) / stdDev
  
  // For "lower is better" workouts (like time), invert the Z-score
  const adjustedZScore = lowerIsBetter ? -zScore : zScore
  
  // Convert Z-score to percentile using approximation of normal CDF
  const percentile = normalCDF(adjustedZScore) * 100
  
  // Clamp between 1 and 99 (avoid 0 and 100)
  return Math.max(1, Math.min(99, Math.round(percentile)))
}

/**
 * Approximation of the cumulative distribution function for standard normal distribution
 */
function normalCDF(z: number): number {
  // Using Abramowitz and Stegun approximation
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2.0)
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))))
  
  if (z > 0) prob = 1.0 - prob
  
  return prob
}

/**
 * Determine if lower scores are better based on workout format
 */
function isLowerBetter(format: string): boolean {
  return format === 'For Time' || format === 'Rounds For Time' // Time-based: lower is better
}

/**
 * Get performance tier based on percentile
 */
function getPerformanceTier(percentile: number): string {
  if (percentile >= 90) return 'Elite'
  if (percentile >= 75) return 'Advanced'
  if (percentile >= 60) return 'Good'
  if (percentile >= 40) return 'Average'
  if (percentile >= 25) return 'Below Average'
  return 'Needs Improvement'
}

/**
 * Calculate workout-level RPE and Quality averages from task completions
 */
async function calculateBTNWorkoutRPEAndQuality(
  supabase: any,
  userId: number,
  workoutId: number
): Promise<{ avgRpe: number | null; avgQuality: number | null }> {
  // Query performance_logs for all tasks in this BTN workout
  const { data: taskLogs, error } = await supabase
    .from('performance_logs')
    .select('rpe, completion_quality')
    .eq('user_id', userId)
    .eq('block', 'BTN')
    .like('result', `%BTN Workout ${workoutId}%`)
    .not('rpe', 'is', null) // Only count tasks with RPE

  if (error || !taskLogs || taskLogs.length === 0) {
    return { avgRpe: null, avgQuality: null }
  }

  // Calculate averages
  const validRpe = taskLogs.filter((t: any) => t.rpe !== null).map((t: any) => t.rpe as number)
  const validQuality = taskLogs.filter((t: any) => t.completion_quality !== null).map((t: any) => t.completion_quality as number)

  const avgRpe = validRpe.length > 0
    ? Math.round((validRpe.reduce((sum: number, rpe: number) => sum + rpe, 0) / validRpe.length) * 10) / 10
    : null

  const avgQuality = validQuality.length > 0
    ? Math.round((validQuality.reduce((sum: number, q: number) => sum + q, 0) / validQuality.length) * 10) / 10
    : null

  return { avgRpe, avgQuality }
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

export async function fetchBTNWorkouts(
  filter: 'all' | 'completed' | 'incomplete' = 'incomplete'
): Promise<BTNWorkoutsResponse> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // First, get ALL workouts for stats calculation (no filter applied)
    const { data: allWorkouts, error: allError } = await supabase
      .from('program_metcons')
      .select('id, completed_at')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (allError) {
      console.error('❌ Error fetching all workouts for stats:', allError)
      // Continue anyway, but stats will be 0
    }

    // Calculate stats from ALL workouts (not filtered)
    const totalWorkouts = (allWorkouts || []).length
    const completedWorkouts = (allWorkouts || []).filter(w => w.completed_at !== null).length
    const completionRate = totalWorkouts > 0 
      ? Math.round((completedWorkouts / totalWorkouts) * 100) 
      : 0

    // Now build query for filtered workout list (for display only)
    let query = supabase
      .from('program_metcons')
      .select('*')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')
      .order('created_at', { ascending: false })
      .limit(100)

    // Apply filters only to the workout list (not stats)
    if (filter === 'completed') {
      query = query.not('completed_at', 'is', null)
    } else if (filter === 'incomplete') {
      query = query.is('completed_at', null)
    }

    const { data: workouts, error } = await query

    if (error) {
      console.error('❌ Error fetching BTN workouts:', error)
      throw new Error(error.message)
    }

    return {
      success: true,
      workouts: workouts || [],
      stats: {
        total: totalWorkouts,
        completed: completedWorkouts,
        incomplete: totalWorkouts - completedWorkouts,
        completionRate
      }
    }
  } catch (error) {
    console.error('Error fetching BTN workouts:', error)
    throw error
  }
}

export interface LogResultRequest {
  workoutId: number
  userScore: string
  notes?: string
  avgHeartRate?: number
  maxHeartRate?: number
  taskCompletions?: Array<{
    exerciseName: string
    rpe: number
    quality: string
  }>
}

export interface LogResultResponse {
  success: boolean
  percentile: number
  performanceTier: string
  benchmarks?: {
    median: string
    excellent: string
    yourScore: string
  }
}

export async function logBTNResult(
  request: LogResultRequest
): Promise<LogResultResponse> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const { workoutId, userScore, notes, avgHeartRate, maxHeartRate, taskCompletions } = request

    if (!workoutId || !userScore) {
      throw new Error('Missing required fields: workoutId, userScore')
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // Step 1: Fetch the workout
    const { data: workout, error: workoutError } = await supabase
      .from('program_metcons')
      .select('id, workout_name, workout_format, median_score, excellent_score, user_id, workout_type')
      .eq('id', workoutId)
      .eq('workout_type', 'btn')
      .single()

    if (workoutError || !workout) {
      throw new Error('Workout not found')
    }

    // Verify ownership
    if (workout.user_id !== userData.id) {
      throw new Error('Unauthorized - not your workout')
    }

    // Step 2: Check if we have benchmarks
    if (!workout.median_score || !workout.excellent_score) {
      throw new Error('Workout missing benchmark scores - cannot calculate percentile')
    }

    // Step 3: Parse scores
    let parsedUserScore
    try {
      parsedUserScore = parseWorkoutScore(userScore, workout.workout_format)
    } catch (parseError: any) {
      throw new Error(`Invalid score format: ${userScore}`)
    }

    const medianValue = parseBenchmarkScore(workout.median_score, workout.workout_format)
    const excellentValue = parseBenchmarkScore(workout.excellent_score, workout.workout_format)

    // Step 4: Calculate percentile
    const lowerIsBetter = isLowerBetter(workout.workout_format)
    const percentile = calculatePercentile(
      parsedUserScore.value,
      medianValue,
      excellentValue,
      lowerIsBetter
    )

    const performanceTier = getPerformanceTier(percentile)

    // Calculate workout-level RPE/Quality from task completions (if provided)
    let avgRpe: number | null = null
    let avgQuality: number | null = null
    
    if (taskCompletions && taskCompletions.length > 0) {
      const validRpe = taskCompletions.filter((t: any) => t.rpe !== null && t.rpe !== undefined).map((t: any) => t.rpe)
      const validQuality = taskCompletions
        .filter((t: any) => t.quality !== null && t.quality !== undefined)
        .map((t: any) => {
          const q = t.quality
          return q === 'A' ? 4 : q === 'B' ? 3 : q === 'C' ? 2 : q === 'D' ? 1 : null
        })
        .filter((q: any) => q !== null) as number[]

      avgRpe = validRpe.length > 0
        ? Math.round((validRpe.reduce((sum: number, rpe: number) => sum + rpe, 0) / validRpe.length) * 10) / 10
        : null

      avgQuality = validQuality.length > 0
        ? Math.round((validQuality.reduce((sum: number, q: number) => sum + q, 0) / validQuality.length) * 10) / 10
        : null
    } else {
      // If no task completions provided, try to calculate from existing performance_logs
      const calculated = await calculateBTNWorkoutRPEAndQuality(supabase, userData.id, workoutId)
      avgRpe = calculated.avgRpe
      avgQuality = calculated.avgQuality
    }

    // Step 5: Update the workout
    const updateData: any = {
      user_score: userScore,
      percentile: percentile, // Save as number (DB column is numeric(5,2))
      performance_tier: performanceTier,
      excellent_score: workout.excellent_score, // Keep existing
      median_score: workout.median_score,       // Keep existing
      completed_at: new Date().toISOString(),
      notes: notes || null,
      avg_rpe: avgRpe,
      avg_quality: avgQuality
    }

    // Add heart rate data if provided
    if (avgHeartRate !== undefined && avgHeartRate !== null) {
      updateData.avg_heart_rate = avgHeartRate
    }
    if (maxHeartRate !== undefined && maxHeartRate !== null) {
      updateData.max_heart_rate = maxHeartRate
    }

    const { data: updatedWorkout, error: updateError } = await supabase
      .from('program_metcons')
      .update(updateData)
      .eq('id', workoutId)
      .select('*, workout_type')
      .single()

    if (updateError) {
      console.error('❌ Error updating workout:', updateError)
      throw new Error(`Failed to save result: ${updateError.message}`)
    }

    // Step 6: Log task-level completions to performance_logs (if provided)
    if (taskCompletions && taskCompletions.length > 0 && updatedWorkout) {
      // Log each task to performance_logs
      const taskLogPromises = taskCompletions.map(async (task) => {
        // Convert quality letter grade to numeric
        const qualityNumeric = task.quality ? 
          { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[task.quality] : null

        // For BTN workouts, program_id, week, day are null
        const perfLogData = {
          program_id: null, // BTN workouts don't have program_id
          user_id: userData.id,
          program_workout_id: null,
          week: null, // BTN workouts don't have week
          day: null, // BTN workouts don't have day
          block: 'BTN', // Use 'BTN' to distinguish from Premium metcons
          exercise_name: task.exerciseName,
          set_number: 1,
          rpe: task.rpe,
          completion_quality: qualityNumeric,
          quality_grade: task.quality,
          result: `BTN Workout ${workoutId}: ${workout.workout_name || 'Workout'}`,
          logged_at: new Date().toISOString()
        }

        // Check for existing log (for BTN, we check by user_id, exercise_name, and result containing workout_id)
        const { data: existingLog } = await supabase
          .from('performance_logs')
          .select('id')
          .eq('user_id', userData.id)
          .eq('exercise_name', task.exerciseName)
          .eq('block', 'BTN')
          .like('result', `%BTN Workout ${workoutId}%`)
          .order('logged_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingLog) {
          // Update existing log
          const { error: updateErr } = await supabase
            .from('performance_logs')
            .update(perfLogData)
            .eq('id', existingLog.id)

          if (updateErr) {
            console.error(`❌ Error updating performance log for ${task.exerciseName}:`, updateErr)
          }
        } else {
          // Insert new log
          const { error: insertErr } = await supabase
            .from('performance_logs')
            .insert(perfLogData)

          if (insertErr) {
            console.error(`❌ Error inserting performance log for ${task.exerciseName}:`, insertErr)
          }
        }
      })

      await Promise.all(taskLogPromises)
    }

    return {
      success: true,
      percentile: percentile,
      performanceTier: performanceTier,
      benchmarks: {
        median: workout.median_score,
        excellent: workout.excellent_score,
        yourScore: userScore
      }
    }
  } catch (error) {
    console.error('Error logging BTN result:', error)
    throw error
  }
}

export async function deleteBTNWorkout(workoutId: number): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // Verify workout belongs to user and delete
    const { error } = await supabase
      .from('program_metcons')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (error) {
      console.error('❌ Error deleting BTN workout:', error)
      throw new Error(error.message)
    }
  } catch (error) {
    console.error('Error deleting BTN workout:', error)
    throw error
  }
}

export interface BTNUserProfile {
  equipment: string[]
  gender: string
  units: string
  skills: { [exerciseName: string]: string }
  oneRMs: { [exerciseName: string]: number }
}

export interface BTNUserProfileResponse {
  success: boolean
  profile: BTNUserProfile
}

export async function fetchBTNUserProfile(): Promise<BTNUserProfileResponse> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, gender, units')
      .eq('auth_id', session.user.id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // Fetch equipment
    const { data: equipment, error: equipmentError } = await supabase
      .from('user_equipment')
      .select('equipment_name')
      .eq('user_id', userData.id)

    if (equipmentError) {
      console.error('Equipment fetch error:', equipmentError)
      throw new Error('Failed to fetch equipment')
    }

    // Fetch skills
    const { data: skills, error: skillsError } = await supabase
      .from('user_skills')
      .select('skill_name, skill_level')
      .eq('user_id', userData.id)

    if (skillsError) {
      console.error('Skills fetch error:', skillsError)
      throw new Error('Failed to fetch skills')
    }

    // Fetch 1RMs
    const { data: oneRMs, error: oneRMsError } = await supabase
      .from('user_one_rms')
      .select('exercise_name, one_rm')
      .eq('user_id', userData.id)

    if (oneRMsError) {
      console.error('1RMs fetch error:', oneRMsError)
      throw new Error('Failed to fetch 1RMs')
    }

    // Format response
    const equipmentArray = equipment?.map(e => e.equipment_name) || []
    
    // Convert skills array to object for easy lookup
    const skillsObject: { [key: string]: string } = {}
    skills?.forEach(skill => {
      skillsObject[skill.skill_name] = skill.skill_level
    })

    // Convert 1RMs array to object for easy lookup
    const oneRMsObject: { [key: string]: number } = {}
    oneRMs?.forEach(rm => {
      oneRMsObject[rm.exercise_name] = rm.one_rm
    })

    const profile: BTNUserProfile = {
      equipment: equipmentArray,
      gender: userData.gender || 'Male',
      units: userData.units || 'Imperial (lbs)',
      skills: skillsObject,
      oneRMs: oneRMsObject
    }

    return {
      success: true,
      profile
    }
  } catch (error) {
    console.error('Error fetching BTN user profile:', error)
    throw error
  }
}

export interface SaveBTNWorkoutsResponse {
  success: boolean
  savedCount: number
  workouts: any[]
}

export async function saveBTNWorkouts(workouts: any[]): Promise<SaveBTNWorkoutsResponse> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    if (!workouts || !Array.isArray(workouts)) {
      throw new Error('Invalid workouts data - expected array')
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // Check incomplete workout limit (20 incomplete workouts max)
    const MAX_INCOMPLETE_WORKOUTS = 20
    const { count: incompleteWorkoutCount, error: incompleteCountError } = await supabase
      .from('program_metcons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')
      .is('completed_at', null) // Only count incomplete workouts

    if (incompleteCountError) {
      console.error('⚠️ Error counting incomplete workouts:', incompleteCountError)
      // Continue anyway - don't block on count error
    }

    const currentIncomplete = incompleteWorkoutCount || 0
    const availableSlots = MAX_INCOMPLETE_WORKOUTS - currentIncomplete

    if (workouts.length > availableSlots) {
      throw new Error(
        `You can only store ${MAX_INCOMPLETE_WORKOUTS} incomplete workouts. You currently have ${currentIncomplete} incomplete workouts. Please complete or delete some workouts to make room.`
      )
    }

    // Get count of existing BTN workouts for this user to determine starting number
    const { count: existingWorkoutCount, error: countError } = await supabase
      .from('program_metcons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (countError) {
      console.error('⚠️ Error counting existing workouts:', countError)
      // Continue anyway, start from 1
    }

    const startNumber = (existingWorkoutCount || 0) + 1

    // Import exerciseEquipment for calculating required equipment
    const { exerciseEquipment } = await import('../btn/data')

    // Transform BTN workouts to database format
    const workoutRecords = workouts.map((workout: any, index: number) => {
      // Calculate required equipment from exercises
      const equipmentSet = new Set<string>()
      workout.exercises.forEach((exercise: any) => {
        const exerciseName = exercise.name || exercise.exercise
        const equipment = exerciseEquipment[exerciseName] || []
        equipment.forEach(eq => equipmentSet.add(eq))
      })
      const requiredEquipment = Array.from(equipmentSet)

      return {
        user_id: userData.id,
        workout_type: 'btn',
        workout_name: `Workout ${startNumber + index}`, // Sequential naming
        workout_format: workout.format,
        time_domain: workout.timeDomain,
        exercises: workout.exercises,
        required_equipment: requiredEquipment.length > 0 ? requiredEquipment : null,
        rounds: workout.rounds || null,
        amrap_time: workout.amrapTime || null,
        pattern: workout.pattern || null,
        
        // Benchmark scores for percentile calculation
        median_score: workout.medianScore || null,
        excellent_score: workout.excellentScore || null,
        
        // Result fields (empty until user logs result)
        user_score: null,
        percentile: null,
        completed_at: null,
        notes: null,
        result: null,
        result_time: null,
        result_rounds: null,
        result_reps: null,
        
        // Program fields (null for BTN - not part of a program)
        program_id: null,
        program_workout_id: null,
        week: null,
        day: null,
        metcon_id: null,
      }
    })

    const { data, error } = await supabase
      .from('program_metcons')
      .insert(workoutRecords)
      .select()

    if (error) {
      console.error('❌ Error saving BTN workouts:', error)
      throw new Error(error.message)
    }

    return {
      success: true,
      savedCount: data.length,
      workouts: data || []
    }
  } catch (error) {
    console.error('Error saving BTN workouts:', error)
    throw error
  }
}

export interface BTNAnalyticsData {
  exercises: string[]
  timeDomains: string[]
  heatmapCells: Array<{
    exercise_name: string
    time_range: string | null
    session_count: number
    avg_percentile: number
    avg_heart_rate?: number | null
    max_heart_rate?: number | null
    avg_rpe?: number | null
    avg_quality?: number | null
  }>
  exerciseAverages: Array<{
    exercise_name: string
    total_sessions: number
    overall_avg_percentile: number
  }>
  globalFitnessScore: number
  totalCompletedWorkouts: number
  timeDomainWorkoutCounts: Record<string, number>
}

export interface BTNAnalyticsResponse {
  success: boolean
  data: BTNAnalyticsData
}

// Map BTN time domains to Premium time ranges
const timeDomainMapping: { [key: string]: string } = {
  '1:00 - 5:00': '1:00–5:00',
  '5:00 - 10:00': '5:00–10:00',
  '10:00 - 15:00': '10:00–15:00',
  '15:00 - 20:00': '15:00–20:00',
  '20:00+': '20:00–30:00'
}

export async function fetchBTNAnalytics(equipmentFilter?: 'all' | 'barbell' | 'no_barbell' | 'gymnastics'): Promise<BTNAnalyticsResponse> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // Fetch all BTN workouts for this user (only completed ones with percentile)
    const { data: workouts, error: workoutsError } = await supabase
      .from('program_metcons')
      .select('id, time_domain, exercises, workout_name, completed_at, percentile, avg_heart_rate, max_heart_rate, required_equipment')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')
      .not('percentile', 'is', null)
      .not('completed_at', 'is', null)

    if (workoutsError) {
      console.error('❌ Failed to fetch BTN workouts:', workoutsError)
      throw new Error('Failed to fetch workouts')
    }

    if (!workouts || workouts.length === 0) {
      return {
        success: true,
        data: {
          exercises: [],
          timeDomains: [],
          heatmapCells: [],
          exerciseAverages: [],
          globalFitnessScore: 0,
          totalCompletedWorkouts: 0,
          timeDomainWorkoutCounts: {}
        }
      }
    }

    // Import exerciseEquipment for filtering
    const { exerciseEquipment } = await import('../btn/data')

    // Helper function to check if an exercise matches the equipment filter
    const exerciseMatchesFilter = (exerciseName: string, filter: string): boolean => {
      const equipment = exerciseEquipment[exerciseName] || []
      
      if (filter === 'barbell') {
        return equipment.includes('Barbell')
      }
      if (filter === 'no_barbell') {
        return !equipment.includes('Barbell')
      }
      if (filter === 'gymnastics') {
        return equipment.some(eq => 
          eq === 'Pullup Bar or Rig' || 
          eq === 'High Rings' || 
          eq === 'Climbing Rope'
        )
      }
      return true // 'all' or undefined - no filter
    }

    // Fetch RPE/Quality data from performance_logs
    const workoutIds = workouts.map(w => w.id)
    const { data: rpeQualityData } = await supabase
      .from('performance_logs')
      .select('exercise_name, rpe, completion_quality, result')
      .eq('user_id', userData.id)
      .eq('block', 'BTN')
      .not('rpe', 'is', null)
      .in('workout_id', workoutIds.length > 0 ? workoutIds : [0])

    // Process workouts into heat map data
    const exerciseTimeMap = new Map<string, Map<string, { 
      workoutIds: Set<number>
      totalPercentile: number
      totalAvgHR: number
      totalMaxHR: number
      hrCount: number
      totalRpe: number
      rpeCount: number
      totalQuality: number
      qualityCount: number
    }>>()
    const exerciseOverallMap = new Map<string, { workoutIds: Set<number>, totalPercentile: number }>()
    const timeDomainWorkoutMap = new Map<string, Set<number>>()

    // Create RPE/Quality lookup map
    const rpeQualityMap = new Map<string, { rpe: number, quality: number }>()
    rpeQualityData?.forEach((log: any) => {
      const workoutMatch = log.result?.match(/BTN Workout (\d+)/)
      if (workoutMatch) {
        const workoutId = parseInt(workoutMatch[1])
        const key = `${workoutId}_${log.exercise_name}`
        if (log.rpe !== null && log.rpe !== undefined) {
          const existing = rpeQualityMap.get(key)
          if (!existing) {
            rpeQualityMap.set(key, {
              rpe: log.rpe,
              quality: log.completion_quality || 0
            })
          }
        }
      }
    })

    workouts.forEach(workout => {
      const percentile = parseFloat(workout.percentile as string)
      if (isNaN(percentile)) return

      const timeRange = timeDomainMapping[workout.time_domain as string] || null
      if (!timeRange) return

      const exercises = workout.exercises || []
      if (!Array.isArray(exercises) || exercises.length === 0) return

      exercises.forEach((exercise: any) => {
        const exerciseName = exercise.name
        if (!exerciseName) return

        // Apply equipment filter at exercise level
        if (equipmentFilter && equipmentFilter !== 'all') {
          if (!exerciseMatchesFilter(exerciseName, equipmentFilter)) {
            return // Skip this exercise
          }
        }

        // Track by time domain
        if (!exerciseTimeMap.has(exerciseName)) {
          exerciseTimeMap.set(exerciseName, new Map())
        }
        const exerciseMap = exerciseTimeMap.get(exerciseName)!
        
        if (!exerciseMap.has(timeRange)) {
          exerciseMap.set(timeRange, { 
            workoutIds: new Set(),
            totalPercentile: 0, 
            totalAvgHR: 0, 
            totalMaxHR: 0, 
            hrCount: 0,
            totalRpe: 0,
            rpeCount: 0,
            totalQuality: 0,
            qualityCount: 0
          })
        }
        const timeData = exerciseMap.get(timeRange)!
        
        if (!timeData.workoutIds.has(workout.id)) {
          timeData.workoutIds.add(workout.id)
          timeData.totalPercentile += percentile
          
          const avgHR = workout.avg_heart_rate ? parseFloat(workout.avg_heart_rate as string) : null
          const maxHR = workout.max_heart_rate ? parseFloat(workout.max_heart_rate as string) : null
          
          if (avgHR !== null && !isNaN(avgHR)) {
            timeData.totalAvgHR += avgHR
            timeData.hrCount++
          }
          if (maxHR !== null && !isNaN(maxHR)) {
            timeData.totalMaxHR += maxHR
          }
          
          // Track RPE/Quality
          const rpeKey = `${workout.id}_${exerciseName}`
          const rpeQuality = rpeQualityMap.get(rpeKey)
          if (rpeQuality) {
            timeData.totalRpe += rpeQuality.rpe
            timeData.rpeCount++
            if (rpeQuality.quality > 0) {
              timeData.totalQuality += rpeQuality.quality
              timeData.qualityCount++
            }
          }
        }

        // Track overall averages
        if (!exerciseOverallMap.has(exerciseName)) {
          exerciseOverallMap.set(exerciseName, { workoutIds: new Set(), totalPercentile: 0 })
        }
        const overallData = exerciseOverallMap.get(exerciseName)!
        if (!overallData.workoutIds.has(workout.id)) {
          overallData.workoutIds.add(workout.id)
          overallData.totalPercentile += percentile
        }
        
        // Track unique workouts per time domain
        if (!timeDomainWorkoutMap.has(timeRange)) {
          timeDomainWorkoutMap.set(timeRange, new Set())
        }
        timeDomainWorkoutMap.get(timeRange)!.add(workout.id)
      })
    })

    // Convert to heat map cell format
    const heatmapCells: BTNAnalyticsData['heatmapCells'] = []
    
    exerciseTimeMap.forEach((timeMap, exerciseName) => {
      const overallData = exerciseOverallMap.get(exerciseName)!
      
      timeMap.forEach((data, timeRange) => {
        const sortOrder = {
          '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
          '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
        }[timeRange] || 7

        const workoutCount = data.workoutIds.size
        heatmapCells.push({
          exercise_name: exerciseName,
          time_range: timeRange,
          session_count: workoutCount,
          avg_percentile: workoutCount > 0 ? Math.round(data.totalPercentile / workoutCount) : 0,
          avg_heart_rate: data.hrCount > 0 ? Math.round(data.totalAvgHR / data.hrCount) : null,
          max_heart_rate: data.hrCount > 0 ? Math.round(data.totalMaxHR / data.hrCount) : null,
          avg_rpe: data.rpeCount > 0 ? Math.round((data.totalRpe / data.rpeCount) * 10) / 10 : null,
          avg_quality: data.qualityCount > 0 ? Math.round((data.totalQuality / data.qualityCount) * 10) / 10 : null,
        })
      })
    })

    // Get unique exercises and time domains
    const exercises = [...new Set(heatmapCells.map(cell => cell.exercise_name))].sort()
    const timeDomains = [...new Set(heatmapCells.map(cell => cell.time_range).filter((d): d is string => d !== null))]
      .sort((a, b) => {
        const order: { [key: string]: number } = {
          '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3, 
          '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
        }
        return (order[a] || 7) - (order[b] || 7)
      })

    // Calculate exercise totals
    const exerciseAverages = exercises.map(exerciseName => {
      const exerciseCells = heatmapCells.filter(cell => cell.exercise_name === exerciseName)
      const totalWorkouts = exerciseCells.reduce((sum, cell) => sum + cell.session_count, 0)
      const weightedPercentileSum = exerciseCells.reduce((sum, cell) => 
        sum + (cell.avg_percentile * cell.session_count), 0)
      const overallAvgPercentile = totalWorkouts > 0 
        ? Math.round(weightedPercentileSum / totalWorkouts) 
        : 0
      
      return {
        exercise_name: exerciseName,
        total_sessions: totalWorkouts,
        overall_avg_percentile: overallAvgPercentile
      }
    })

    // Calculate global fitness score
    const totalWeightedPercentile = heatmapCells.reduce((sum, cell) => 
      sum + (cell.avg_percentile * cell.session_count), 0)
    const totalWorkouts = heatmapCells.reduce((sum, cell) => sum + cell.session_count, 0)
    const globalFitnessScore = totalWorkouts > 0 
      ? Math.round(totalWeightedPercentile / totalWorkouts)
      : 0

    // Build time domain workout counts
    const timeDomainWorkoutCounts: Record<string, number> = {}
    timeDomainWorkoutMap.forEach((workoutIds, timeRange) => {
      timeDomainWorkoutCounts[timeRange] = workoutIds.size
    })

    return {
      success: true,
      data: {
        exercises,
        timeDomains,
        heatmapCells,
        exerciseAverages,
        globalFitnessScore,
        totalCompletedWorkouts: workouts.length,
        timeDomainWorkoutCounts
      }
    }
  } catch (error) {
    console.error('Error fetching BTN analytics:', error)
    throw error
  }
}









