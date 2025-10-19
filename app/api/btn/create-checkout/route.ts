import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// BTN Stripe Price ID
const BTN_PRICE_ID = process.env.BTN_STRIPE_PRICE_ID || 'price_1SJwvaLEmGVLIgpHmbsh1cu8'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Try to get current user (optional - they might not be logged in)
    const { data: { user } } = await supabase.auth.getUser()

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

        // If they don't have a stripe customer yet, create one
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: userData.email,
            name: userData.name,
            metadata: {
              user_id: userData.id.toString(),
              product: 'btn'
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
    }

    // Create Stripe Checkout session
    const sessionConfig: any = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: BTN_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/btn?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/btn?canceled=true`,
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
    } else {
      // If not logged in, let Stripe collect email
      sessionConfig.customer_email = undefined // Stripe will ask for email
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url 
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
