// /app/api/admin/daily-active-users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, getUserRole } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (authError || !userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Require admin
    const { role } = await getUserRole(supabase, userId)
    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    // Optional ?hours=, default 24
    const url = new URL(request.url)
    const hours = parseInt(url.searchParams.get('hours') || '24', 10)
    const sinceISO = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Fetch daily_active_users first (without join)
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_active_users')
      .select('*')
      .gte('last_activity_at', sinceISO)
      .order('last_activity_at', { ascending: false })

    if (dailyError) {
      console.error('Error fetching daily active users:', dailyError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch daily activity' },
        { status: 500 }
      )
    }

    // Get unique user IDs (filter out nulls)
    const userIds = [...new Set((dailyData || []).map((row: any) => row.user_id).filter((id: any) => id != null))]

    // Fetch users separately if we have any user IDs
    let usersMap = new Map()
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)
      
      if (usersError) {
        console.error('Error fetching users:', usersError)
      } else {
        usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))
      }
    }

    // Join the data manually
    const rows = (dailyData || []).map((row: any) => {
      const user = usersMap.get(row.user_id)
      return {
        id: row.id,
        userId: row.user_id,
        name: user?.name || null,
        email: user?.email || null,
        subscriptionTier: row.subscription_tier,
        programMonth: row.program_month,
        sessions: row.sessions_completed,
        tasks: row.tasks_completed,
        metcons: row.metcons_completed,
        lastActivityAt: row.last_activity_at,
      }
    })

    return NextResponse.json({ success: true, rows })
  } catch (e) {
    console.error('daily-active-users API error:', e)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
