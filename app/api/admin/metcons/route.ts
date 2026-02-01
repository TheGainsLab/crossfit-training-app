import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

/**
 * GET /api/admin/metcons
 *
 * Fetches MetCons for admin selection, optionally filtered by user constraints.
 *
 * Query params:
 *   - userId: number (optional) - if provided, filters by user's equipment
 *   - search: string (optional) - search by workout_id or workout_notes
 *   - format: string (optional) - filter by format (AMRAP, For Time, etc)
 *   - limit: number (optional) - max results to return (default 50)
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
    const targetUserId = searchParams.get('userId')
    const search = searchParams.get('search')
    const format = searchParams.get('format')
    const limit = parseInt(searchParams.get('limit') || '50')

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

    // Build query for metcons
    let query = supabase
      .from('metcons')
      .select('id, workout_id, format, time_range, workout_notes, tasks, required_equipment, level')
      .order('workout_id')
      .limit(limit)

    // Add search filter if provided
    if (search) {
      query = query.or(`workout_id.ilike.%${search}%,workout_notes.ilike.%${search}%`)
    }

    // Add format filter if provided
    if (format) {
      query = query.eq('format', format)
    }

    const { data: metcons, error: metconsError } = await query

    if (metconsError) {
      console.error('Error fetching metcons:', metconsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch metcons' },
        { status: 500 }
      )
    }

    // Filter by equipment if user has equipment list
    let filteredMetcons = metcons || []
    if (userEquipment.length > 0) {
      filteredMetcons = filteredMetcons.filter(metcon => {
        const required = metcon.required_equipment || []
        // MetCon is valid if it requires no equipment, or all required equipment is available
        if (required.length === 0) return true
        return required.every((eq: string) =>
          eq === 'None' || eq === '' || userEquipment.includes(eq)
        )
      })
    }

    // Format for UI
    const metconsFormatted = filteredMetcons.map(m => ({
      id: m.id,
      workoutId: m.workout_id,
      format: m.format,
      timeRange: m.time_range,
      workoutNotes: m.workout_notes,
      tasks: m.tasks,
      requiredEquipment: m.required_equipment || [],
      level: m.level,
      hasAllEquipment: true // Already filtered
    }))

    // Get unique formats for filter dropdown
    const { data: formats } = await supabase
      .from('metcons')
      .select('format')
      .not('format', 'is', null)

    const uniqueFormats = [...new Set(formats?.map(f => f.format).filter(Boolean))]

    return NextResponse.json({
      success: true,
      metcons: metconsFormatted,
      totalCount: metconsFormatted.length,
      userEquipment: userEquipment.length > 0 ? userEquipment : null,
      availableFormats: uniqueFormats
    })

  } catch (error) {
    console.error('Error in metcons API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
