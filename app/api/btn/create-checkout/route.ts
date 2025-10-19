import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// BTN Stripe Price ID
const BTN_PRICE_ID = process.env.BTN_STRIPE_PRICE_ID || 'price_1SJwvaLEmGVLIgpHmbsh1cu8'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user details from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, stripe_customer_id')
      .eq('email', user.email)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get or create Stripe customer
    let stripeCustomerId = userData.stripe_customer_id

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

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
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
        user_id: userData.id.toString(),
        product: 'btn'
      },
      subscription_data: {
        metadata: {
          user_id: userData.id.toString(),
          product: 'btn'
        }
      },
      allow_promotion_codes: true
    })

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url 
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
