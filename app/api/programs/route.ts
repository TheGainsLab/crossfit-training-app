// app/api/programs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Generate program with subscription check
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient()
  try {
    const body = await request.json()
    const { userId, namedValues, weeksToGenerate = [1, 2, 3, 4] } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Step 1: Check subscription status (PAYWALL)
    const subscriptionCheck = await checkSubscriptionStatus(userId, supabase)
    
    if (!subscriptionCheck.hasActiveSubscription) {
      return NextResponse.json({ 
        error: 'Subscription required',
        message: 'An active subscription is required to generate training programs',
        subscriptionRequired: true,
        availablePlans: subscriptionCheck.availablePlans
      }, { status: 402 }) // 402 Payment Required
    }

   
// Step 2: Call your existing Supabase edge function
console.log(`✅ User ${userId} has active subscription (${subscriptionCheck.tierName}), generating program...`)

let programData; // 👈 DECLARE HERE - outside all the blocks

try {
  const programResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-program`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      namedValues,
      weeksToGenerate
    })
  })

  console.log('Edge function response status:', programResponse.status)
  
  if (!programResponse.ok) {
    const errorText = await programResponse.text()
    console.error('Edge function error:', errorText)
    
    // If edge function fails, return a mock response so we can test the payment flow
    console.log('Falling back to mock response for testing...')
    const mockProgramData = {
      success: true,
      program: {
        weeks: [
          {
            week: 1,
            days: [
              {
                day: 1,
                dayName: "DAY 1",
                mainLift: "Snatch",
                blocks: [
                  {
                    block: "SKILLS",
                    exercises: [
                      { name: "Double Unders", sets: 3, reps: 20, weightTime: "", notes: "Practice timing" }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        totalExercises: 1,
        metadata: {
          generatedAt: new Date().toISOString(),
          userSnapshot: { name: "Test User" },
          weeksGenerated: weeksToGenerate,
          note: "Mock response - edge function returned error"
        }
      }
    }
    
    // Use mock data but continue with the flow
    programData = mockProgramData // 👈 ASSIGN (remove 'var')
  } else {
    programData = await programResponse.json() // 👈 ASSIGN (remove 'const')
    console.log('✅ Edge function succeeded!')
  }
} catch (fetchError) {
  console.error('Network error calling edge function:', fetchError)
  
  // Fallback to mock response
  programData = { // 👈 ASSIGN (remove 'const')
    success: true,
    program: {
      weeks: [{ week: 1, days: [] }],
      totalExercises: 0,
      metadata: {
        generatedAt: new Date().toISOString(),
        note: "Mock response - network error"
      }
    }
  }
}

// Step 3: Store the generated program in database
// Now programData is accessible here! ✅




    const { data: storedProgram, error: storeError } = await supabase
      .from('programs')
      .insert({
        user_id: parseInt(userId),
        created_by_user_id: parseInt(userId),
        program_number: 1, // You might want to auto-increment this
        weeks_generated: weeksToGenerate,
        user_snapshot: { name: "Test User", userId: userId }, // Required JSONB field
        ratio_snapshot: { test: "data" }, // Required JSONB field - you'd populate this with actual ratios
        sport_id: 1, // Assuming CrossFit = 1
        program_data: programData,
        generated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (storeError) {
      console.error('Error storing program:', storeError)
      // Still return the program even if storage fails
    } else {
      console.log('✅ Program stored successfully with ID:', storedProgram?.id)
    }

    return NextResponse.json({
      success: true,
      program: programData,
      programId: storedProgram?.id,
      subscription: {
        tierName: subscriptionCheck.tierName,
        status: 'active'
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        weeksGenerated: weeksToGenerate,
        userId: userId
      }
    })

  } catch (error) {
    console.error('Program generation error:', error)
    return NextResponse.json({ 
      error: 'Program generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to check subscription status
async function checkSubscriptionStatus(userId: string, supabase: any) {
  try {
    // Get active subscription from your subscriptions table
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', parseInt(userId))
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get available plans for upsell
    const { data: availablePlans } = await supabase
      .from('subscription_tiers')
      .select('id, name, price_monthly, price_quarterly, features')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true })

    if (error || !subscription) {
      console.log('No active subscription found for user:', userId)
      return {
        hasActiveSubscription: false,
        tierId: null,
        tierName: null,
        availablePlans: availablePlans || []
      }
    }

    // Check if subscription is in trial period or active
    const now = new Date()
    const isInTrial = subscription.trial_end && new Date(subscription.trial_end) > now
    const isActive = subscription.status === 'active'

    // Get tier info from the plan name
    const { data: tierInfo } = await supabase
      .from('subscription_tiers')
      .select('id, name')
      .eq('id', subscription.plan)
      .single()

    console.log(`User ${userId} subscription check:`, {
      status: subscription.status,
      plan: subscription.plan,
      isInTrial,
      trialEnd: subscription.trial_end
    })

    return {
      hasActiveSubscription: isActive || isInTrial,
      tierId: subscription.plan,
      tierName: tierInfo?.name || subscription.plan,
      subscriptionStatus: subscription.status,
      trialEnd: subscription.trial_end,
      isInTrial: isInTrial,
      availablePlans: availablePlans || []
    }

  } catch (error) {
    console.error('Subscription check error:', error)
    return {
      hasActiveSubscription: false,
      tierId: null,
      tierName: null,
      availablePlans: []
    }
  }
}
