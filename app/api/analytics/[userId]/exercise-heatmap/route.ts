// /api/analytics/[userId]/exercise-heatmap/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { canAccessAthleteData, getUserIdFromAuth } from '@/lib/permissions'
import { exerciseEquipment } from '@/lib/btn/data'

// Map BTN time domains to Premium time ranges
const timeDomainMapping: { [key: string]: string } = {
  '1:00 - 5:00': '1:00–5:00',
  '5:00 - 10:00': '5:00–10:00',
  '10:00 - 15:00': '10:00–15:00',
  '15:00 - 20:00': '15:00–20:00',
  '20:00+': '20:00–30:00'
}

function mapBTNTimeDomainToTimeRange(timeDomain: string | null): string | null {
  if (!timeDomain) return null
  return timeDomainMapping[timeDomain] || timeDomain
}

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

    // Step 1: Get completed MetCons with exercise data (Premium workouts)
    const { data: premiumData, error: premiumError } = await supabase
      .from('program_metcons')
      .select(`
        percentile,
        avg_heart_rate,
        max_heart_rate,
        completed_at,
        week,
        day,
        program_id,
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
      .not('metcon_id', 'is', null) // Only Premium metcons
      .not('percentile', 'is', null)
      .not('completed_at', 'is', null)

    // Step 1b: Get BTN workouts
    const { data: btnData, error: btnError } = await supabase
      .from('program_metcons')
      .select(`
        percentile,
        avg_heart_rate,
        max_heart_rate,
        completed_at,
        time_domain,
        exercises,
        required_equipment
      `)
      .eq('user_id', userIdNum)
      .eq('workout_type', 'btn')
      .not('percentile', 'is', null)
      .not('completed_at', 'is', null)

    if (premiumError || btnError) {
      console.error('❌ Failed to fetch workout data:', premiumError || btnError)
      return NextResponse.json(
        { error: 'Failed to fetch workout data', details: (premiumError || btnError)?.message },
        { status: 500 }
      )
    }

    // Normalize and merge the data
    const rawData = [
      ...(premiumData || []).map((w: any) => ({
        ...w,
        source: 'premium',
        time_range: w.metcons?.time_range,
        tasks: w.metcons?.tasks || [],
        exercises: null,
        required_equipment: w.metcons?.required_equipment || []
      })),
      ...(btnData || []).map((w: any) => ({
        ...w,
        id: w.id, // Keep the program_metcons.id for BTN workout lookup
        source: 'btn',
        time_range: mapBTNTimeDomainToTimeRange(w.time_domain),
        tasks: null,
        exercises: w.exercises || [],
        required_equipment: w.required_equipment || [],
        week: null,
        day: null,
        program_id: null,
        metcons: {
          time_range: mapBTNTimeDomainToTimeRange(w.time_domain),
          tasks: w.exercises?.map((e: any) => ({ exercise: e.name || e.exercise || e })) || [],
          required_equipment: w.required_equipment || []
        }
      }))
    ]

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

    console.log(`📊 Processing ${rawData.length} completed MetCons (filtering at task level)`)

    // Step 2: Fetch RPE/Quality data from performance_logs for all MetCons (both Premium and BTN)
    const programIds = [...new Set(rawData.map((w: any) => w.program_id).filter(Boolean))]
    const { data: rpeQualityData, error: rpeError } = await supabase
      .from('performance_logs')
      .select('program_id, week, day, exercise_name, rpe, completion_quality, block, result')
      .eq('user_id', userIdNum)
      .in('block', ['METCONS', 'BTN'])
      .not('rpe', 'is', null)

    if (rpeError) {
      console.warn('⚠️ Failed to fetch RPE/Quality data:', rpeError)
    }

    // Step 3: Process raw data into heat map structure with task-level filtering
    // Note: Equipment filtering is now done at the task/exercise level inside processRawDataToHeatmap
    // This allows filtering individual exercises within a workout (e.g., if a workout has deadlifts and burpees,
    // and "Barbell" filter is applied, only deadlifts will be shown)
    const heatmapData = processRawDataToHeatmap(rawData, equip || undefined, rpeQualityData || [])

    // Step 3: Calculate global fitness score (use all workouts for this calculation)
    const globalFitnessScore = rawData.length > 0
      ? Math.round(
          rawData.reduce((sum, row) => sum + parseFloat(row.percentile), 0) / 
          rawData.length
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
      totalCompletedWorkouts: rawData.length // Use all workouts, not filtered
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

function processRawDataToHeatmap(rawData: any[], equipmentFilter?: string, rpeQualityData: any[] = []): any[] {
  const exerciseTimeMap = new Map<string, Map<string, { 
    count: number, 
    totalPercentile: number,
    totalAvgHR: number,
    totalMaxHR: number,
    hrCount: number,
    totalRpe: number,
    rpeCount: number,
    totalQuality: number,
    qualityCount: number
  }>>()
  const exerciseOverallMap = new Map<string, { count: number, totalPercentile: number }>()
  
  // Create a lookup map for RPE/Quality data: 
  // For Premium: (program_id, week, day, exercise_name) -> {rpe, quality}
  // For BTN: (workout_id from result, exercise_name) -> {rpe, quality}
  const rpeQualityMap = new Map<string, { rpe: number, quality: number }>()
  rpeQualityData.forEach((log: any) => {
    let key: string
    if (log.block === 'BTN') {
      // Extract workout ID from result column (format: "BTN Workout 123: Workout Name")
      const workoutMatch = log.result?.match(/BTN Workout (\d+)/)
      if (workoutMatch) {
        const workoutId = workoutMatch[1]
        key = `btn_${workoutId}_${log.exercise_name}`
      } else {
        return // Skip if we can't parse BTN workout ID
      }
    } else {
      // Premium format
      key = `${log.program_id}_${log.week}_${log.day}_${log.exercise_name}`
    }
    
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
  })

  console.log('🔍 Processing raw data for heat map...')

  // Process each workout
  rawData.forEach(workout => {
    const percentile = parseFloat(workout.percentile)
    const avgHR = workout.avg_heart_rate ? parseFloat(workout.avg_heart_rate) : null
    const maxHR = workout.max_heart_rate ? parseFloat(workout.max_heart_rate) : null
    const timeRange = workout.time_range || workout.metcons?.time_range
    const tasks = workout.tasks || workout.metcons?.tasks || []
    const exercises = workout.exercises || []
    const isBTN = workout.source === 'btn'

    if (!timeRange) {
      console.log(`⚠️ Skipping workout without time_range`)
      return
    }

    // Extract exercises from tasks (Premium) or exercises array (BTN)
    const exerciseList = isBTN ? exercises : tasks
    
    exerciseList.forEach((item: any) => {
      // Handle Premium format (task.exercise) or BTN format (exercise.name or exercise.exercise)
      const exerciseName = item.exercise || item.name || (typeof item === 'string' ? item : null)
      if (!exerciseName) {
        console.log(`⚠️ Exercise missing name:`, item)
        return
      }

      // Filter at task/exercise level (task-level filtering)
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
          count: 0, 
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
      
      // Track RPE/Quality data from performance_logs
      let rpeKey: string
      if (isBTN) {
        // BTN format: extract workout ID from workout object
        const workoutId = workout.id
        rpeKey = `btn_${workoutId}_${exerciseName}`
      } else {
        // Premium format
        rpeKey = `${workout.program_id}_${workout.week}_${workout.day}_${exerciseName}`
      }
      const rpeQuality = rpeQualityMap.get(rpeKey)
      if (rpeQuality) {
        timeData.totalRpe += rpeQuality.rpe
        timeData.rpeCount++
        if (rpeQuality.quality > 0) {
          timeData.totalQuality += rpeQuality.quality
          timeData.qualityCount++
        }
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
        avg_heart_rate: data.hrCount > 0 ? Math.round(data.totalAvgHR / data.hrCount) : null,
        max_heart_rate: data.hrCount > 0 ? Math.round(data.totalMaxHR / data.hrCount) : null,
        avg_rpe: data.rpeCount > 0 ? Math.round((data.totalRpe / data.rpeCount) * 10) / 10 : null,
        avg_quality: data.qualityCount > 0 ? Math.round((data.totalQuality / data.qualityCount) * 10) / 10 : null,
        total_sessions: overallData.count,
        overall_avg_percentile: Math.round(overallData.totalPercentile / overallData.count),
        sort_order: sortOrder
      })
    })
  })

  console.log(`✅ Generated ${result.length} heat map cells`)

  return result
}
