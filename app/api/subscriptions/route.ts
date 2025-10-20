// app/api/subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Get user's current subscription
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient()
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check which subscription table exists
    const { data: tableExists } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'user_subscriptions')
      .single()

    const tableName = tableExists ? 'user_subscriptions' : 'subscriptions'

    const { data: subscription, error } = await supabase
      .from(tableName)
      .select(`
        *,
        subscription_tiers (
          id,
          name,
          description,
          price_monthly,
          price_quarterly,
          price_yearly,
          features
        )
      `)
      .eq('user_id', parseInt(userId))
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new subscription checkout session
export async function POST(request: NextRequest) {
  const stripe = getStripeClient()
  const supabase = getSupabaseClient()
  try {
    const { userId, tierId, billingPeriod, successUrl, cancelUrl } = await request.json()

    if (!userId || !tierId || !billingPeriod) {
      return NextResponse.json({ 
        error: 'User ID, tier ID, and billing period required' 
      }, { status: 400 })
    }

    // Get tier details and appropriate price ID
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', tierId)
      .single()

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 })
    }

    // Select the appropriate Stripe price ID based on billing period
    let stripePriceId: string
    switch (billingPeriod) {
      case 'monthly':
        stripePriceId = tier.stripe_price_id_monthly
        break
      case 'quarterly':
        stripePriceId = tier.stripe_price_id_quarterly
        break
      case 'yearly':
        stripePriceId = tier.stripe_price_id_yearly
        break
      default:
        return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 })
    }

    if (!stripePriceId) {
      return NextResponse.json({ 
        error: `${billingPeriod} billing not available for this tier` 
      }, { status: 400 })
    }

    // Get or create Stripe customer
    let stripeCustomerId: string
    
    // Check if user already has a customer ID
    const { data: tableExists } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'user_subscriptions')
      .single()

    const tableName = tableExists ? 'user_subscriptions' : 'subscriptions'

    const { data: existingSubscription } = await supabase
      .from(tableName)
      .select('stripe_customer_id')
      .eq('user_id', parseInt(userId))
      .limit(1)
      .single()

    if (existingSubscription?.stripe_customer_id) {
      stripeCustomerId = existingSubscription.stripe_customer_id
    } else {
      // Get user details to create customer
      const { data: user } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', parseInt(userId))
        .single()

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          user_id: userId.toString(),
          tier_id: tierId
        }
      })

      stripeCustomerId = customer.id
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/pricing`,
      metadata: {
        user_id: userId.toString(),
        tier_id: tierId,
        billing_period: billingPeriod
      },
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
        metadata: {
          user_id: userId.toString(),
          tier_id: tierId,
          billing_period: billingPeriod
        }
      },
      allow_promotion_codes: true
    })

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url,
      tierId: tierId,
      billingPeriod: billingPeriod
    })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
