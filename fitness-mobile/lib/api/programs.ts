import { createClient } from '../supabase/client'
import { fetchWorkout } from './workouts'

export interface DaySummary {
  day: number
  dayName: string
  totalExercises: number
  completed: number
}

export interface WeekSummary {
  week: number
  days: DaySummary[]
}

export interface ProgramSummary {
  id: number
  generatedAt: string
  monthIndex: number
  weeks: WeekSummary[]
}

export async function fetchProgramSummaries(
  userId: number
): Promise<ProgramSummary[]> {
  const supabase = createClient()

  // Fetch all programs for this user ordered by generated date
  const { data: programRows, error: progErr } = await supabase
    .from('programs')
    .select('id, generated_at, program_data, weeks_generated')
    .eq('user_id', userId)
    .order('generated_at', { ascending: true })

  if (progErr || !programRows) {
    throw new Error('Failed to load programs')
  }

  const monthPromises = programRows.map(async (p: any, idx: number) => {
    const programData = p.program_data || {}
    const weeksGenerated: number[] = (p.weeks_generated || [])
      .slice()
      .sort((a: number, b: number) => a - b)
    const weeksInData: any[] = programData.weeks || []

    const weeks: WeekSummary[] = await Promise.all(
      weeksGenerated.map(async (weekNum) => {
        const weekData =
          weeksInData.find((w: any) => w.week === weekNum) || { days: [] }
        const days = (weekData.days || [])
          .slice()
          .sort((a: any, b: any) => a.day - b.day)

        const daySummaries: DaySummary[] = await Promise.all(
          days.map(async (d: any) => {
            // Default to original count from program_data (fallback)
            let totalExercises = (d.blocks || []).reduce(
              (sum: number, block: any) => sum + (block.exercises?.length || 0),
              0
            )

            // Fetch workout to get modified exercise count (accounts for AI modifications)
            let hasEngineData = false
            let engineDayNumber = 0
            try {
              const workoutResult = await fetchWorkout(p.id, weekNum, d.day)
              if (workoutResult.success && workoutResult.workout?.blocks) {
                // Calculate total from modified blocks, skip ENGINE (handled separately)
                totalExercises = workoutResult.workout.blocks.reduce(
                  (sum: number, block: any) => {
                    if (block.blockName === 'ENGINE') return sum
                    return sum + (Array.isArray(block.exercises) ? block.exercises.length : 0)
                  },
                  0
                )
                
                // Check if this workout has ENGINE data
                if (workoutResult.workout.engineData) {
                  hasEngineData = true
                  engineDayNumber = workoutResult.workout.engineData.dayNumber
                  totalExercises += 1  // Add 1 for ENGINE
                }
              }
            } catch (err) {
              // If workout fetch fails, use original count from program_data
              console.warn(
                `Failed to fetch modified workout count for week ${weekNum}, day ${d.day}:`,
                err
              )
            }

            // Fetch completion count for this day directly from performance_logs
            let completed = 0
            try {
              const { data: completions } = await supabase
                .from('performance_logs')
                .select('exercise_name, set_number')
                .eq('user_id', userId)
                .eq('program_id', p.id)
                .eq('week', weekNum)
                .eq('day', d.day)

              if (completions) {
                // Count unique exercises (handling set numbers)
                const uniqueExercises = new Set(
                  completions.map((c: any) => `${c.exercise_name}-${c.set_number || 1}`)
                )
                completed = uniqueExercises.size
              }
              
              // Check if ENGINE is completed
              if (hasEngineData && engineDayNumber > 0) {
                const { data: engineSession } = await supabase
                  .from('workout_sessions')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('program_day_number', engineDayNumber)
                  .eq('completed', true)
                  .limit(1)
                  .maybeSingle()
                
                if (engineSession) {
                  completed += 1  // Add 1 for completed ENGINE
                }
              }
            } catch (err) {
              console.warn('Failed to fetch completion count:', err)
            }

            return {
              day: d.day,
              dayName: d.dayName || `Day ${d.day}`,
              totalExercises,
              completed,
            }
          })
        )

        return { week: weekNum, days: daySummaries }
      })
    )

    return {
      id: p.id,
      generatedAt: p.generated_at,
      monthIndex: idx + 1,
      weeks,
    }
  })

  const summaries = await Promise.all(monthPromises)
  return summaries
}

