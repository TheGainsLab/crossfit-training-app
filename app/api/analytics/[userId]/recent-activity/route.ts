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
  // Group exercises by date
  const dayGroups: { [key: string]: any[] } = {}
  
  performanceData.forEach(exercise => {
    const exerciseDate = new Date(exercise.logged_at)
    const dateKey = exerciseDate.toISOString().split('T')[0] // YYYY-MM-DD
    
    if (!dayGroups[dateKey]) {
      dayGroups[dateKey] = []
    }
    dayGroups[dateKey].push(exercise)
  })

  // Convert to array and sort by date (newest first)
  const sortedDays = Object.entries(dayGroups)
    .map(([date, exercises]) => ({ date, exercises }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Process each day into session format
  const sessions = sortedDays.map(({ date, exercises }) => {
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

    // Try to extract week/day from the first exercise (if available)
    const firstExercise = exercises[0]
    const week = firstExercise.week || extractWeekFromDate(date)
    const day = firstExercise.day || extractDayFromDate(date)
    const programId = firstExercise.program_id || null

    return {
      date,
      week,
      day,
      totalExercises: exercises.length,
      programId,
      blocks: blocks.sort((a, b) => b.exerciseCount - a.exerciseCount) // Sort by exercise count
    }
  })

  return sessions
}

/**
 * Extract week number from date (fallback if not in exercise data)
 */
function extractWeekFromDate(dateString: string): number {
  const date = new Date(dateString)
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + startOfYear.getDay() + 1) / 7)
}

/**
 * Extract day number from date (fallback if not in exercise data)
 */
function extractDayFromDate(dateString: string): number {
  const date = new Date(dateString)
  return date.getDay() === 0 ? 7 : date.getDay() // Sunday = 7, Monday = 1, etc.
}
