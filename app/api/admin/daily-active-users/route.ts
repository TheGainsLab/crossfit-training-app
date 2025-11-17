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

    // Join daily_active_users → users for name/email
    const { data, error } = await supabase
      .from('daily_active_users')
      .select(`
        id,
        user_id,
        window_start,
        window_end,
        sessions_completed,
        tasks_completed,
        metcons_completed,
        primary_program_id,
        subscription_tier,
        program_month,
        first_activity_at,
        last_activity_at,
        users!inner(
          name,
          email
        )
      `)
      .gte('window_start', sinceISO)
      .order('last_activity_at', { ascending: false })

    if (error) {
      console.error('Error fetching daily active users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch daily activity' },
        { status: 500 }
      )
    }

    const rows = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      name: row.users?.name,
      email: row.users?.email,
      subscriptionTier: row.subscription_tier,
      programMonth: row.program_month,
      sessions: row.sessions_completed,
      tasks: row.tasks_completed,
      metcons: row.metcons_completed,
      lastActivityAt: row.last_activity_at,
    }))

    return NextResponse.json({ success: true, rows })
  } catch (e) {
    console.error('daily-active-users API error:', e)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

