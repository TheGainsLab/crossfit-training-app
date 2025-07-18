// User analytics API endpoint
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '30' // days
    
    console.log(`📊 Generating analytics for User ${userId} (last ${timeRange} days)`)

    const userIdNum = parseInt(userId)
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const timeRangeNum = parseInt(timeRange)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeRangeNum)

    // 1. GET RECENT COMPLETIONS
    const { data: recentCompletions, error: completionsError } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', userIdNum)
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: false })

    if (completionsError) {
      console.error('❌ Failed to fetch completions:', completionsError)
      return NextResponse.json(
        { error: 'Failed to fetch completion data', details: completionsError.message },
        { status: 500 }
      )
    }

    // 2. WORKOUT CONSISTENCY METRICS
    const completionsByDate = recentCompletions?.reduce((acc: any, completion) => {
      const date = completion.completed_at.split('T')[0]
      if (!acc[date]) {
        acc[date] = { date, workouts: 0, exercises: 0, totalRPE: 0, rpeCount: 0 }
      }
      acc[date].exercises += 1
      if (completion.rpe) {
        acc[date].totalRPE += completion.rpe
        acc[date].rpeCount += 1
      }
      return acc
    }, {}) || {}

    // Group by workout day (program/week/day combination)
    const workoutDays = recentCompletions?.reduce((acc: any, completion) => {
      const key = `${completion.program_id}-${completion.week}-${completion.day}`
      if (!acc[key]) {
        acc[key] = {
          programId: completion.program_id,
          week: completion.week,
          day: completion.day,
          date: completion.completed_at.split('T')[0],
          exercises: []
        }
      }
      acc[key].exercises.push(completion)
      return acc
    }, {}) || {}

    const workoutSessions = Object.values(workoutDays)
    const consistencyData = Object.values(completionsByDate).map((day: any) => ({
      ...day,
      averageRPE: day.rpeCount > 0 ? (day.totalRPE / day.rpeCount).toFixed(1) : null
    }))

    // 3. STRENGTH PROGRESSION ANALYSIS
    const strengthExercises = ['Snatch', 'Clean and Jerk', 'Back Squat', 'Front Squat', 
                              'Bench Press', 'Deadlift', 'Strict Press', 'Push Press']
    
    const strengthProgressions = strengthExercises.map(exercise => {
      const exerciseCompletions = recentCompletions?.filter(c => 
        c.exercise_name === exercise && c.weight_used && c.weight_used > 0
      ).sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()) || []

      if (exerciseCompletions.length === 0) return null

      const latest = exerciseCompletions[exerciseCompletions.length - 1]
      const earliest = exerciseCompletions[0]
      const maxWeight = Math.max(...exerciseCompletions.map(c => c.weight_used))
      const avgRPE = exerciseCompletions
        .filter(c => c.rpe)
        .reduce((sum, c) => sum + c.rpe, 0) / exerciseCompletions.filter(c => c.rpe).length

      return {
        exercise,
        totalSessions: exerciseCompletions.length,
        latestWeight: latest.weight_used,
        maxWeight,
        weightProgression: latest.weight_used - earliest.weight_used,
        averageRPE: avgRPE ? avgRPE.toFixed(1) : null,
        lastCompleted: latest.completed_at,
        trend: exerciseCompletions.slice(-3).map(c => ({
          date: c.completed_at.split('T')[0],
          weight: c.weight_used,
          rpe: c.rpe
        }))
      }
    }).filter(Boolean)

    // 4. BLOCK PERFORMANCE ANALYSIS
    const blockStats = ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS']
      .map(block => {
        const blockCompletions = recentCompletions?.filter(c => c.block === block) || []
        const avgRPE = blockCompletions
          .filter(c => c.rpe)
          .reduce((sum, c) => sum + c.rpe, 0) / blockCompletions.filter(c => c.rpe).length

        return {
          block,
          totalExercises: blockCompletions.length,
          averageRPE: avgRPE ? avgRPE.toFixed(1) : null,
          completionRate: blockCompletions.length > 0 ? 
            (blockCompletions.filter(c => c.was_rx).length / blockCompletions.length * 100).toFixed(1) : '0'
        }
      })

    // 5. PERSONAL RECORDS & ACHIEVEMENTS
    const personalRecords = strengthProgressions
      .filter((prog: any) => prog && prog.maxWeight > 0)
      .map((prog: any) => ({
        exercise: prog.exercise,
        weight: prog.maxWeight,
        date: prog.lastCompleted.split('T')[0],
        isRecent: new Date(prog.lastCompleted) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // 6. WEEKLY SUMMARY
    const weeklyData = []
    for (let week = 0; week < Math.min(4, Math.ceil(timeRangeNum / 7)); week++) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (week + 1) * 7)
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() - week * 7)

      const weekCompletions = recentCompletions?.filter(c => {
        const date = new Date(c.completed_at)
        return date >= weekStart && date < weekEnd
      }) || []

      const weekWorkouts = Object.values(weekCompletions.reduce((acc: any, completion) => {
        const key = `${completion.program_id}-${completion.week}-${completion.day}`
        acc[key] = acc[key] || { date: completion.completed_at.split('T')[0], exercises: 0 }
        acc[key].exercises += 1
        return acc
      }, {}))

      weeklyData.push({
        weekNumber: week + 1,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        totalWorkouts: weekWorkouts.length,
        totalExercises: weekCompletions.length,
        averageRPE: weekCompletions.filter(c => c.rpe).length > 0 ?
          (weekCompletions.reduce((sum, c) => sum + (c.rpe || 0), 0) / weekCompletions.filter(c => c.rpe).length).toFixed(1) : null
      })
    }

    // 7. OVERALL SUMMARY STATS
    const totalWorkouts = workoutSessions.length
    const totalExercises = recentCompletions?.length || 0
    const averageRPE = recentCompletions?.filter(c => c.rpe).length > 0 ?
      (recentCompletions.reduce((sum, c) => sum + (c.rpe || 0), 0) / recentCompletions.filter(c => c.rpe).length).toFixed(1) : null

    const rxRate = recentCompletions?.length > 0 ?
      (recentCompletions.filter(c => c.was_rx).length / recentCompletions.length * 100).toFixed(1) : '0'

    console.log(`✅ Analytics generated: ${totalWorkouts} workouts, ${totalExercises} exercises`)

    return NextResponse.json({
      success: true,
      timeRange: timeRangeNum,
      analytics: {
        summary: {
          totalWorkouts,
          totalExercises,
          averageRPE,
          rxRate: `${rxRate}%`,
          daysActive: Object.keys(completionsByDate).length
        },
        consistencyData,
        strengthProgressions,
        blockStats,
        personalRecords,
        weeklyData,
        recentSessions: workoutSessions.slice(0, 10) // Last 10 workout sessions
      },
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Unexpected error generating analytics:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
