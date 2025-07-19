import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Stripe webhook handler for Vercel API routes
export async function POST(request: NextRequest) {
  console.log('🔔 Stripe webhook received')
  
  try {
    // Get request body and headers
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')
    
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
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
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

      if (!customerEmail) {
        console.error('❌ No customer email in session')
        return NextResponse.json({ error: 'No customer email' }, { status: 400 })
      }

      // Initialize Supabase client with service role key
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Missing Supabase environment variables')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
      }

      console.log('🔧 Initializing Supabase client')
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      try {
        console.log('🔍 Checking for existing user')
        
        // Check if user exists
        const { data: existingUsers, error: userCheckError } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', customerEmail)

        if (userCheckError) {
          console.error('❌ Error checking user:', userCheckError)
          throw new Error('Failed to check user')
        }

        let userId

        if (existingUsers && existingUsers.length > 0) {
          // User exists, update subscription status
          userId = existingUsers[0].id
          console.log(`✅ Found existing user: ${userId}`)
          
          const { error: updateError } = await supabase
            .from('users')
            .update({
              subscription_status: 'ACTIVE',
              subscription_tier: 'PREMIUM',
              stripe_customer_id: stripeCustomerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          if (updateError) {
            console.error('❌ Error updating user:', updateError)
            throw updateError
          }
          
          console.log('✅ Updated existing user subscription')
        } else {
          // Create new user
          console.log('➕ Creating new user')
          
          const { data: newUsers, error: createError } = await supabase
            .from('users')
            .insert({
              email: customerEmail,
              name: customerName || customerEmail.split('@')[0],
              subscription_status: 'ACTIVE',
              subscription_tier: 'PREMIUM',
              stripe_customer_id: stripeCustomerId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')

          if (createError) {
            console.error('❌ Error creating user:', createError)
            throw createError
          }

          if (newUsers && newUsers.length > 0) {
            userId = newUsers[0].id
            console.log(`✅ Created new user: ${userId}`)
          } else {
            throw new Error('Failed to get new user ID')
          }
        }

        // Create/update subscription record
        console.log('💳 Managing subscription record')
        
        const { data: existingSubscriptions, error: subCheckError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)

        if (subCheckError) {
          console.error('❌ Error checking subscription:', subCheckError)
          throw new Error('Failed to check subscription')
        }

        if (existingSubscriptions && existingSubscriptions.length > 0) {
          // Update existing subscription
          const { error: subUpdateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              stripe_customer_id: stripeCustomerId,
              amount_cents: amountTotal,
              subscription_start: new Date().toISOString(),
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)

          if (subUpdateError) {
            console.error('❌ Error updating subscription:', subUpdateError)
          } else {
            console.log('✅ Updated existing subscription')
          }
        } else {
          // Create new subscription
          const { error: subCreateError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              stripe_customer_id: stripeCustomerId,
              status: 'active',
              plan: 'premium',
              amount_cents: amountTotal,
              billing_interval: 'month',
              subscription_start: new Date().toISOString(),
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (subCreateError) {
            console.error('❌ Error creating subscription:', subCreateError)
          } else {
            console.log('✅ Created new subscription')
          }
        }

        console.log('🎉 Webhook processing complete!')
        
        return NextResponse.json({ 
          success: true, 
          userId: userId,
          message: 'User and subscription processed successfully' 
        })

      } catch (dbError) {
        console.error('❌ Database error:', dbError)
        return NextResponse.json({ 
          error: 'Database error', 
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // Handle other event types
    console.log(`ℹ️ Unhandled event type: ${event.type}`)
    return NextResponse.json({ 
      message: 'Event received but not processed',
      eventType: event.type 
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
