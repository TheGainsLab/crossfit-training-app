import { createClient } from '../supabase/client'

export interface EngineProgram {
  id: string
  display_name: string
  description: string | null
  frequency_per_week: number
  total_days: number
  duration_weeks: number
  focus_areas: string[] | null
  icon: string | null
  is_active: boolean
  sort_order: number
}

export interface UserProgramInfo {
  currentProgramId: string | null
  subscriptionTier: string | null
  currentProgramDay: number | null
}

/**
 * Fetch all active engine programs
 */
export async function getAvailableEnginePrograms(): Promise<{
  programs: EngineProgram[] | null
  error: Error | null
}> {
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
 * Get user's current engine program and subscription info
 */
export async function getUserCurrentProgram(userId: number): Promise<{
  data: UserProgramInfo | null
  error: Error | null
}> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('users')
    .select('preferred_engine_program_id, subscription_tier, current_program_day')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user program info:', error)
    return { data: null, error }
  }

  return {
    data: {
      currentProgramId: data?.preferred_engine_program_id || null,
      subscriptionTier: data?.subscription_tier || null,
      currentProgramDay: data?.current_program_day || null,
    },
    error: null,
  }
}

/**
 * Switch user's engine program
 *
 * For Pure Engine users: Resets to day 1 of the new program
 * For Premium users: Updates preference, takes effect on next program generation
 */
export async function switchEngineProgram(
  userId: number,
  newProgramId: string,
  subscriptionTier: string | null
): Promise<{
  success: boolean
  error: Error | null
}> {
  const supabase = createClient()

  // Build update object based on subscription tier
  const updateData: Record<string, any> = {
    preferred_engine_program_id: newProgramId,
    updated_at: new Date().toISOString(),
  }

  // For Pure Engine users, reset to day 1
  if (subscriptionTier === 'ENGINE') {
    updateData.current_program_day = 1
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)

  if (error) {
    console.error('Error switching engine program:', error)
    return { success: false, error }
  }

  // Optionally log the program switch for history
  try {
    await supabase.from('program_switch_history').insert({
      user_id: userId,
      new_program_id: newProgramId,
      switched_at: new Date().toISOString(),
    })
  } catch (historyError) {
    // Non-critical - don't fail the switch if history logging fails
    console.warn('Failed to log program switch history:', historyError)
  }

  return { success: true, error: null }
}

/**
 * Get a single engine program by ID
 */
export async function getEngineProgramById(programId: string): Promise<{
  program: EngineProgram | null
  error: Error | null
}> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('engine_programs')
    .select('*')
    .eq('id', programId)
    .single()

  if (error) {
    console.error('Error fetching engine program:', error)
    return { program: null, error }
  }

  return { program: data, error: null }
}

/**
 * Check if user has access to engine programs (ENGINE or PREMIUM tier)
 */
export function hasEngineProgramAccess(subscriptionTier: string | null): boolean {
  if (!subscriptionTier) return false
  const tier = subscriptionTier.toUpperCase()
  return tier === 'ENGINE' || tier === 'PREMIUM' || tier === 'PRO'
}
