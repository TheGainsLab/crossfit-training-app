import { NextRequest, NextResponse } from 'next/server'
import { createClientForRequest } from '@/app/api/utils/create-client-mobile'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { populateExercisePercentileLog } from '@/app/api/utils/populate-exercise-percentile-log'

interface LogResultRequest {
  workoutId: number
  userScore: string
  notes?: string
  avgHeartRate?: number
  maxHeartRate?: number
  taskCompletions?: Array<{exerciseName: string, rpe: number, quality: string}>
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
// MAIN API HANDLER
// =============================================================================

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientForRequest(request)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { 
          status: 401,
          headers: corsHeaders
        }
      )
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { 
          status: 404,
          headers: corsHeaders
        }
      )
    }

    const { workoutId, userScore, notes, avgHeartRate, maxHeartRate, taskCompletions }: LogResultRequest = await request.json()

    if (!workoutId || !userScore) {
      return NextResponse.json(
        { error: 'Missing required fields: workoutId, userScore' },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    // Step 1: Fetch the workout
    const { data: workout, error: workoutError } = await supabase
      .from('program_metcons')
      .select('id, workout_name, workout_format, median_score, excellent_score, user_id, workout_type')
      .eq('id', workoutId)
      .eq('workout_type', 'btn')
      .single()

    if (workoutError || !workout) {
      console.error('❌ Workout not found:', workoutError)
      return NextResponse.json(
        { error: 'Workout not found' },
        { 
          status: 404,
          headers: corsHeaders
        }
      )
    }

    // Verify ownership
    if (workout.user_id !== userData.id) {
      return NextResponse.json(
        { error: 'Unauthorized - not your workout' },
        { 
          status: 403,
          headers: corsHeaders
        }
      )
    }

    // Step 2: Check if we have benchmarks
    if (!workout.median_score || !workout.excellent_score) {
      return NextResponse.json(
        { error: 'Workout missing benchmark scores - cannot calculate percentile' },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    // Step 3: Parse scores
    let parsedUserScore
    try {
      parsedUserScore = parseWorkoutScore(userScore, workout.workout_format)
    } catch (parseError: any) {
      console.error('❌ Error parsing user score:', parseError)
      return NextResponse.json(
        { error: `Invalid score format: ${userScore}` },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
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
      percentile: percentile, // Save as number, not string (DB column is numeric(5,2))
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
      console.error('❌ Update error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        { error: 'Failed to save result', details: updateError.message },
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }


    // Step 6: Log task-level completions to performance_logs (if provided)
    if (taskCompletions && taskCompletions.length > 0 && updatedWorkout) {
      // Create service role client for performance_logs writes
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Log each task to performance_logs
      const taskLogPromises = taskCompletions.map(async (task) => {
        // Convert quality letter grade to numeric
        const qualityNumeric = task.quality ? 
          { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[task.quality] : null

        // For BTN workouts, program_id, week, day are null
        // Use a unique identifier: user_id + exercise_name + workout_id (in result) + logged_at
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
          result: `BTN Workout ${workoutId}: ${workout.workout_name || 'Workout'}`, // Use 'result' column, not 'notes'
          logged_at: new Date().toISOString()
        }

        // Check for existing log (for BTN, we check by user_id, exercise_name, and result containing workout_id)
        const { data: existingLog } = await serviceSupabase
          .from('performance_logs')
          .select('id')
          .eq('user_id', userData.id)
          .eq('exercise_name', task.exerciseName)
          .eq('block', 'BTN')
          .like('result', `%BTN Workout ${workoutId}%`) // Use 'result' column, not 'notes'
          .order('logged_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingLog) {
          // Update existing log
          const { error: updateErr } = await serviceSupabase
            .from('performance_logs')
            .update(perfLogData)
            .eq('id', existingLog.id)

          if (updateErr) {
            console.error(`❌ Error updating performance log for ${task.exerciseName}:`, updateErr)
          } else {
          }
        } else {
          // Insert new log
          const { error: insertErr } = await serviceSupabase
            .from('performance_logs')
            .insert(perfLogData)

          if (insertErr) {
            console.error(`❌ Error inserting performance log for ${task.exerciseName}:`, insertErr)
          } else {
          }
        }
      })

      await Promise.all(taskLogPromises)
    }

    // Populate exercise_percentile_log (skip for BTN - metcon_id is required but BTN workouts don't have one)
    if (updatedWorkout && updatedWorkout.workout_type !== 'btn') {
      // Only populate for Premium metcons (BTN workouts don't have metcon_id which is required)
      // Fetch full workout to get week/day
      const { data: fullWorkout } = await supabase
        .from('program_metcons')
        .select('week, day')
        .eq('id', workoutId)
        .single()

      if (fullWorkout) {
        // Create service role client for helper function (needs elevated permissions)
        const serviceSupabase = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        await populateExercisePercentileLog(
          serviceSupabase,
          workoutId,
          userData.id,
          percentile,
          performanceTier,
          fullWorkout.week || 1,
          fullWorkout.day || 1,
          new Date().toISOString()
        )
      }
    }

    return NextResponse.json({
      success: true,
      percentile: percentile,
      performanceTier: performanceTier,
      benchmarks: {
        median: workout.median_score,
        excellent: workout.excellent_score,
        yourScore: userScore
      },
      calculation: {
        userScoreValue: parsedUserScore.value,
        medianValue,
        excellentValue,
        scoreType: parsedUserScore.type,
        lowerIsBetter
      }
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    console.error('❌ BTN result logging error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: corsHeaders
      }
    )
  }
}
