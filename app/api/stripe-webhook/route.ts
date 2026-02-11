import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper: Determine plan type from Stripe price ID by querying the database
async function getPlanFromPriceId(priceId: string): Promise<string> {
  try {
    // Query subscription_tiers to find which tier has this price ID
    const { data: tier, error } = await supabase
      .from('subscription_tiers')
      .select('id')
      .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_quarterly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
      .single()
    
    if (!error && tier) {
      // Map tier id to plan type (tier id is already in the correct format)
      return tier.id.toLowerCase() // 'btn', 'applied_power', 'engine', etc.
    }
    
    // Default to premium if not found
    console.log(`⚠️ Price ID ${priceId} not found in subscription_tiers, defaulting to premium`)
    return 'premium'
  } catch (error) {
    console.error('❌ Error querying subscription_tiers:', error)
    // Default to premium on error
    return 'premium'
  }
}

// Helper: normalize Stripe timestamps (seconds, milliseconds, ISO) -> ISO date string or null
function toIsoDate(value: any, { dateOnly = true }: { dateOnly?: boolean } = {}): string | null {
  if (value === null || value === undefined) return null
  let d: Date
  if (typeof value === 'number') {
    // Heuristic: seconds epoch is much smaller than ms
    d = new Date(value < 10_000_000_000 ? value * 1000 : value)
  } else if (typeof value === 'string') {
    const parsed = new Date(value)
    d = parsed
  } else if (value instanceof Date) {
    d = value
  } else {
    return null
  }
  if (isNaN(d.getTime())) return null
  const iso = d.toISOString()
  return dateOnly ? iso.split('T')[0] : iso
}

// MOVED OUTSIDE - Now accessible to all handler functions
async function getCurrentUserData(userId: number) {
  // Get basic user info
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('body_weight, gender, units, conditioning_benchmarks')
    .eq('id', userId)
    .single()

  if (userError) throw userError

  // Get equipment
  const { data: equipmentData, error: equipmentError } = await supabase
    .from('user_equipment')
    .select('equipment_name')
    .eq('user_id', userId)

  if (equipmentError) throw equipmentError

  // Get skills
  const { data: skillsData, error: skillsError } = await supabase
    .from('user_skills')
    .select('skill_name, skill_level, skill_index')
    .eq('user_id', userId)
    .order('skill_index')

  if (skillsError) throw skillsError

  // Get 1RMs
  const { data: oneRMData, error: oneRMError } = await supabase
    .from('user_one_rms')
    .select('exercise_name, one_rm, one_rm_index')
    .eq('user_id', userId)
    .order('one_rm_index')

  if (oneRMError) throw oneRMError

  return {
    userData,
    equipment: equipmentData?.map(eq => eq.equipment_name) || [],
    skills: skillsData || [],
    oneRMs: oneRMData || []
  }
}

// MOVED OUTSIDE - Now accessible to all handler functions
async function generateRenewalProgram(stripeSubscriptionId: string) {
  try {
    // Get subscription and user info
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id, billing_interval')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single()

    if (subError || !subscription) {
      console.error('Subscription not found for renewal program generation')
      return
    }

    // Get user's subscription tier to determine program type
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', subscription.user_id)
      .single()

    if (userError) {
      console.error('Error getting user subscription tier:', userError)
      // Continue with default 'full' if we can't determine tier
    }

    const isAppliedPower = userData?.subscription_tier === 'APPLIED_POWER'
    const programType = isAppliedPower ? 'applied_power' : 'full'

    // Get current program count to determine next program number
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('program_number')
      .eq('user_id', subscription.user_id)
      .order('program_number', { ascending: false })
      .limit(1)

    if (programError) {
      console.error('Error getting program count:', programError)
      return
    }

    const nextProgramNumber = (programData?.[0]?.program_number || 0) + 1
    console.log(`Generating program #${nextProgramNumber} for user ${subscription.user_id} (type: ${programType})`)

    // Get current user data from settings
    const currentUserData = await getCurrentUserData(subscription.user_id)

    // Always generate 4-week programs regardless of billing interval
    const weeksToGenerate = Array.from({length: 4}, (_, i) => i + 1 + (4 * (nextProgramNumber - 1)))

    console.log(`Generating program for ${weeksToGenerate.length} weeks...`)

    // Call program generation edge function
    const programResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-program`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: subscription.user_id,
          weeksToGenerate,
          programType
        })
      }
    )

    if (!programResponse.ok) {
      const errorText = await programResponse.text()
      console.error('Program generation failed for renewal:', errorText)
      return
    }

    const programResult = await programResponse.json()

    // Save new program
    const { error: programSaveError } = await supabase
      .from('programs')
      .insert({
        user_id: subscription.user_id,
        sport_id: 1,
        program_number: nextProgramNumber,
        weeks_generated: weeksToGenerate,
        program_data: programResult.program,
        user_snapshot: programResult.program.metadata.userSnapshot,
        ratio_snapshot: programResult.program.metadata.ratioSnapshot
      })

    if (programSaveError) {
      console.error('Failed to save renewal program:', programSaveError)
      return
    }

    // Generate updated profile
    const profileResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-user-profile`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: subscription.user_id,
          sport_id: 1,
          force_regenerate: true
        })
      }
    )

    if (profileResponse.ok) {
      console.log(`Successfully generated renewal program #${nextProgramNumber}`)
    }

  } catch (error) {
    console.error('Error generating renewal program:', error)
  }
}

export async function POST(request: NextRequest) {
  // ADD THE DEBUG CODE HERE - FIRST THING INSIDE THE POST FUNCTION
  console.log('=== WEBHOOK DEBUG START ===')
  console.log('Content-Type:', request.headers.get('content-type'))
  console.log('User-Agent:', request.headers.get('user-agent'))

  const body = await request.arrayBuffer()
  const bodyBuffer = Buffer.from(body)
  
  console.log('Body length:', bodyBuffer.length)
  console.log('Body first 200 chars:', bodyBuffer.toString().substring(0, 200))
  
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')
  console.log('Stripe signature:', signature)
  console.log('=== WEBHOOK DEBUG END ===')

  try {
    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        bodyBuffer,  // ← This change
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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
    // Get the subscription to determine plan type
    let planType = 'PREMIUM' // Default
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = (subscription as any).items.data[0].price.id
      planType = (await getPlanFromPriceId(priceId)).toUpperCase() // 'btn' -> 'BTN', 'premium' -> 'PREMIUM'
    }

    // Normalize email to lowercase for consistent lookups
    // Users are stored with lowercase email (from trigger or API)
    const normalizedEmail = customerEmail.toLowerCase()

    // Check if user exists
    const { data: existingUsers, error: userCheckError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)

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
          subscription_status: 'active',
          subscription_tier: planType,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating user:', updateError)
        throw updateError
      }
      
      console.log(`Updated existing user subscription to ${planType}`)
    } else {
      // User doesn't exist yet - API will create it when intake form submits
      console.log('⚠️ User record not found - will be created by create-user-account API')
      console.log('⚠️ Skipping user and subscription updates - will be handled when user is created')
      return // Skip user and subscription updates
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

      // Determine plan type from price ID
      const priceId = (subscription as any).items.data[0].price.id
      const planType = await getPlanFromPriceId(priceId)

      const subscriptionData = {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan: planType,
        amount_cents: amountTotal,
        billing_interval: (subscription as any).items.data[0].price.recurring?.interval || 'month',
        subscription_start: toIsoDate((subscription as any).created),
        current_period_start: toIsoDate((subscription as any).current_period_start),
        current_period_end: toIsoDate((subscription as any).current_period_end),
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

  // Determine plan type from price ID
  const priceId = (subscription as any).items.data[0].price.id
  const planType = await getPlanFromPriceId(priceId)

  // Use existing subscriptions table structure
  const subscriptionData = {
    user_id: parseInt(userId),
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: planType,
    billing_interval: (subscription as any).items.data[0].price.recurring?.interval || 'month',
    subscription_start: toIsoDate((subscription as any).created),
    current_period_start: toIsoDate((subscription as any).current_period_start),
    current_period_end: toIsoDate((subscription as any).current_period_end),
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
      current_period_start: toIsoDate((subscription as any).current_period_start),
      current_period_end: toIsoDate((subscription as any).current_period_end),
      canceled_at: toIsoDate((subscription as any).canceled_at, { dateOnly: false }),
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

  // Sync status to users table
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (sub) {
    await supabase
      .from('users')
      .update({ subscription_status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', sub.user_id)
  }
}

async function handlePaymentSucceeded(invoice: any) {
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

    // Sync status to users table
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .single()

    if (sub) {
      await supabase
        .from('users')
        .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
        .eq('id', sub.user_id)
    }

    // NEW: Check if this is a renewal payment (not initial signup)
    if (invoice.billing_reason === 'subscription_cycle') {
      console.log('Renewal payment detected - generating next program')
      await generateRenewalProgram(invoice.subscription as string)
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id)

  if ((invoice as any).subscription) {
    const stripeSubId = (invoice as any).subscription as string

    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubId)

    if (error) {
      console.error('Error updating subscription after failed payment:', error)
    } else {
      console.log('Successfully updated subscription after failed payment')
    }

    // Sync status to users table
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubId)
      .single()

    if (sub) {
      await supabase
        .from('users')
        .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
        .eq('id', sub.user_id)
    }
  }
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log('Customer created:', customer.id)
  // Store customer info if needed for future use
}
