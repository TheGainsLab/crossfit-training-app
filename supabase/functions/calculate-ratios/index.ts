import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { calculateUserRatios } from '../_shared/ratios.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CalculateRatiosRequest {
  user_id: number
  force_recalculate?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { user_id, force_recalculate = false }: CalculateRatiosRequest = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🧮 Calculating ratios for user ${user_id}`)

    // Check if ratios already exist and are recent (unless forced recalculation)
    if (!force_recalculate) {
      const { data: existingRatios, error: ratiosError } = await supabase
        .from('user_ratios')
        .select('*')
        .eq('user_id', user_id)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single()

      if (!ratiosError && existingRatios) {
        const calculatedAt = new Date(existingRatios.calculated_at)
        const daysSinceCalculation = (Date.now() - calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
        
        // Use cached ratios if calculated within last 7 days
        if (daysSinceCalculation < 7) {
          console.log(`✅ Using cached ratios from ${calculatedAt.toISOString()}`)
          return new Response(
            JSON.stringify({ success: true, ratios: existingRatios }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Fetch user data for calculation
    const userData = await fetchUserDataForRatios(supabase, user_id)

    // Calculate ratios using shared logic
    const ratios = calculateUserRatios({
      name: userData.name,
      gender: userData.gender,
      bodyWeight: userData.bodyWeight,
      oneRMs: userData.oneRMs
    }) as Record<string, unknown>

    console.log(`✅ Ratios calculated: Snatch level: ${ratios.snatch_level}, C&J level: ${ratios.clean_jerk_level}`)

    // Store ratios in database
    await storeUserRatios(supabase, user_id, ratios)

    console.log(`✅ Ratios calculated and stored for user ${user_id}`)

    return new Response(
      JSON.stringify({ success: true, ratios }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Ratio calculation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// === FETCH USER DATA FOR RATIOS ===
async function fetchUserDataForRatios(supabase: any, user_id: number) {
  console.log(`📊 Fetching user data for ratio calculations`)

  // Fetch basic user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('name, email, gender, body_weight, units')
    .eq('id', user_id)
    .single()

  if (userError) {
    throw new Error(`Failed to fetch user data: ${userError.message}`)
  }

  // Fetch 1RMs (latest for each exercise)
  const { data: oneRMs, error: oneRMsError } = await supabase
    .from('latest_user_one_rms')
    .select('one_rm_index, one_rm')
    .eq('user_id', user_id)
    .order('one_rm_index')

  if (oneRMsError) {
    throw new Error(`Failed to fetch 1RMs: ${oneRMsError.message}`)
  }

  // Convert 1RMs to array format (14 1RMs total)
  const oneRMsArray = Array(14).fill(0)
  oneRMs?.forEach(rm => {
    if (rm.one_rm_index >= 0 && rm.one_rm_index < 14) {
      oneRMsArray[rm.one_rm_index] = rm.one_rm
    }
  })

  return {
    name: user.name,
    email: user.email,
    gender: user.gender || 'Male',
    bodyWeight: user.body_weight || 0,
    units: user.units || 'Imperial (lbs)',
    oneRMs: oneRMsArray
  }
}

// === STORE USER RATIOS ===
async function storeUserRatios(supabase: any, user_id: number, ratios: any) {
  const { error } = await supabase
    .from('user_ratios')
    .insert({
      user_id,
      ...ratios,
      calculated_at: new Date().toISOString()
    })

  if (error) {
    throw new Error(`Failed to store ratios: ${error.message}`)
  }

  console.log(`✅ Ratios stored in database for user ${user_id}`)
}
