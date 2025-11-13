// Deno-specific imports for Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Helper function to determine plan type from Stripe price ID
function getPlanFromPriceId(priceId: string): string {
  const BTN_PRICE_ID = Deno.env.get('BTN_STRIPE_PRICE_ID') || 'price_1SK2r2LEmGVLIgpHjn1dF2EU'
  const APPLIED_POWER_PRICE_ID = Deno.env.get('APPLIED_POWER_STRIPE_PRICE_ID') || 'price_1SK4BSLEmGVLIgpHrS1cfLrH'
  
  if (priceId === BTN_PRICE_ID) {
    return 'btn'
  }
  if (priceId === APPLIED_POWER_PRICE_ID) {
    return 'applied_power'
  }
  // Default to premium for other price IDs
  return 'premium'
}

serve(async (req) => {
  console.log(`🚀 Webhook function started - ${req.method} ${req.url}`)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 Processing webhook request')
    
    // Get request body and headers
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')
    
    console.log('📦 Request body length:', body.length)
    console.log('🔍 Stripe signature present:', signature ? 'Yes' : 'No')

    // Parse the webhook payload
    let event
    try {
      event = JSON.parse(body)
      console.log(`📨 Event type: ${event.type}`)
      console.log(`🆔 Event ID: ${event.id}`)
    } catch (err) {
      console.error('❌ Invalid JSON:', err)
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      console.log('💳 Processing checkout session completed')
      
      const session = event.data.object
      const customerEmail = session.customer_details?.email
      const customerName = session.customer_details?.name
      const stripeCustomerId = session.customer
      const amountTotal = session.amount_total

      console.log(`👤 Customer: ${customerEmail} (${customerName})`)
      console.log(`💰 Amount: ${amountTotal} ${session.currency}`)

      // Get the subscription to determine plan type
      let planType = 'PREMIUM' // Default
      if (session.subscription) {
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (stripeSecretKey) {
          try {
            const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            })
            
            if (subscriptionResponse.ok) {
              const subscription = await subscriptionResponse.json()
              const priceId = subscription.items?.data?.[0]?.price?.id
              if (priceId) {
                planType = getPlanFromPriceId(priceId).toUpperCase()
                console.log(`📦 Detected plan type: ${planType} from price ID: ${priceId}`)
              }
            }
          } catch (err) {
            console.error('⚠️ Error fetching subscription from Stripe:', err)
            // Continue with default PREMIUM
          }
        }
      }

      if (!customerEmail) {
        console.error('❌ No customer email in session')
        return new Response(JSON.stringify({ error: 'No customer email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Initialize Supabase client here to avoid auth issues
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables')
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('🔧 Initializing Supabase client')
      
      // Create Supabase client manually to avoid import issues
      const supabaseHeaders = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }

      try {
        console.log('🔍 Checking for existing user')
        
        // Check if user exists
        const userCheckResponse = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(customerEmail)}&select=id,email`, {
          method: 'GET',
          headers: supabaseHeaders
        })

        if (!userCheckResponse.ok) {
          console.error('❌ Error checking user:', await userCheckResponse.text())
          throw new Error('Failed to check user')
        }

        const existingUsers = await userCheckResponse.json()
        let userId

        if (existingUsers && existingUsers.length > 0) {
          // User exists, update subscription status
          userId = existingUsers[0].id
          console.log(`✅ Found existing user: ${userId}`)
          
          const updateResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({
              subscription_status: 'ACTIVE',
              subscription_tier: planType,
              stripe_customer_id: stripeCustomerId,
              updated_at: new Date().toISOString()
            })
          })

          if (!updateResponse.ok) {
            console.error('❌ Error updating user:', await updateResponse.text())
            throw new Error('Failed to update user')
          }
          
          console.log('✅ Updated existing user subscription')
          
          // Create/update subscription record
          console.log('💳 Managing subscription record')
          
          const subCheckResponse = await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&select=id`, {
            method: 'GET',
            headers: supabaseHeaders
          })

          if (!subCheckResponse.ok) {
            console.error('❌ Error checking subscription:', await subCheckResponse.text())
            throw new Error('Failed to check subscription')
          }

          const existingSubscriptions = await subCheckResponse.json()

          if (existingSubscriptions && existingSubscriptions.length > 0) {
            // Update existing subscription
            const subUpdateResponse = await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}`, {
              method: 'PATCH',
              headers: supabaseHeaders,
              body: JSON.stringify({
                status: 'active',
                stripe_customer_id: stripeCustomerId,
                amount_cents: amountTotal,
                subscription_start: new Date().toISOString(),
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString()
              })
            })

            if (!subUpdateResponse.ok) {
              console.error('❌ Error updating subscription:', await subUpdateResponse.text())
            } else {
              console.log('✅ Updated existing subscription')
            }
          } else {
            // Create new subscription
            const subCreateResponse = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
              method: 'POST',
              headers: supabaseHeaders,
              body: JSON.stringify({
                user_id: userId,
                stripe_customer_id: stripeCustomerId,
                status: 'active',
                plan: planType.toLowerCase(),
                amount_cents: amountTotal,
                billing_interval: 'month',
                subscription_start: new Date().toISOString(),
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            })

            if (!subCreateResponse.ok) {
              console.error('❌ Error creating subscription:', await subCreateResponse.text())
            } else {
              console.log('✅ Created new subscription')
            }
          }

          console.log('🎉 Webhook processing complete!')
          
          return new Response(JSON.stringify({ 
            success: true, 
            userId: userId,
            message: 'User and subscription processed successfully' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          // User doesn't exist yet - API will create it when intake form submits
          console.log('⚠️ User record not found - will be created by create-user-account API')
          console.log('⚠️ Skipping user and subscription updates - will be handled when user is created')
          return new Response(JSON.stringify({ 
            received: true, 
            message: 'User will be created by API' 
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

      } catch (dbError) {
        console.error('❌ Database error:', dbError)
        return new Response(JSON.stringify({ 
          error: 'Database error', 
          details: dbError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Handle other event types
    console.log(`ℹ️ Unhandled event type: ${event.type}`)
    return new Response(JSON.stringify({ 
      message: 'Event received but not processed',
      eventType: event.type 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response(JSON.stringify({ 
      error: 'Webhook processing failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
