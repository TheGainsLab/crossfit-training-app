import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MetConCompletionData {
  programId: number
  userId: number
  week: number
  day: number
  workoutScore: string
  notes?: string
}

// =============================================================================
// SCORE PARSING UTILITIES
// =============================================================================

/**
 * Parse workout score to a comparable numeric value
 */
function parseWorkoutScore(score: string): { value: number; type: 'time' | 'reps' | 'rounds_reps' } {
  const cleanScore = score.trim().toLowerCase()
  
  // Time format: "6:45", "12:34", "1:23:45"
  if (cleanScore.includes(':')) {
    const parts = cleanScore.split(':').map(p => parseInt(p))
    if (parts.length === 2) {
      // MM:SS format
      return { 
        value: parts[0] * 60 + parts[1], 
        type: 'time' 
      }
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return { 
        value: parts[0] * 3600 + parts[1] * 60 + parts[2], 
        type: 'time' 
      }
    }
  }
  
  // Rounds + reps format: "8 rounds + 15", "5+23"
  const roundsMatch = cleanScore.match(/(\d+)\s*(?:rounds?\s*)?(?:\+|plus)\s*(\d+)/)
  if (roundsMatch) {
    const rounds = parseInt(roundsMatch[1])
    const reps = parseInt(roundsMatch[2])
    return { 
      value: rounds * 1000 + reps, // Convert to comparable number (rounds are weighted heavily)
      type: 'rounds_reps' 
    }
  }
  
  // Simple number: "250", "42"
  const numericMatch = cleanScore.match(/(\d+(?:\.\d+)?)/)
  if (numericMatch) {
    return { 
      value: parseFloat(numericMatch[1]), 
      type: 'reps' 
    }
  }
  
  throw new Error(`Unable to parse workout score: ${score}`)
}

/**
 * Parse benchmark score (from metcons table)
 */
function parseBenchmarkScore(benchmarkStr: string): number {
  if (!benchmarkStr) return 0
  
  // Remove any non-numeric characters except : and .
  const cleaned = benchmarkStr.toString().trim()
  
  // Time format
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(p => parseInt(p))
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
  }
  
  // Numeric format
  return parseFloat(cleaned) || 0
}

// =============================================================================
// PERCENTILE CALCULATION
// =============================================================================

/**
 * Calculate percentile using normal distribution
 */
function calculatePercentile(userScore: number, mean: number, stdDev: number, lowerIsBetter: boolean): number {
  if (stdDev === 0) return 50 // If no variation, assume median
  
  // Calculate Z-score
  const zScore = (userScore - mean) / stdDev
  
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
 * Determine if lower scores are better based on workout type
 */
function isLowerBetter(scoreType: string): boolean {
  return scoreType === 'time' // Time-based workouts: lower is better
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
    const completionData: MetConCompletionData = await request.json()
    
    console.log('🔥 MetCon completion request:', completionData)

    // 1. Look up the correct metcon for this program/week/day
    const { data: programMetcon, error: lookupError } = await supabase
      .from('program_metcons')
      .select('metcon_id')
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .single()

    if (lookupError || !programMetcon) {
      console.error('❌ Error finding metcon mapping:', lookupError)
      return NextResponse.json({ 
        success: false, 
        error: 'No MetCon found for this program/week/day combination' 
      }, { status: 404 })
    }

    const metconId = programMetcon.metcon_id

    // 2. Get the metcon benchmarks
    const { data: metcon, error: metconError } = await supabase
      .from('metcons')
.select('male_p50, male_p90, male_std_dev, female_p50, female_p90, female_std_dev, workout_id, format')
      .eq('id', metconId)
      .single()

    if (metconError || !metcon) {
      console.error('❌ Error fetching metcon:', metconError)
      return NextResponse.json({ 
        success: false, 
        error: 'Metcon benchmark data not found' 
      }, { status: 404 })
    }

    // 3. Get user gender
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('gender')
      .eq('id', completionData.userId)
      .single()

    if (userError) {
      console.error('❌ Error fetching user data:', userError)
      return NextResponse.json({ 
        success: false, 
        error: 'User data not found' 
      }, { status: 404 })
    }

    // 4. Parse user score
    let parsedUserScore
    try {
      parsedUserScore = parseWorkoutScore(completionData.workoutScore)
    } catch (parseError) {
      console.error('❌ Error parsing user score:', parseError)
      return NextResponse.json({ 
        success: false, 
        error: `Invalid score format: ${completionData.workoutScore}` 
      }, { status: 400 })
    }

    // 5. Get appropriate benchmarks based on gender
    const isMale = userData.gender?.toLowerCase() === 'male'
    const benchmarkMean = parseBenchmarkScore(isMale ? metcon.male_p50 : metcon.female_p50)
    const benchmarkStdDev = parseBenchmarkScore(isMale ? metcon.male_std_dev : metcon.female_std_dev)

    if (benchmarkMean === 0 || benchmarkStdDev === 0) {
      console.error('❌ Invalid benchmark data for metcon:', metconId)
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid benchmark data for this workout' 
      }, { status: 500 })
    }

    // 6. Calculate percentile
    const lowerIsBetter = isLowerBetter(parsedUserScore.type)
    const percentile = calculatePercentile(
      parsedUserScore.value,
      benchmarkMean,
      benchmarkStdDev,
      lowerIsBetter
    )

    const performanceTier = getPerformanceTier(percentile)

    console.log(`📊 Percentile calculation:`, {
      userScore: parsedUserScore.value,
      benchmarkMean,
      benchmarkStdDev,
      lowerIsBetter,
      percentile,
      performanceTier
    })

    // 7. Check if completion already exists
    const { data: existingCompletion } = await supabase
      .from('program_metcons')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .single()

    let result
    if (existingCompletion) {
      // Update existing completion
      const { data, error } = await supabase
        .from('program_metcons')
        .update({
          user_score: completionData.workoutScore,
          percentile: percentile.toFixed(2),
          performance_tier: performanceTier,
          excellent_score: isMale ? metcon.male_p90 : metcon.female_p90,
          median_score: isMale ? metcon.male_p50 : metcon.female_p50,
          std_dev: isMale ? metcon.male_std_dev : metcon.female_std_dev,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Create new completion
      const { data, error } = await supabase
        .from('program_metcons')
        .insert({
          program_id: completionData.programId,
          week: completionData.week,
          day: completionData.day,
          metcon_id: metconId,
          user_score: completionData.workoutScore,
          percentile: percentile.toFixed(2),
          performance_tier: performanceTier,
          excellent_score: isMale ? metcon.male_p90 : metcon.female_p90,
          median_score: isMale ? metcon.male_p50 : metcon.female_p50,
          std_dev: isMale ? metcon.male_std_dev : metcon.female_std_dev,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('❌ Error saving MetCon completion:', result.error)
      return NextResponse.json({ 
        success: false, 
        error: result.error.message 
      }, { status: 500 })
    }

    console.log('✅ MetCon completion saved with real percentile:', result.data)

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      percentile: percentile,
      performanceTier: performanceTier,
      calculation: {
        userScore: parsedUserScore.value,
        benchmarkMean,
        benchmarkStdDev,
        scoreType: parsedUserScore.type,
        lowerIsBetter
      }
    })

  } catch (error) {
    console.error('❌ MetCon completion error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
