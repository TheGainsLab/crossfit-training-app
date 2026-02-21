// /app/api/coach/athletes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Handle cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Handle cookie removal errors
            }
          },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized' 
        },
        { status: 401 }
      )
    }

    // Get user from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found' 
        },
        { status: 404 }
      )
    }

    // Verify user is an approved coach
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', userData.id)
      .eq('status', 'approved')
      .single()

    if (coachError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not an approved coach' 
        },
        { status: 403 }
      )
    }

    // Get all active coach-athlete relationships for this coach
    const { data: relationships, error: relationshipsError } = await supabase
      .from('coach_athlete_relationships')
      .select(`
        id,
        athlete_id,
        permission_level,
        status,
        primary_coach,
        assigned_at,
        users!coach_athlete_relationships_athlete_id_fkey (
          id,
          name,
          email,
          created_at
        )
      `)
      .eq('coach_id', coachData.id)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false })

    if (relationshipsError) {
      console.error('❌ Error fetching coach-athlete relationships:', relationshipsError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch athletes',
          details: relationshipsError.message
        },
        { status: 500 }
      )
    }

    if (!relationships || relationships.length === 0) {
      return NextResponse.json({
        success: true,
        athletes: [],
        totalAthletes: 0,
        message: 'No athletes assigned yet'
      })
    }

    // Get recent activity and compliance data for each athlete
    const athleteIds = relationships.map(rel => rel.athlete_id)
    
    // Get recent session counts (last 14 days)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('performance_logs')
      .select('user_id, logged_at')
      .in('user_id', athleteIds)
      .gte('logged_at', twoWeeksAgo.toISOString())

    // Get latest programs for athletes
    const { data: latestPrograms, error: programsError } = await supabase
      .from('programs')
      .select('user_id, id, generated_at')
      .in('user_id', athleteIds)
      .order('generated_at', { ascending: false })

    // Process athlete data with activity metrics
    
    const athletesWithMetrics = relationships.map(rel => {
      
const athlete = Array.isArray(rel.users) ? rel.users[0] : rel.users
      if (!athlete) return null

      // Calculate recent sessions for this athlete
      const athleteSessions = recentSessions?.filter(session => session.user_id === athlete.id) || []
      const recentSessionCount = athleteSessions.length
      
      // Calculate days since last session
      const lastSession = athleteSessions.sort((a, b) => 
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
      )[0]
      
      const daysSinceLastSession = lastSession 
        ? Math.floor((Date.now() - new Date(lastSession.logged_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      // Get latest program
      const latestProgram = latestPrograms?.find(prog => prog.user_id === athlete.id)

      // Calculate health status
      let healthStatus = 'good'
      if (daysSinceLastSession === null || daysSinceLastSession > 7) {
        healthStatus = 'needs_attention'
      } else if (daysSinceLastSession > 3 || recentSessionCount < 3) {
        healthStatus = 'warning'
      }

      return {
        relationshipId: rel.id,
        athlete: {
          id: athlete.id,
          name: athlete.name,
          email: athlete.email,
          joinedAt: athlete.created_at
        },
        coachingDetails: {
          permissionLevel: rel.permission_level,
          isPrimaryCoach: rel.primary_coach,
          assignedAt: rel.assigned_at
        },
        recentActivity: {
          sessionsLast14Days: recentSessionCount,
          daysSinceLastSession,
          lastSessionDate: lastSession?.logged_at || null,
          healthStatus
        },
        currentProgram: latestProgram ? {
          id: latestProgram.id,
          generatedAt: latestProgram.generated_at
        } : null
      }
    }).filter(Boolean)

    // Calculate summary stats
    const totalAthletes = athletesWithMetrics.length
    const athletesNeedingAttention = athletesWithMetrics.filter(a => a?.recentActivity.healthStatus === 'needs_attention').length
    const athletesWithWarnings = athletesWithMetrics.filter(a => a?.recentActivity.healthStatus === 'warning').length
    const recentlyActiveathletes = athletesWithMetrics.filter(a => a?.recentActivity.healthStatus === 'good').length

    return NextResponse.json({
      success: true,
      athletes: athletesWithMetrics,
      summary: {
        totalAthletes,
        athletesNeedingAttention,
        athletesWithWarnings,
        recentlyActiveathletes,
        averageSessionsPerAthlete: totalAthletes > 0 
          ? Math.round(athletesWithMetrics.reduce((sum, a) => sum + (a?.recentActivity?.sessionsLast14Days || 0), 0) / totalAthletes * 10) / 10
          : 0
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in coach/athletes:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

