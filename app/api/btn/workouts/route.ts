import { NextRequest, NextResponse } from 'next/server'
import { createClientForRequest } from '@/app/api/utils/create-client-mobile'

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientForRequest(request)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { 
          status: 401,
          headers: corsHeaders
        }
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
        { 
          status: 404,
          headers: corsHeaders
        }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'all', 'completed', 'incomplete'
    const limit = parseInt(searchParams.get('limit') || '100')

    console.log(`📖 Fetching BTN workouts for user ${userData.id} (filter: ${filter || 'all'})`)

    // First, get ALL workouts for stats calculation (no filter applied)
    const { data: allWorkouts, error: allError } = await supabase
      .from('program_metcons')
      .select('id, completed_at')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (allError) {
      console.error('❌ Error fetching all workouts for stats:', allError)
      // Continue anyway, but stats will be 0
    }

    // Calculate stats from ALL workouts (not filtered)
    const totalWorkouts = (allWorkouts || []).length
    const completedWorkouts = (allWorkouts || []).filter(w => w.completed_at !== null).length
    const completionRate = totalWorkouts > 0 
      ? Math.round((completedWorkouts / totalWorkouts) * 100) 
      : 0

    // Now build query for filtered workout list (for display only)
    let query = supabase
      .from('program_metcons')
      .select('*')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters only to the workout list (not stats)
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
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }

    console.log(`✅ Found ${workouts.length} BTN workouts (filtered), ${totalWorkouts} total workouts`)
    if (workouts.length > 0) {
      console.log('First workout:', { id: workouts[0].id, name: workouts[0].workout_name, user_id: workouts[0].user_id, workout_type: workouts[0].workout_type })
    } else {
      console.log('No workouts found. Query was for user_id:', userData.id, 'workout_type: btn')
    }

    return NextResponse.json({ 
      success: true,
      workouts,
      stats: {
        total: totalWorkouts,
        completed: completedWorkouts,
        incomplete: totalWorkouts - completedWorkouts,
        completionRate
      }
    }, {
      headers: corsHeaders
    })
  } catch (error: any) {
    console.error('❌ Exception fetching BTN workouts:', error)
    return NextResponse.json(
      { error: error.message }, 
      { 
        status: 500,
        headers: corsHeaders
      }
    )
  }
}
