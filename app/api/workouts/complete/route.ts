import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CompletionData {
  programId: number
  userId: number
  week: number
  day: number
  block: string
  exerciseName: string
  setNumber?: number 
  setsCompleted?: number
  repsCompleted?: number | string  // Can be number or string like "8-10" or "AMRAP"
  weightUsed?: number
  timeCompleted?: string  // For time-based exercises like "5:30"
  caloriesCompleted?: number  // For calorie-based exercises
  distanceCompleted?: string  // For distance-based exercises
  rpe?: number  // Rate of Perceived Exertion (1-10)
  quality?: string  // Quality grade (A, B, C, D)
  notes?: string
  wasRx?: boolean  // Did they do the workout as prescribed?
  scalingUsed?: string  // What scaling modifications were used
}

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Exercise completion logging called')
    
    const body = await request.json()
    const completionData: CompletionData = body

    // Validate required fields
    if (!completionData.programId || !completionData.userId || 
        !completionData.week || !completionData.day || 
        !completionData.block || !completionData.exerciseName) {
      return NextResponse.json(
        { error: 'Missing required fields: programId, userId, week, day, block, exerciseName' },
        { status: 400 }
      )
    }

    // Validate numeric ranges
    if (completionData.week < 1 || completionData.week > 12) {
      return NextResponse.json(
        { error: 'Week must be between 1 and 12' },
        { status: 400 }
      )
    }

    if (completionData.day < 1 || completionData.day > 5) {
      return NextResponse.json(
        { error: 'Day must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (completionData.rpe && (completionData.rpe < 1 || completionData.rpe > 10)) {
      return NextResponse.json(
        { error: 'RPE must be between 1 and 10' },
        { status: 400 }
      )
    }

    if (completionData.quality && !['A', 'B', 'C', 'D'].includes(completionData.quality)) {
      return NextResponse.json(
        { error: 'Quality must be A, B, C, or D' },
        { status: 400 }
      )
    }

    console.log(`📊 Logging completion: ${completionData.exerciseName} - Week ${completionData.week}, Day ${completionData.day}`)

// Check if this exact completion already exists (prevent duplicates)
const { data: existingCompletion } = await supabase
  .from('workout_completions')
  .select('id')
  .eq('user_id', completionData.userId)
  .eq('program_id', completionData.programId)
  .eq('week', completionData.week)
  .eq('day', completionData.day)
  .eq('block', completionData.block)
  .eq('exercise_name', completionData.exerciseName)
  .eq('set_number', completionData.setNumber || 1)  // ← ADD THIS LINE
  .single()

    let result
    if (existingCompletion) {
      // Update existing completion
      console.log('🔄 Updating existing completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .update({
          set_number: completionData.setNumber || 1,  // ← ADD THIS LINE       
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Create new completion
      console.log('✨ Creating new completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .insert({
          user_id: completionData.userId,
          program_id: completionData.programId,
          week: completionData.week,
          day: completionData.day,
          block: completionData.block,
          exercise_name: completionData.exerciseName,
          set_number: completionData.setNumber || 1,  // ← ADD THIS LINE    
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('❌ Failed to save completion:', result.error)
      return NextResponse.json(
        { error: 'Failed to save workout completion', details: result.error.message },
        { status: 500 }
      )
    }

    // Also log to performance_logs for analytics (including quality grade)
    console.log('📊 Logging to performance_logs for analytics...')
    
    // First, try to find the program_workout_id
    const { data: programWorkout } = await supabase
      .from('program_workouts')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
      .eq('block', completionData.block)
      .single()

    // Check if performance log already exists
    const { data: existingPerfLog } = await supabase
      .from('performance_logs')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('user_id', completionData.userId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
      .single()

    // Convert quality letter grade to numeric if needed
    const qualityNumeric = completionData.quality ? 
      { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[completionData.quality] : null

    const perfLogData = {
      program_id: completionData.programId,
      user_id: completionData.userId,
      program_workout_id: programWorkout?.id,
      week: completionData.week,
      day: completionData.day,
      block: completionData.block,
      exercise_name: completionData.exerciseName,
      sets: completionData.setsCompleted?.toString(),
      set_number: completionData.setNumber || 1,  // ← ADD THIS LINE    
      reps: completionData.repsCompleted?.toString(),
      weight_time: completionData.weightUsed?.toString(),
      result: completionData.notes,
      rpe: completionData.rpe,
      completion_quality: qualityNumeric,
      quality_grade: completionData.quality,
      logged_at: new Date().toISOString()
    }

    if (existingPerfLog) {
      // Update existing performance log
      await supabase
        .from('performance_logs')
        .update(perfLogData)
        .eq('id', existingPerfLog.id)
    } else {
      // Create new performance log
      await supabase
        .from('performance_logs')
        .insert(perfLogData)
    }

    console.log('✅ Workout completion saved successfully')

    // Get completion stats for this workout session
    const { data: sessionStats } = await supabase
      .from('workout_completions')
      .select('exercise_name')
      .eq('user_id', completionData.userId)
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)

    const completedExercises = sessionStats?.length || 0

    return NextResponse.json({
      success: true,
      completion: result.data,
      sessionStats: {
        completedExercises,
        week: completionData.week,
        day: completionData.day,
        block: completionData.block
      },
      message: existingCompletion ? 'Workout completion updated successfully' : 'Workout completion logged successfully'
    })

  } catch (error) {
    console.error('❌ Unexpected error logging workout completion:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve completions for a specific workout day
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const programId = searchParams.get('programId')
    const week = searchParams.get('week')
    const day = searchParams.get('day')

    if (!userId || !programId || !week || !day) {
      return NextResponse.json(
        { error: 'Missing required query parameters: userId, programId, week, day' },
        { status: 400 }
      )
    }

    console.log(`📊 Fetching completions for User ${userId}, Program ${programId}, Week ${week}, Day ${day}`)

    const { data: completions, error } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', parseInt(userId))
      .eq('program_id', parseInt(programId))
      .eq('week', parseInt(week))
      .eq('day', parseInt(day))
      .order('completed_at', { ascending: true })

    if (error) {
      console.error('❌ Failed to fetch completions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workout completions', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      completions: completions || [],
      totalCompleted: completions?.length || 0
    })

  } catch (error) {
    console.error('❌ Unexpected error fetching completions:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
