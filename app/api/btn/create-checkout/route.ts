import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// BTN Stripe Price ID
const BTN_PRICE_ID = process.env.BTN_STRIPE_PRICE_ID || 'price_1SJwvaLEmGVLIgpHmbsh1cu8'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 BTN checkout: Starting checkout session creation')
    
    const supabase = await createClient()
    
    // Try to get current user (optional - they might not be logged in)
    const { data: { user } } = await supabase.auth.getUser()
    console.log('👤 User logged in:', !!user, user?.email)

    let stripeCustomerId: string | undefined
    let userId: string | undefined

    // If user is logged in, try to get their existing customer ID
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, name, stripe_customer_id')
        .eq('email', user.email)
        .single()

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
              product: 'btn'
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
    }

    // Get the base URL from request origin
    const origin = request.headers.get('origin') || 'https://www.thegainsapps.com'
    console.log('🌐 Using origin for URLs:', origin)

    // Create Stripe Checkout session - redirect to profile after success
    const sessionConfig: any = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: BTN_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/profile?success=true`,
      cancel_url: `${origin}/btn?canceled=true`,
      metadata: {
        product: 'btn'
      },
      subscription_data: {
        metadata: {
          product: 'btn'
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
