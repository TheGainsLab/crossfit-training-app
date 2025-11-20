import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Applied Power checkout: Starting checkout session creation')
    
    // Get Applied Power tier from subscription_tiers table
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', 'applied_power')
      .eq('is_active', true)
      .single()

    if (tierError || !tier) {
      console.error('❌ Applied Power tier not found:', tierError)
      return NextResponse.json({ 
        error: 'Applied Power subscription tier not available' 
      }, { status: 404 })
    }

    if (!tier.stripe_price_id_monthly) {
      return NextResponse.json({ 
        error: 'Applied Power monthly pricing not configured' 
      }, { status: 500 })
    }
    
    // Get authorization header for authenticated requests
    const authHeader = request.headers.get('authorization')
    let user = null
    
    // Try to get current user if they're authenticated (optional - they might not be logged in)
    if (authHeader) {
      const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      user = authUser
    }
    
    console.log('👤 User logged in:', !!user, user?.email)

    let stripeCustomerId: string | undefined
    let userId: string | undefined

    // If user is logged in, try to get their existing customer ID
    if (user?.email) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, name, stripe_customer_id')
          .eq('email', user.email)
          .single()

        if (userError) {
          console.log('⚠️ User lookup error (not fatal):', userError.message)
        }

        if (userData) {
          userId = userData.id.toString()
          stripeCustomerId = userData.stripe_customer_id
          console.log('📊 User data found:', { userId, hasStripeCustomer: !!stripeCustomerId })

          // If they don't have a stripe customer yet, create one
          if (!stripeCustomerId) {
            console.log('🔨 Creating new Stripe customer')
            const customer = await stripe.customers.create({
              email: userData.email,
              name: userData.name,
              metadata: {
                user_id: userData.id.toString(),
                tier_id: 'applied_power'
              }
            })
            stripeCustomerId = customer.id
            console.log('✅ Stripe customer created:', stripeCustomerId)

            // Update user with stripe_customer_id
            await supabase
              .from('users')
              .update({ stripe_customer_id: stripeCustomerId })
              .eq('id', userData.id)
          }
        }
      } catch (err) {
        console.log('⚠️ User lookup error (continuing):', err)
      }
    }

    // Get the base URL from request origin
    const origin = request.headers.get('origin') || 'https://www.thegainsapps.com'
    console.log('🌐 Using origin for URLs:', origin)

    // Create Stripe Checkout session
    const sessionConfig: any = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: tier.stripe_price_id_monthly, // Use price ID from tier
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/intake?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/appliedpower?canceled=true`,
      metadata: {
        product: 'applied_power',
        tier_id: 'applied_power'
      },
      subscription_data: {
        metadata: {
          product: 'applied_power',
          tier_id: 'applied_power'
        }
      },
      allow_promotion_codes: true
    }

    // If user is logged in and has a customer ID, use it
    if (stripeCustomerId) {
      sessionConfig.customer = stripeCustomerId
      sessionConfig.metadata.user_id = userId
      sessionConfig.subscription_data.metadata.user_id = userId
      console.log('✅ Using existing customer:', stripeCustomerId)
    } else {
      // If not logged in, let Stripe collect email
      console.log('📧 Stripe will collect customer email')
    }

    console.log('💳 Creating Stripe checkout session...')
    const session = await stripe.checkout.sessions.create(sessionConfig)
    console.log('✅ Checkout session created:', session.id)

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url 
    })
  } catch (error: any) {
    console.error('❌ Error creating checkout session:', error)
    console.error('Error details:', error.message, error.type, error.code)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.type 
    }, { status: 500 })
  }
}
