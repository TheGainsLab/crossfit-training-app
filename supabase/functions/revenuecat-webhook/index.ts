import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook authorization from RevenueCat
    const authHeader = req.headers.get('Authorization')
    const expectedToken = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      console.error('Unauthorized webhook request')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const event = await req.json()
    console.log('RevenueCat webhook event:', event.type)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract event data
    const eventType = event.type
    const appUserId = event.event.app_user_id
    const productId = event.event.product_id
    const entitlements = event.event.entitlements || {}
    const store = event.event.store // 'app_store' or 'play_store'
    const platform = store === 'app_store' ? 'ios' : 'android'

    // Get user_id from app_user_id (Supabase auth_id)
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', appUserId)
      .single()

    // Handle anonymous purchases - defer processing until user signs up
    if (!user) {
      console.log('Anonymous purchase detected - will be linked after user signup:', {
        appUserId,
        eventType,
        productId,
        entitlements: Object.keys(entitlements),
        timestamp: new Date().toISOString()
      })
      
      return new Response(JSON.stringify({ 
        success: true, 
        deferred: true,
        message: 'Anonymous purchase - will sync after user signup'
      }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id

    // Handle different event types
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        // Find active entitlements
        const activeEntitlements = Object.keys(entitlements).filter(
          (key) => entitlements[key].expires_date && new Date(entitlements[key].expires_date) > new Date()
        )

        for (const entitlementId of activeEntitlements) {
          const entitlementData = entitlements[entitlementId]
          const expiresAt = entitlementData.expires_date
          const purchaseDate = entitlementData.purchase_date
          const isTrialPeriod = event.event.is_trial_period || false

          // Map entitlement to plan
          const plan = entitlementId // 'btn', 'engine', 'competitor', 'applied_power'

          // Determine billing interval from product_id
          let billingInterval = 'monthly'
          if (productId.includes('yearly')) billingInterval = 'yearly'
          else if (productId.includes('quarterly')) billingInterval = 'quarterly'

          // Check if subscription already exists
          const { data: existing } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('revenuecat_subscriber_id', appUserId)
            .eq('entitlement_identifier', entitlementId)
            .single()

          if (existing) {
            // Update existing subscription
            await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                revenuecat_product_id: productId,
                current_period_end: expiresAt,
                billing_interval: billingInterval,
                is_trial_period: isTrialPeriod,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          } else {
            // Create new subscription
            await supabase
              .from('subscriptions')
              .insert({
                user_id: userId,
                revenuecat_subscriber_id: appUserId,
                revenuecat_product_id: productId,
                entitlement_identifier: entitlementId,
                plan,
                status: 'active',
                platform,
                store,
                billing_interval: billingInterval,
                is_trial_period: isTrialPeriod,
                subscription_start: purchaseDate,
                current_period_start: purchaseDate,
                current_period_end: expiresAt,
              })
          }
        }

        // Update users table with subscription tier from first active entitlement
        if (activeEntitlements.length > 0) {
          const primaryEntitlement = activeEntitlements[0]
          const tierMap: Record<string, string> = {
            'btn': 'BTN',
            'engine': 'ENGINE',
            'applied_power': 'APPLIED_POWER',
            'competitor': 'PREMIUM'
          }
          const subscriptionTier = tierMap[primaryEntitlement] || primaryEntitlement.toUpperCase()
          
          await supabase
            .from('users')
            .update({
              subscription_tier: subscriptionTier,
              subscription_status: 'active'
            })
            .eq('id', userId)
        }

        break
      }

      case 'CANCELLATION': {
        // Mark subscription as canceled but keep active until period ends
        await supabase
          .from('subscriptions')
          .update({
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('revenuecat_subscriber_id', appUserId)

        // Update users table to reflect cancellation (still active until period ends)
        await supabase
          .from('users')
          .update({ subscription_status: 'canceled' })
          .eq('id', userId)

        break
      }

      case 'EXPIRATION': {
        // Mark subscription as expired
        await supabase
          .from('subscriptions')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('revenuecat_subscriber_id', appUserId)

        // Check if user has any other active subscriptions before revoking access
        const { data: otherActive } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)

        if (!otherActive || otherActive.length === 0) {
          // No other active subscriptions - revoke access
          await supabase
            .from('users')
            .update({
              subscription_tier: null,
              subscription_status: 'expired'
            })
            .eq('id', userId)
        }

        break
      }

      case 'BILLING_ISSUE': {
        // Mark subscription as having billing issues
        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('revenuecat_subscriber_id', appUserId)

        // Update users table to reflect billing issue
        await supabase
          .from('users')
          .update({ subscription_status: 'past_due' })
          .eq('id', userId)

        break
      }

      default:
        console.log('Unhandled event type:', eventType)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

