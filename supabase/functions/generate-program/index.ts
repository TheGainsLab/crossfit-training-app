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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { namedValues, weeksToGenerate = [1, 2, 3, 4] } = await req.json()

    console.log(`🎯 Starting program generation for weeks: ${weeksToGenerate.join(', ')}`)

    // Step 1: Determine user ability (call edge function)
    console.log('📊 Step 1: Determining user ability...')
    const abilityResponse = await fetch(`${supabaseUrl}/functions/v1/determine-user-ability`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ namedValues })
    })

    if (!abilityResponse.ok) {
      throw new Error('Failed to determine user ability: ' + await abilityResponse.text())
    }

    const abilityResult = await abilityResponse.json()
    console.log(`✅ User ability: ${abilityResult.ability} (${abilityResult.advancedCount} advanced skills)`)

    // Step 2: Process user data from intake form
    console.log('👤 Step 2: Processing user data...')
    const user = processUserData(namedValues, abilityResult)
    console.log(`✅ User processed: ${user.name}, ${user.gender}, ${user.equipment.length} equipment items`)

    // Step 3: Calculate ratios and technical data (call edge function)
    console.log('🔢 Step 3: Calculating ratios...')
    const ratiosResponse = await fetch(`${supabaseUrl}/functions/v1/calculate-ratios`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user })
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

// === USER DATA PROCESSING (Exact Google Script Logic) ===
function processUserData(namedValues: any, abilityResult: any): any {
  console.log('Processing user intake data...')
  
  // Extract basic user info
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
    
    // 1RMs processing
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
      
      console.log(`  📋 Generating ${days[day]} (${mainLift})...`)
      
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
        console.log(`    🎯 Generating ${block}...`)

// Filter blocks based on subscription tier
// if (subscriptionTier === 'STRENGTH_FOCUSED') {
  //  if (block === 'SKILLS' || block === 'METCONS') {
    //  console.log(` ⏭️ Skipping ${block} for Strength Focused tier`)
     // dayData.blocks.push({
      //  block: block,
       // exercises: []
     //  })
      // continue
   // }
   // }

        
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

