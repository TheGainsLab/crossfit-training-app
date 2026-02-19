/**
 * Deterministic technical work exercise selector.
 * Uses ratio-derived focus categories and technical_exercise_focus table
 * to select exercises instead of AI/probabilistic logic.
 */

const SNATCH_CATEGORIES = ['snatch_strength', 'snatch_receiving', 'snatch_overhead'] as const
const CJ_CATEGORIES = ['cj_strength', 'cj_receiving', 'cj_jerk'] as const

/** Normalize main lift for Press family (lookup uses 'Press' in focus table) */
function normalizeMainLift(mainLift: string): string {
  if (['Strict Press', 'Push Press', 'Press'].includes(mainLift)) return 'Press'
  return mainLift
}

/**
 * Get focus categories for this week/day based on main lift and user ratios.
 * Snatch/C&J: rotate by week. Squat/Press: single category from ratios.
 */
function getFocusCategories(
  mainLift: string,
  numExercises: number,
  week: number,
  day: number,
  user: any
): string[] {
  const norm = normalizeMainLift(mainLift)

  if (norm === 'Snatch') {
    // 0 failures: 1 ex, rotate all 3 by week. 1-3 failures: 2 ex, rotate pairs (A+B),(B+C),(C+A)
    const cycle = week % 3
    if (numExercises === 1) {
      return [SNATCH_CATEGORIES[cycle]]
    }
    const pair: [string, string][] = [
      [SNATCH_CATEGORIES[0], SNATCH_CATEGORIES[1]],
      [SNATCH_CATEGORIES[1], SNATCH_CATEGORIES[2]],
      [SNATCH_CATEGORIES[2], SNATCH_CATEGORIES[0]]
    ]
    return pair[cycle]
  }

  if (norm === 'Clean and Jerk') {
    const cycle = week % 3
    if (numExercises === 1) {
      return [CJ_CATEGORIES[cycle]]
    }
    const pair: [string, string][] = [
      [CJ_CATEGORIES[0], CJ_CATEGORIES[1]],
      [CJ_CATEGORIES[1], CJ_CATEGORIES[2]],
      [CJ_CATEGORIES[2], CJ_CATEGORIES[0]]
    ]
    return pair[cycle]
  }

  if (norm === 'Back Squat') {
    const focus = (user.back_squat_technical_focus || 'position') as string
    return [focus === 'overhead' ? 'overhead' : 'position']
  }

  if (norm === 'Front Squat') {
    const focus = (user.front_squat_technical_focus || 'front_rack') as string
    return [focus === 'overhead_complex' ? 'overhead_complex' : 'front_rack']
  }

  if (norm === 'Press') {
    const focus = (user.press_technical_focus || 'stability_unilateral') as string
    return [focus === 'strict_strength' ? 'strict_strength' : 'stability_unilateral']
  }

  return []
}

/**
 * Select technical exercises deterministically.
 * @param supabase - Supabase client
 * @param filteredExercises - Pre-filtered exercises (equipment, prereqs, technical_dependency already applied)
 * @param user - User with ratio-derived fields (back_squat_technical_focus, etc.)
 * @param mainLift - Day's main lift
 * @param week - Week number
 * @param day - Day number
 * @param numExercises - Number of exercises to select (1 or 2)
 * @param dailyStrengthExercises - Exercises already used in Strength block today (exclude)
 * @returns Selected exercise records from filteredExercises, or []
 */
export async function selectTechnicalExercises(
  supabase: any,
  filteredExercises: any[],
  user: any,
  mainLift: string,
  week: number,
  day: number,
  numExercises: number,
  dailyStrengthExercises: string[] = []
): Promise<any[]> {
  const norm = normalizeMainLift(mainLift)
  const categories = getFocusCategories(mainLift, numExercises, week, day, user)
  if (categories.length === 0) return []

  const { data: focusRows, error } = await supabase
    .from('technical_exercise_focus')
    .select('exercise_name')
    .eq('main_lift', norm)
    .in('focus_category', categories)

  if (error) {
    console.error('technical_exercise_focus query error:', error)
    return []
  }
  if (!focusRows || focusRows.length === 0) return []

  const allowedNames = new Set(focusRows.map((r: any) => r.exercise_name))
  const strengthSet = new Set(dailyStrengthExercises || [])

  const pool = filteredExercises.filter((ex: any) => {
    if (!allowedNames.has(ex.name)) return false
    if (strengthSet.has(ex.name)) return false
    return true
  })

  if (pool.length === 0) return []

  const seed = week * 7 + day
  const selected: any[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < numExercises && i < pool.length; i++) {
    const available = pool.filter((ex: any) => !usedNames.has(ex.name))
    if (available.length === 0) break

    const idx = (seed + i * 17) % available.length
    const chosen = available[idx]
    selected.push(chosen)
    usedNames.add(chosen.name)
  }

  return selected
}
