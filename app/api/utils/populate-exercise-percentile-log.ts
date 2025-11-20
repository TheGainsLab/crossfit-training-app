import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Populates exercise_percentile_log table with exercise-level percentile data
 * Called after a MetCon/workout completion is saved to program_metcons
 */
export async function populateExercisePercentileLog(
  supabase: SupabaseClient,
  programMetconId: number,
  userId: number,
  percentile: number,
  performanceTier: string,
  week: number,
  day: number,
  loggedAt: string
) {
  try {
    // Fetch the MetCon/workout to get exercises and heart rate data
    const { data: programMetcon, error: fetchError } = await supabase
      .from('program_metcons')
      .select(`
        id,
        metcon_id,
        week,
        day,
        time_domain,
        workout_type,
        avg_heart_rate,
        max_heart_rate,
        metcons(
          workout_id,
          time_range,
          level,
          tasks
        )
      `)
      .eq('id', programMetconId)
      .single()

    if (fetchError || !programMetcon) {
      console.error('❌ Error fetching program_metcon:', fetchError)
      return
    }

    // Extract exercises based on workout type
    let exercises: string[] = []
    let timeRange: string | null = null
    let workoutLevel: string | null = null
    let workoutId: string | null = null
    let metconId: number | null = null

    if (programMetcon.workout_type === 'btn' || programMetcon.workout_type === 'conditioning') {
      // BTN/Conditioning: exercises are in program_metcons.exercises JSONB
      const { data: btnWorkout } = await supabase
        .from('program_metcons')
        .select('exercises, time_domain, workout_name')
        .eq('id', programMetconId)
        .single()

      if (btnWorkout?.exercises) {
        exercises = (btnWorkout.exercises || []).map((ex: any) => ex.name || ex.exercise).filter(Boolean)
        timeRange = btnWorkout.time_domain || null
        workoutId = btnWorkout.workout_name || null
      }
    } else {
      // Premium: exercises are in metcons.tasks JSONB
      const metcon = programMetcon.metcons
      if (metcon?.tasks) {
        exercises = (metcon.tasks || []).map((task: any) => task.exercise).filter(Boolean)
        timeRange = metcon.time_range || null
        workoutLevel = metcon.level || null
        workoutId = metcon.workout_id || null
        metconId = programMetcon.metcon_id
      }
    }

    if (exercises.length === 0) {
      console.log(`⚠️ No exercises found for program_metcon ${programMetconId}`)
      return
    }

    // Delete existing rows for this program_metcon (in case of update)
    await supabase
      .from('exercise_percentile_log')
      .delete()
      .eq('program_metcon_id', programMetconId)

    // Insert rows for each exercise
    const logEntries = exercises.map((exerciseName: string) => ({
      user_id: userId,
      program_metcon_id: programMetconId,
      metcon_id: metconId,
      exercise_name: exerciseName,
      percentile: percentile,
      performance_tier: performanceTier,
      week: week,
      day: day,
      time_domain: programMetcon.time_domain || null,
      workout_level: workoutLevel,
      time_range: timeRange,
      workout_id: workoutId || '',
      avg_heart_rate: programMetcon.avg_heart_rate,
      max_heart_rate: programMetcon.max_heart_rate,
      logged_at: loggedAt
    }))

    const { error: insertError } = await supabase
      .from('exercise_percentile_log')
      .insert(logEntries)

    if (insertError) {
      console.error('❌ Error inserting exercise_percentile_log:', insertError)
    } else {
      console.log(`✅ Populated exercise_percentile_log: ${logEntries.length} exercises for MetCon ${programMetconId}`)
    }
  } catch (error) {
    console.error('❌ Error in populateExercisePercentileLog:', error)
    // Don't throw - this is a non-critical operation
  }
}

