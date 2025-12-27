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

    // Fetch all stats in parallel
    const [
      activeResult,
      trialResult,
      canceledResult,
      expiredResult,
      pastDueResult,
      allSubsResult
    ] = await Promise.all([
      // Active paying
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_trial_period', false),

      // Trials
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_trial_period', true),

      // Canceled
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .not('canceled_at', 'is', null),

      // Expired
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'expired'),

      // Past due
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'past_due'),

      // All subs for distribution analysis
      supabase
        .from('subscriptions')
        .select('entitlement_identifier, billing_interval, platform, status')
        .eq('status', 'active')
    ])

    // Calculate distributions
    const tierCounts: Record<string, number> = {}
    const billingCounts: Record<string, number> = {}
    const platformCounts: Record<string, number> = {}

    allSubsResult.data?.forEach(sub => {
      const tier = sub.entitlement_identifier || 'Unknown'
      tierCounts[tier] = (tierCounts[tier] || 0) + 1

      const billing = sub.billing_interval || 'Unknown'
      billingCounts[billing] = (billingCounts[billing] || 0) + 1

      const platform = sub.platform || 'Unknown'
      platformCounts[platform] = (platformCounts[platform] || 0) + 1
    })

    const stats = {
      active: activeResult.count ?? 0,
      trial: trialResult.count ?? 0,
      canceled: canceledResult.count ?? 0,
      expired: expiredResult.count ?? 0,
      pastDue: pastDueResult.count ?? 0,
      byTier: Object.entries(tierCounts)
        .map(([tier, count]) => ({ tier, count }))
        .sort((a, b) => b.count - a.count),
      byBilling: Object.entries(billingCounts)
        .map(([interval, count]) => ({ interval, count }))
        .sort((a, b) => b.count - a.count),
      byPlatform: Object.entries(platformCounts)
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count)
    }

    return NextResponse.json({
      success: true,
      stats,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching subscription overview:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
