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
    const statusFilter = searchParams.get('status') || ''
    const limit = 50

    // Build query
    let query = supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        status,
        is_trial_period,
        plan,
        entitlement_identifier,
        billing_interval,
        current_period_end,
        canceled_at,
        platform,
        created_at,
        user:users!subscriptions_user_id_fkey(email, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply status filter
    if (statusFilter === 'active') {
      query = query.eq('status', 'active').eq('is_trial_period', false)
    } else if (statusFilter === 'trial') {
      query = query.eq('status', 'active').eq('is_trial_period', true)
    } else if (statusFilter === 'past_due') {
      query = query.eq('status', 'past_due')
    } else if (statusFilter === 'canceled') {
      query = query.not('canceled_at', 'is', null)
    } else if (statusFilter === 'expired') {
      query = query.eq('status', 'expired')
    }

    const { data: subscriptions, error } = await query

    if (error) {
      console.error('Error fetching subscriptions:', error)
      throw error
    }

    const formattedSubs = subscriptions?.map(sub => ({
      id: sub.id,
      user_id: sub.user_id,
      user_email: (sub.user as any)?.email || '',
      user_name: (sub.user as any)?.name || null,
      status: sub.status,
      is_trial_period: sub.is_trial_period,
      plan: sub.plan,
      entitlement_identifier: sub.entitlement_identifier,
      billing_interval: sub.billing_interval,
      current_period_end: sub.current_period_end,
      canceled_at: sub.canceled_at,
      platform: sub.platform
    })) || []

    return NextResponse.json({
      success: true,
      subscriptions: formattedSubs,
      filter: statusFilter,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching subscriptions list:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
