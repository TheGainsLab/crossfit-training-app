import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ExerciseHeatmapCell {
  exercise_name: string
  time_range: string | null
  session_count: number
  sort_order: number
}

interface ExerciseOverallCount {
  exercise_name: string
  total_sessions: number
}

interface HeatmapData {
  exercises: string[]
  timeDomains: string[]
  heatmapCells: ExerciseHeatmapCell[]
  exerciseCounts: ExerciseOverallCount[]
  totalCompletedWorkouts: number
}

// Map BTN time domains to Premium time ranges
const timeDomainMapping: { [key: string]: string } = {
  'Sprint': '1:00–5:00',
  'Short': '5:00–10:00',
  'Medium': '10:00–15:00',
  'Long': '15:00–20:00',
  'Extended': '20:00–30:00'
}

export async function GET(request: NextRequest) {
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

    console.log(`🔥 Generating BTN exercise heat map for User ${userData.id}`)

    // Fetch all BTN workouts for this user
    const { data: workouts, error: workoutsError } = await supabase
      .from('program_metcons')
      .select('id, time_domain, exercises, workout_name, completed_at')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (workoutsError) {
      console.error('❌ Failed to fetch BTN workouts:', workoutsError)
      return NextResponse.json(
        { error: 'Failed to fetch workouts', details: workoutsError.message },
        { status: 500 }
      )
    }

    if (!workouts || workouts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          exercises: [],
          timeDomains: [],
          heatmapCells: [],
          exerciseCounts: [],
          totalCompletedWorkouts: 0
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          userId: userData.id,
          totalExercises: 0,
          totalTimeDomains: 0,
          totalCompletedWorkouts: 0
        }
      })
    }

    console.log(`📊 Processing ${workouts.length} BTN workouts`)

    // Process workouts into heat map data
    const heatmapData = processWorkoutsToHeatmap(workouts)

    // Get unique exercises and time domains
    const exercises = [...new Set(heatmapData.map(row => row.exercise_name))].sort()
    const timeDomains = [...new Set(heatmapData.map(row => row.time_range).filter((d): d is string => d !== null))]
      .sort((a, b) => {
        const order: { [key: string]: number } = {
          '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3, 
          '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
        }
        return (order[a] || 7) - (order[b] || 7)
      })

    // Calculate exercise totals
    const exerciseCounts = exercises.map(exerciseName => {
      const exerciseCells = heatmapData.filter(row => row.exercise_name === exerciseName)
      const totalSessions = exerciseCells.reduce((sum, cell) => sum + cell.session_count, 0)
      return {
        exercise_name: exerciseName,
        total_sessions: totalSessions
      }
    })

    const responseData: HeatmapData = {
      exercises,
      timeDomains,
      heatmapCells: heatmapData.filter(row => row.time_range !== null),
      exerciseCounts,
      totalCompletedWorkouts: workouts.length
    }

    console.log(`✅ Heat map generated: ${exercises.length} exercises, ${timeDomains.length} time domains, ${responseData.heatmapCells.length} cells`)

    return NextResponse.json({
      success: true,
      data: responseData,
      metadata: {
        generatedAt: new Date().toISOString(),
        userId: userData.id,
        totalExercises: exercises.length,
        totalTimeDomains: timeDomains.length,
        totalCompletedWorkouts: responseData.totalCompletedWorkouts
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in BTN exercise heat map API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

function processWorkoutsToHeatmap(workouts: any[]): ExerciseHeatmapCell[] {
  // Map to count exercise × time domain combinations
  const exerciseTimeMap = new Map<string, Map<string, number>>()

  console.log('🔍 Processing BTN workouts for heat map...')

  workouts.forEach(workout => {
    // Map BTN time domain to Premium time range
    const timeRange = timeDomainMapping[workout.time_domain] || null
    
    if (!timeRange) {
      console.log(`⚠️ Unknown time domain: ${workout.time_domain}`)
      return
    }

    // Extract exercises from JSONB
    const exercises = workout.exercises || []
    
    if (!Array.isArray(exercises) || exercises.length === 0) {
      console.log(`⚠️ Workout ${workout.id} has no exercises`)
      return
    }

    // Count each exercise in this time domain
    exercises.forEach((exercise: any) => {
      const exerciseName = exercise.name
      if (!exerciseName) {
        console.log(`⚠️ Exercise missing name:`, exercise)
        return
      }

      // Initialize maps if needed
      if (!exerciseTimeMap.has(exerciseName)) {
        exerciseTimeMap.set(exerciseName, new Map())
      }
      const timeMap = exerciseTimeMap.get(exerciseName)!
      
      // Increment count for this exercise × time domain
      const currentCount = timeMap.get(timeRange) || 0
      timeMap.set(timeRange, currentCount + 1)
    })
  })

  console.log(`📊 Found ${exerciseTimeMap.size} unique exercises`)

  // Convert to heat map cell format
  const result: ExerciseHeatmapCell[] = []
  
  exerciseTimeMap.forEach((timeMap, exerciseName) => {
    timeMap.forEach((count, timeRange) => {
      const sortOrder = {
        '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
        '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
      }[timeRange] || 7

      result.push({
        exercise_name: exerciseName,
        time_range: timeRange,
        session_count: count,
        sort_order: sortOrder
      })
    })
  })

  console.log(`✅ Generated ${result.length} heat map cells`)

  return result
}
