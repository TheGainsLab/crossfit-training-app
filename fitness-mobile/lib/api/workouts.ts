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

    // Check if week was generated
    if (!program.weeks_generated?.includes(week)) {
      return { success: false, error: `Week ${week} not found` }
    }

    // Extract workout from program_data JSON
    const programData = program.program_data
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
      .eq('id', program.user_id)
      .single()

    const userGender = userData?.gender || 'male'

    // Fetch completions
    const { data: completions } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)
      .eq('user_id', program.user_id)

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
      metconData: targetDay.metconData,
      engineData: targetDay.engineData,
      totalExercises: (targetDay.blocks || []).reduce(
        (sum: number, block: any) => sum + (block.exercises?.length || 0),
        0
      )
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
