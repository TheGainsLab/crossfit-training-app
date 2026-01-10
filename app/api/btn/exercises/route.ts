import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toDisplayName } from '@/lib/btn/db'

/**
 * GET /api/btn/exercises
 * Returns list of available BTN exercises for include/exclude dropdowns
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Fetch BTN-eligible exercises from database
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('name')
      .eq('btn_eligible', true)
      .order('name')

    if (error) {
      console.error('Error fetching BTN exercises:', error)
      return NextResponse.json(
        { error: 'Failed to fetch exercises' },
        { status: 500 }
      )
    }

    // Convert to display names and sort
    const exerciseNames = exercises
      .map(e => toDisplayName(e.name))
      .sort()

    return NextResponse.json({
      success: true,
      exercises: exerciseNames
    })

  } catch (error: any) {
    console.error('Error in exercises endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
