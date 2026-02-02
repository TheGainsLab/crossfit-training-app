import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

/**
 * GET /api/admin/exercises
 *
 * Fetches exercises valid for a specific block type, optionally filtered by user equipment.
 *
 * Query params:
 *   - blockType: SKILLS | TECHNICAL | STRENGTH | ACCESSORIES (required)
 *   - userId: number (optional) - if provided, filters by user's equipment
 *   - search: string (optional) - search by exercise name
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const blockType = searchParams.get('blockType')?.toUpperCase()
    const targetUserId = searchParams.get('userId')
    const search = searchParams.get('search')

    if (!blockType) {
      return NextResponse.json(
        { success: false, error: 'blockType is required' },
        { status: 400 }
      )
    }

    // Map block type to can_be column
    const blockColumnMap: { [key: string]: string } = {
      'SKILLS': 'can_be_skills',
      'TECHNICAL': 'can_be_technical',
      'TECHNICAL WORK': 'can_be_technical',
      'STRENGTH': 'can_be_strength',
      'STRENGTH AND POWER': 'can_be_strength',
      'ACCESSORIES': 'can_be_accessories',
    }

    const canBeColumn = blockColumnMap[blockType]
    if (!canBeColumn) {
      return NextResponse.json(
        { success: false, error: `Invalid blockType: ${blockType}. Must be SKILLS, TECHNICAL, STRENGTH, or ACCESSORIES` },
        { status: 400 }
      )
    }

    // Get user's equipment if userId provided
    let userEquipment: string[] = []
    if (targetUserId) {
      const { data: userData } = await supabase
        .from('users')
        .select('equipment')
        .eq('id', parseInt(targetUserId))
        .single()

      userEquipment = userData?.equipment || []
    }

    // Build query for exercises
    let query = supabase
      .from('exercises')
      .select('id, name, required_equipment, difficulty_level, program_notes, scaling_options, one_rm_reference')
      .eq(canBeColumn, true)
      .order('name')

    // Add search filter if provided
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data: exercises, error: exercisesError } = await query

    if (exercisesError) {
      console.error('Error fetching exercises:', exercisesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch exercises' },
        { status: 500 }
      )
    }

    // Filter by equipment if user has equipment list
    let filteredExercises = exercises || []
    if (userEquipment.length > 0) {
      filteredExercises = filteredExercises.filter(exercise => {
        const required = exercise.required_equipment || []
        // Exercise is valid if it requires no equipment, or all required equipment is available
        if (required.length === 0) return true
        return required.every((eq: string) =>
          eq === 'None' || eq === '' || userEquipment.includes(eq)
        )
      })
    }

    // Add equipment match info for UI
    const exercisesWithMeta = filteredExercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      requiredEquipment: ex.required_equipment || [],
      difficultyLevel: ex.difficulty_level,
      programNotes: ex.program_notes,
      scalingOptions: ex.scaling_options,
      oneRmReference: ex.one_rm_reference,
      hasAllEquipment: true // Already filtered, so all have equipment
    }))

    return NextResponse.json({
      success: true,
      exercises: exercisesWithMeta,
      blockType,
      userEquipment: userEquipment.length > 0 ? userEquipment : null
    })

  } catch (error) {
    console.error('Error in exercises API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
