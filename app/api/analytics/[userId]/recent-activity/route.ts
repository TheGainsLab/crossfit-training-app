// /api/analytics/[userId]/recent-activity/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { canAccessAthleteData, getUserIdFromAuth } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    const userIdNum = parseInt(userId)
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

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

    // Get requesting user ID from authentication
    const { userId: requestingUserId, error: authError } = await getUserIdFromAuth(supabase)
    if (authError || !requestingUserId) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to access this athlete's data
    const { hasAccess, permissionLevel, isCoach } = await canAccessAthleteData(
      supabase, 
      requestingUserId, 
      userIdNum
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to user data' },
        { status: 403 }
      )
    }

    // Get performance data - all-time to align with session review and dashboard semantics
    const { data: performanceData, error: perfError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userIdNum)
      .order('logged_at', { ascending: false })

    if (perfError) {
      console.error('❌ Failed to fetch performance data:', perfError)
      return NextResponse.json(
        { error: 'Failed to fetch performance data', details: perfError.message },
        { status: 500 }
      )
    }

    if (!performanceData || performanceData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          recentSessions: []
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          message: 'No recent training activity found',
          accessType: isCoach ? 'coach' : 'self',
          permissionLevel
        }
      })
    }

    // Process the data to get recent training sessions
    const recentSessions = processRecentActivity(performanceData)

    // Get limit from query params, default to 25 (enough for "Last 25" filter)
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 25

    const response = {
      success: true,
      data: {
        recentSessions: recentSessions.slice(0, limit)
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        totalExercises: performanceData.length,
        activeDays: recentSessions.length,
        accessType: isCoach ? 'coach' : 'self',
        permissionLevel
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Unexpected error in recent activity:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * Process performance data into recent training sessions
 */
function processRecentActivity(performanceData: any[]) {
  // Group exercises by program_id + week + day (session structure)
  const sessionGroups: { [key: string]: any[] } = {}
  
  performanceData.forEach(exercise => {
    const programId = exercise.program_id || 0
    const week = exercise.week || 1
    const day = exercise.day || 1
    const sessionKey = `${programId}-W${week}D${day}` // e.g., "37-W1D2"
    
    if (!sessionGroups[sessionKey]) {
      sessionGroups[sessionKey] = []
    }
    sessionGroups[sessionKey].push(exercise)
  })

  // Convert to array and sort by most recent logged_at timestamp within each session
  const sessions = Object.entries(sessionGroups)
    .map(([sessionKey, exercises]) => {
      // Sort exercises by logged_at to get the most recent timestamp for this session
      const sortedExercises = exercises.sort((a, b) => 
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
      )
      
      // Group exercises by block
      const blockGroups: { [key: string]: any[] } = {}
      exercises.forEach(exercise => {
        const blockName = exercise.block || 'Unknown'
        if (!blockGroups[blockName]) {
          blockGroups[blockName] = []
        }
        blockGroups[blockName].push(exercise)
      })

      // Create block summary
      const blocks = Object.entries(blockGroups).map(([blockName, blockExercises]) => ({
        blockName,
        exerciseCount: blockExercises.length
      }))

      // Get session info from first exercise
      const firstExercise = sortedExercises[0]
      const week = firstExercise.week
      const day = firstExercise.day
      const programId = firstExercise.program_id || null
      
      // Use the most recent exercise timestamp as the session date
      const sessionDate = new Date(firstExercise.logged_at).toISOString().split('T')[0]

      return {
        sessionKey,
        date: sessionDate,
        week,
        day,
        totalExercises: exercises.length,
        programId,
        blocks: blocks
          // Keep a stable, meaningful order for blocks: show all existing blocks
          .sort((a, b) => a.blockName.localeCompare(b.blockName)),
        mostRecentTimestamp: new Date(firstExercise.logged_at).getTime() // For sorting sessions
      }
    })
    .sort((a, b) => b.mostRecentTimestamp - a.mostRecentTimestamp) // Sort by most recent activity

  return sessions
}
