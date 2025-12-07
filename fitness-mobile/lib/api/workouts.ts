import { createClient } from '../supabase/client'

export interface WorkoutData {
  programId: number
  week: number
  day: number
  dayName: string
  mainLift: string
  isDeload: boolean
  userGender: string
  blocks: Array<{
    blockName: string
    exercises: Array<{
      name: string
      sets: number | string
      reps: number | string
      weightTime: string
      notes: string
    }>
  }>
  metconData?: any
  engineData?: any
  totalExercises: number
}

async function enhanceMetconData(metconData: any) {
  if (!metconData || !metconData.workoutId) {
    return metconData
  }

  try {
    const supabase = createClient()
    
    // Look up the complete metcon data by matching workout_id
    const { data: metcon, error } = await supabase
      .from('metcons')
      .select(`
        id,
        workout_id,
        format,
        workout_notes,
        time_range,
        tasks,
        male_p90,
        male_p50,
        male_std_dev,
        female_p90,
        female_p50,
        female_std_dev,
        max_weight_male,
        max_weight_female
      `)
      .eq('workout_id', metconData.workoutId)
      .single()

    if (error || !metcon) {
      console.warn('⚠️ Could not find metcon data for:', metconData.workoutId)
      return metconData // Return original data without enhancements
    }

    // Type assertion for Supabase query result
    const metconDataTyped = metcon as {
      id: number
      workout_id: string
      format?: string
      workout_notes?: string
      time_range?: string
      tasks?: any[]
      male_p90?: number | string
      male_p50?: number | string
      male_std_dev?: number | string
      female_p90?: number | string
      female_p50?: number | string
      female_std_dev?: number | string
      max_weight_male?: number | string
      max_weight_female?: number | string
    }

    // Format scores for display (handle null/undefined)
    const formatScore = (score: any) => {
      if (!score && score !== 0) return ''
      return String(score)
    }

    // Return fully enhanced data structure
    return {
      id: metconDataTyped.id,
      workoutId: metconDataTyped.workout_id,
      workoutFormat: metconDataTyped.format || metconData.workoutFormat,
      workoutNotes: metconDataTyped.workout_notes || metconData.workoutNotes,
      timeRange: metconDataTyped.time_range || metconData.timeRange,
      tasks: metconDataTyped.tasks || metconData.tasks || [],
      percentileGuidance: {
        male: {
          excellentScore: formatScore(metconDataTyped.male_p90),
          medianScore: formatScore(metconDataTyped.male_p50),
          stdDev: formatScore(metconDataTyped.male_std_dev)
        },
        female: {
          excellentScore: formatScore(metconDataTyped.female_p90),
          medianScore: formatScore(metconDataTyped.female_p50),
          stdDev: formatScore(metconDataTyped.female_std_dev)
        }
      },
      rxWeights: {
        male: formatScore(metconDataTyped.max_weight_male),
        female: formatScore(metconDataTyped.max_weight_female)
      }
    }
  } catch (error) {
    console.error('❌ Error enhancing metcon data:', error)
    return metconData // Return original data on error
  }
}

export async function fetchWorkout(
  programId: number,
  week: number,
  day: number
): Promise<{ success: boolean; workout?: WorkoutData; completions?: any[]; error?: string }> {
  try {
    const supabase = createClient()

    // Fetch the program from database
    const { data: program, error: fetchError } = await supabase
      .from('programs')
      .select('program_data, weeks_generated, user_id')
      .eq('id', programId)
      .single()

    if (fetchError || !program) {
      return { success: false, error: 'Program not found' }
    }

    // Type assertion for Supabase query result
    const programTyped = program as {
      program_data: any
      weeks_generated: number[]
      user_id: number
    }

    // Check if week was generated
    if (!programTyped.weeks_generated?.includes(week)) {
      return { success: false, error: `Week ${week} not found` }
    }

    // Extract workout from program_data JSON
    const programData = programTyped.program_data
    const weeks = programData?.weeks || []

    const targetWeek = weeks.find((w: any) => w.week === week)
    if (!targetWeek) {
      return { success: false, error: `Week ${week} not found in program data` }
    }

    const targetDay = targetWeek.days?.find((d: any) => d.day === day)
    if (!targetDay) {
      return { success: false, error: `Day ${day} not found in week ${week}` }
    }

    // Fetch user gender
    const { data: userData } = await supabase
      .from('users')
      .select('gender')
      .eq('id', programTyped.user_id)
      .single()

    const userDataTyped = userData as { gender?: string } | null
    const userGender = userDataTyped?.gender || 'male'

    // Fetch completions
    const { data: completions } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)
      .eq('user_id', programTyped.user_id)

    // Calculate total exercises, skip METCONS and ENGINE blocks (handled separately)
    const blockExercises = (targetDay.blocks || []).reduce(
      (sum: number, block: any) => {
        const blockNameUpper = block.blockName?.toUpperCase() || ''
        if (blockNameUpper === 'METCONS' || blockNameUpper === 'ENGINE') return sum
        return sum + (block.exercises?.length || 0)
      },
      0
    )
    const metconTasksCount = targetDay.metconData?.tasks?.length || 0

    // Build workout response
    const workout: WorkoutData = {
      programId,
      week,
      day,
      dayName: targetDay.dayName || `Day ${day}`,
      mainLift: targetDay.mainLift || '',
      isDeload: targetDay.isDeload || false,
      userGender,
      blocks: targetDay.blocks || [],
      metconData: targetDay.metconData ? await enhanceMetconData(targetDay.metconData) : undefined,
      engineData: targetDay.engineData,
      totalExercises: blockExercises + metconTasksCount
    }

    return {
      success: true,
      workout,
      completions: completions || []
    }
  } catch (error) {
    console.error('Error fetching workout:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
