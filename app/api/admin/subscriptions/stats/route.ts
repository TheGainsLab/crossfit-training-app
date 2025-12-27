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

    // Get current date for calculations
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // Fetch subscription stats in parallel
    const [
      activeResult,
      trialResult,
      canceledResult,
      expiredResult,
      pastDueResult,
      expiringTrialsResult
    ] = await Promise.all([
      // Active paying subscribers
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_trial_period', false),

      // Trial users
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_trial_period', true),

      // Canceled (still has access until period end)
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .not('canceled_at', 'is', null)
        .eq('status', 'active'),

      // Expired subscriptions
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'expired'),

      // Past due (billing issues)
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'past_due'),

      // Trials expiring in 3 days
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_trial_period', true)
        .lte('current_period_end', threeDaysFromNow.toISOString().split('T')[0])
        .gte('current_period_end', now.toISOString().split('T')[0])
    ])

    const stats = {
      active: activeResult.count ?? 0,
      trial: trialResult.count ?? 0,
      canceled: canceledResult.count ?? 0,
      expired: expiredResult.count ?? 0,
      pastDue: pastDueResult.count ?? 0,
      expiringTrials3Days: expiringTrialsResult.count ?? 0
    }

    return NextResponse.json({
      success: true,
      stats,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching subscription stats:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
