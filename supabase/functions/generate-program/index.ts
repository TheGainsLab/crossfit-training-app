import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Program configuration (exact from Google Script)
const days = ['DAY 1', 'DAY 2', 'DAY 3', 'DAY 4', 'DAY 5']
const mainLifts = ['Snatch', 'Back Squat', 'Press', 'Clean and Jerk', 'Front Squat']
const blocks = ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS']

interface GenerateProgramRequest {
  user_id: number
  weeksToGenerate?: number[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { user_id, weeksToGenerate = [1, 2, 3, 4] }: GenerateProgramRequest = await req.json()
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🚀 Starting program generation for user ${user_id}, weeks: ${weeksToGenerate.join(', ')}`)
    
    // Step 1: Fetch complete user data
    console.log('📊 Step 1: Fetching user data...')
    const userData = await fetchCompleteUserData(supabase, user_id)
    console.log(`✅ User data fetched: ${userData.name}, ${userData.gender}, ${userData.equipment.length} equipment items`)
    
    // Step 2: Determine user ability
    console.log('🎯 Step 2: Determining user ability...')
    const abilityResponse = await fetch(`${supabaseUrl}/functions/v1/determine-user-ability`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id })
    })
    
    if (!abilityResponse.ok) {
      throw new Error('Failed to determine user ability: ' + await abilityResponse.text())
    }
    
    const abilityResult = await abilityResponse.json()
    console.log(`✅ User ability: ${abilityResult.ability} (${abilityResult.advancedCount} advanced skills)`)
    
    // Merge ability data with user data
    const user = {
      ...userData,
      skills: abilityResult.skills,
      ability: abilityResult.ability
    }
    
    // Step 3: Calculate ratios
    console.log('🧮 Step 3: Calculating ratios...')
    const ratiosResponse = await fetch(`${supabaseUrl}/functions/v1/calculate-ratios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id })
    })
    
    if (!ratiosResponse.ok) {
      throw new Error('Failed to calculate ratios: ' + await ratiosResponse.text())
    }
    
    const ratiosResult = await ratiosResponse.json()
    const ratios = ratiosResult.ratios
    console.log(`✅ Ratios calculated: Snatch level: ${ratios.snatch_level}, needs analysis complete`)
    
    // Step 4: Generate program structure
    console.log('🏗️ Step 4: Generating program structure...')
    const program = await generateProgramStructure(user, ratios, weeksToGenerate, supabase, supabaseUrl, supabaseKey)
    
    const executionTime = Date.now() - startTime
    console.log(`🎉 Program generation complete in ${executionTime}ms`)
    
    return new Response(
      JSON.stringify({
        success: true,
        program: {
          ...program,
          metadata: {
            generatedAt: new Date().toISOString(),
            totalExercises: program.totalExercises,
            executionTime: executionTime,
            userSnapshot: user,
            ratioSnapshot: ratios,
            weeksGenerated: weeksToGenerate
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Program generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// === FETCH COMPLETE USER DATA ===
async function fetchCompleteUserData(supabase: any, user_id: number) {
  console.log(`📊 Fetching complete user data for user ${user_id}`)

  // Fetch basic user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select(`
      name,
      email,
      gender,
      body_weight,
      units,
      ability_level,
      conditioning_benchmarks
    `)
    .eq('id', user_id)
    .single()

  if (userError) {
    throw new Error(`Failed to fetch user data: ${userError.message}`)
  }

  // Fetch equipment
  const { data: equipment, error: equipmentError } = await supabase
    .from('user_equipment')
    .select('equipment_name')
    .eq('user_id', user_id)

  if (equipmentError) {
    throw new Error(`Failed to fetch equipment: ${equipmentError.message}`)
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

  // Convert equipment to array
  const equipmentArray = equipment?.map(eq => eq.equipment_name) || []

  // Convert 1RMs to array format (14 1RMs total)
  const oneRMsArray = Array(14).fill(0)
  oneRMs?.forEach(rm => {
    if (rm.one_rm_index >= 0 && rm.one_rm_index < 14) {
      oneRMsArray[rm.one_rm_index] = rm.one_rm
    }
  })

  // Convert benchmarks from JSONB to array format (7 benchmarks)
  const benchmarks = user.conditioning_benchmarks || {}
  const benchmarksArray = [
    benchmarks.mile_run || '',
    benchmarks.five_k_run || '',
    benchmarks.ten_k_run || '',
    benchmarks.one_k_row || '',
    benchmarks.two_k_row || '',
    benchmarks.five_k_row || '',
    benchmarks.ten_min_air_bike || ''
  ]

  return {
    name: user.name || 'Unknown User',
    email: user.email || '',
    gender: user.gender || 'Male',
    units: user.units || 'Imperial (lbs)',
    bodyWeight: user.body_weight || 0,
    equipment: equipmentArray,
    oneRMs: oneRMsArray,
    benchmarks: benchmarksArray,
    ability: user.ability_level || 'Beginner'
  }
}

// === PROGRAM STRUCTURE GENERATION (Exact Google Script Logic) ===
async function generateProgramStructure(user: any, ratios: any, weeksToGenerate: number[], supabase: any, supabaseUrl: string, supabaseKey: string): Promise<any> {
  console.log('Generating program structure...')
  
  const weeks: any[] = []
  let totalExercises = 0
  
  // Initialize frequency tracking
  const weeklySkills: Record<string, number> = {}
  const weeklyAccessories: Record<string, number> = {}
  
  for (const week of weeksToGenerate) {
    console.log(`📅 Generating Week ${week}...`)
    
    const weekData = {
      week: week,
      days: []
    }
    
    let previousDayAccessories: string[] = []
    let previousDaySkills: string[] = []
    
    for (let day = 0; day < days.length; day++) {
      const dayNumber = day + 1
      const mainLift = mainLifts[day % 5]
      const isDeload = [4, 8, 12].includes(week)
      
      console.log(`  📅 Generating ${days[day]} (${mainLift})...`)
      
      const dayData = {
        day: dayNumber,
        dayName: days[day],
        mainLift: mainLift,
        isDeload: isDeload,
        blocks: []
      }
      
      let dailyStrengthExercises: string[] = []
      
      // Generate each block
      for (const block of blocks) {
        console.log(`    🏗️ Generating ${block}...`)
        
        let blockExercises: any[] = []
        
        if (block === 'METCONS') {
          // Call assign-metcon function
          const metconResponse = await fetch(`${supabaseUrl}/functions/v1/assign-metcon`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user: { ...user, ...ratios },
              week: week,
              day: dayNumber
            })
          })
          
          if (metconResponse.ok) {
            const metconResult = await metconResponse.json()
            blockExercises = metconResult.exercises || []
            
            // Add MetCon metadata
            if (metconResult.workoutId) {
              dayData.metconData = {
                workoutId: metconResult.workoutId,
                workoutFormat: metconResult.workoutFormat,
                timeRange: metconResult.timeRange,
                percentileGuidance: metconResult.percentileGuidance
              }
            }
          }
        } else {
          // Call assign-exercises function
          const numExercises = getNumExercisesForBlock(block, mainLift, ratios)
          
          const exerciseResponse = await fetch(`${supabaseUrl}/functions/v1/assign-exercises`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user: { ...user, ...ratios },
              block: block,
              mainLift: mainLift,
              week: week,
              day: dayNumber,
              isDeload: isDeload,
              numExercises: numExercises,
              weeklySkills: weeklySkills,
              weeklyAccessories: weeklyAccessories,
              previousDayAccessories: previousDayAccessories,
              previousDaySkills: previousDaySkills,
              dailyStrengthExercises: dailyStrengthExercises
            })
          })
          
          if (exerciseResponse.ok) {
            const exerciseResult = await exerciseResponse.json()
            blockExercises = exerciseResult.exercises || []
            
            // Track strength exercises for technical work filtering
            if (block === 'STRENGTH AND POWER') {
              dailyStrengthExercises = blockExercises.map(ex => ex.name)
            }
            
            // Update frequency tracking
            if (block === 'SKILLS') {
              blockExercises.forEach(ex => {
                weeklySkills[ex.name] = (weeklySkills[ex.name] || 0) + 1
              })
              previousDaySkills = blockExercises.map(ex => ex.name)
            }
            
            if (block === 'ACCESSORIES') {
              blockExercises.forEach(ex => {
                weeklyAccessories[ex.name] = (weeklyAccessories[ex.name] || 0) + 1
              })
              previousDayAccessories = blockExercises.map(ex => ex.name)
            }
          }
        }
        
        dayData.blocks.push({
          block: block,
          exercises: blockExercises
        })
        
        totalExercises += blockExercises.length
        console.log(`    ✅ ${block}: ${blockExercises.length} exercises assigned`)
      }
      
      weekData.days.push(dayData)
      console.log(`  ✅ ${days[day]} complete: ${dayData.blocks.reduce((sum, b) => sum + b.exercises.length, 0)} total exercises`)
    }
    
    weeks.push(weekData)
    console.log(`📅 ✅ Week ${week} complete`)
    
    // Reset weekly frequency tracking after each week
    Object.keys(weeklySkills).forEach(key => delete weeklySkills[key])
    Object.keys(weeklyAccessories).forEach(key => delete weeklyAccessories[key])
  }
  
  console.log(`🎉 Program structure complete: ${weeks.length} weeks, ${totalExercises} total exercises`)
  
  return {
    weeks: weeks,
    totalExercises: totalExercises
  }
}

// === HELPER FUNCTIONS (Exact Google Script Logic) ===
function getNumExercisesForBlock(block: string, mainLift: string, ratios: any): number {
  switch (block) {
    case 'SKILLS':
      return 2
    case 'TECHNICAL WORK':
      if (mainLift === 'Snatch') {
        return ratios.snatch_technical_count || 2
      } else if (mainLift === 'Clean and Jerk') {
        return ratios.clean_jerk_technical_count || 2
      } else if (['Back Squat', 'Front Squat'].includes(mainLift)) {
        return 2
      } else {
        return 2
      }
    case 'STRENGTH AND POWER':
      return 1
    case 'ACCESSORIES':
      return 2
    default:
      return 2
  }
}
