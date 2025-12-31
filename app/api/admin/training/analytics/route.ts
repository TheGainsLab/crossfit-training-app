import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

export async function GET() {
  try {
    const supabase = await createClient()

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
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Fetch stats in parallel
    const [
      totalResult,
      weekResult,
      monthResult,
      activeUsersResult,
      blockStatsResult,
      dailyStatsResult,
      programStatsResult
    ] = await Promise.all([
      // Total workouts all time
      supabase
        .from('performance_logs')
        .select('id', { count: 'exact', head: true }),

      // Workouts this week
      supabase
        .from('performance_logs')
        .select('id', { count: 'exact', head: true })
        .gte('logged_at', startOfWeek.toISOString()),

      // Workouts this month
      supabase
        .from('performance_logs')
        .select('id', { count: 'exact', head: true })
        .gte('logged_at', startOfMonth.toISOString()),

      // Active users this week (distinct user_ids with logs)
      supabase
        .from('performance_logs')
        .select('user_id')
        .gte('logged_at', startOfWeek.toISOString()),

      // Workouts by block type
      supabase
        .from('performance_logs')
        .select('block')
        .gte('logged_at', thirtyDaysAgo.toISOString()),

      // Daily workouts for last 7 days
      supabase
        .from('performance_logs')
        .select('logged_at')
        .gte('logged_at', sevenDaysAgo.toISOString())
        .order('logged_at', { ascending: true }),

      // Program distribution (from users table)
      supabase
        .from('users')
        .select('subscription_tier')
        .not('subscription_tier', 'is', null)
    ])

    // Calculate unique active users
    const uniqueActiveUsers = new Set(
      activeUsersResult.data?.map(l => l.user_id).filter(Boolean) ?? []
    ).size

    // Calculate workouts by block
    const blockCounts: Record<string, number> = {}
    blockStatsResult.data?.forEach(log => {
      const block = log.block || 'Unknown'
      blockCounts[block] = (blockCounts[block] || 0) + 1
    })
    const workoutsByBlock = Object.entries(blockCounts)
      .map(([block, count]) => ({ block, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Calculate daily workouts
    const dailyCounts: Record<string, number> = {}
    // Initialize all 7 days
    for (let i = 6; i >= 0; i--) {
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

    // Calculate avg workouts per user (last 30 days)
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

    const stats = {
      totalWorkouts: totalResult.count ?? 0,
      workoutsThisWeek: weekResult.count ?? 0,
      workoutsThisMonth: monthResult.count ?? 0,
      activeUsersThisWeek: uniqueActiveUsers,
      avgWorkoutsPerUser,
      workoutsByBlock,
      dailyWorkouts,
      topPrograms
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
