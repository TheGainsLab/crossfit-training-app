import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d' // 7d, 1m, 3m, 1y, all

    // Authenticate
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permission
    const userIsAdmin = await isAdmin(supabase, userId)
    if (!userIsAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const now = new Date()

    // Calculate date range based on parameter
    let startDate: Date | null = null
    let daysInRange = 7

    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        daysInRange = 7
        break
      case '1m':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        daysInRange = 30
        break
      case '3m':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        daysInRange = 90
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        daysInRange = 365
        break
      case 'all':
        startDate = null // No date filter
        daysInRange = 0
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        daysInRange = 7
    }

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Build queries based on date range
    let workoutsQuery = supabase
      .from('performance_logs')
      .select('id', { count: 'exact', head: true })

    let activeUsersQuery = supabase
      .from('performance_logs')
      .select('user_id')

    let dailyStatsQuery = supabase
      .from('performance_logs')
      .select('logged_at')
      .order('logged_at', { ascending: true })

    let engineWorkoutsQuery = supabase
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })

    if (startDate) {
      workoutsQuery = workoutsQuery.gte('logged_at', startDate.toISOString())
      activeUsersQuery = activeUsersQuery.gte('logged_at', startDate.toISOString())
      dailyStatsQuery = dailyStatsQuery.gte('logged_at', startDate.toISOString())
      engineWorkoutsQuery = engineWorkoutsQuery.gte('date', startDate.toISOString().split('T')[0])
    }

    // Fetch stats in parallel
    const [
      totalResult,
      totalEngineResult,
      workoutsResult,
      activeUsersResult,
      blockStatsResult,
      dailyStatsResult,
      programStatsResult,
      engineWorkoutsResult
    ] = await Promise.all([
      // Total workouts all time (for reference)
      supabase
        .from('performance_logs')
        .select('id', { count: 'exact', head: true }),

      // Total Engine workouts all time
      supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true }),

      // Workouts in selected range
      workoutsQuery,

      // Active users in selected range
      activeUsersQuery,

      // Workouts by block type (last 30 days for this metric)
      supabase
        .from('performance_logs')
        .select('block')
        .gte('logged_at', thirtyDaysAgo.toISOString()),

      // Daily workouts for chart
      dailyStatsQuery,

      // Program distribution (from users table)
      supabase
        .from('users')
        .select('subscription_tier')
        .not('subscription_tier', 'is', null),

      // Engine workouts in range
      engineWorkoutsQuery
    ])

    // Calculate unique active users in range
    const uniqueActiveUsers = new Set(
      activeUsersResult.data?.map(l => l.user_id).filter(Boolean) ?? []
    ).size

    // Calculate workouts by block
    const blockCounts: Record<string, number> = {}
    blockStatsResult.data?.forEach(log => {
      const block = log.block || 'Unknown'
      blockCounts[block] = (blockCounts[block] || 0) + 1
    })

    // Add Engine workouts as a block type
    const engineCount = engineWorkoutsResult.count ?? 0
    if (engineCount > 0) {
      blockCounts['ENGINE'] = engineCount
    }

    const workoutsByBlock = Object.entries(blockCounts)
      .map(([block, count]) => ({ block, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Calculate daily/weekly/monthly workouts based on range
    const dailyCounts: Record<string, number> = {}

    if (range === 'all') {
      // For "all", group by month
      dailyStatsResult.data?.forEach(log => {
        if (log.logged_at) {
          const date = new Date(log.logged_at)
          const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          dailyCounts[monthStr] = (dailyCounts[monthStr] || 0) + 1
        }
      })
    } else if (daysInRange > 60) {
      // For ranges > 60 days, group by week
      dailyStatsResult.data?.forEach(log => {
        if (log.logged_at) {
          const date = new Date(log.logged_at)
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          const weekStr = weekStart.toISOString().split('T')[0]
          dailyCounts[weekStr] = (dailyCounts[weekStr] || 0) + 1
        }
      })
    } else {
      // For shorter ranges, show daily
      // Initialize all days in range
      for (let i = daysInRange - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        dailyCounts[dateStr] = 0
      }
      // Count workouts per day
      dailyStatsResult.data?.forEach(log => {
        if (log.logged_at) {
          const dateStr = new Date(log.logged_at).toISOString().split('T')[0]
          if (dailyCounts[dateStr] !== undefined) {
            dailyCounts[dateStr]++
          }
        }
      })
    }

    const dailyWorkouts = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate program distribution
    const programCounts: Record<string, number> = {}
    programStatsResult.data?.forEach(user => {
      const tier = user.subscription_tier || 'FREE'
      programCounts[tier] = (programCounts[tier] || 0) + 1
    })
    const topPrograms = Object.entries(programCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Calculate avg workouts per user (last 30 days - fixed metric)
    const { data: thirtyDayUsers } = await supabase
      .from('performance_logs')
      .select('user_id')
      .gte('logged_at', thirtyDaysAgo.toISOString())

    const uniqueThirtyDayUsers = new Set(
      thirtyDayUsers?.map(l => l.user_id).filter(Boolean) ?? []
    ).size

    const { count: thirtyDayWorkouts } = await supabase
      .from('performance_logs')
      .select('id', { count: 'exact', head: true })
      .gte('logged_at', thirtyDaysAgo.toISOString())

    const avgWorkoutsPerUser = uniqueThirtyDayUsers > 0
      ? (thirtyDayWorkouts ?? 0) / uniqueThirtyDayUsers
      : 0

    // Total workouts in range (including engine)
    const workoutsInRange = (workoutsResult.count ?? 0) + (engineWorkoutsResult.count ?? 0)

    const stats = {
      totalWorkouts: (totalResult.count ?? 0) + (totalEngineResult.count ?? 0),
      workoutsInRange,
      activeUsersInRange: uniqueActiveUsers,
      avgWorkoutsPerUser,
      workoutsByBlock,
      dailyWorkouts,
      topPrograms,
      range
    }

    return NextResponse.json({
      success: true,
      stats,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching training analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
