import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await req.json()
    const ratios = calculateUserRatios(user)

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

// === COMPLETE RATIO CALCULATION (Exact Google Sheets Logic) ===
function calculateUserRatios(user: any) {
  console.log(`🔢 Calculating complete ratios for: ${user.name}`)
  
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

  // Calculate accessory needs (exact same logic as Google Sheets)
  const needsUpperBack = (ratios.front_squat_back_squat < 0.85)
  const needsLegStrength = false // Not currently triggered in Google Sheets
  const needsPosteriorChain = (ratios.deadlift_body_weight < 2.0)
  const needsUpperBodyPressing = (ratios.bench_press_body_weight < 0.9) || (ratios.push_press_strict_press > 1.5)
  const needsUpperBodyPulling = (ratios.weighted_pullup_bench_press < 0.4) || (ratios.weighted_pullup_body_weight < 0.33)
  const needsCore = false // Not currently triggered in Google Sheets

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

  console.log(`📊 Complete ratios calculated for ${user.name}:`)
  console.log(`   Snatch Level: ${snatchLevel}, C&J Level: ${cleanJerkLevel}`)
  console.log(`   Back Squat Level: ${backSquatLevel}, Press Level: ${pressLevel}`)
  console.log(`   Needs: Upper Back: ${needsUpperBack}, Posterior Chain: ${needsPosteriorChain}`)
  console.log(`   Technical Counts: Snatch: ${snatchTechnicalCount}, C&J: ${cleanJerkTechnicalCount}`)

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
    press_level: pressLevel,
    
    // Metadata
    effective_gender: effectiveGender,
    calculated_at: new Date().toISOString()
  }
}
