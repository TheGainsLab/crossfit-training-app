// /api/analytics/[userId]/recent-activity/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user ownership
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('id', userIdNum)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Unauthorized access to user data' },
        { status: 403 }
      )
    }

    console.log(`📈 Fetching recent activity for User ${userIdNum}`)

    // Get recent performance data - last 30 days to ensure we find 5 active days
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const { data: performanceData, error: perfError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userIdNum)
      .gte('logged_at', startDate.toISOString())
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
          message: 'No recent training activity found'
        }
      })
    }

    // Process the data to get last 5 training days with activity
    const recentSessions = processRecentActivity(performanceData)

    const response = {
      success: true,
      data: {
        recentSessions: recentSessions.slice(0, 5) // Limit to 5 most recent
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        totalExercises: performanceData.length,
        activeDays: recentSessions.length
      }
    }

    console.log(`✅ Recent activity processed: ${recentSessions.length} active days found`)

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
  // Group exercises by week and day (program structure)
  const sessionGroups: { [key: string]: any[] } = {}
  
  performanceData.forEach(exercise => {
    const week = exercise.week || 1
    const day = exercise.day || 1
    const sessionKey = `W${week}D${day}` // e.g., "W1D2"
    
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
        blocks: blocks.sort((a, b) => b.exerciseCount - a.exerciseCount), // Sort by exercise count
        mostRecentTimestamp: new Date(firstExercise.logged_at).getTime() // For sorting sessions
      }
    })
    .sort((a, b) => b.mostRecentTimestamp - a.mostRecentTimestamp) // Sort by most recent activity

  return sessions
}
