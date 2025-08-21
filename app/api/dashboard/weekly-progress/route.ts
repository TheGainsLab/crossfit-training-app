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
    
    // Get parameters
    const searchParams = request.nextUrl.searchParams
    const userIdParam = searchParams.get('userId')
    const programIdParam = searchParams.get('programId')
    
    if (!userIdParam || !programIdParam) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing userId or programId parameter' 
      }, { status: 400 })
    }

    const targetAthleteId = parseInt(userIdParam)
    const programId = parseInt(programIdParam)

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

    // Get completed exercises from performance_logs to determine current week and progress
    const { data: completedLogs, error: logsError } = await supabase
      .from('performance_logs')
      .select('week, day, logged_at')
      .eq('program_id', programId)
      .eq('user_id', targetAthleteId)
      .order('logged_at', { ascending: false })

    if (logsError) {
      console.error('Error fetching performance logs:', logsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch progress data' }, { status: 500 })
    }

    // Determine current week
    let currentWeek = 1
    if (completedLogs && completedLogs.length > 0) {
      // Get the most recent week with activity
      const recentWeeks = completedLogs.map(log => log.week)
      currentWeek = Math.max(...recentWeeks)
      
      // If current week seems fully completed, advance to next week
      const currentWeekDays = completedLogs.filter(log => log.week === currentWeek)
      const uniqueCurrentWeekDays = [...new Set(currentWeekDays.map(log => log.day))].length
      
      if (uniqueCurrentWeekDays >= 5) { // Assuming 5 days per week
        currentWeek += 1
      }
    }

    // Get completion data for current week
    const currentWeekLogs = completedLogs?.filter(log => log.week === currentWeek) || []
    const completedDays = [...new Set(currentWeekLogs.map(log => log.day))].sort()
    
    // Get most recent workout info
    let lastWorkout = null
    let exercisesLogged = 0
    let totalExercises = 0
    
    if (completedLogs && completedLogs.length > 0) {
      lastWorkout = completedLogs[0].logged_at
      
      // Count exercises for most recent day
      const mostRecentDay = completedLogs[0]
      const recentDayLogs = completedLogs.filter(
        log => log.week === mostRecentDay.week && log.day === mostRecentDay.day
      )
      exercisesLogged = recentDayLogs.length
      
      // For total exercises, we'd need to query the program structure
      // For now, we'll estimate or leave as is
      totalExercises = exercisesLogged // Placeholder - you might want to get this from program_workouts
    }

    const weeklyProgress = {
      currentWeek,
      completedDays,
      totalDays: 5, // Standard 5-day week
      lastWorkout,
      exercisesLogged,
      totalExercises: Math.max(totalExercises, exercisesLogged)
    }

    return NextResponse.json({
      success: true,
      weeklyProgress,
      metadata: {
        accessType: isCoach ? 'coach' : 'self',
        permissionLevel,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error in weekly progress API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
