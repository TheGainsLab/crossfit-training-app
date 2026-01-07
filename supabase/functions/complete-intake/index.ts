import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IntakeData {
  bodyWeight: number
  gender: string
  units: string
  skills: string[] // Array of 26 skill levels
  oneRMs: (number | null)[] // Array of 14 1RMs (null for not entered)
  equipment: string[]
  benchmarks?: {
    mile_run?: string
    five_k_run?: string
    ten_k_run?: string
    one_k_row?: string
    two_k_row?: string
    five_k_row?: string
    ten_min_air_bike?: string
  }
}

interface CompleteIntakeRequest {
  user_id: number
  intake_data: IntakeData
}

// Skill names in order (index 0-25)
const skillNames = [
  'Double Unders', 'Wall Balls', 'Toes to Bar', 'Pull-ups (kipping or butterfly)', 
  'Chest to Bar Pull-ups', 'Strict Pull-ups', 'Push-ups', 'Ring Dips', 
  'Strict Ring Dips', 'Strict Handstand Push-ups', 'Wall Facing Handstand Push-ups', 
  'Deficit Handstand Push-ups (4")', 'Alternating Pistols', 'GHD Sit-ups', 
  'Wall Walks', 'Ring Muscle Ups', 'Bar Muscle Ups', 'Rope Climbs', 
  'Wall Facing Handstand Hold', 'Freestanding Handstand Hold', 'Legless Rope Climbs', 
  'Pegboard Ascent', 'Handstand Walk (10m or 25")', 'Seated Legless Rope Climbs', 
  'Strict Ring Muscle Ups', 'Handstand Walk Obstacle Crossings'
]

// 1RM exercise names in order (index 0-13)
const oneRMNames = [
  'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 
  'Clean (Only)', 'Jerk (Only)', 'Back Squat', 'Front Squat', 
  'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press', 
  'Strict Press', 'Weighted Pullup'
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { user_id, intake_data }: CompleteIntakeRequest = await req.json()

    if (!user_id || !intake_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing user_id or intake_data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📝 Processing intake for user ${user_id}`)

    // Validate intake data
    if (!intake_data.skills || intake_data.skills.length !== 26) {
      return new Response(
        JSON.stringify({ success: false, error: 'Must provide exactly 26 skill assessments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user has active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('billing_interval, status')
      .eq('user_id', user_id)
      .in('status', ['active', 'trialing'])
      .single()

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active subscription found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Start saving intake data
    console.log('💾 Saving intake data...')

    // Update user details
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        body_weight: intake_data.bodyWeight,
        gender: intake_data.gender,
        units: intake_data.units,
        conditioning_benchmarks: intake_data.benchmarks || {},
        program_generation_pending: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)

    if (userUpdateError) {
      throw new Error(`Failed to update user: ${userUpdateError.message}`)
    }

    // Delete existing equipment (to handle updates)
    await supabase
      .from('user_equipment')
      .delete()
      .eq('user_id', user_id)

    // Save equipment
    if (intake_data.equipment.length > 0) {
      const equipmentRecords = intake_data.equipment.map(eq => ({
        user_id,
        equipment_name: eq
      }))

      const { error: equipmentError } = await supabase
        .from('user_equipment')
        .insert(equipmentRecords)

      if (equipmentError) {
        throw new Error(`Failed to save equipment: ${equipmentError.message}`)
      }
    }

    // Delete existing skills (to handle updates)
    await supabase
      .from('user_skills')
      .delete()
      .eq('user_id', user_id)

    // Save all 26 skills
    const skillRecords = intake_data.skills.map((level, index) => ({
      user_id,
      skill_index: index,
      skill_name: skillNames[index],
      skill_level: level
    }))

    const { error: skillsError } = await supabase
      .from('user_skills')
      .insert(skillRecords)

    if (skillsError) {
      throw new Error(`Failed to save skills: ${skillsError.message}`)
    }

    // Delete existing 1RMs (to handle updates)
    await supabase
      .from('user_one_rms')
      .delete()
      .eq('user_id', user_id)

    // Save 1RMs (only non-zero values)
    const oneRMRecords = intake_data.oneRMs
      .map((weight, index) => 
        weight && weight > 0 ? {
          user_id,
          one_rm_index: index,
          exercise_name: oneRMNames[index],
          one_rm: weight
        } : null
      )
      .filter(record => record !== null)

    if (oneRMRecords.length > 0) {
      const { error: oneRMsError } = await supabase
        .from('user_one_rms')
        .insert(oneRMRecords)

      if (oneRMsError) {
        throw new Error(`Failed to save 1RMs: ${oneRMsError.message}`)
      }
    }

    console.log('✅ Intake data saved successfully')

    // Determine weeks to generate based on subscription
    const weeksToGenerate = subscription.billing_interval === 'quarter' 
      ? Array.from({length: 13}, (_, i) => i + 1)  // Weeks 1-13
      : [1, 2, 3, 4]  // Weeks 1-4 for monthly

    console.log(`🏋️ Generating program for ${weeksToGenerate.length} weeks...`)

    // Determine programType based on subscription tier
    const { data: userTier } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user_id)
      .single()
    
    const subscriptionTier = userTier?.subscription_tier
    const programType = subscriptionTier === 'ENGINE' ? 'engine'
      : subscriptionTier === 'APPLIED_POWER' ? 'applied_power'
      : 'full'
    
    console.log(`📊 User subscription tier: ${subscriptionTier}, programType: ${programType}`)

    // Generate program
    const programResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-program`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id, 
          weeksToGenerate,
          programType
        })
      }
    )

    if (!programResponse.ok) {
      const errorText = await programResponse.text()
      throw new Error(`Program generation failed: ${errorText}`)
    }

    const programResult = await programResponse.json()

    // Store the generated program in the programs table
    const { data: savedProgram, error: programSaveError } = await supabase
      .from('programs')
      .insert({
        user_id,
        sport_id: 1,
        program_number: 1,
        weeks_generated: weeksToGenerate,
        program_data: programResult.program,
        user_snapshot: programResult.program.metadata.userSnapshot,
        ratio_snapshot: programResult.program.metadata.ratioSnapshot
      })
      .select('id')
      .single()

    if (programSaveError) {
      console.error('Failed to save program to database:', programSaveError)
      // Continue anyway - program was generated successfully
    }

    console.log(`✅ Program generated successfully!`)

// Generate user profile
console.log(`📊 Generating user profile...`)

const profileResponse = await fetch(
  `${supabaseUrl}/functions/v1/generate-user-profile`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      user_id,
      sport_id: 1,
      force_regenerate: false
    })
  }
)

if (!profileResponse.ok) {
  const errorText = await profileResponse.text()
  console.error('❌ Profile generation failed:', errorText)
  // Don't throw - profile is nice to have but not critical
} else {
  console.log(`✅ Profile generated successfully!`)
}


    return new Response(
      JSON.stringify({ 
        success: true,
        program_id: savedProgram?.id,
        message: 'Intake completed and program generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Complete intake error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
