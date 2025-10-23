import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'all', 'completed', 'incomplete'
    const limit = parseInt(searchParams.get('limit') || '100')

    console.log(`📖 Fetching BTN workouts for user ${userData.id} (filter: ${filter || 'all'})`)

    // Build query
    let query = supabase
      .from('program_metcons')
      .select('*')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (filter === 'completed') {
      query = query.not('completed_at', 'is', null)
    } else if (filter === 'incomplete') {
      query = query.is('completed_at', null)
    }

    const { data: workouts, error } = await query

    if (error) {
      console.error('❌ Error fetching BTN workouts:', error)
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      )
    }

    console.log(`✅ Found ${workouts.length} BTN workouts`)

    // Calculate stats
    const totalWorkouts = workouts.length
    const completedWorkouts = workouts.filter(w => w.completed_at !== null).length
    const completionRate = totalWorkouts > 0 
      ? Math.round((completedWorkouts / totalWorkouts) * 100) 
      : 0

    return NextResponse.json({ 
      success: true,
      workouts,
      stats: {
        total: totalWorkouts,
        completed: completedWorkouts,
        incomplete: totalWorkouts - completedWorkouts,
        completionRate
      }
    })
  } catch (error: any) {
    console.error('❌ Exception fetching BTN workouts:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}
