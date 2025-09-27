// /api/analytics/[userId]/exercise-heatmap/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { canAccessAthleteData, getUserIdFromAuth } from '@/lib/permissions'

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

    // Get requesting user ID from authentication
    const { userId: requestingUserId, error: authError } = await getUserIdFromAuth(supabase)
    if (authError || !requestingUserId) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to access this athlete's data
    const { hasAccess, permissionLevel, isCoach } = await canAccessAthleteData(
      supabase, 
      requestingUserId, 
      userIdNum
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to user data' },
        { status: 403 }
      )
    }

    console.log(`🔥 Generating exercise heat map for User ${userIdNum} (${isCoach ? `Coach access - ${permissionLevel}` : 'Self access'})`)

    // Optional equipment filter
    const equip = new URL(request.url).searchParams.get('equip') || ''

    // Step 1: Get completed MetCons with exercise data
    // FIXED: Use same approach as metcon-analyzer
    const { data: rawData, error: dataError } = await supabase
      .from('program_metcons')
      .select(`
        percentile,
        completed_at,
        week,
        day,
        metcons!inner(
          time_range,
          workout_id,
          tasks,
          required_equipment
        ),
        programs!inner(
          user_id
        )
      `)
      .eq('programs.user_id', userIdNum)
      .not('percentile', 'is', null)
      .not('completed_at', 'is', null)

    if (dataError || !rawData) {
      console.error('❌ Failed to fetch workout data:', dataError)
      return NextResponse.json(
        { error: 'Failed to fetch workout data', details: dataError?.message },
        { status: 500 }
      )
    }

    if (rawData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          exercises: [],
          timeDomains: [],
          heatmapCells: [],
          exerciseAverages: [],
          globalFitnessScore: 0,
          totalCompletedWorkouts: 0
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          userId: userIdNum,
          totalExercises: 0,
          totalTimeDomains: 0,
          totalCompletedWorkouts: 0,
          accessType: isCoach ? 'coach' : 'self',
          permissionLevel
        }
      })
    }

    console.log(`📊 Processing ${rawData.length} completed MetCons`)

    // Step 2: Apply optional equipment filter
    const filteredRaw = (() => {
      if (!equip) return rawData
      if (equip === 'barbell') {
        return rawData.filter(r => Array.isArray(r.metcons?.required_equipment) && r.metcons.required_equipment.includes('Barbell'))
      }
      if (equip === 'gymnastics') {
        return rawData.filter(r => {
          const req = Array.isArray(r.metcons?.required_equipment) ? r.metcons.required_equipment : []
          return req.includes('Pullup Bar or Rig') || req.includes('High Rings')
        })
      }
      return rawData
    })()

    // Step 3: Process raw data into heat map structure
    const heatmapData = processRawDataToHeatmap(filteredRaw)

    // Step 4: Calculate global fitness score
    const globalFitnessScore = filteredRaw.length > 0
      ? Math.round(
          filteredRaw.reduce((sum, row) => sum + parseFloat(row.percentile), 0) / 
          filteredRaw.length
        )
      : 0

    // Step 5: Structure the response data
    const exercises = [...new Set(heatmapData.map(row => row.exercise_name))].sort()
    const timeDomains = [...new Set(heatmapData.map(row => row.time_range).filter(Boolean))]
      .sort((a, b) => {
        const order: { [key: string]: number } = {
          '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3, 
          '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
        }
        return (order[a] || 7) - (order[b] || 7)
      })

    // Extract unique exercise averages
    const exerciseAverages = exercises.map(exerciseName => {
      const exerciseData = heatmapData.find(row => row.exercise_name === exerciseName)
      return {
        exercise_name: exerciseName,
        total_sessions: exerciseData?.total_sessions || 0,
        overall_avg_percentile: exerciseData?.overall_avg_percentile || 0
      }
    })

    const responseData: HeatmapData = {
      exercises,
      timeDomains,
      heatmapCells: heatmapData.filter(row => row.time_range !== null),
      exerciseAverages,
      globalFitnessScore,
      totalCompletedWorkouts: filteredRaw.length
    }

    console.log(`✅ Heat map generated: ${exercises.length} exercises, ${timeDomains.length} time domains, ${responseData.heatmapCells.length} cells`)

    return NextResponse.json({
      success: true,
      data: responseData,
      metadata: {
        generatedAt: new Date().toISOString(),
        userId: userIdNum,
        totalExercises: exercises.length,
        totalTimeDomains: timeDomains.length,
        totalCompletedWorkouts: responseData.totalCompletedWorkouts,
        accessType: isCoach ? 'coach' : 'self',
        permissionLevel
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

  console.log('🔍 Processing raw data for heat map...')

  // Process each workout
  rawData.forEach(workout => {
    const percentile = parseFloat(workout.percentile)
    const timeRange = workout.metcons.time_range
    const tasks = workout.metcons.tasks || []

    if (!timeRange) {
      console.log(`⚠️ Skipping workout without time_range: ${workout.metcons.workout_id}`)
      return
    }

    // Extract exercises from tasks
    tasks.forEach((task: any) => {
      const exerciseName = task.exercise
      if (!exerciseName) {
        console.log(`⚠️ Task missing exercise name:`, task)
        return
      }

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

      // Track overall averages
      if (!exerciseOverallMap.has(exerciseName)) {
        exerciseOverallMap.set(exerciseName, { count: 0, totalPercentile: 0 })
      }
      const overallData = exerciseOverallMap.get(exerciseName)!
      overallData.count++
      overallData.totalPercentile += percentile
    })
  })

  console.log(`📊 Found ${exerciseTimeMap.size} unique exercises across ${exerciseOverallMap.size} exercise variations`)

  // Convert to heat map format
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
        total_sessions: overallData.count,
        overall_avg_percentile: Math.round(overallData.totalPercentile / overallData.count),
        sort_order: sortOrder
      })
    })
  })

  console.log(`✅ Generated ${result.length} heat map cells`)

  return result
}
