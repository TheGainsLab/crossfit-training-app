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
    // Get Engine tier from subscription_tiers table
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', 'engine')
      .eq('is_active', true)
      .single()

    if (tierError || !tier) {
      console.error('❌ Engine tier not found:', tierError)
      return NextResponse.json({ 
        error: 'Engine subscription tier not available' 
      }, { status: 404 })
    }

    if (!tier.stripe_price_id_monthly) {
      return NextResponse.json({ 
        error: 'Engine monthly pricing not configured' 
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
        }

        if (userData) {
          userId = userData.id.toString()
          stripeCustomerId = userData.stripe_customer_id
          // If they don't have a stripe customer yet, create one
          if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
              email: userData.email,
              name: userData.name,
              metadata: {
                user_id: userData.id.toString(),
                tier_id: 'engine'
              }
            })
            stripeCustomerId = customer.id
            // Update user with stripe_customer_id
            await supabase
              .from('users')
              .update({ stripe_customer_id: stripeCustomerId })
              .eq('id', userData.id)
          }
        }
      } catch (err) {
      }
    }

    // Get the base URL from request origin
    const origin = request.headers.get('origin') || 'https://www.thegainsai.com'
    // Create Stripe Checkout session - redirect to intake after success
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
      cancel_url: `${origin}/engine?canceled=true`,
      metadata: {
        product: 'engine',
        tier_id: 'engine'
      },
      subscription_data: {
        metadata: {
          product: 'engine',
          tier_id: 'engine'
        }
      },
      allow_promotion_codes: true
    }

    // If user is logged in and has a customer ID, use it
    if (stripeCustomerId) {
      sessionConfig.customer = stripeCustomerId
      sessionConfig.metadata.user_id = userId
      sessionConfig.subscription_data.metadata.user_id = userId
    } else {
      // If not logged in, let Stripe collect email
    }

    // Verify the price exists and is active before creating checkout session
    try {
      const price = await stripe.prices.retrieve(tier.stripe_price_id_monthly)
      if (!price.active) {
        return NextResponse.json({ 
          error: `Price ID ${tier.stripe_price_id_monthly} is archived or inactive. Please activate it in Stripe dashboard.`,
          priceId: tier.stripe_price_id_monthly
        }, { status: 400 })
      }
      
      if (price.type !== 'recurring') {
        return NextResponse.json({ 
          error: `Price ID ${tier.stripe_price_id_monthly} is not a recurring subscription. Please use a recurring price.`,
          priceId: tier.stripe_price_id_monthly,
          priceType: price.type
        }, { status: 400 })
      }
    } catch (priceError: any) {
      console.error('❌ Price verification failed:', priceError.message, priceError.code)
      return NextResponse.json({ 
        error: `Price ID ${tier.stripe_price_id_monthly} not found in Stripe. Please verify the price ID in your Stripe dashboard.`,
        details: priceError.message,
        code: priceError.code,
        priceId: tier.stripe_price_id_monthly
      }, { status: 400 })
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig)
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

