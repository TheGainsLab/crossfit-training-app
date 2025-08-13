// /api/analytics/[userId]/exercise-heatmap/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface ExerciseHeatmapCell {
  exercise_name: string
  time_range: string | null
  session_count: number
  avg_percentile: number
  sort_order: number
}

interface ExerciseOverallAverage {
  exercise_name: string
  total_sessions: number
  overall_avg_percentile: number
}

interface HeatmapData {
  exercises: string[]
  timeDomains: string[]
  heatmapCells: ExerciseHeatmapCell[]
  exerciseAverages: ExerciseOverallAverage[]
  globalFitnessScore: number
  totalCompletedWorkouts: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const userIdNum = parseInt(userId)
    
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Handle cookie setting errors silently
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Handle cookie removal errors silently
            }
          },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user ownership
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('id', userIdNum)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Unauthorized access to user data' },
        { status: 403 }
      )
    }

    console.log(`🔥 Generating exercise heat map for User ${userIdNum}`)

    // Step 1: Get user's most recent program
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('id')
      .eq('user_id', userIdNum)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (programError || !programData) {
      return NextResponse.json(
        { error: 'No program found for user' },
        { status: 404 }
      )
    }

    const programId = programData.id
    console.log(`📋 Using program ${programId} for User ${userIdNum}`)

    // Step 2: Execute main heat map query
    const heatmapQuery = `
      WITH user_workout_exercises AS (
        SELECT 
          pm.program_id,
          pm.percentile::numeric as percentile,
          pm.completed_at,
          m.time_range,
          m.workout_id,
          jsonb_array_elements(m.tasks)->>'exercise' as exercise_name
        FROM program_metcons pm
        JOIN metcons m ON pm.metcon_id = m.id
        WHERE pm.percentile IS NOT NULL 
          AND pm.completed_at IS NOT NULL
          AND pm.program_id = $1
      ),
      
      exercise_time_aggregates AS (
        SELECT 
          exercise_name,
          time_range,
          COUNT(*) as session_count,
          ROUND(AVG(percentile)) as avg_percentile
        FROM user_workout_exercises
        GROUP BY exercise_name, time_range
      ),
     
     exercise_overall_averages AS (
  SELECT 
    exercise_name,
    SUM(session_count) as total_sessions,
    ROUND(SUM(avg_percentile * session_count) / SUM(session_count)) as overall_avg_percentile
  FROM exercise_time_aggregates
  GROUP BY exercise_name
),

      time_domain_order AS (
        SELECT time_range, 
          CASE time_range
            WHEN '1:00–5:00' THEN 1
            WHEN '5:00–10:00' THEN 2  
            WHEN '10:00–15:00' THEN 3
            WHEN '15:00–20:00' THEN 4
            WHEN '20:00–30:00' THEN 5
            WHEN '30:00+' THEN 6
            ELSE 7
          END as sort_order
        FROM (SELECT DISTINCT time_range FROM metcons WHERE time_range IS NOT NULL) t
      )
      
      SELECT 
        eta.exercise_name,
        eta.time_range,
        eta.session_count,
        eta.avg_percentile,
        eoa.total_sessions,
        eoa.overall_avg_percentile,
        COALESCE(tdo.sort_order, 7) as sort_order
      FROM exercise_time_aggregates eta
      LEFT JOIN exercise_overall_averages eoa ON eta.exercise_name = eoa.exercise_name
      LEFT JOIN time_domain_order tdo ON eta.time_range = tdo.time_range
      ORDER BY eta.exercise_name, COALESCE(tdo.sort_order, 7);
    `

    const { data: heatmapCells, error: heatmapError } = await supabase
      .rpc('execute_raw_sql', {
        query: heatmapQuery,
        params: [programId]
      })

    // If RPC doesn't work, fall back to direct query construction
    let finalHeatmapData: any[]
    if (heatmapError) {
      console.log('🔄 RPC failed, using direct query execution')
      
      const { data: rawData, error: directError } = await supabase
        .from('program_metcons')
        .select(`
          percentile,
          completed_at,
          metcons!inner(
            time_range,
            workout_id,
            tasks
          )
        `)
        .eq('program_id', programId)
        .not('percentile', 'is', null)
        .not('completed_at', 'is', null)

      if (directError || !rawData) {
        return NextResponse.json(
          { error: 'Failed to fetch workout data', details: directError?.message },
          { status: 500 }
        )
      }

      // Process raw data into heat map structure
      finalHeatmapData = processRawDataToHeatmap(rawData)
    } else {
      finalHeatmapData = heatmapCells
    }

    // Step 3: Get global fitness score
    const { data: globalScoreData, error: globalError } = await supabase
      .from('program_metcons')
      .select('percentile')
      .eq('program_id', programId)
      .not('percentile', 'is', null)
      .not('completed_at', 'is', null)

    if (globalError) {
      console.error('⚠️ Failed to fetch global score:', globalError)
    }

    const globalFitnessScore = globalScoreData && globalScoreData.length > 0
      ? Math.round(
          globalScoreData.reduce((sum, row) => sum + parseFloat(row.percentile), 0) / 
          globalScoreData.length
        )
      : 0

    // Step 4: Process and structure the response data
    const exercises = [...new Set(finalHeatmapData.map(row => row.exercise_name))].sort()
    const timeDomains = [...new Set(finalHeatmapData.map(row => row.time_range).filter(Boolean))]
      .sort((a, b) => {
        const order: { [key: string]: number } = {
          '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3, 
          '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
        }
        return (order[a] || 7) - (order[b] || 7)
      })

    const exerciseAverages = finalHeatmapData
      .filter(row => row.overall_avg_percentile !== null)
      .reduce((acc: ExerciseOverallAverage[], row) => {
        if (!acc.find(ex => ex.exercise_name === row.exercise_name)) {
          acc.push({
            exercise_name: row.exercise_name,
            total_sessions: row.total_sessions || 0,
            overall_avg_percentile: row.overall_avg_percentile || 0
          })
        }
        return acc
      }, [])

    const responseData: HeatmapData = {
      exercises,
      timeDomains,
      heatmapCells: finalHeatmapData.filter(row => row.time_range !== null),
      exerciseAverages,
      globalFitnessScore,
      totalCompletedWorkouts: globalScoreData?.length || 0
    }

    console.log(`✅ Heat map generated: ${exercises.length} exercises, ${timeDomains.length} time domains`)

    return NextResponse.json({
      success: true,
      data: responseData,
      metadata: {
        generatedAt: new Date().toISOString(),
        programId,
        userId: userIdNum,
        totalExercises: exercises.length,
        totalTimeDomains: timeDomains.length,
        totalCompletedWorkouts: responseData.totalCompletedWorkouts
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in exercise heat map API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}


function processRawDataToHeatmap(rawData: any[]): any[] {
  const exerciseTimeMap = new Map<string, Map<string, { count: number, totalPercentile: number }>>()
  const exerciseOverallMap = new Map<string, { count: number, totalPercentile: number }>()

  // Process each workout
  rawData.forEach(workout => {
    const percentile = parseFloat(workout.percentile)
    const timeRange = workout.metcons.time_range
    const tasks = workout.metcons.tasks || []

    // Extract exercises from tasks
    tasks.forEach((task: any) => {
      const exerciseName = task.exercise
      if (!exerciseName) return

      // Track by time domain
      if (!exerciseTimeMap.has(exerciseName)) {
        exerciseTimeMap.set(exerciseName, new Map())
      }
      const exerciseMap = exerciseTimeMap.get(exerciseName)!
      
      if (!exerciseMap.has(timeRange)) {
        exerciseMap.set(timeRange, { count: 0, totalPercentile: 0 })
      }
      const timeData = exerciseMap.get(timeRange)!
      timeData.count++
      timeData.totalPercentile += percentile

      // Track overall (FIXED: this was missing the calculation)
      if (!exerciseOverallMap.has(exerciseName)) {
        exerciseOverallMap.set(exerciseName, { count: 0, totalPercentile: 0 })
      }
      const overallData = exerciseOverallMap.get(exerciseName)!
      overallData.count++
      overallData.totalPercentile += percentile
    })
  })

  // Convert to heat map format with CORRECT exercise averages
  const result: any[] = []
  
  exerciseTimeMap.forEach((timeMap, exerciseName) => {
    const overallData = exerciseOverallMap.get(exerciseName)!
    
    timeMap.forEach((data, timeRange) => {
      const sortOrder = {
        '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
        '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
      }[timeRange] || 7

      result.push({
        exercise_name: exerciseName,
        time_range: timeRange,
        session_count: data.count,
        avg_percentile: Math.round(data.totalPercentile / data.count),
        total_sessions: overallData.count, // ← This was missing
        overall_avg_percentile: Math.round(overallData.totalPercentile / overallData.count), // ← This was wrong
        sort_order: sortOrder
      })
    })
  })

  return result
}





