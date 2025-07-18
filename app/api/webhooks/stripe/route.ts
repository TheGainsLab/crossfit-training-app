// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
apiVersion: '2024-06-20'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()


const headersList = await headers()
const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log('Processing Stripe webhook:', event.type)

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      
      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Creating subscription:', subscription.id)
  
  // Get the user ID from customer metadata
  const customer = await stripe.customers.retrieve(subscription.customer as string)
  const userId = (customer as Stripe.Customer).metadata?.user_id
  
  if (!userId) {
    console.error('No user_id found in customer metadata')
    return
  }

  // Get tier details based on the Stripe price ID
  const priceId = subscription.items.data[0].price.id
  const { data: tier } = await supabase
    .from('subscription_tiers')
    .select('id')
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_quarterly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .single()

  if (!tier) {
    console.error('Tier not found for price ID:', priceId)
    return
  }

  // Determine subscription table to use
  const { data: tableExists } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_name', 'user_subscriptions')
    .single()

  const tableName = tableExists ? 'user_subscriptions' : 'subscriptions'

console.log('Available subscription properties:', Object.keys(subscription));
console.log('Subscription object:', subscription);

  // Create subscription record
  const subscriptionData = {
    user_id: parseInt(userId), // Convert to integer for your schema
    tier_id: tier.id,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000),
    trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
  }

  const { error } = await supabase
    .from(tableName)
    .insert(subscriptionData)

  if (error) {
    console.error('Error creating subscription:', error)
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Updating subscription:', subscription.id)
  
  // Determine which table to use
  const { data: tableExists } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_name', 'user_subscriptions')
    .single()

  const tableName = tableExists ? 'user_subscriptions' : 'subscriptions'
  
  const { error } = await supabase
    .from(tableName)
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      updated_at: new Date()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Deleting subscription:', subscription.id)
  
  // Determine which table to use
  const { data: tableExists } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_name', 'user_subscriptions')
    .single()

  const tableName = tableExists ? 'user_subscriptions' : 'subscriptions'
  
  const { error } = await supabase
    .from(tableName)
    .update({
      status: 'canceled',
      canceled_at: new Date(),
      updated_at: new Date()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error deleting subscription:', error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded for invoice:', invoice.id)
  
  if (invoice.subscription) {
    // Determine which table to use
    const { data: tableExists } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'user_subscriptions')
      .single()

    const tableName = tableExists ? 'user_subscriptions' : 'subscriptions'
    
    const { error } = await supabase
      .from(tableName)
      .update({
        status: 'active',
        updated_at: new Date()
      })
      .eq('stripe_subscription_id', invoice.subscription as string)

    if (error) {
      console.error('Error updating subscription after payment:', error)
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id)
  
  if (invoice.subscription) {
    // Determine which table to use
    const { data: tableExists } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'user_subscriptions')
      .single()

    const tableName = tableExists ? 'user_subscriptions' : 'subscriptions'
    
    const { error } = await supabase
      .from(tableName)
      .update({
        status: 'past_due',
        updated_at: new Date()
      })
      .eq('stripe_subscription_id', invoice.subscription as string)

    if (error) {
      console.error('Error updating subscription after failed payment:', error)
    }
  }
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log('Customer created:', customer.id)
  // Store customer info if needed
}
