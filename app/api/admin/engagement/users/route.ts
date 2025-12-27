import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'at-risk'

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    let users: any[] = []

    if (filter === 'at-risk') {
      // Get active subscribers who haven't logged activity in 7+ days
      const { data: activeSubscribers } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('status', 'active')
        .eq('is_trial_period', false)

      const activeUserIds = activeSubscribers?.map(s => s.user_id).filter(Boolean) ?? []

      if (activeUserIds.length > 0) {
        // Get users with their last activity
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, name, subscription_tier')
          .in('id', activeUserIds)

        // Get last activity for each user
        const { data: perfLogs } = await supabase
          .from('performance_logs')
          .select('user_id, logged_at')
          .in('user_id', activeUserIds)
          .order('logged_at', { ascending: false })

        // Get workout counts
        const { data: workoutCounts } = await supabase
          .from('performance_logs')
          .select('user_id')
          .in('user_id', activeUserIds)
          .gte('logged_at', thirtyDaysAgo.toISOString())

        // Build activity map
        const userLastActivity: Map<number, Date> = new Map()
        perfLogs?.forEach(log => {
          if (log.user_id && log.logged_at && !userLastActivity.has(log.user_id)) {
            userLastActivity.set(log.user_id, new Date(log.logged_at))
          }
        })

        // Build workout count map
        const userWorkoutCounts: Map<number, number> = new Map()
        workoutCounts?.forEach(log => {
          if (log.user_id) {
            userWorkoutCounts.set(log.user_id, (userWorkoutCounts.get(log.user_id) || 0) + 1)
          }
        })

        // Filter to users with 7+ days inactivity
        users = (usersData ?? [])
          .map(user => {
            const lastActivity = userLastActivity.get(user.id)
            const daysSince = lastActivity
              ? Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
              : null

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              subscription_tier: user.subscription_tier,
              days_since_activity: daysSince,
              last_activity: lastActivity?.toISOString() || null,
              workouts_30d: userWorkoutCounts.get(user.id) || 0
            }
          })
          .filter(u => u.days_since_activity === null || u.days_since_activity >= 7)
          .sort((a, b) => (b.days_since_activity ?? 999) - (a.days_since_activity ?? 999))
      }

    } else if (filter === 'expiring-trials') {
      // Get trial users expiring in next 7 days
      const { data: trialSubs } = await supabase
        .from('subscriptions')
        .select('user_id, current_period_end')
        .eq('status', 'active')
        .eq('is_trial_period', true)
        .lte('current_period_end', sevenDaysFromNow.toISOString().split('T')[0])
        .gte('current_period_end', now.toISOString().split('T')[0])
        .order('current_period_end', { ascending: true })

      const trialUserIds = trialSubs?.map(s => s.user_id).filter(Boolean) ?? []

      if (trialUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, name, subscription_tier')
          .in('id', trialUserIds)

        // Get workout counts
        const { data: workoutCounts } = await supabase
          .from('performance_logs')
          .select('user_id')
          .in('user_id', trialUserIds)
          .gte('logged_at', thirtyDaysAgo.toISOString())

        const userWorkoutCounts: Map<number, number> = new Map()
        workoutCounts?.forEach(log => {
          if (log.user_id) {
            userWorkoutCounts.set(log.user_id, (userWorkoutCounts.get(log.user_id) || 0) + 1)
          }
        })

        // Map trial end dates
        const trialEndMap: Map<number, string> = new Map()
        trialSubs?.forEach(s => {
          if (s.user_id && s.current_period_end) {
            trialEndMap.set(s.user_id, s.current_period_end)
          }
        })

        users = (usersData ?? []).map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          subscription_tier: user.subscription_tier,
          trial_ends: trialEndMap.get(user.id) || null,
          workouts_30d: userWorkoutCounts.get(user.id) || 0
        }))

        // Sort by trial end date
        users.sort((a, b) => {
          if (!a.trial_ends) return 1
          if (!b.trial_ends) return -1
          return new Date(a.trial_ends).getTime() - new Date(b.trial_ends).getTime()
        })
      }

    } else if (filter === 'win-back') {
      // Get canceled users
      const { data: canceledSubs } = await supabase
        .from('subscriptions')
        .select('user_id, canceled_at')
        .not('canceled_at', 'is', null)
        .order('canceled_at', { ascending: false })
        .limit(100)

      const canceledUserIds = canceledSubs?.map(s => s.user_id).filter(Boolean) ?? []

      if (canceledUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, name, subscription_tier')
          .in('id', canceledUserIds)

        // Get workout counts (historical)
        const { data: workoutCounts } = await supabase
          .from('performance_logs')
          .select('user_id')
          .in('user_id', canceledUserIds)

        const userWorkoutCounts: Map<number, number> = new Map()
        workoutCounts?.forEach(log => {
          if (log.user_id) {
            userWorkoutCounts.set(log.user_id, (userWorkoutCounts.get(log.user_id) || 0) + 1)
          }
        })

        // Map canceled dates
        const canceledMap: Map<number, string> = new Map()
        canceledSubs?.forEach(s => {
          if (s.user_id && s.canceled_at) {
            canceledMap.set(s.user_id, s.canceled_at)
          }
        })

        users = (usersData ?? []).map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          subscription_tier: user.subscription_tier,
          canceled_at: canceledMap.get(user.id) || null,
          workouts_30d: userWorkoutCounts.get(user.id) || 0
        }))

        // Sort by most workouts first (best win-back candidates)
        users.sort((a, b) => b.workouts_30d - a.workouts_30d)
      }
    }

    return NextResponse.json({
      success: true,
      users,
      filter,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching engagement users:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
