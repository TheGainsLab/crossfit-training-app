import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      )
    }

    // Get user's numeric ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    const workoutId = parseInt(params.id)
    if (isNaN(workoutId)) {
      return NextResponse.json(
        { error: 'Invalid workout ID' }, 
        { status: 400 }
      )
    }

    const body = await request.json()
    const { result, notes } = body

    console.log(`📝 Logging result for BTN workout ${workoutId}`)

    // Verify workout belongs to user
    const { data: workout, error: fetchError } = await supabase
      .from('program_metcons')
      .select('id, workout_format')
      .eq('id', workoutId)
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')
      .single()

    if (fetchError || !workout) {
      return NextResponse.json(
        { error: 'Workout not found or access denied' }, 
        { status: 404 }
      )
    }

    // Parse result based on workout format
    let updateData: any = {
      completed_at: new Date().toISOString(),
      user_score: result, // Store raw result
      notes: notes || null
    }

    // Parse format-specific result fields
    const format = workout.workout_format?.toLowerCase() || ''
    
    if (format.includes('time')) {
      // For Time workouts: store as time
      updateData.result_time = result
    } else if (format.includes('amrap')) {
      // AMRAP workouts: parse "rounds+reps" format like "5+10"
      const amrapMatch = result?.match(/(\d+)\+(\d+)/)
      if (amrapMatch) {
        updateData.result_rounds = parseInt(amrapMatch[1])
        updateData.result_reps = parseInt(amrapMatch[2])
      } else {
        // Just rounds number like "5"
        const rounds = parseInt(result)
        if (!isNaN(rounds)) {
          updateData.result_rounds = rounds
        }
      }
    }

    // Update the workout
    const { error: updateError } = await supabase
      .from('program_metcons')
      .update(updateData)
      .eq('id', workoutId)

    if (updateError) {
      console.error('❌ Error updating BTN workout:', updateError)
      return NextResponse.json(
        { error: updateError.message }, 
        { status: 500 }
      )
    }

    console.log(`✅ Logged result for BTN workout ${workoutId}: ${result}`)

    return NextResponse.json({ 
      success: true,
      message: 'Result logged successfully'
    })
  } catch (error: any) {
    console.error('❌ Exception updating BTN workout:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}

// Optional: DELETE endpoint to remove a workout
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      )
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    const workoutId = parseInt(params.id)
    if (isNaN(workoutId)) {
      return NextResponse.json(
        { error: 'Invalid workout ID' }, 
        { status: 400 }
      )
    }

    console.log(`🗑️ Deleting BTN workout ${workoutId}`)

    // Delete workout (only if it belongs to user)
    const { error } = await supabase
      .from('program_metcons')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (error) {
      console.error('❌ Error deleting BTN workout:', error)
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      )
    }

    console.log(`✅ Deleted BTN workout ${workoutId}`)

    return NextResponse.json({ 
      success: true,
      message: 'Workout deleted successfully'
    })
  } catch (error: any) {
    console.error('❌ Exception deleting BTN workout:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}
