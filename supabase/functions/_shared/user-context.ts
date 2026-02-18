/**
 * Build complete user context for program and profile generation.
 * Consolidates: user fetch, skills array, ratio calculation.
 * Replaces: fetchCompleteUserData, determine-user-ability, calculate-ratios (for these use cases).
 */
import { calculateUserRatios } from './ratios.ts'

export async function buildUserContextForProgram(supabase: any, user_id: number): Promise<Record<string, unknown>> {
  // Fetch all user data in one batch (parallel)
  const [usersResult, equipmentResult, oneRMsResult, skillsResult, prefsResult] = await Promise.all([
    supabase.from('users').select('name, email, gender, body_weight, units, ability_level, conditioning_benchmarks').eq('id', user_id).single(),
    supabase.from('user_equipment').select('equipment_name').eq('user_id', user_id),
    supabase.from('latest_user_one_rms').select('one_rm_index, one_rm').eq('user_id', user_id).order('one_rm_index'),
    supabase.from('latest_user_skills').select('skill_index, skill_level').eq('user_id', user_id).order('skill_index'),
    supabase.from('user_preferences').select('*').eq('user_id', user_id).single()
  ])

  const user = usersResult.data
  if (usersResult.error || !user) {
    throw new Error(`Failed to fetch user data: ${usersResult.error?.message || 'User not found'}`)
  }

  const equipment = equipmentResult.data || []
  const equipmentArray = equipment.map((eq: { equipment_name: string }) => eq.equipment_name)

  const oneRMs = oneRMsResult.data || []
  const oneRMsArray = Array(14).fill(0)
  oneRMs.forEach((rm: { one_rm_index: number; one_rm: number }) => {
    if (rm.one_rm_index >= 0 && rm.one_rm_index < 14) {
      oneRMsArray[rm.one_rm_index] = rm.one_rm
    }
  })

  const benchmarks = user.conditioning_benchmarks || {}
  const benchmarksArray = [
    benchmarks.mile_run || '',
    benchmarks.five_k_run || '',
    benchmarks.ten_k_run || '',
    benchmarks.one_k_row || '',
    benchmarks.two_k_row || '',
    benchmarks.five_k_row || '',
    benchmarks.ten_min_air_bike || ''
  ]

  const skills = Array(26).fill("Don't have it")
  const skillsRows = skillsResult.data || []
  skillsRows.forEach((row: { skill_index: number; skill_level: string }) => {
    if (row.skill_index >= 0 && row.skill_index < 26) {
      skills[row.skill_index] = row.skill_level
    }
  })

  const ability = deriveAbilityFromSkills(skills)

  const prefs = prefsResult.data || {}
  const preferences = {
    trainingDaysPerWeek: prefs.training_days_per_week ?? 5,
    primaryStrengthLifts: prefs.primary_strength_lifts || [],
    emphasizedStrengthLifts: prefs.emphasized_strength_lifts || [],
    three_month_goals: prefs.three_month_goals || null,
    monthly_primary_goal: prefs.monthly_primary_goal || null,
    preferred_metcon_exercises: prefs.preferred_metcon_exercises || [],
    avoided_exercises: prefs.avoided_exercises || []
  }

  const ratiosInput = {
    name: user.name,
    gender: user.gender,
    bodyWeight: user.body_weight,
    oneRMs: oneRMsArray
  }
  const ratios = calculateUserRatios(ratiosInput) as Record<string, unknown>

  return {
    id: user_id,
    name: user.name || 'Unknown User',
    email: user.email || '',
    gender: user.gender || 'Male',
    units: user.units || 'Imperial (lbs)',
    bodyWeight: user.body_weight || 0,
    equipment: equipmentArray,
    oneRMs: oneRMsArray,
    benchmarks: benchmarksArray,
    skills,
    ability,
    preferences,
    ...ratios
  }
}

function deriveAbilityFromSkills(skills: string[]): string {
  const levels = skills.map(s => {
    if (s.includes('Advanced')) return 3
    if (s.includes('Intermediate')) return 2
    if (s.includes('Beginner')) return 1
    return 0
  })
  const advancedCount = levels.filter(l => l === 3).length
  const intermediateCount = levels.filter(l => l === 2).length

  if (advancedCount >= 8) return 'Advanced'
  if (advancedCount >= 4) return 'Intermediate'
  if (intermediateCount >= 10) return 'Intermediate'
  return 'Beginner'
}
