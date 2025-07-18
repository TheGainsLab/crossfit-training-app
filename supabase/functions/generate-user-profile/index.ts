import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateUserProfileRequest {
  namedValues: Record<string, string[]>
  userId: number
  sportId?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { namedValues, userId, sportId = 1 }: GenerateUserProfileRequest = await req.json()

    console.log(`🔄 Starting profile generation for user ${userId}, sport ${sportId}`)

    // Step 1: Determine user ability (reuse existing function)
    console.log('📊 Step 1: Determining user ability...')
    const abilityResult = await callEdgeFunction('determine-user-ability', { namedValues }, supabaseUrl, supabaseKey)
    console.log(`✅ User ability: ${abilityResult.ability} (${abilityResult.advancedCount} advanced skills)`)

    // Step 2: Process user data (same logic as generate-program)
    console.log('👤 Step 2: Processing user data...')
    const user = processUserData(namedValues, abilityResult)
    console.log(`✅ User processed: ${user.name}, ${user.gender}, ${user.equipment.length} equipment items`)

    // Step 3: Calculate ratios (reuse existing function)
    console.log('🔢 Step 3: Calculating ratios...')
    const ratiosResult = await callEdgeFunction('calculate-ratios', { user }, supabaseUrl, supabaseKey)
    console.log(`✅ Ratios calculated: Snatch level: ${ratiosResult.ratios.snatch_level}`)

    // Step 4: Generate profile analysis
    console.log('📋 Step 4: Generating profile analysis...')
    const profile = generateUserProfile(user, ratiosResult.ratios, abilityResult, sportId)
    console.log(`✅ Profile generated with ${profile.missing_data.length} missing data items`)

    // Step 5: Store in database
    console.log('💾 Step 5: Storing in database...')
    await storeUserProfile(supabase, userId, sportId, profile)
    console.log(`✅ Profile stored successfully`)

    const executionTime = Date.now() - startTime
    console.log(`🎉 Profile generation complete in ${executionTime}ms`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile,
        metadata: {
          executionTime,
          generatedAt: new Date().toISOString(),
          userId,
          sportId
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Profile generation error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// === HELPER FUNCTIONS WILL GO BELOW THIS LINE ===

// === HELPER FUNCTIONS ===

async function callEdgeFunction(functionName: string, payload: any, supabaseUrl: string, supabaseKey: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Failed to call ${functionName}: ${await response.text()}`)
  }

  return await response.json()
}

function processUserData(namedValues: any, abilityResult: any): any {
  console.log('Processing user intake data...')
  
  // Extract basic user info (exact same logic as generate-program)
  const user = {
    name: namedValues['What is your name?']?.[0] || 'Unknown User',
    email: namedValues['Enter your email']?.[0] || '',
    gender: namedValues['Choose your gender']?.[0] || 'Male',
    units: namedValues['Which unit system do you prefer?']?.[0] || 'Imperial (lbs)',
    bodyWeight: parseFloat(namedValues['Enter your body weight in your preferred unit (pounds or kilograms, as selected above). We use this to calculate strength and weightlifting targets']?.[0] || '0') || 0,
    
    // Equipment processing
    equipment: namedValues['Select all equipment available for your training']?.[0] ?
      namedValues['Select all equipment available for your training'][0].split(',').map((e: string) => e.trim()) : [],
    
    // Skills from ability calculation
    skills: abilityResult.skills,
    ability: abilityResult.ability,
    
    // 1RMs processing (exact same as generate-program)
    oneRMs: [
      parseFloat(namedValues['Enter your 1-RM Snatch']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Power Snatch']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Clean and Jerk']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Power Clean']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Clean (clean only)']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Jerk (from rack or blocks, max Split or Power Jerk)']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Back Squat']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Front Squat']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Overhead Squat']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Deadlift']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Bench Press']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Push Press']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Strict Press']?.[0] || '0') || 0,
      parseFloat(namedValues['Enter your 1-RM Weighted Pullup (do not include body weight)']?.[0] || '0') || 0
    ],
    
    // Benchmarks processing
    benchmarks: [
      namedValues['Enter your 1 Mile Run time in mm:ss format']?.[0] || '',
      namedValues['Enter your 5K Run time in mm:ss format']?.[0] || '',
      namedValues['Enter your 10K Run time in mm:ss format']?.[0] || '',
      namedValues['Enter your 1K Row time in mm:ss format']?.[0] || '',
      namedValues['Enter your 2K Row time in mm:ss format']?.[0] || '',
      namedValues['Enter your 5K Row time in mm:ss format']?.[0] || '',
      namedValues['Enter your 10-Minute Air Bike Time Trial result (in calories)']?.[0] || ''
    ]
  }
  
  console.log(`User data processed: ${user.name}, ${user.ability} level, ${user.equipment.length} equipment items`)
  return user
}

function generateUserProfile(user: any, ratios: any, abilityResult: any, sportId: number) {
  console.log('🔨 Generating comprehensive user profile...')

  // Categorize skills (exact same logic as Google Script)
  const skillNames = ['Double Unders', 'Wall Balls', 'Toes to Bar', 'Pull-ups (kipping or butterfly)', 'Chest to Bar Pull-ups', 'Strict Pull-ups', 'Push-ups', 'Ring Dips', 'Strict Ring Dips', 'Strict Handstand Push-ups', 'Wall Facing Handstand Push-ups', 'Deficit Handstand Push-ups (4")', 'Alternating Pistols', 'GHD Sit-ups', 'Wall Walks', 'Ring Muscle Ups', 'Bar Muscle Ups', 'Rope Climbs', 'Wall Facing Handstand Hold', 'Freestanding Handstand Hold', 'Legless Rope Climbs', 'Pegboard Ascent', 'Handstand Walk (10m or 25")', 'Seated Legless Rope Climbs', 'Strict Ring Muscle Ups', 'Handstand Walk Obstacle Crossings']

  const dontHaveSkills = skillNames.filter((_, i) => user.skills[i] === "Don't have it")
  const beginnerSkills = skillNames.filter((_, i) => user.skills[i] === "Beginner")
  const intermediateSkills = skillNames.filter((_, i) => user.skills[i] === "Intermediate")
  const advancedSkills = skillNames.filter((_, i) => user.skills[i] === "Advanced")

  // Generate ratio analysis messages (exact same logic as Google Script)
  const ratioAnalysis = generateRatioMessages(user, ratios)

  // Identify missing data
  const missingData = identifyMissingData(user)

  // Generate recommendations
  const recommendations = generateRecommendations(user, ratios, missingData)

  const profile = {
    // Basic Info
    user_summary: {
      name: user.name,
      email: user.email,
      gender: user.gender,
      units: user.units,
      body_weight: user.bodyWeight || null,
      equipment: user.equipment,
      ability_level: user.ability,
      sport_id: sportId
    },

    // Performance Data
    one_rms: {
      snatch: user.oneRMs[0] || null,
      power_snatch: user.oneRMs[1] || null,
      clean_and_jerk: user.oneRMs[2] || null,
      power_clean: user.oneRMs[3] || null,
      clean_only: user.oneRMs[4] || null,
      jerk_only: user.oneRMs[5] || null,
      back_squat: user.oneRMs[6] || null,
      front_squat: user.oneRMs[7] || null,
      overhead_squat: user.oneRMs[8] || null,
      deadlift: user.oneRMs[9] || null,
      bench_press: user.oneRMs[10] || null,
      push_press: user.oneRMs[11] || null,
      strict_press: user.oneRMs[12] || null,
      weighted_pullup: user.oneRMs[13] || null
    },

    // Benchmarks
    benchmarks: {
      mile_run: user.benchmarks[0] || null,
      five_k_run: user.benchmarks[1] || null,
      ten_k_run: user.benchmarks[2] || null,
      one_k_row: user.benchmarks[3] || null,
      two_k_row: user.benchmarks[4] || null,
      five_k_row: user.benchmarks[5] || null,
      ten_min_air_bike: user.benchmarks[6] || null
    },

    // Skills Assessment
    skills_assessment: {
      dont_have: dontHaveSkills,
      beginner: beginnerSkills,
      intermediate: intermediateSkills,
      advanced: advancedSkills,
      advanced_count: advancedSkills.length,
      total_skills_assessed: skillNames.length
    },

    // Ratio Analysis (formatted for display)
    ratio_analysis: ratioAnalysis,

    // Technical Focus Areas
    technical_focus: {
      snatch_technical_count: ratios.snatch_technical_count,
      clean_jerk_technical_count: ratios.clean_jerk_technical_count,
      back_squat_focus: ratios.back_squat_technical_focus,
      front_squat_focus: ratios.front_squat_technical_focus,
      press_focus: ratios.press_technical_focus
    },

    // Lift Levels
    lift_levels: {
      snatch_level: ratios.snatch_level,
      clean_jerk_level: ratios.clean_jerk_level,
      back_squat_level: ratios.back_squat_level,
      press_level: ratios.press_level
    },

    // Accessory Needs
    accessory_needs: {
      needs_upper_back: ratios.needs_upper_back,
      needs_leg_strength: ratios.needs_leg_strength,
      needs_posterior_chain: ratios.needs_posterior_chain,
      needs_upper_body_pressing: ratios.needs_upper_body_pressing,
      needs_upper_body_pulling: ratios.needs_upper_body_pulling,
      needs_core: ratios.needs_core
    },

    // Analysis & Recommendations
    missing_data: missingData,
    recommendations: recommendations,

    // Metadata
    generated_at: new Date().toISOString(),
    raw_ratios: ratios // Store for program generation
  }

  console.log(`✅ Profile generated with ${missingData.length} missing data items`)
  return profile
}

function generateRatioMessages(user: any, ratios: any) {
  // Validate gender for calculations
  const effectiveGender = (user.gender === 'Male' || user.gender === 'Female') ? user.gender : 'Male'
  const genderMessage = effectiveGender === 'Male' && user.gender !== 'Male' ? 'Gender not specified, using male thresholds' : ''

  return {
    // Lift Ratios
    snatch_back_squat: user.oneRMs[6] && user.oneRMs[0] && ratios.snatch_back_squat > 0 ?
      (ratios.snatch_back_squat < 0.62 ? 'Snatch to Back Squat Ratio is Low' :
       ratios.snatch_back_squat >= 1.0 ? 'Snatch exceeds Back Squat, treated as Balanced' : 'Snatch to Back Squat Ratio is Balanced') : 'Missing Snatch or Back Squat 1RM',
    
    clean_jerk_back_squat: user.oneRMs[6] && user.oneRMs[2] && ratios.clean_jerk_back_squat > 0 ?
      (ratios.clean_jerk_back_squat < 0.74 ? 'Clean and Jerk to Back Squat Ratio is Low' :
       ratios.clean_jerk_back_squat >= 1.0 ? 'Clean and Jerk exceeds Back Squat, treated as Balanced' : 'Clean and Jerk to Back Squat Ratio is Balanced') : 'Missing Clean and Jerk or Back Squat 1RM',
    
    jerk_clean: user.oneRMs[4] && user.oneRMs[5] && ratios.jerk_clean > 0 ?
      (ratios.jerk_clean < 0.82 ? 'Jerk (Only) to Clean (Only) Ratio is Low' :
       ratios.jerk_clean >= 1.0 ? 'Jerk exceeds Clean, treated as Balanced' : 'Jerk (Only) to Clean (Only) Ratio is Balanced') : 'Missing Jerk or Clean 1RM',
    
    power_snatch_snatch: user.oneRMs[0] && user.oneRMs[1] && ratios.power_snatch_snatch > 0 ?
      (ratios.power_snatch_snatch < 0.88 ? 'Power Snatch to Snatch Ratio is Low' :
       ratios.power_snatch_snatch >= 1.0 ? 'Power Snatch exceeds Snatch, treated as Balanced' : 'Power Snatch to Snatch Ratio is Balanced') : 'Missing Power Snatch or Snatch 1RM',
    
    power_clean_clean: user.oneRMs[4] && user.oneRMs[3] && ratios.power_clean_clean > 0 ?
      (ratios.power_clean_clean < 0.88 ? 'Power Clean to Clean (Only) Ratio is Low' :
       ratios.power_clean_clean >= 1.0 ? 'Power Clean exceeds Clean, treated as Balanced' : 'Power Clean to Clean (Only) Ratio is Balanced') : 'Missing Power Clean or Clean 1RM',
    
    front_squat_back_squat: user.oneRMs[6] && user.oneRMs[7] && ratios.front_squat_back_squat > 0 ?
      (ratios.front_squat_back_squat < 0.82 ? 'Front Squat to Back Squat Ratio is Low' :
       ratios.front_squat_back_squat >= 1.0 ? 'Front Squat exceeds Back Squat, treated as Balanced' : 'Front Squat to Back Squat Ratio is Balanced') : 'Missing Front Squat or Back Squat 1RM',
    
    overhead_squat_back_squat: user.oneRMs[6] && user.oneRMs[8] && ratios.overhead_squat_back_squat > 0 ?
      (ratios.overhead_squat_back_squat < 0.62 ? 'Overhead Squat to Back Squat Ratio is Low' :
       ratios.overhead_squat_back_squat >= 1.0 ? 'Overhead Squat exceeds Back Squat, treated as Balanced' : 'Overhead Squat to Back Squat Ratio is Balanced') : 'Missing Overhead Squat or Back Squat 1RM',

    // Body Weight Ratios
    back_squat_bodyweight: user.bodyWeight && user.oneRMs[6] && ratios.back_squat_body_weight > 0 ?
      (ratios.back_squat_level + (genderMessage ? ' - ' + genderMessage : '')) : 'Back Squat to Bodyweight Level is Beginner' + (genderMessage ? ' - ' + genderMessage : ''),
    
    deadlift_bodyweight: user.bodyWeight && user.oneRMs[9] && ratios.deadlift_body_weight > 0 ?
      (effectiveGender === 'Male' ? 
        (ratios.deadlift_body_weight < 1.35 ? 'Deadlift to Bodyweight Level is Beginner' : 
         ratios.deadlift_body_weight >= 2.1 ? 'Deadlift to Bodyweight Level is Advanced' : 'Deadlift to Bodyweight Level is Intermediate') :
        (ratios.deadlift_body_weight < 0.7 ? 'Deadlift to Bodyweight Level is Beginner' : 
         ratios.deadlift_body_weight >= 1.4 ? 'Deadlift to Bodyweight Level is Advanced' : 'Deadlift to Bodyweight Level is Intermediate')) + 
      (genderMessage ? ' - ' + genderMessage : '') : 'Deadlift to Bodyweight Level is Beginner' + (genderMessage ? ' - ' + genderMessage : ''),
    
    bench_press_bodyweight: user.bodyWeight && user.oneRMs[10] && ratios.bench_press_body_weight > 0 ?
      (effectiveGender === 'Male' ? 
        (ratios.bench_press_body_weight < 0.9 ? 'Bench Press to Bodyweight Level is Beginner' : 
         ratios.bench_press_body_weight >= 1.4 ? 'Bench Press to Bodyweight Level is Advanced' : 'Bench Press to Bodyweight Level is Intermediate') :
        (ratios.bench_press_body_weight < 0.7 ? 'Bench Press to Bodyweight Level is Beginner' : 
         ratios.bench_press_body_weight >= 1.0 ? 'Bench Press to Bodyweight Level is Advanced' : 'Bench Press to Bodyweight Level is Intermediate')) + 
      (genderMessage ? ' - ' + genderMessage : '') : 'Bench Press to Bodyweight Level is Beginner' + (genderMessage ? ' - ' + genderMessage : ''),

    // Other Ratios
    weighted_pullup_bench_press: user.oneRMs[10] && user.oneRMs[13] && ratios.weighted_pullup_bench_press > 0 ?
      (effectiveGender === 'Male' ? 
        (ratios.weighted_pullup_bench_press < 0.25 ? 'Weighted Pullup to Bench Press Ratio is Low' : 'Weighted Pullup to Bench Press Ratio is Balanced') :
        (ratios.weighted_pullup_bench_press < 0.15 ? 'Weighted Pullup to Bench Press Ratio is Low' : 'Weighted Pullup to Bench Press Ratio is Balanced')) + 
      (genderMessage ? ' - ' + genderMessage : '') : 'Missing Weighted Pullup or Bench Press 1RM' + (genderMessage ? ' - ' + genderMessage : ''),
    
    push_press_strict_press: user.oneRMs[12] && user.oneRMs[11] && ratios.push_press_strict_press > 0 ?
      (ratios.push_press_strict_press < 1.25 ? 'Push Press to Strict Press Ratio is Low' : 
       ratios.push_press_strict_press >= 1.85 ? 'Push Press to Strict Press Ratio is High' : 'Push Press to Strict Press Ratio is Balanced') : 'Missing Push Press or Strict Press 1RM',
    
    snatch_clean_jerk: user.oneRMs[2] && user.oneRMs[0] && ratios.snatch_clean_jerk > 0 ?
      (ratios.snatch_clean_jerk < 0.8 ? 'Snatch to Clean and Jerk Ratio is Low' : 'Snatch to Clean and Jerk Ratio is Balanced') : 'Missing Snatch or Clean and Jerk 1RM',
    
    weighted_pullup_bodyweight: user.bodyWeight && user.oneRMs[13] && ratios.weighted_pullup_body_weight > 0 ?
      (effectiveGender === 'Male' ? 
        (ratios.weighted_pullup_body_weight < 0.25 ? 'Weighted Pullup to Bodyweight Ratio is Low' : 'Weighted Pullup to Bodyweight Ratio is Balanced') :
        (ratios.weighted_pullup_body_weight < 0.15 ? 'Weighted Pullup to Bodyweight Ratio is Low' : 'Weighted Pullup to Bodyweight Ratio is Balanced')) + 
      (genderMessage ? ' - ' + genderMessage : '') : 'Missing Weighted Pullup or Body Weight' + (genderMessage ? ' - ' + genderMessage : '')
  }
}

function identifyMissingData(user: any) {
  const missing = []
  
  // Check 1RMs
  const oneRMNames = ['Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (Only)', 'Jerk (Only)', 'Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press', 'Strict Press', 'Weighted Pullup']
  oneRMNames.forEach((name, index) => {
    if (!user.oneRMs[index] || user.oneRMs[index] === 0) {
      missing.push(`${name} 1RM`)
    }
  })
  
  // Check body weight
  if (!user.bodyWeight || user.bodyWeight === 0) {
    missing.push('Body Weight')
  }
  
  // Check benchmarks
  const benchmarkNames = ['1 Mile Run', '5K Run', '10K Run', '1K Row', '2K Row', '5K Row', '10-Min Air Bike']
  benchmarkNames.forEach((name, index) => {
    if (!user.benchmarks[index] || user.benchmarks[index] === '') {
      missing.push(name)
    }
  })
  
  return missing
}

function generateRecommendations(user: any, ratios: any, missingData: string[]) {
  const recommendations = []
  
  // High priority missing data
  if (missingData.includes('Body Weight')) {
    recommendations.push({
      priority: 'high',
      category: 'data_collection',
      message: 'Enter your body weight to unlock strength level assessments and personalized weight recommendations'
    })
  }
  
  // Critical 1RMs for program effectiveness
  const critical1RMs = ['Back Squat', 'Clean and Jerk', 'Snatch']
  const missingCritical = critical1RMs.filter(lift => missingData.includes(`${lift} 1RM`))
  if (missingCritical.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'data_collection',
      message: `Complete 1RM testing for: ${missingCritical.join(', ')}. These are essential for proper program loading.`
    })
  }
  
  // Ratio-based recommendations
  if (ratios.snatch_back_squat < 0.62 && user.oneRMs[6] && user.oneRMs[0]) {
    recommendations.push({
      priority: 'medium',
      category: 'technique',
      message: 'Focus on snatch technique and receiving position - your squat strength is ahead of your snatch'
    })
  }
  
  if (ratios.front_squat_back_squat < 0.82 && user.oneRMs[6] && user.oneRMs[7]) {
    recommendations.push({
      priority: 'medium',
      category: 'strength',
      message: 'Prioritize front rack position and front squat strength development'
    })
  }
  
  if (ratios.needs_posterior_chain) {
    recommendations.push({
      priority: 'medium',
      category: 'strength',
      message: 'Focus on posterior chain development - deadlift and hip hinge patterns'
    })
  }
  
  // Skill-based recommendations
  const noSkills = user.skills.filter((skill: string) => skill === "Don't have it").length
  if (noSkills > 15) {
    recommendations.push({
      priority: 'medium',
      category: 'skills',
      message: 'Focus on fundamental movement skills - prioritize basic progressions before advanced movements'
    })
  }
  
  return recommendations
}

async function storeUserProfile(supabase: any, userId: number, sportId: number, profile: any) {
  console.log(`💾 Storing profile for user ${userId}, sport ${sportId}`)
  
  // Upsert the user profile
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      sport_id: sportId,
      profile_data: profile,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,sport_id'
    })
    .select()
  
  if (error) {
    console.error('Database error storing profile:', error)
    throw new Error(`Failed to store user profile: ${error.message}`)
  }
  
  console.log(`✅ Profile stored successfully for user ${userId}`)
  return data
}
