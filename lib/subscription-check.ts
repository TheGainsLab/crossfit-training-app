import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
    const supabase = getSupabaseClient()
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
