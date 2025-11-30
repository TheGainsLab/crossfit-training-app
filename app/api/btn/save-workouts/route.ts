import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exerciseEquipment } from '@/lib/btn/data'

interface BTNWorkout {
  name: string
  format: string
  timeDomain: string
  exercises: any[]
  rounds?: number
  amrapTime?: number
  pattern?: string
  medianScore?: string
  excellentScore?: string
}

export async function POST(request: NextRequest) {
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

    const { workouts } = await request.json()

    if (!workouts || !Array.isArray(workouts)) {
      return NextResponse.json(
        { error: 'Invalid workouts data - expected array' }, 
        { status: 400 }
      )
    }

    console.log(`💾 Saving ${workouts.length} BTN workouts for user ${userData.id}`)
    console.log('Sample workout to save:', JSON.stringify(workouts[0], null, 2))

    // Check incomplete workout limit (20 incomplete workouts max)
    const MAX_INCOMPLETE_WORKOUTS = 20
    const { count: incompleteWorkoutCount, error: incompleteCountError } = await supabase
      .from('program_metcons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')
      .is('completed_at', null) // Only count incomplete workouts

    if (incompleteCountError) {
      console.error('⚠️ Error counting incomplete workouts:', incompleteCountError)
      // Continue anyway - don't block on count error, but log it
    }

    const currentIncomplete = incompleteWorkoutCount || 0
    const availableSlots = MAX_INCOMPLETE_WORKOUTS - currentIncomplete

    if (workouts.length > availableSlots) {
      console.log(`❌ Workout limit exceeded: ${currentIncomplete} incomplete, trying to add ${workouts.length}, limit is ${MAX_INCOMPLETE_WORKOUTS}`)
      return NextResponse.json(
        { 
          error: `You can only store ${MAX_INCOMPLETE_WORKOUTS} incomplete workouts. You currently have ${currentIncomplete} incomplete workouts. Please complete or delete some workouts to make room.`,
          incompleteCount: currentIncomplete,
          maxAllowed: MAX_INCOMPLETE_WORKOUTS,
          availableSlots,
          requestedCount: workouts.length
        }, 
        { status: 400 }
      )
    }

    console.log(`✅ Workout limit check passed: ${currentIncomplete} incomplete, ${availableSlots} slots available, adding ${workouts.length}`)

    // Get count of existing BTN workouts for this user to determine starting number
    const { count: existingWorkoutCount, error: countError } = await supabase
      .from('program_metcons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (countError) {
      console.error('⚠️ Error counting existing workouts:', countError)
      // Continue anyway, start from 1
    }

    const startNumber = (existingWorkoutCount || 0) + 1
    console.log(`📊 Existing workouts: ${existingWorkoutCount || 0}, starting new workouts at: ${startNumber}`)

    // Transform BTN workouts to database format
    const workoutRecords = workouts.map((workout: BTNWorkout, index: number) => {
      // Calculate required equipment from exercises
      const equipmentSet = new Set<string>()
      workout.exercises.forEach((exercise: any) => {
        const exerciseName = exercise.name || exercise.exercise
        const equipment = exerciseEquipment[exerciseName] || []
        equipment.forEach(eq => equipmentSet.add(eq))
      })
      const requiredEquipment = Array.from(equipmentSet)

      return {
        user_id: userData.id,
        workout_type: 'btn',
        workout_name: `Workout ${startNumber + index}`, // Sequential naming regardless of original name
        workout_format: workout.format,
        time_domain: workout.timeDomain,
        exercises: workout.exercises,
        required_equipment: requiredEquipment.length > 0 ? requiredEquipment : null,
        rounds: workout.rounds || null,
        amrap_time: workout.amrapTime || null,
        pattern: workout.pattern || null,
        
        // Benchmark scores for percentile calculation
        median_score: workout.medianScore || null,
        excellent_score: workout.excellentScore || null,
        
        // Result fields (empty until user logs result)
        user_score: null,
        percentile: null,
        completed_at: null,
        notes: null,
        result: null,
        result_time: null,
        result_rounds: null,
        result_reps: null,
        
        // Program fields (null for BTN - not part of a program)
        program_id: null,
        program_workout_id: null,
        week: null,
        day: null,
        metcon_id: null, // Could match to library metcon later
      }
    })

    const { data, error } = await supabase
      .from('program_metcons')
      .insert(workoutRecords)
      .select()

    if (error) {
      console.error('❌ Error saving BTN workouts:', error)
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      )
    }

    console.log(`✅ Saved ${data.length} BTN workouts to database`)
    console.log('First saved workout ID:', data[0]?.id, 'user_id:', data[0]?.user_id, 'workout_type:', data[0]?.workout_type)

    return NextResponse.json({ 
      success: true, 
      savedCount: data.length,
      workouts: data 
    })
  } catch (error: any) {
    console.error('❌ Exception saving BTN workouts:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}
