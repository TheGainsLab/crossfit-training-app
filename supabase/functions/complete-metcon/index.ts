import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MetConCompletionData {
  programId: number
  userId: number
  week: number
  day: number
  workoutScore: string
  metconId?: number
  avgHR?: number
  peakHR?: number
  notes?: string
}

// =============================================================================
// SCORE PARSING UTILITIES
// =============================================================================

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
      value: rounds * 1000 + reps,
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

function parseBenchmarkScore(benchmarkStr: string): number {
  if (!benchmarkStr) return 0
  
  const cleaned = benchmarkStr.toString().trim()
  
  // Time format
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(p => parseInt(p))
    
    if (parts.length === 3) {
      const firstPart = parts[0]
      const secondPart = parts[1] 
      const thirdPart = parts[2]
      
      if (firstPart < 2) {
        return firstPart * 3600 + secondPart * 60 + thirdPart
      } else {
        return firstPart * 60 + secondPart + (thirdPart / 100)
      }
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
  }
  
  return parseFloat(cleaned) || 0
}

// =============================================================================
// PERCENTILE CALCULATION
// =============================================================================

function calculatePercentile(userScore: number, mean: number, stdDev: number, lowerIsBetter: boolean): number {
  if (stdDev === 0) return 50
  
  const zScore = (userScore - mean) / stdDev
  const adjustedZScore = lowerIsBetter ? -zScore : zScore
  const percentile = normalCDF(adjustedZScore) * 100
  
  return Math.max(1, Math.min(99, Math.round(percentile)))
}

function normalCDF(z: number): number {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2.0)
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))))
  
  if (z > 0) prob = 1.0 - prob
  
  return prob
}

function isLowerBetter(scoreType: string): boolean {
  return scoreType === 'time'
}

function getPerformanceTier(percentile: number): string {
  if (percentile >= 90) return 'Elite'
  if (percentile >= 75) return 'Advanced'
  if (percentile >= 60) return 'Good'
  if (percentile >= 40) return 'Average'
  if (percentile >= 25) return 'Below Average'
  return 'Needs Improvement'
}

async function calculateWorkoutRPEAndQuality(
  supabase: any,
  userId: number,
  programId: number,
  week: number,
  day: number
): Promise<{ avgRpe: number | null; avgQuality: number | null }> {
  const { data: taskLogs, error } = await supabase
    .from('performance_logs')
    .select('rpe, completion_quality')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('week', week)
    .eq('day', day)
    .eq('block', 'METCONS')
    .not('rpe', 'is', null)

  if (error || !taskLogs || taskLogs.length === 0) {
    return { avgRpe: null, avgQuality: null }
  }

  const validRpe = taskLogs.filter(t => t.rpe !== null).map(t => t.rpe)
  const validQuality = taskLogs.filter(t => t.completion_quality !== null).map(t => t.completion_quality)

  const avgRpe = validRpe.length > 0
    ? Math.round((validRpe.reduce((sum, rpe) => sum + rpe, 0) / validRpe.length) * 10) / 10
    : null

  const avgQuality = validQuality.length > 0
    ? Math.round((validQuality.reduce((sum, q) => sum + q, 0) / validQuality.length) * 10) / 10
    : null

  return { avgRpe, avgQuality }
}

// =============================================================================
// POPULATE EXERCISE PERCENTILE LOG
// =============================================================================

async function populateExercisePercentileLog(
  supabase: any,
  programMetconId: number,
  userId: number,
  percentile: number,
  performanceTier: string,
  week: number,
  day: number,
  loggedAt: string
) {
  try {
    const { data: programMetcon, error: fetchError } = await supabase
      .from('program_metcons')
      .select(`
        id,
        metcon_id,
        week,
        day,
        time_domain,
        workout_type,
        avg_heart_rate,
        max_heart_rate,
        metcons(
          workout_id,
          time_range,
          level,
          tasks
        )
      `)
      .eq('id', programMetconId)
      .single()

    if (fetchError || !programMetcon) {
      console.error('❌ Error fetching program_metcon:', fetchError)
      return
    }

    let exercises: string[] = []
    let timeRange: string | null = null
    let workoutLevel: string | null = null
    let workoutId: string | null = null
    let metconId: number | null = null

    if (programMetcon.workout_type === 'btn' || programMetcon.workout_type === 'conditioning') {
      const { data: btnWorkout } = await supabase
        .from('program_metcons')
        .select('exercises, time_domain, workout_name')
        .eq('id', programMetconId)
        .single()

      if (btnWorkout?.exercises) {
        exercises = (btnWorkout.exercises || []).map((ex: any) => ex.name || ex.exercise).filter(Boolean)
        timeRange = btnWorkout.time_domain || null
        workoutId = btnWorkout.workout_name || null
      }
    } else {
      const metconsData = (programMetcon as any).metcons
      const metcon = Array.isArray(metconsData) ? metconsData[0] : metconsData
      if (metcon?.tasks) {
        exercises = (metcon.tasks || []).map((task: any) => task.exercise).filter(Boolean)
        timeRange = metcon.time_range || null
        workoutLevel = metcon.level || null
        workoutId = metcon.workout_id || null
        metconId = programMetcon.metcon_id
      }
    }

    if (exercises.length === 0) {
      console.log(`⚠️ No exercises found for program_metcon ${programMetconId}`)
      return
    }

    await supabase
      .from('exercise_percentile_log')
      .delete()
      .eq('program_metcon_id', programMetconId)

    const logEntries = exercises.map((exerciseName: string) => ({
      user_id: userId,
      program_metcon_id: programMetconId,
      metcon_id: metconId,
      exercise_name: exerciseName,
      percentile: percentile,
      performance_tier: performanceTier,
      week: week,
      day: day,
      time_domain: programMetcon.time_domain || null,
      workout_level: workoutLevel,
      time_range: timeRange,
      workout_id: workoutId || '',
      avg_heart_rate: programMetcon.avg_heart_rate,
      max_heart_rate: programMetcon.max_heart_rate,
      logged_at: loggedAt
    }))

    const { error: insertError } = await supabase
      .from('exercise_percentile_log')
      .insert(logEntries)

    if (insertError) {
      console.error('❌ Error inserting exercise_percentile_log:', insertError)
    } else {
      console.log(`✅ Populated exercise_percentile_log: ${logEntries.length} exercises`)
    }
  } catch (error) {
    console.error('❌ Error in populateExercisePercentileLog:', error)
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const completionData: MetConCompletionData = await req.json()
    
    console.log('🔥 MetCon completion request:', completionData)

    // Step 1: Get program data
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('program_data, user_id')
      .eq('id', completionData.programId)
      .single()

    if (programError || !program) {
      return new Response(
        JSON.stringify({ success: false, error: 'Program not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Extract MetCon data
    const programData = program.program_data
    const weeks = programData.weeks || []
    const targetWeek = weeks.find((w: any) => w.week === completionData.week)
    if (!targetWeek) {
      return new Response(
        JSON.stringify({ success: false, error: `Week ${completionData.week} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const targetDay = targetWeek.days?.find((d: any) => d.day === completionData.day)
    if (!targetDay) {
      return new Response(
        JSON.stringify({ success: false, error: `Day ${completionData.day} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const metconData = targetDay.metconData
    if (!metconData || !metconData.workoutId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No MetCon found for this day' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Get MetCon benchmarks
    const { data: metcon, error: metconError } = await supabase
      .from('metcons')
      .select('id, male_p50, male_p90, male_std_dev, female_p50, female_p90, female_std_dev, workout_id, format')
      .eq('workout_id', metconData.workoutId)
      .single()

    if (metconError || !metcon) {
      return new Response(
        JSON.stringify({ success: false, error: 'MetCon benchmark data not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: Get user gender
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('gender')
      .eq('id', completionData.userId)
      .single()

    if (userError) {
      return new Response(
        JSON.stringify({ success: false, error: 'User data not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 5: Parse user score
    let parsedUserScore
    try {
      parsedUserScore = parseWorkoutScore(completionData.workoutScore)
    } catch (parseError) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid score format: ${completionData.workoutScore}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 6: Get benchmarks
    const isMale = userData.gender?.toLowerCase() === 'male'
    const benchmarkP50 = parseBenchmarkScore(isMale ? metcon.male_p50 : metcon.female_p50)
    const benchmarkP90 = parseBenchmarkScore(isMale ? metcon.male_p90 : metcon.female_p90)
    let benchmarkStdDev = parseBenchmarkScore(isMale ? metcon.male_std_dev : metcon.female_std_dev)

    // Derive std_dev from p50/p90 if missing (assumes normal distribution)
    // In a normal distribution, p90 is at z-score ~1.28 from p50 (mean)
    if (benchmarkStdDev === 0 && benchmarkP50 !== 0 && benchmarkP90 !== 0) {
      benchmarkStdDev = Math.abs((benchmarkP90 - benchmarkP50) / 1.28)
      console.log(`📊 Derived std_dev from p50/p90: ${benchmarkStdDev}`)
    }

    if (benchmarkP50 === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid benchmark data - missing p50' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If we still don't have std_dev, use a reasonable default (20% of mean)
    if (benchmarkStdDev === 0) {
      benchmarkStdDev = benchmarkP50 * 0.2
      console.log(`📊 Using default std_dev (20% of mean): ${benchmarkStdDev}`)
    }

    const benchmarkMean = benchmarkP50

    // Step 7: Calculate percentile
    const lowerIsBetter = isLowerBetter(parsedUserScore.type)
    const percentile = calculatePercentile(
      parsedUserScore.value,
      benchmarkMean,
      benchmarkStdDev,
      lowerIsBetter
    )

    const performanceTier = getPerformanceTier(percentile)

    // Step 8: Calculate workout-level RPE/Quality
    const { avgRpe, avgQuality } = await calculateWorkoutRPEAndQuality(
      supabase,
      completionData.userId,
      completionData.programId,
      completionData.week,
      completionData.day
    )

    // Step 9: Check if completion exists
    const { data: existingCompletion } = await supabase
      .from('program_metcons')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('user_id', completionData.userId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .maybeSingle()

    // Step 10: Upsert completion
    let result
    if (existingCompletion) {
      const { data, error } = await supabase
        .from('program_metcons')
        .update({
          workout_type: 'program',
          user_id: completionData.userId,
          user_score: completionData.workoutScore,
          percentile: percentile.toFixed(2),
          performance_tier: performanceTier,
          excellent_score: isMale ? metcon.male_p90 : metcon.female_p90,
          median_score: isMale ? metcon.male_p50 : metcon.female_p50,
          std_dev: benchmarkStdDev.toFixed(2),
          avg_heart_rate: completionData.avgHR || null,
          max_heart_rate: completionData.peakHR || null,
          avg_rpe: avgRpe,
          avg_quality: avgQuality,
          notes: completionData.notes || null,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)
        .select()
        .single()

      result = { data, error }
    } else {
      const { data, error } = await supabase
        .from('program_metcons')
        .insert({
          workout_type: 'program',
          program_id: completionData.programId,
          week: completionData.week,
          day: completionData.day,
          metcon_id: metcon.id,
          user_id: completionData.userId,
          user_score: completionData.workoutScore,
          percentile: percentile.toFixed(2),
          performance_tier: performanceTier,
          excellent_score: isMale ? metcon.male_p90 : metcon.female_p90,
          median_score: isMale ? metcon.male_p50 : metcon.female_p50,
          std_dev: benchmarkStdDev.toFixed(2),
          avg_heart_rate: completionData.avgHR || null,
          max_heart_rate: completionData.peakHR || null,
          avg_rpe: avgRpe,
          avg_quality: avgQuality,
          notes: completionData.notes || null,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      return new Response(
        JSON.stringify({ success: false, error: result.error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 11: Populate exercise percentile log
    if (result.data) {
      await populateExercisePercentileLog(
        supabase,
        result.data.id,
        completionData.userId,
        percentile,
        performanceTier,
        completionData.week,
        completionData.day,
        new Date().toISOString()
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result.data,
        percentile: percentile,
        performanceTier: performanceTier,
        metconInfo: {
          workoutId: metcon.workout_id,
          format: metcon.format
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ MetCon completion error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

