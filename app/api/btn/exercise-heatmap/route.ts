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
  avg_rpe?: number | null
  avg_quality?: number | null
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
  timeDomainWorkoutCounts: Record<string, number>
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
          totalCompletedWorkouts: 0,
          timeDomainWorkoutCounts: {}
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
    // Fetch RPE/Quality data from performance_logs for all BTN workouts
    const workoutIds = workouts.map(w => w.id)
    const { data: rpeQualityData, error: rpeError } = await supabase
      .from('performance_logs')
      .select('exercise_name, rpe, completion_quality, result')
      .eq('user_id', userData.id)
      .eq('block', 'BTN')
      .not('rpe', 'is', null)

    if (rpeError) {
      console.warn('⚠️ Failed to fetch RPE/Quality data:', rpeError)
    }

    // Process workouts into heat map data with exercise-level filtering
    const { cells: heatmapData, timeDomainWorkoutCounts } = processWorkoutsToHeatmap(workouts, equip || undefined, rpeQualityData || [])

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
      const totalWorkouts = exerciseCells.reduce((sum, cell) => sum + cell.session_count, 0)
      const weightedPercentileSum = exerciseCells.reduce((sum, cell) => 
        sum + (cell.avg_percentile * cell.session_count), 0)
      const overallAvgPercentile = totalWorkouts > 0 
        ? Math.round(weightedPercentileSum / totalWorkouts) 
        : 0
      
      return {
        exercise_name: exerciseName,
        total_sessions: totalWorkouts, // Now represents unique workouts
        overall_avg_percentile: overallAvgPercentile
      }
    })
    
    // Calculate global fitness score (weighted average of all percentiles)
    const totalWeightedPercentile = heatmapData.reduce((sum, cell) => 
      sum + (cell.avg_percentile * cell.session_count), 0)
    const totalWorkouts = heatmapData.reduce((sum, cell) => sum + cell.session_count, 0)
    const globalFitnessScore = totalWorkouts > 0 
      ? Math.round(totalWeightedPercentile / totalWorkouts)
      : 0

    const responseData = {
      exercises,
      timeDomains,
      heatmapCells: heatmapData.filter(row => row.time_range !== null),
      exerciseAverages: exerciseCounts, // Renamed to match Premium format
      globalFitnessScore, // Now calculated!
      totalCompletedWorkouts: workouts.length,
      timeDomainWorkoutCounts
    }

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

function processWorkoutsToHeatmap(workouts: any[], equipmentFilter?: string, rpeQualityData: any[] = []): { cells: ExerciseHeatmapCell[], timeDomainWorkoutCounts: Record<string, number> } {
  // Map to track exercise × time domain combinations
  // Now tracking unique workouts instead of task instances
  const exerciseTimeMap = new Map<string, Map<string, {
    workoutIds: Set<number>, // Track unique workouts
    totalPercentile: number,
    totalAvgHR: number,
    totalMaxHR: number,
    avgHrCount: number,
    maxHrCount: number,
    totalRpe: number,
    rpeCount: number,
    totalQuality: number,
    qualityCount: number
  }>>()
  const exerciseOverallMap = new Map<string, { workoutIds: Set<number>, totalPercentile: number }>()
  // Track unique workouts per time domain
  const timeDomainWorkoutMap = new Map<string, Set<number>>()
  
  // Create a lookup map for RPE/Quality data: workoutId_exerciseName -> {rpe, quality}
  const rpeQualityMap = new Map<string, { rpe: number, quality: number }>()
  rpeQualityData.forEach((log: any) => {
    // Extract workout ID from result column (format: "BTN Workout 123: Workout Name")
    const workoutMatch = log.result?.match(/BTN Workout (\d+)/)
    if (workoutMatch) {
      const workoutId = workoutMatch[1]
      const key = `${workoutId}_${log.exercise_name}`
      if (log.rpe !== null && log.rpe !== undefined) {
        const existing = rpeQualityMap.get(key)
        if (!existing) {
          rpeQualityMap.set(key, {
            rpe: log.rpe,
            quality: log.completion_quality || 0
          })
        } else {
          // Average if multiple entries
          existing.rpe = (existing.rpe + log.rpe) / 2
          if (log.completion_quality) {
            existing.quality = existing.quality ? (existing.quality + log.completion_quality) / 2 : log.completion_quality
          }
        }
      }
    }
  })

  workouts.forEach(workout => {
    const percentile = parseFloat(workout.percentile)
    const avgHR = workout.avg_heart_rate ? parseFloat(workout.avg_heart_rate) : null
    const maxHR = workout.max_heart_rate ? parseFloat(workout.max_heart_rate) : null
    
    if (isNaN(percentile)) {
      return
    }
    
    // Map BTN time domain to Premium time range
    const timeRange = timeDomainMapping[workout.time_domain] || null
    
    if (!timeRange) {
      return
    }

    // Extract exercises from JSONB
    const exercises = workout.exercises || []
    
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return
    }

    // SAME LOGIC AS PREMIUM: Apply workout percentile to exercises
    // But now filter at exercise level if equipment filter is specified
    exercises.forEach((exercise: any) => {
      const exerciseName = exercise.name
      if (!exerciseName) {
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
        exerciseMap.set(timeRange, {
          workoutIds: new Set(),
          totalPercentile: 0,
          totalAvgHR: 0,
          totalMaxHR: 0,
          avgHrCount: 0,
          maxHrCount: 0,
          totalRpe: 0,
          rpeCount: 0,
          totalQuality: 0,
          qualityCount: 0
        })
      }
      const timeData = exerciseMap.get(timeRange)!
      
      // Only add this workout once per exercise+timeDomain combination
      if (!timeData.workoutIds.has(workout.id)) {
        timeData.workoutIds.add(workout.id)
        timeData.totalPercentile += percentile
        
        // Track HR data (only once per workout)
        if (avgHR !== null) {
          timeData.totalAvgHR += avgHR
          timeData.avgHrCount++
        }
        if (maxHR !== null) {
          timeData.totalMaxHR += maxHR
          timeData.maxHrCount++
        }
        
        // Track RPE/Quality data from performance_logs
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

      // Track overall averages (unique workouts per exercise)
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
  const result: ExerciseHeatmapCell[] = []
  
  exerciseTimeMap.forEach((timeMap, exerciseName) => {
    const overallData = exerciseOverallMap.get(exerciseName)!
    
    timeMap.forEach((data, timeRange) => {
      const sortOrder = {
        '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
        '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
      }[timeRange] || 7

      const workoutCount = data.workoutIds.size
      result.push({
        exercise_name: exerciseName,
        time_range: timeRange,
        session_count: workoutCount, // Now represents unique workouts, not task instances
        avg_percentile: workoutCount > 0 ? Math.round(data.totalPercentile / workoutCount) : 0,
        avg_heart_rate: data.avgHrCount > 0 ? Math.round(data.totalAvgHR / data.avgHrCount) : null,
        max_heart_rate: data.maxHrCount > 0 ? Math.round(data.totalMaxHR / data.maxHrCount) : null,
        avg_rpe: data.rpeCount > 0 ? Math.round((data.totalRpe / data.rpeCount) * 10) / 10 : null,
        avg_quality: data.qualityCount > 0 ? Math.round((data.totalQuality / data.qualityCount) * 10) / 10 : null,
        sort_order: sortOrder
      })
    })
  })

  // Build time domain workout counts object
  const timeDomainWorkoutCounts: Record<string, number> = {}
  timeDomainWorkoutMap.forEach((workoutIds, timeRange) => {
    timeDomainWorkoutCounts[timeRange] = workoutIds.size
  })

  return { cells: result, timeDomainWorkoutCounts }
}
