import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface SubscriptionStatus {
  hasAccess: boolean
  subscriptionData?: {
    status: string
    plan: string
    current_period_end: string
  }
}

/**
 * Check if a user has an active BTN subscription
 */
export async function checkBTNAccess(userId: number): Promise<SubscriptionStatus> {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, plan, current_period_end')
      .eq('user_id', userId)
      .eq('plan', 'btn') // BTN-specific plan
      .in('status', ['active', 'trialing'])
      .single()

    if (error || !subscription) {
      return { hasAccess: false }
    }

    // Check if subscription is still valid
    const periodEnd = new Date(subscription.current_period_end)
    const now = new Date()

    if (periodEnd < now && subscription.status !== 'active') {
      return { hasAccess: false }
    }

    return {
      hasAccess: true,
      subscriptionData: subscription
    }
  } catch (error) {
    console.error('Error checking BTN access:', error)
    return { hasAccess: false }
  }
}

/**
 * Check if a user has any active subscription (for general premium features)
 */
export async function checkActiveSubscription(userId: number): Promise<SubscriptionStatus> {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, plan, current_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !subscription) {
      return { hasAccess: false }
    }

    return {
      hasAccess: true,
      subscriptionData: subscription
    }
  } catch (error) {
    console.error('Error checking subscription:', error)
    return { hasAccess: false }
  }
}
