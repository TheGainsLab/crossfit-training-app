import { createClient } from '../supabase/client'

export interface CompletionData {
  programId: number
  userId: number
  week: number
  day: number
  block: string
  exerciseName: string
  setNumber?: number
  setsCompleted?: number
  repsCompleted?: string
  weightUsed?: number
  rpe?: number
  quality?: string
  notes?: string
  wasRx?: boolean
}

export async function logExerciseCompletion(
  completionData: CompletionData
): Promise<void> {
  const supabase = createClient()
  
  // Convert quality letter to numeric
  const qualityNumeric = completionData.quality 
    ? { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[completionData.quality] 
    : null
  
  // Build data object matching database column names
  const perfLogData: any = {
    program_id: completionData.programId,
    user_id: completionData.userId,
    program_workout_id: null, // This table was removed
    week: completionData.week,
    day: completionData.day,
    block: completionData.block,
    exercise_name: completionData.exerciseName,
    set_number: completionData.setNumber || 1,
    rpe: completionData.rpe,
    completion_quality: qualityNumeric,
    quality_grade: completionData.quality,
    logged_at: new Date().toISOString()
  }

  // Only include fields if they have values (match Next.js API behavior)
  if (completionData.setsCompleted !== undefined && completionData.setsCompleted !== null) {
    perfLogData.sets = completionData.setsCompleted.toString()
  }
  if (completionData.repsCompleted !== undefined && completionData.repsCompleted !== null && completionData.repsCompleted.toString().trim() !== '') {
    perfLogData.reps = completionData.repsCompleted.toString()
  }
  if (completionData.weightUsed !== undefined && completionData.weightUsed !== null) {
    perfLogData.weight_time = completionData.weightUsed.toString()
  }
  if (completionData.notes !== undefined && completionData.notes !== null) {
    perfLogData.result = completionData.notes
  }
  if (completionData.wasRx !== undefined) {
    perfLogData.was_rx = completionData.wasRx
  }

  // Check if log already exists
  const { data: existingLog } = await supabase
    .from('performance_logs')
    .select('id')
    .eq('program_id', completionData.programId)
    .eq('user_id', completionData.userId)
    .eq('week', completionData.week)
    .eq('day', completionData.day)
    .eq('exercise_name', completionData.exerciseName)
    .eq('set_number', completionData.setNumber || 1)
    .single()

  let error
  if (existingLog) {
    // Update existing
    const { error: updateError } = await supabase
      .from('performance_logs')
      .update(perfLogData)
      .eq('id', existingLog.id)
    error = updateError
  } else {
    // Insert new
    const { error: insertError } = await supabase
      .from('performance_logs')
      .insert(perfLogData)
    error = insertError
  }
  
  if (error) {
    throw new Error(`Failed to log completion: ${error.message}`)
  }
}

