import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

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
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      
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

async function handleCheckoutCompleted(session: Stripe.CheckoutSession) {
  console.log('Processing checkout session completed:', session.id)
  
  const customerEmail = session.customer_details?.email
  const customerName = session.customer_details?.name
  const stripeCustomerId = session.customer
  const amountTotal = session.amount_total

  console.log(`Customer: ${customerEmail} (${customerName})`)
  console.log(`Amount: ${amountTotal} ${session.currency}`)

  if (!customerEmail) {
    console.error('No customer email in session')
    return
  }

  try {
    // Check if user exists
    const { data: existingUsers, error: userCheckError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', customerEmail)

    if (userCheckError) {
      console.error('Error checking user:', userCheckError)
      throw new Error('Failed to check user')
    }

    let userId

    if (existingUsers && existingUsers.length > 0) {
      // User exists, update subscription status
      userId = existingUsers[0].id
      console.log(`Found existing user: ${userId}`)
      
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
        console.error('Error updating user:', updateError)
        throw updateError
      }
      
      console.log('Updated existing user subscription')
    } else {
      // Create new user
      console.log('Creating new user')
      
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
        console.error('Error creating user:', createError)
        throw createError
      }

      if (newUsers && newUsers.length > 0) {
        userId = newUsers[0].id
        console.log(`Created new user: ${userId}`)
      } else {
        throw new Error('Failed to get new user ID')
      }
    }

    // Create/update subscription record with proper Stripe data
    console.log('Managing subscription record')
    
    // If this is a subscription checkout, get the subscription details
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      
      const { data: existingSubscriptions, error: subCheckError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)

      if (subCheckError) {
        console.error('Error checking subscription:', subCheckError)
        throw new Error('Failed to check subscription')
      }

      const subscriptionData = {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan: 'premium',
        amount_cents: amountTotal,
        billing_interval: subscription.items.data[0].price.recurring?.interval || 'month',
        subscription_start: new Date(subscription.created * 1000).toISOString(),
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }

      if (existingSubscriptions && existingSubscriptions.length > 0) {
        // Update existing subscription
        const { error: subUpdateError } = await supabase
          .from('subscriptions')
          .update({
            ...subscriptionData,
            created_at: undefined // Don't update created_at
          })
          .eq('user_id', userId)

        if (subUpdateError) {
          console.error('Error updating subscription:', subUpdateError)
        } else {
          console.log('Updated existing subscription with Stripe data')
        }
      } else {
        // Create new subscription
        const { error: subCreateError } = await supabase
          .from('subscriptions')
          .insert({
            ...subscriptionData,
            created_at: new Date().toISOString()
          })

        if (subCreateError) {
          console.error('Error creating subscription:', subCreateError)
        } else {
          console.log('Created new subscription with Stripe data')
        }
      }
    }

    console.log('Checkout processing complete!')

  } catch (dbError) {
    console.error('Database error:', dbError)
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Creating subscription:', subscription.id)
  
  // Try to get user from customer metadata first
  const customer = await stripe.customers.retrieve(subscription.customer as string)
  let userId = (customer as Stripe.Customer).metadata?.user_id
  
  // If no metadata user_id, try to find user by customer ID in database
  if (!userId) {
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single()
    
    if (existingUsers) {
      userId = existingUsers.id.toString()
    }
  }
  
  if (!userId) {
    console.error('No user found for subscription:', subscription.id)
    return
  }

  // Use existing subscriptions table structure
  const subscriptionData = {
    user_id: parseInt(userId),
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: 'premium',
    billing_interval: subscription.items.data[0].price.recurring?.interval || 'month',
    subscription_start: new Date(subscription.created * 1000).toISOString(),
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('subscriptions')
    .insert(subscriptionData)

  if (error) {
    console.error('Error creating subscription:', error)
  } else {
    console.log('Successfully created subscription record')
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Updating subscription:', subscription.id)
  
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
      current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
      canceled_at: (subscription as any).canceled_at ? new Date((subscription as any).canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating subscription:', error)
  } else {
    console.log('Successfully updated subscription')
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Deleting subscription:', subscription.id)
  
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error deleting subscription:', error)
  } else {
    console.log('Successfully canceled subscription')
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded for invoice:', invoice.id)
  
  if (invoice.subscription) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription as string)

    if (error) {
      console.error('Error updating subscription after payment:', error)
    } else {
      console.log('Successfully updated subscription after payment')
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id)
  
  if (invoice.subscription) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription as string)

    if (error) {
      console.error('Error updating subscription after failed payment:', error)
    } else {
      console.log('Successfully updated subscription after failed payment')
    }
  }
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log('Customer created:', customer.id)
  // Store customer info if needed for future use
}
