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

    const userId = parseInt(userIdParam)
    const programId = parseInt(programIdParam)

    // Verify user ownership
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData || userData.id !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    // Get completed exercises from performance_logs to determine current week and progress
    const { data: completedLogs, error: logsError } = await supabase
      .from('performance_logs')
      .select('week, day, logged_at')
      .eq('program_id', programId)
      .eq('user_id', userId)
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
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in weekly progress API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
