import { createClient } from '../supabase/client'

export interface EngineProgram {
  id: string
  display_name: string
  description: string | null
  frequency_per_week: number
  total_days: number
  duration_weeks: number | null
  focus_areas: string[] | null
  icon: string | null
  is_active: boolean
  sort_order: number
}

export interface UserProgramInfo {
  preferred_engine_program_id: string
  subscription_tier: string
}

/**
 * Fetch all active Engine programs from the database
 */
export async function getAvailableEnginePrograms(): Promise<{ programs: EngineProgram[] | null; error: any }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('engine_programs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Error fetching engine programs:', error)
    return { programs: null, error }
  }

  return { programs: data, error: null }
}

/**
 * Get user's current Engine program preference
 */
export async function getUserCurrentProgram(userId: number): Promise<{ program: EngineProgram | null; error: any }> {
  const supabase = createClient()

  // Get user's preferred program ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('preferred_engine_program_id')
    .eq('id', userId)
    .single()

  if (userError) {
    console.error('Error fetching user program preference:', userError)
    return { program: null, error: userError }
  }

  const programId = userData?.preferred_engine_program_id || 'main_5day'

  // Get program details
  const { data: programData, error: programError } = await supabase
    .from('engine_programs')
    .select('*')
    .eq('id', programId)
    .single()

  if (programError) {
    console.error('Error fetching program details:', programError)
    return { program: null, error: programError }
  }

  return { program: programData, error: null }
}

/**
 * Switch user's Engine program
 * Resets progress to Day 1 of the new program
 */
export async function switchEngineProgram(
  userId: number,
  newProgramId: string
): Promise<{ success: boolean; error: any }> {
  const supabase = createClient()

  try {
    // Update user's preferred program
    const { error: updateError } = await supabase
      .from('users')
      .update({
        preferred_engine_program_id: newProgramId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error switching engine program:', updateError)
      return { success: false, error: updateError }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Error in switchEngineProgram:', error)
    return { success: false, error }
  }
}

/**
 * Get workout for a specific day in a specific program
 */
export async function getWorkoutForProgramDay(
  programId: string,
  programSequenceOrder: number
): Promise<{ workout: any | null; error: any }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('engine_program_day_assignments')
    .select(`
      engine_workout_day_number,
      program_sequence_order,
      workouts!inner(*)
    `)
    .eq('engine_program_id', programId)
    .eq('program_sequence_order', programSequenceOrder)
    .single()

  if (error) {
    console.error('Error fetching workout for program day:', error)
    return { workout: null, error }
  }

  // Return the workout data from the joined workouts table
  return { workout: (data as any)?.workouts, error: null }
}

/**
 * Get all workouts for a program (used for displaying program structure)
 */
export async function getWorkoutsForProgram(
  programId: string
): Promise<{ workouts: any[] | null; error: any }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('engine_program_day_assignments')
    .select(`
      engine_workout_day_number,
      program_sequence_order,
      workouts!inner(*)
    `)
    .eq('engine_program_id', programId)
    .order('program_sequence_order')

  if (error) {
    console.error('Error fetching workouts for program:', error)
    return { workouts: null, error }
  }

  // Extract and return the workout data
  const workouts = (data || []).map((item: any) => ({
    ...item.workouts,
    program_day_number: item.program_sequence_order,
    engine_workout_day_number: item.engine_workout_day_number
  }))

  return { workouts, error: null }
}
