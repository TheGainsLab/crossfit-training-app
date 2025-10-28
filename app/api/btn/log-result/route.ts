import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface LogResultRequest {
  workoutId: number
  userScore: string
  notes?: string
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

// =============================================================================
// MAIN API HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
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
        { status: 404 }
      )
    }

    const { workoutId, userScore, notes }: LogResultRequest = await request.json()

    if (!workoutId || !userScore) {
      return NextResponse.json(
        { error: 'Missing required fields: workoutId, userScore' },
        { status: 400 }
      )
    }

    console.log(`🔥 BTN result logging for workout ${workoutId}, user ${userData.id}`)

    // Step 1: Fetch the workout
    const { data: workout, error: workoutError } = await supabase
      .from('program_metcons')
      .select('id, workout_name, workout_format, median_score, excellent_score, user_id')
      .eq('id', workoutId)
      .eq('workout_type', 'btn')
      .single()

    if (workoutError || !workout) {
      console.error('❌ Workout not found:', workoutError)
      return NextResponse.json(
        { error: 'Workout not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (workout.user_id !== userData.id) {
      return NextResponse.json(
        { error: 'Unauthorized - not your workout' },
        { status: 403 }
      )
    }

    // Step 2: Check if we have benchmarks
    if (!workout.median_score || !workout.excellent_score) {
      return NextResponse.json(
        { error: 'Workout missing benchmark scores - cannot calculate percentile' },
        { status: 400 }
      )
    }

    console.log(`📊 Workout: ${workout.workout_name}, Format: ${workout.workout_format}`)
    console.log(`📈 Benchmarks - Median: ${workout.median_score}, Excellent: ${workout.excellent_score}`)
    console.log(`👤 User score: ${userScore}`)

    // Step 3: Parse scores
    let parsedUserScore
    try {
      parsedUserScore = parseWorkoutScore(userScore, workout.workout_format)
    } catch (parseError: any) {
      console.error('❌ Error parsing user score:', parseError)
      return NextResponse.json(
        { error: `Invalid score format: ${userScore}` },
        { status: 400 }
      )
    }

    const medianValue = parseBenchmarkScore(workout.median_score, workout.workout_format)
    const excellentValue = parseBenchmarkScore(workout.excellent_score, workout.workout_format)

    console.log(`🔢 Parsed values - User: ${parsedUserScore.value}, Median: ${medianValue}, Excellent: ${excellentValue}`)

    // Step 4: Calculate percentile
    const lowerIsBetter = isLowerBetter(workout.workout_format)
    const percentile = calculatePercentile(
      parsedUserScore.value,
      medianValue,
      excellentValue,
      lowerIsBetter
    )

    const performanceTier = getPerformanceTier(percentile)

    console.log(`✅ Calculated percentile: ${percentile}% (${performanceTier})`)

    // Step 5: Update the workout
    const { data: updatedWorkout, error: updateError } = await supabase
      .from('program_metcons')
      .update({
        user_score: userScore,
        percentile: percentile, // Save as number, not string (DB column is numeric(5,2))
        performance_tier: performanceTier,
        excellent_score: workout.excellent_score, // Keep existing
        median_score: workout.median_score,       // Keep existing
        completed_at: new Date().toISOString(),
        notes: notes || null
      })
      .eq('id', workoutId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating workout:', updateError)
      console.error('❌ Update error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        { error: 'Failed to save result', details: updateError.message },
        { status: 500 }
      )
    }

    console.log(`💾 Result saved successfully`)

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
    })

  } catch (error) {
    console.error('❌ BTN result logging error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
