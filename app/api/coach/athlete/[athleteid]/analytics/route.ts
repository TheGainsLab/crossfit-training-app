import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
{ params }: { params: Promise<{ athleteid: string }> }
) {
  try {
    // ADD THESE DEBUG LOGS HERE
    console.log('🔍 Raw request URL:', request.url);
    console.log('🔍 Raw params object:', params);
    console.log('🔍 Params is Promise?', params instanceof Promise);
    
    // Try both approaches
    let athleteId;
    if (params instanceof Promise) {
      const resolvedParams = await params;
      console.log('🔍 Resolved params (awaited):', resolvedParams);

athleteId = resolvedParams.athleteid;  // Use lowercase 'athleteid'


    } else {
      console.log('🔍 Direct params (not awaited):', params);
      
athleteId = (params as any).athleteid;
    }
    
    console.log('🔍 Final athleteId:', athleteId);
    console.log('🔍 Type of athleteId:', typeof athleteId);

    console.log('🔍 API: Raw athleteId received:', athleteId)
    console.log('🔍 API: Type of athleteId:', typeof athleteId)
    console.log('🔍 API: parseInt result:', parseInt(athleteId))
    console.log('🔍 API: isNaN check:', isNaN(parseInt(athleteId)))

    const athleteIdNum = parseInt(athleteId)

    if (isNaN(athleteIdNum)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid athlete ID'
      }, { status: 400 })
    }

    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: any) {
            try { cookieStore.set(name, value, options) } catch (error) {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set(name, '', { ...options, maxAge: 0 }) } catch (error) {}
          },
        },
      }
    )

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Get coach user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    // Verify coach status
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('id, coach_name')
      .eq('user_id', userData.id)
      .eq('status', 'approved')
      .single()

    if (coachError) {
      return NextResponse.json({
        success: false,
        error: 'Not an approved coach'
      }, { status: 403 })
    }

    // Verify coach-athlete relationship
    const { data: relationship, error: relationshipError } = await supabase
      .from('coach_athlete_relationships')
      .select('permission_level')
      .eq('coach_id', coachData.id)
      .eq('athlete_id', athleteIdNum)
      .eq('status', 'active')
      .single()

    if (relationshipError) {
      return NextResponse.json({
        success: false,
        error: 'No active coaching relationship with this athlete'
      }, { status: 403 })
    }

    console.log(`🎯 Coach ${coachData.coach_name} accessing analytics for athlete ${athleteIdNum}`)

// Fetch analytics data by calling internal APIs
const baseUrl = request.nextUrl.origin
const authHeader = request.headers.get('cookie');

const [dashboardRes, skillsRes, strengthRes, metconsRes, recentRes] = await Promise.allSettled([
  fetch(`${baseUrl}/api/analytics/${athleteIdNum}/dashboard`, {
    headers: { 'cookie': authHeader || '' }
  }),
  fetch(`${baseUrl}/api/analytics/${athleteIdNum}/skills-analytics`, {
    headers: { 'cookie': authHeader || '' }
  }),
  fetch(`${baseUrl}/api/analytics/${athleteIdNum}/strength-tracker`, {
    headers: { 'cookie': authHeader || '' }
  }),
  fetch(`${baseUrl}/api/analytics/${athleteIdNum}/exercise-heatmap`, {
    headers: { 'cookie': authHeader || '' }
  }),
  fetch(`${baseUrl}/api/analytics/${athleteIdNum}/recent-activity`, {
    headers: { 'cookie': authHeader || '' }
  })
])

    // Process results
    const analyticsData: any = {}

    if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
      try {
        analyticsData.dashboard = await dashboardRes.value.json()
      } catch (e) {
        console.log('Dashboard API parse error:', e)
      }
    }

    if (skillsRes.status === 'fulfilled' && skillsRes.value.ok) {
      try {
        analyticsData.skills = await skillsRes.value.json()
      } catch (e) {
        console.log('Skills API parse error:', e)
      }
    }

    if (strengthRes.status === 'fulfilled' && strengthRes.value.ok) {
      try {
        analyticsData.strength = await strengthRes.value.json()
      } catch (e) {
        console.log('Strength API parse error:', e)
      }
    }

    if (metconsRes.status === 'fulfilled' && metconsRes.value.ok) {
      try {
        analyticsData.metcons = await metconsRes.value.json()
      } catch (e) {
        console.log('MetCons API parse error:', e)
      }
    }

    if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
      try {
        analyticsData.recent = await recentRes.value.json()
      } catch (e) {
        console.log('Recent API parse error:', e)
      }
    }

    // Get athlete info
    const { data: athleteData, error: athleteError } = await supabase
      .from('users')
      .select('id, name, email, ability_level')
      .eq('id', athleteIdNum)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        athlete: athleteData,
        analytics: analyticsData,
        coachPermissions: {
          permissionLevel: relationship.permission_level,
          coachId: coachData.id,
          coachName: coachData.coach_name
        }
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        athleteId: athleteIdNum,
        coachAccess: true
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in coach analytics wrapper:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
// Force deployment
// Force deployment
