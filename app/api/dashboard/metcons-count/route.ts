import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { canAccessAthleteData, getUserIdFromAuth } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
    
    // Get userId from query params
    const searchParams = request.nextUrl.searchParams
    const userIdParam = searchParams.get('userId')
    
    if (!userIdParam) {
      return NextResponse.json({ success: false, error: 'Missing userId parameter' }, { status: 400 })
    }

    const targetAthleteId = parseInt(userIdParam)

    // Get requesting user ID from auth
    const { userId: requestingUserId, error: authError } = await getUserIdFromAuth(supabase)
    if (authError || !requestingUserId) {
      return NextResponse.json({ success: false, error: authError || 'Not authenticated' }, { status: 401 })
    }

    // Check permissions (self-access or coach access)
    const { hasAccess, permissionLevel, isCoach } = await canAccessAthleteData(
      supabase, 
      requestingUserId, 
      targetAthleteId
    )

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
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
      .eq('programs.user_id', targetAthleteId)

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
      metadata: {
        accessType: isCoach ? 'coach' : 'self',
        permissionLevel,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error in MetCons count API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
