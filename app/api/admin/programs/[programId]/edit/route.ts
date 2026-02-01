import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

/**
 * PATCH /api/admin/programs/[programId]/edit
 *
 * Edit a program's exercises. Supports:
 * - swap: Replace an exercise with another
 * - editDetails: Change sets/reps/weight for an exercise
 * - add: Add a new exercise to a block
 * - remove: Remove an exercise from a block
 *
 * Body:
 * {
 *   week: number,
 *   day: number,
 *   blockName: string,
 *   action: 'swap' | 'editDetails' | 'add' | 'remove',
 *   exerciseIndex?: number,  // For swap, editDetails, remove
 *   newExercise?: { name, sets, reps, weightTime, notes },  // For swap, add
 *   updates?: { sets?, reps?, weightTime?, notes? }  // For editDetails
 * }
 */

const EDITABLE_BLOCKS = ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES']

const BLOCK_TO_COLUMN: { [key: string]: string } = {
  'SKILLS': 'can_be_skills',
  'TECHNICAL WORK': 'can_be_technical',
  'STRENGTH AND POWER': 'can_be_strength',
  'ACCESSORIES': 'can_be_accessories',
}

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
    const { week, day, blockName, action, exerciseIndex, newExercise, updates } = body

    // Validate required fields
    if (week === undefined || day === undefined || !blockName || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: week, day, blockName, action' },
        { status: 400 }
      )
    }

    // Validate block is editable
    const blockNameUpper = blockName.toUpperCase()
    if (!EDITABLE_BLOCKS.includes(blockNameUpper)) {
      return NextResponse.json(
        { success: false, error: `Block "${blockName}" is not editable. Only SKILLS, TECHNICAL WORK, STRENGTH AND POWER, and ACCESSORIES can be edited.` },
        { status: 400 }
      )
    }

    // Validate action
    if (!['swap', 'editDetails', 'add', 'remove'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be swap, editDetails, add, or remove' },
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

    // Find the week and day
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

    // Find the block
    const blockIndex = dayData.blocks?.findIndex(
      (b: any) => b.blockName?.toUpperCase() === blockNameUpper
    )
    if (blockIndex === -1 || blockIndex === undefined) {
      return NextResponse.json(
        { success: false, error: `Block "${blockName}" not found in day ${day}` },
        { status: 404 }
      )
    }

    const block = dayData.blocks[blockIndex]

    // For swap/editDetails/remove, check if exercise is already completed
    if (['swap', 'editDetails', 'remove'].includes(action)) {
      if (exerciseIndex === undefined || exerciseIndex < 0) {
        return NextResponse.json(
          { success: false, error: 'exerciseIndex is required for this action' },
          { status: 400 }
        )
      }

      const exercise = block.exercises?.[exerciseIndex]
      if (!exercise) {
        return NextResponse.json(
          { success: false, error: `Exercise at index ${exerciseIndex} not found` },
          { status: 404 }
        )
      }

      // Check if exercise is completed in performance_logs
      const { data: perfLog } = await supabase
        .from('performance_logs')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('program_id', programIdNum)
        .eq('week', week)
        .eq('day', day)
        .ilike('exercise_name', exercise.name)
        .limit(1)
        .single()

      if (perfLog) {
        return NextResponse.json(
          { success: false, error: `Cannot edit "${exercise.name}" - it has already been completed` },
          { status: 400 }
        )
      }
    }

    // For swap/add, validate the new exercise
    if (['swap', 'add'].includes(action)) {
      if (!newExercise?.name) {
        return NextResponse.json(
          { success: false, error: 'newExercise with name is required for this action' },
          { status: 400 }
        )
      }

      // Check if exercise exists and can be assigned to this block
      const canBeColumn = BLOCK_TO_COLUMN[blockNameUpper]
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('id, name, required_equipment')
        .eq('name', newExercise.name)
        .eq(canBeColumn, true)
        .single()

      if (exerciseError || !exerciseData) {
        return NextResponse.json(
          { success: false, error: `Exercise "${newExercise.name}" is not valid for ${blockName} block` },
          { status: 400 }
        )
      }

      // Check user has required equipment
      const { data: userData } = await supabase
        .from('users')
        .select('equipment')
        .eq('id', targetUserId)
        .single()

      const userEquipment = userData?.equipment || []
      const requiredEquipment = exerciseData.required_equipment || []

      if (requiredEquipment.length > 0 && userEquipment.length > 0) {
        const hasAllEquipment = requiredEquipment.every((eq: string) =>
          eq === 'None' || eq === '' || userEquipment.includes(eq)
        )
        if (!hasAllEquipment) {
          return NextResponse.json(
            { success: false, error: `User doesn't have required equipment for "${newExercise.name}"` },
            { status: 400 }
          )
        }
      }
    }

    // Perform the action
    switch (action) {
      case 'swap': {
        block.exercises[exerciseIndex] = {
          name: newExercise.name,
          sets: newExercise.sets ?? block.exercises[exerciseIndex].sets,
          reps: newExercise.reps ?? block.exercises[exerciseIndex].reps,
          weightTime: newExercise.weightTime ?? block.exercises[exerciseIndex].weightTime,
          notes: newExercise.notes ?? ''
        }
        break
      }

      case 'editDetails': {
        if (!updates) {
          return NextResponse.json(
            { success: false, error: 'updates object is required for editDetails action' },
            { status: 400 }
          )
        }
        const exercise = block.exercises[exerciseIndex]
        if (updates.sets !== undefined) exercise.sets = updates.sets
        if (updates.reps !== undefined) exercise.reps = updates.reps
        if (updates.weightTime !== undefined) exercise.weightTime = updates.weightTime
        if (updates.notes !== undefined) exercise.notes = updates.notes
        break
      }

      case 'add': {
        if (!block.exercises) {
          block.exercises = []
        }
        block.exercises.push({
          name: newExercise.name,
          sets: newExercise.sets ?? '',
          reps: newExercise.reps ?? '',
          weightTime: newExercise.weightTime ?? '',
          notes: newExercise.notes ?? ''
        })
        break
      }

      case 'remove': {
        block.exercises.splice(exerciseIndex, 1)
        break
      }
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
      message: `Exercise ${action} completed successfully`,
      updatedBlock: block
    })

  } catch (error) {
    console.error('Error editing program:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
