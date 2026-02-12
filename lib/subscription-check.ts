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
 * Generic function to check if a user has access to a specific plan
 * @param userId - The user's ID
 * @param plan - The plan to check for ('btn', 'premium', etc.) or null for any active subscription
 */
export async function checkSubscriptionAccess(
  userId: number, 
  plan?: string | null
): Promise<SubscriptionStatus> {
  try {
    let query = supabase
      .from('subscriptions')
      .select('status, plan, current_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])

    // If a specific plan is requested, filter by it
    if (plan) {
      query = query.eq('plan', plan)
    }

    const { data: subscription, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !subscription) {
      return { hasAccess: false }
    }

    // Check if subscription is still valid (24h grace window covers webhook delay on renewals)
    const periodEnd = new Date(subscription.current_period_end)
    const now = new Date()
    const graceMs = 24 * 60 * 60 * 1000

    if (periodEnd.getTime() + graceMs < now.getTime()) {
      return { hasAccess: false }
    }

    return {
      hasAccess: true,
      subscriptionData: subscription
    }
  } catch (error) {
    console.error('Error checking subscription access:', error)
    return { hasAccess: false }
  }
}

/**
 * Convenience function: Check if a user has an active BTN subscription
 */
export async function checkBTNAccess(userId: number): Promise<SubscriptionStatus> {
  return checkSubscriptionAccess(userId, 'btn')
}

/**
 * Convenience function: Check if a user has an active Premium subscription
 */
export async function checkPremiumAccess(userId: number): Promise<SubscriptionStatus> {
  return checkSubscriptionAccess(userId, 'premium')
}

/**
 * Convenience function: Check if a user has ANY active subscription
 */
export async function checkAnyActiveSubscription(userId: number): Promise<SubscriptionStatus> {
  return checkSubscriptionAccess(userId, null)
}

/**
 * Convenience function: Check if a user has an active Applied Power subscription
 */
export async function checkAppliedPowerAccess(userId: number): Promise<SubscriptionStatus> {
  return checkSubscriptionAccess(userId, 'applied_power')
}

/**
 * Convenience function: Check if a user has an active Engine subscription
 */
export async function checkEngineAccess(userId: number): Promise<SubscriptionStatus> {
  return checkSubscriptionAccess(userId, 'engine')
}

/**
 * Check if a user has access to BTN features (BTN or Premium subscription)
 * Premium users get access to BTN features as well
 */
export async function checkBTNFeatureAccess(userId: number): Promise<SubscriptionStatus> {
  // First check BTN subscription
  const btnAccess = await checkBTNAccess(userId)
  if (btnAccess.hasAccess) {
    return btnAccess
  }
  
  // If no BTN subscription, check Premium (Premium users get BTN features)
  return checkPremiumAccess(userId)
}
