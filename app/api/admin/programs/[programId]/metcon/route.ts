import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

/**
 * PATCH /api/admin/programs/[programId]/metcon
 *
 * Swap a MetCon in a program. The entire MetCon is replaced, not individual tasks.
 *
 * Body:
 * {
 *   week: number,
 *   day: number,
 *   newMetconId: number  // ID from metcons table
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    const supabase = await createClient()

    // Authenticate
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permission
    const userIsAdmin = await isAdmin(supabase, userId)
    if (!userIsAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const programIdNum = parseInt(programId)
    if (isNaN(programIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid program ID' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { week, day, newMetconId } = body

    // Validate required fields
    if (week === undefined || day === undefined || !newMetconId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: week, day, newMetconId' },
        { status: 400 }
      )
    }

    // Fetch the program
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, user_id, program_data')
      .eq('id', programIdNum)
      .single()

    if (programError || !program) {
      return NextResponse.json(
        { success: false, error: 'Program not found' },
        { status: 404 }
      )
    }

    const programData = program.program_data
    const targetUserId = program.user_id

    // Check if this MetCon is already completed
    const { data: existingCompletion } = await supabase
      .from('program_metcons')
      .select('id')
      .eq('program_id', programIdNum)
      .eq('week', week)
      .eq('day', day)
      .eq('user_id', targetUserId)
      .limit(1)
      .single()

    if (existingCompletion) {
      return NextResponse.json(
        { success: false, error: 'Cannot swap MetCon - it has already been completed' },
        { status: 400 }
      )
    }

    // Fetch the new MetCon details
    const { data: newMetcon, error: metconError } = await supabase
      .from('metcons')
      .select('id, workout_id, format, time_range, workout_notes, tasks, required_equipment')
      .eq('id', newMetconId)
      .single()

    if (metconError || !newMetcon) {
      return NextResponse.json(
        { success: false, error: 'MetCon not found' },
        { status: 404 }
      )
    }

    // Check user has required equipment
    const { data: userData } = await supabase
      .from('users')
      .select('equipment')
      .eq('id', targetUserId)
      .single()

    const userEquipment = userData?.equipment || []
    const requiredEquipment = newMetcon.required_equipment || []

    if (requiredEquipment.length > 0 && userEquipment.length > 0) {
      const hasAllEquipment = requiredEquipment.every((eq: string) =>
        eq === 'None' || eq === '' || userEquipment.includes(eq)
      )
      if (!hasAllEquipment) {
        return NextResponse.json(
          { success: false, error: `User doesn't have required equipment for this MetCon` },
          { status: 400 }
        )
      }
    }

    // Find the week and day in program data
    const weekData = programData.weeks?.find((w: any) => w.week === week)
    if (!weekData) {
      return NextResponse.json(
        { success: false, error: `Week ${week} not found in program` },
        { status: 404 }
      )
    }

    const dayData = weekData.days?.find((d: any) => d.day === day)
    if (!dayData) {
      return NextResponse.json(
        { success: false, error: `Day ${day} not found in week ${week}` },
        { status: 404 }
      )
    }

    // Update metconData with new MetCon info
    dayData.metconData = {
      workoutId: newMetcon.workout_id,
      workoutFormat: newMetcon.format,
      timeRange: newMetcon.time_range,
      workoutNotes: newMetcon.workout_notes
    }

    // Update METCONS block if it exists
    const metconBlockIndex = dayData.blocks?.findIndex(
      (b: any) => b.blockName?.toUpperCase() === 'METCONS'
    )

    if (metconBlockIndex !== -1 && metconBlockIndex !== undefined) {
      // Convert tasks to exercises format
      const metconExercises = (newMetcon.tasks || []).map((task: any) => ({
        name: task.exercise || task.name || 'MetCon Task',
        sets: task.sets || '',
        reps: task.reps || '',
        weightTime: task.weight || task.weightTime || '',
        notes: task.notes || ''
      }))

      dayData.blocks[metconBlockIndex].exercises = metconExercises
    }

    // Save the updated program
    const { error: updateError } = await supabase
      .from('programs')
      .update({ program_data: programData })
      .eq('id', programIdNum)

    if (updateError) {
      console.error('Error updating program:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to save program changes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'MetCon swapped successfully',
      newMetcon: {
        workoutId: newMetcon.workout_id,
        format: newMetcon.format,
        timeRange: newMetcon.time_range,
        workoutNotes: newMetcon.workout_notes
      }
    })

  } catch (error) {
    console.error('Error swapping metcon:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
