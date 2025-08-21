import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Get userId from query params
    const searchParams = request.nextUrl.searchParams
    const userIdParam = searchParams.get('userId')
    
    if (!userIdParam) {
      return NextResponse.json({ success: false, error: 'Missing userId parameter' }, { status: 400 })
    }

    const userId = parseInt(userIdParam)

    // Get user's internal ID to verify ownership
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Verify the requesting user matches the userId (basic permission check)
    if (userData.id !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    // Count completed MetCons by joining through programs table
    // Since program_metcons doesn't have user_id, we join through programs
    const { data: metconsData, error: metconsError } = await supabase
      .from('program_metcons')
      .select(`
        id,
        programs!inner(user_id)
      `, { count: 'exact' })
      .not('completed_at', 'is', null)
      .eq('programs.user_id', userId)

    if (metconsError) {
      console.error('Error fetching metcons count:', metconsError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch MetCons count',
        details: metconsError.message 
      }, { status: 500 })
    }

    const metconsCount = metconsData?.length || 0

    return NextResponse.json({
      success: true,
      count: metconsCount,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in MetCons count API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
