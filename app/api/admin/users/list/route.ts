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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
    const search = searchParams.get('search') || ''
    const statusFilter = searchParams.get('status') || ''
    const tierFilter = searchParams.get('tier') || ''
    const activityFilter = searchParams.get('activity') || ''
    const roleFilter = searchParams.get('role') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const offset = (page - 1) * limit
    const now = new Date()

    // Valid sort columns (db columns only - computed columns sorted client-side)
    const validSortColumns = ['name', 'email', 'subscription_status', 'subscription_tier', 'created_at']
    const dbSortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    const ascending = sortOrder === 'asc'

    // Build base query for users
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        ability_level,
        subscription_tier,
        subscription_status,
        created_at
      `, { count: 'exact' })

    // Apply role filter
    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    // Apply search
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Apply tier filter
    if (tierFilter) {
      if (tierFilter === 'FREE') {
        query = query.or('subscription_tier.is.null,subscription_tier.eq.FREE')
      } else {
        query = query.eq('subscription_tier', tierFilter)
      }
    }

    // Apply status filter (from users table subscription_status)
    if (statusFilter) {
      if (statusFilter === 'trial') {
        query = query.eq('subscription_status', 'trialing')
      } else {
        query = query.eq('subscription_status', statusFilter)
      }
    }

    // Execute base query with sorting
    query = query
      .order(dbSortColumn, { ascending })
      .range(offset, offset + limit - 1)

    const { data: users, count, error: usersError } = await query

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
    }

    const userIds = users.map(u => u.id)

    // Get last activity and workout counts for these users
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get last activity from performance_logs
    const { data: perfLogs } = await supabase
      .from('performance_logs')
      .select('user_id, logged_at')
      .in('user_id', userIds)
      .order('logged_at', { ascending: false })

    // Get last activity from workout_sessions
    const { data: workoutSessions } = await supabase
      .from('workout_sessions')
      .select('user_id, date')
      .in('user_id', userIds)
      .order('date', { ascending: false })

    // Get workout counts in last 30 days (performance_logs)
    const { data: workoutCounts } = await supabase
      .from('performance_logs')
      .select('user_id')
      .in('user_id', userIds)
      .gte('logged_at', thirtyDaysAgo.toISOString())

    // Get Engine workout counts in last 30 days (workout_sessions)
    const { data: engineWorkoutCounts } = await supabase
      .from('workout_sessions')
      .select('user_id')
      .in('user_id', userIds)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])

    // Build activity maps
    const userLastActivity: Map<number, Date> = new Map()
    const userWorkoutCounts: Map<number, number> = new Map()

    // Initialize workout counts
    userIds.forEach(id => userWorkoutCounts.set(id, 0))

    // Process performance logs for last activity
    perfLogs?.forEach(log => {
      if (log.user_id && log.logged_at) {
        const logDate = new Date(log.logged_at)
        const existing = userLastActivity.get(log.user_id)
        if (!existing || logDate > existing) {
          userLastActivity.set(log.user_id, logDate)
        }
      }
    })

    // Process workout sessions for last activity
    workoutSessions?.forEach(session => {
      if (session.user_id && session.date) {
        const sessionDate = new Date(session.date)
        const existing = userLastActivity.get(session.user_id)
        if (!existing || sessionDate > existing) {
          userLastActivity.set(session.user_id, sessionDate)
        }
      }
    })

    // Count workouts in last 30 days (performance_logs + workout_sessions)
    workoutCounts?.forEach(log => {
      if (log.user_id) {
        userWorkoutCounts.set(log.user_id, (userWorkoutCounts.get(log.user_id) || 0) + 1)
      }
    })

    // Add Engine workouts to count
    engineWorkoutCounts?.forEach(session => {
      if (session.user_id) {
        userWorkoutCounts.set(session.user_id, (userWorkoutCounts.get(session.user_id) || 0) + 1)
      }
    })

    // Enrich users with engagement data
    let enrichedUsers = users.map(user => {
      const lastActivity = userLastActivity.get(user.id)
      let daysSinceActivity: number | null = null

      if (lastActivity) {
        daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
      }

      return {
        ...user,
        last_activity: lastActivity?.toISOString() || null,
        days_since_activity: daysSinceActivity,
        workouts_30d: userWorkoutCounts.get(user.id) || 0
      }
    })

    // Apply activity filter (post-query filtering since it's computed)
    if (activityFilter) {
      enrichedUsers = enrichedUsers.filter(user => {
        const days = user.days_since_activity

        switch (activityFilter) {
          case '7':
            return days !== null && days <= 7
          case '7-14':
            return days !== null && days > 7 && days <= 14
          case '14-30':
            return days !== null && days > 14 && days <= 30
          case '30':
            return days === null || days > 30
          case '7+':
            return days === null || days > 7
          default:
            return true
        }
      })
    }

    // Client-side sorting for computed columns
    if (sortBy === 'last_activity' || sortBy === 'days_since_activity') {
      enrichedUsers.sort((a, b) => {
        const aVal = a.days_since_activity ?? 9999
        const bVal = b.days_since_activity ?? 9999
        return ascending ? aVal - bVal : bVal - aVal
      })
    } else if (sortBy === 'workouts_30d') {
      enrichedUsers.sort((a, b) => {
        return ascending ? a.workouts_30d - b.workouts_30d : b.workouts_30d - a.workouts_30d
      })
    }

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit)
      },
      sort: {
        sortBy,
        sortOrder
      }
    })

  } catch (error) {
    console.error('Error in admin users list:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
