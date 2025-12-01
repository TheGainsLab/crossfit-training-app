import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
    
    // Calculate ratios using exact same logic as Google Script
    const ratios = calculateUserRatios(userData)

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

// === RATIO CALCULATION LOGIC (Exact same as Google Script) ===
function calculateUserRatios(user: any) {
  console.log(`🧮 Calculating complete ratios for: ${user.name}`)
  
  // Validate gender for calculations
  const effectiveGender = (user.gender === 'Male' || user.gender === 'Female') ? user.gender : 'Male'
  
  // Calculate all 13 ratios with precision (3 decimal places), handle zero/missing 1RMs, and cap outliers
  const ratios = {
    // Lift ratios (capped at 1.0 for outliers)
    snatch_back_squat: user.oneRMs[6] && user.oneRMs[0] ?
      Math.min(parseFloat((user.oneRMs[0] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    
    clean_jerk_back_squat: user.oneRMs[6] && user.oneRMs[2] ?
      Math.min(parseFloat((user.oneRMs[2] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    
    jerk_clean: user.oneRMs[4] && user.oneRMs[5] ?
      Math.min(parseFloat((user.oneRMs[5] / user.oneRMs[4]).toFixed(3)), 1.0) : 0,
    
    power_snatch_snatch: user.oneRMs[0] && user.oneRMs[1] ?
      Math.min(parseFloat((user.oneRMs[1] / user.oneRMs[0]).toFixed(3)), 1.0) : 0,
    
    power_clean_clean: user.oneRMs[4] && user.oneRMs[3] ?
      Math.min(parseFloat((user.oneRMs[3] / user.oneRMs[4]).toFixed(3)), 1.0) : 0,
    
    front_squat_back_squat: user.oneRMs[6] && user.oneRMs[7] ?
      Math.min(parseFloat((user.oneRMs[7] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    
    overhead_squat_back_squat: user.oneRMs[6] && user.oneRMs[8] ?
      Math.min(parseFloat((user.oneRMs[8] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    
    // Body weight ratios
    back_squat_body_weight: user.bodyWeight && user.oneRMs[6] ?
      parseFloat((user.oneRMs[6] / user.bodyWeight).toFixed(3)) : 0,
    
    deadlift_body_weight: user.bodyWeight && user.oneRMs[9] ?
      parseFloat((user.oneRMs[9] / user.bodyWeight).toFixed(3)) : 0,
    
    bench_press_body_weight: user.bodyWeight && user.oneRMs[10] ?
      parseFloat((user.oneRMs[10] / user.bodyWeight).toFixed(3)) : 0,
    
    weighted_pullup_body_weight: user.bodyWeight && user.oneRMs[13] ?
      parseFloat((user.oneRMs[13] / user.bodyWeight).toFixed(3)) : 0,
    
    // Other ratios
    weighted_pullup_bench_press: user.oneRMs[10] && user.oneRMs[13] ?
      parseFloat((user.oneRMs[13] / user.oneRMs[10]).toFixed(3)) : 0,
    
    push_press_strict_press: user.oneRMs[12] && user.oneRMs[11] ?
      parseFloat((user.oneRMs[11] / user.oneRMs[12]).toFixed(3)) : 0,
    
    snatch_clean_jerk: user.oneRMs[2] && user.oneRMs[0] ?
      parseFloat((user.oneRMs[0] / user.oneRMs[2]).toFixed(3)) : 0
  }
  
  // Calculate accessory needs
  const needsUpperBack = true // Always needed - everyone gets Upper Back
  
  // Calculate deadlift/back_squat ratio to determine leg strength vs posterior chain needs
  const deadliftBackSquatRatio = user.oneRMs[6] && user.oneRMs[9] ? 
    (user.oneRMs[9] / user.oneRMs[6]) : 0
  
  // If deadlift >= 1.15 * back_squat, posterior chain is strong → needs leg strength
  // Otherwise, posterior chain is weak → needs posterior chain work
  const needsLegStrength = deadliftBackSquatRatio >= 1.15
  const needsPosteriorChain = !needsLegStrength // Mutually exclusive
  
  const needsUpperBodyPressing = (ratios.bench_press_body_weight < 0.9) || (ratios.push_press_strict_press > 1.45)
  const needsUpperBodyPulling = (ratios.weighted_pullup_bench_press < 0.4) || (ratios.weighted_pullup_body_weight < 0.33)
  const needsCore = true // Always needed - everyone gets Core
  
  // Evaluate Snatch technical needs (default to failed if missing data)
  const snatchFailedRatios = [
    !ratios.snatch_back_squat || ratios.snatch_back_squat < 0.62,
    !ratios.power_snatch_snatch || ratios.power_snatch_snatch > 0.88,
    !ratios.overhead_squat_back_squat || ratios.overhead_squat_back_squat < 0.65
  ].filter(Boolean).length
  
  // Evaluate Clean & Jerk technical needs (default to failed if missing data)
  const cleanJerkFailedRatios = [
    !ratios.clean_jerk_back_squat || ratios.clean_jerk_back_squat < 0.74,
    !ratios.power_clean_clean || ratios.power_clean_clean > 0.88,
    !ratios.jerk_clean || ratios.jerk_clean < 0.9
  ].filter(Boolean).length
  
  // Store technical exercise counts
  const snatchTechnicalCount = snatchFailedRatios === 0 ? 1 : snatchFailedRatios === 3 ? 3 : 2
  const cleanJerkTechnicalCount = cleanJerkFailedRatios === 0 ? 1 : cleanJerkFailedRatios === 3 ? 3 : 2
  
  // Store squat technical focus (default to remedial work if ratios are missing/zero)
  const backSquatTechnicalFocus = (ratios.overhead_squat_back_squat && ratios.overhead_squat_back_squat >= 0.65) ? 'position' : 'overhead'
  const frontSquatTechnicalFocus = (ratios.front_squat_back_squat && ratios.front_squat_back_squat >= 0.82) ? 'overhead_complex' : 'front_rack'
  
  // Store press technical focus (default to strict strength work if ratio missing/high)
  const pressTechnicalFocus = (ratios.push_press_strict_press && ratios.push_press_strict_press <= 1.65) ? 'stability_unilateral' : 'strict_strength'
  
  // Determine lift levels with Back Squat dominance mitigation
  let backSquatLevel = 'Beginner'
  if (user.bodyWeight && user.oneRMs[6]) {
    if (effectiveGender === 'Male') {
      backSquatLevel = ratios.back_squat_body_weight < 1.25 ? 'Beginner' :
        ratios.back_squat_body_weight >= 1.85 ? 'Advanced' : 'Intermediate'
    } else {
      backSquatLevel = ratios.back_squat_body_weight < 0.75 ? 'Beginner' :
        ratios.back_squat_body_weight >= 1.2 ? 'Advanced' : 'Intermediate'
    }
  }
  
  let snatchLevel = backSquatLevel === 'Beginner' ? 'Beginner' :
    ratios.snatch_back_squat >= 0.62 ? backSquatLevel :
    backSquatLevel === 'Advanced' ? 'Intermediate' : 'Beginner'
  
  let cleanJerkLevel = backSquatLevel === 'Beginner' ? 'Beginner' :
    ratios.clean_jerk_back_squat >= 0.74 ? backSquatLevel :
    backSquatLevel === 'Advanced' ? 'Intermediate' : 'Beginner'
  
  // Secondary check for Back Squat dominance
  if (backSquatLevel === 'Beginner' && user.bodyWeight) {
    const snatchBodyWeightRatio = user.oneRMs[0] / user.bodyWeight
    const cleanJerkBodyWeightRatio = user.oneRMs[2] / user.bodyWeight
    
    if (effectiveGender === 'Male') {
      if (snatchBodyWeightRatio >= 0.5) snatchLevel = 'Intermediate'
      if (cleanJerkBodyWeightRatio >= 0.6) cleanJerkLevel = 'Intermediate'
    } else {
      if (snatchBodyWeightRatio >= 0.5) snatchLevel = 'Intermediate'
      if (cleanJerkBodyWeightRatio >= 0.6) cleanJerkLevel = 'Intermediate'
    }
  }
  
  // Calculate press level
  let pressLevel = 'Beginner'
  if (user.bodyWeight && user.oneRMs[10]) { // oneRMs[10] is Bench Press
    const benchBodyWeightRatio = user.oneRMs[10] / user.bodyWeight
    if (effectiveGender === 'Male') {
      pressLevel = benchBodyWeightRatio < 0.9 ? 'Beginner' :
        benchBodyWeightRatio >= 1.4 ? 'Advanced' : 'Intermediate'
    } else { // Female
      pressLevel = benchBodyWeightRatio < 0.7 ? 'Beginner' :
        benchBodyWeightRatio >= 1.0 ? 'Advanced' : 'Intermediate'
    }
  }
  
  console.log(`🧮 Complete ratios calculated for ${user.name}:`)
  console.log(`  Snatch Level: ${snatchLevel}, C&J Level: ${cleanJerkLevel}`)
  console.log(`  Back Squat Level: ${backSquatLevel}, Press Level: ${pressLevel}`)
  console.log(`  Needs: Upper Back: ${needsUpperBack}, Posterior Chain: ${needsPosteriorChain}`)
  console.log(`  Technical Counts: Snatch: ${snatchTechnicalCount}, C&J: ${cleanJerkTechnicalCount}`)
  
  return {
    // All calculated ratios
    ...ratios,
    
    // Accessory needs flags
    needs_upper_back: needsUpperBack,
    needs_leg_strength: needsLegStrength,
    needs_posterior_chain: needsPosteriorChain,
    needs_upper_body_pressing: needsUpperBodyPressing,
    needs_upper_body_pulling: needsUpperBodyPulling,
    needs_core: needsCore,
    
    // Technical exercise counts
    snatch_technical_count: snatchTechnicalCount,
    clean_jerk_technical_count: cleanJerkTechnicalCount,
    
    // Technical focus areas
    back_squat_technical_focus: backSquatTechnicalFocus,
    front_squat_technical_focus: frontSquatTechnicalFocus,
    press_technical_focus: pressTechnicalFocus,
    
    // Calculated lift levels
    snatch_level: snatchLevel,
    clean_jerk_level: cleanJerkLevel,
    back_squat_level: backSquatLevel,
    press_level: pressLevel
  }
}
