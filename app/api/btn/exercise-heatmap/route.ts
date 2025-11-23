import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exerciseEquipment } from '@/lib/btn/data'

interface ExerciseHeatmapCell {
  exercise_name: string
  time_range: string | null
  session_count: number
  avg_percentile: number
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  sort_order: number
}

interface ExerciseOverallCount {
  exercise_name: string
  total_sessions: number
  overall_avg_percentile: number
}

interface HeatmapData {
  exercises: string[]
  timeDomains: string[]
  heatmapCells: ExerciseHeatmapCell[]
  exerciseCounts: ExerciseOverallCount[]
  totalCompletedWorkouts: number
}

// Map BTN time domains to Premium time ranges
// BTN stores actual ranges like "10:00 - 15:00", map to Premium format "10:00–15:00"
const timeDomainMapping: { [key: string]: string } = {
  '1:00 - 5:00': '1:00–5:00',
  '5:00 - 10:00': '5:00–10:00',
  '10:00 - 15:00': '10:00–15:00',
  '15:00 - 20:00': '15:00–20:00',
  '20:00+': '20:00–30:00'
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

    // Optional equipment filter
    const equip = new URL(request.url).searchParams.get('equip') || ''

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

    // Note: Equipment filtering is now done at the exercise/task level inside processWorkoutsToHeatmap
    // This allows filtering individual exercises within a workout (e.g., if a workout has deadlifts and burpees,
    // and "Barbell" filter is applied, only deadlifts will be shown)
    console.log(`📊 Processing ${workouts.length} BTN workouts (filtering at exercise level)`)

    // Process workouts into heat map data with exercise-level filtering
    const heatmapData = processWorkoutsToHeatmap(workouts, equip || undefined)

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

    // Calculate exercise totals and overall averages
    const exerciseCounts = exercises.map(exerciseName => {
      const exerciseCells = heatmapData.filter(row => row.exercise_name === exerciseName)
      const totalSessions = exerciseCells.reduce((sum, cell) => sum + cell.session_count, 0)
      const weightedPercentileSum = exerciseCells.reduce((sum, cell) => 
        sum + (cell.avg_percentile * cell.session_count), 0)
      const overallAvgPercentile = totalSessions > 0 
        ? Math.round(weightedPercentileSum / totalSessions) 
        : 0
      
      return {
        exercise_name: exerciseName,
        total_sessions: totalSessions,
        overall_avg_percentile: overallAvgPercentile
      }
    })
    
    // Calculate global fitness score (weighted average of all percentiles)
    const totalWeightedPercentile = heatmapData.reduce((sum, cell) => 
      sum + (cell.avg_percentile * cell.session_count), 0)
    const totalSessions = heatmapData.reduce((sum, cell) => sum + cell.session_count, 0)
    const globalFitnessScore = totalSessions > 0 
      ? Math.round(totalWeightedPercentile / totalSessions)
      : 0

    const responseData = {
      exercises,
      timeDomains,
      heatmapCells: heatmapData.filter(row => row.time_range !== null),
      exerciseAverages: exerciseCounts, // Renamed to match Premium format
      globalFitnessScore, // Now calculated!
      totalCompletedWorkouts: workouts.length
    }

    console.log(`✅ Heat map generated: ${exercises.length} exercises, ${timeDomains.length} time domains, ${responseData.heatmapCells.length} cells, global fitness score: ${globalFitnessScore}%`)

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

// Helper function to check if an exercise matches the equipment filter
function exerciseMatchesFilter(exerciseName: string, filter: string): boolean {
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

function processWorkoutsToHeatmap(workouts: any[], equipmentFilter?: string): ExerciseHeatmapCell[] {
  // Map to track exercise × time domain combinations
  // Now tracking both count AND percentiles (same as Premium!)
  const exerciseTimeMap = new Map<string, Map<string, { 
    count: number, 
    totalPercentile: number,
    totalAvgHR: number,
    totalMaxHR: number,
    hrCount: number
  }>>()
  const exerciseOverallMap = new Map<string, { count: number, totalPercentile: number }>()

  console.log('🔍 Processing BTN workouts for heat map...')

  workouts.forEach(workout => {
    const percentile = parseFloat(workout.percentile)
    const avgHR = workout.avg_heart_rate ? parseFloat(workout.avg_heart_rate) : null
    const maxHR = workout.max_heart_rate ? parseFloat(workout.max_heart_rate) : null
    
    if (isNaN(percentile)) {
      console.log(`⚠️ Workout ${workout.id} has invalid percentile: ${workout.percentile}`)
      return
    }
    
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

    // SAME LOGIC AS PREMIUM: Apply workout percentile to exercises
    // But now filter at exercise level if equipment filter is specified
    exercises.forEach((exercise: any) => {
      const exerciseName = exercise.name
      if (!exerciseName) {
        console.log(`⚠️ Exercise missing name:`, exercise)
        return
      }

      // Filter at exercise level (task-level filtering)
      if (equipmentFilter && equipmentFilter !== 'all') {
        if (!exerciseMatchesFilter(exerciseName, equipmentFilter)) {
          return // Skip this exercise if it doesn't match the equipment filter
        }
      }

      // Track by time domain
      if (!exerciseTimeMap.has(exerciseName)) {
        exerciseTimeMap.set(exerciseName, new Map())
      }
      const exerciseMap = exerciseTimeMap.get(exerciseName)!
      
      if (!exerciseMap.has(timeRange)) {
        exerciseMap.set(timeRange, { count: 0, totalPercentile: 0, totalAvgHR: 0, totalMaxHR: 0, hrCount: 0 })
      }
      const timeData = exerciseMap.get(timeRange)!
      timeData.count++
      timeData.totalPercentile += percentile
      
      // Track HR data
      if (avgHR !== null) {
        timeData.totalAvgHR += avgHR
        timeData.hrCount++
      }
      if (maxHR !== null) {
        timeData.totalMaxHR += maxHR
      }

      // Track overall averages
      if (!exerciseOverallMap.has(exerciseName)) {
        exerciseOverallMap.set(exerciseName, { count: 0, totalPercentile: 0 })
      }
      const overallData = exerciseOverallMap.get(exerciseName)!
      overallData.count++
      overallData.totalPercentile += percentile
    })
  })

  console.log(`📊 Found ${exerciseTimeMap.size} unique exercises`)

  // Convert to heat map cell format
  const result: ExerciseHeatmapCell[] = []
  
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
        avg_heart_rate: data.hrCount > 0 ? Math.round(data.totalAvgHR / data.hrCount) : null,
        max_heart_rate: data.hrCount > 0 ? Math.round(data.totalMaxHR / data.hrCount) : null,
        sort_order: sortOrder
      })
    })
  })

  console.log(`✅ Generated ${result.length} heat map cells with percentiles`)

  return result
}
