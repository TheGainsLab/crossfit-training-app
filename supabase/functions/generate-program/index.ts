import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { buildUserContextForProgram } from '../_shared/user-context.ts'
import { runSkillsScheduler, type SkillGrid } from '../_shared/skills-scheduler.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Program configuration (exact from Google Script)
const defaultDays = ['DAY 1', 'DAY 2', 'DAY 3', 'DAY 4', 'DAY 5']
const defaultMainLifts = ['Snatch', 'Back Squat', 'Press', 'Clean and Jerk', 'Front Squat']

interface GenerateProgramRequest {
  user_id: number
  weeksToGenerate?: number[]
  programType?: 'full' | 'applied_power' | 'engine' | 'btn'
  includeTestWeek?: boolean
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
    
    // Validate request body
    let parsed: any
    try {
      parsed = await req.json()
    } catch (_) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { user_id, weeksToGenerate = [1, 2, 3, 4], programType = 'full', includeTestWeek = false }: GenerateProgramRequest = parsed || {}

    if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid user_id (number > 0 required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(weeksToGenerate) || weeksToGenerate.length === 0 || !weeksToGenerate.every((w) => Number.isInteger(w) && w > 0)) {
      return new Response(
        JSON.stringify({ error: 'Invalid weeksToGenerate (array of positive integers required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine blocks based on program type
    const blocks = programType === 'engine'
      ? ['ENGINE']  // Engine: Only ENGINE block
      : programType === 'applied_power'
      ? ['TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES']  // Applied Power: 3 blocks (no SKILLS, no METCONS, no ENGINE)
      : ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS', 'ENGINE']  // Full program: 6 blocks

    console.log(`🚀 Starting program generation for user ${user_id}, weeks: ${weeksToGenerate.join(', ')}, programType: ${programType}, includeTestWeek: ${includeTestWeek}, blocks: ${blocks.join(', ')}`)
    
    // Fetch user context (profile, skills, ratios - all in one)
    console.log('📊 Fetching user context (profile, skills, ratios)...')
    const user = await buildUserContextForProgram(supabase, user_id)
    const ratios = user
    console.log(`✅ User context: ${user.name}, Snatch level: ${(user as any).snatch_level}`)
    
    // Generate program structure
    console.log('🏗️ Step 4: Generating program structure...')
    const program = await generateProgramStructure(user, ratios, weeksToGenerate, supabase, supabaseUrl, supabaseKey, blocks, includeTestWeek, programType)
    
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

// === PROGRAM STRUCTURE GENERATION (Exact Google Script Logic) ===
async function generateProgramStructure(user: any, ratios: any, weeksToGenerate: number[], supabase: any, supabaseUrl: string, supabaseKey: string, blocks: string[], includeTestWeek: boolean = false, programType: string = 'full'): Promise<any> {
  console.log('Generating program structure...')
  
  const weeks: any[] = []
  let totalExercises = 0
  
  // Run skills scheduler once if SKILLS block is included
  let skillGrid: SkillGrid = {}
  if (blocks.includes('SKILLS')) {
    console.log('📋 Running skills scheduler...')
    skillGrid = await runSkillsScheduler(supabase, user, weeksToGenerate)
    console.log(`✅ Skills grid generated for ${Object.keys(skillGrid).length} days`)
  }
  
  // Initialize frequency tracking
  const weeklySkills: Record<string, number> = {}
  const weeklyAccessories: Record<string, number> = {}
  
  // Initialize Engine day counter (1-720, wraps around)
  let engineDayCounter = 1

  // Determine number of training days from preferences (3-6)
  const clampedDays = Math.max(3, Math.min(6, Number(user?.preferences?.trainingDaysPerWeek || 5)))
  const days = defaultDays.slice(0, clampedDays)
  console.log(`🗓️ Planned training days per week: ${days.length} (pref=${user?.preferences?.trainingDaysPerWeek})`)

  // Determine main lift rotation
  let mainLifts = defaultMainLifts.slice(0)
  const preferred = (user?.preferences?.primaryStrengthLifts || []).filter((n: string) => !!n)
  if (preferred.length > 0) {
    // Start rotation with preferred lifts, then fill with defaults unique
    const set = new Set<string>()
    const ordered: string[] = []
    preferred.forEach((lift: string) => { if (!set.has(lift)) { set.add(lift); ordered.push(lift) } })
    defaultMainLifts.forEach((lift) => { if (!set.has(lift)) { set.add(lift); ordered.push(lift) } })
    mainLifts = ordered
  }
  
  console.log(`🔍 Main lifts rotation:`, mainLifts)
  console.log(`🔍 User preferences primaryStrengthLifts:`, user?.preferences?.primaryStrengthLifts)
  
  for (const week of weeksToGenerate) {
    console.log(`📅 Generating Week ${week}...`)
    
    const weekData = {
      week: week,
      days: []
    }
    
    let previousDayAccessories: string[] = []
    let weeklyAccessoryCategories: Record<string, number> = {}
    let previousAccessoryCategoryDays: string[][] = []
    let previousDaySkills: string[] = []
    
    // Track used strength exercise names within the week to prevent repeats
    const usedWeeklyStrengths: Set<string> = new Set()

    for (let day = 0; day < days.length; day++) {
      const dayNumber = day + 1
      const isDeload = [4, 8, 12].includes(week)
      const mainLift = getEquipmentGatedMainLift(mainLifts, day, user?.equipment || [])
      const expectedLift = mainLifts[day % mainLifts.length]
      
      console.log(`  📅 Generating ${days[day]} (${mainLift})...`)
      console.log(`🔍 Day ${day} (index ${day}), selected mainLift: ${mainLift}, expected: ${expectedLift}`)
      
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
              user,
              week: week,
              day: dayNumber
            })
          })
          
          if (metconResponse.ok) {
            try {
              const metconResult = await metconResponse.json()
              blockExercises = Array.isArray(metconResult.exercises) ? metconResult.exercises : []
              
              // Add MetCon metadata
              if (metconResult.workoutId) {
                dayData.metconData = {
                  workoutId: metconResult.workoutId,
                  workoutFormat: metconResult.workoutFormat,
                  timeRange: metconResult.timeRange,
                  percentileGuidance: metconResult.percentileGuidance,
                  workoutNotes: metconResult.workoutNotes || ''
                }
              }
            } catch (e) {
              console.error('    ↳ assign-metcon JSON parse error:', e)
            }
          } else {
            let errText = ''
            try { errText = await metconResponse.text() } catch (_) {}
            console.error(`    ↳ assign-metcon HTTP ${metconResponse.status}: ${errText}`)
          }
        } else if (block === 'ENGINE') {
          // Fetch Engine workout from workouts table (sequential 1-720)
          try {
            const { data: engineWorkout, error: engineError } = await supabase
              .from('workouts')
              .select('*')
              .eq('program_type', 'main_5day')
              .eq('day_number', engineDayCounter)
              .single()
            
            if (engineError || !engineWorkout) {
              console.error(`    ↳ Engine workout fetch error for day ${engineDayCounter}:`, engineError?.message || 'Not found')
              // Create placeholder if workout not found
              blockExercises = [{
                name: `Engine Day ${engineDayCounter}`,
                sets: 1,
                reps: 'N/A',
                weightTime: '',
                notes: 'Engine workout not available'
              }]
            } else {
              // Format Engine workout as block exercise
              const dayType = engineWorkout.day_type || 'conditioning'
              const duration = engineWorkout.total_duration_minutes || 30
              
              blockExercises = [{
                name: `Engine ${dayType.charAt(0).toUpperCase() + dayType.slice(1)}`,
                sets: 1,
                reps: `${duration} min`,
                weightTime: '',
                notes: `Day ${engineDayCounter}: ${dayType} workout`,
                engineWorkoutId: engineWorkout.id,
                engineDayNumber: engineDayCounter,
                engineWorkoutData: engineWorkout
              }]
              
              // Store Engine workout metadata (similar to metconData)
              dayData.engineData = {
                workoutId: engineWorkout.id,
                dayNumber: engineDayCounter,
                dayType: dayType,
                duration: duration,
                blockCount: engineWorkout.block_count || 1,
                blockParams: {
                  block1: engineWorkout.block_1_params,
                  block2: engineWorkout.block_2_params,
                  block3: engineWorkout.block_3_params,
                  block4: engineWorkout.block_4_params
                }
              }
              
              // Increment Engine day counter (wrap at 720)
              engineDayCounter = (engineDayCounter % 720) + 1
            }
          } catch (err) {
            console.error(`    ↳ Engine workout error:`, err)
            blockExercises = []
          }
        } else if (block === 'STRENGTH AND POWER') {
          // Determine how many separate strength blocks to emit
          let strengthBlocksCount = 1
          const daysPerWeek = days.length
          if (!isDeload) {
            if (daysPerWeek === 3) {
              strengthBlocksCount = 2
            } else if (daysPerWeek === 4) {
              strengthBlocksCount = (dayNumber === 1 || dayNumber === 3) ? 2 : 1
            }
          }

          for (let s = 0; s < strengthBlocksCount; s++) {
            // Always one exercise per strength block (distinct lift)
            const numExercises = 1
            const exerciseResponse = await fetch(`${supabaseUrl}/functions/v1/assign-exercises`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user,
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
                dailyStrengthExercises: dailyStrengthExercises,
                usedStrengths: Array.from(usedWeeklyStrengths)
              })
            })

            let strengthBlockExercises: any[] = []
            if (exerciseResponse.ok) {
              try {
                const exerciseResult = await exerciseResponse.json()
                strengthBlockExercises = Array.isArray(exerciseResult.exercises) ? exerciseResult.exercises : []
              } catch (e) {
                console.error('    ↳ assign-exercises JSON parse error (Strength):', e)
              }
              // Update trackers
              if (strengthBlockExercises.length > 0) {
                const chosenName = strengthBlockExercises[0]?.name
                if (chosenName) {
                  usedWeeklyStrengths.add(chosenName)
                  dailyStrengthExercises = [...dailyStrengthExercises, chosenName]
                }
              }
            } else {
              let errText = ''
              try { errText = await exerciseResponse.text() } catch (_) {}
              console.error(`    ↳ assign-exercises HTTP ${exerciseResponse.status} (Strength): ${errText}`)
            }

            dayData.blocks.push({
              blockName: block,
              subOrder: s + 1,
              exercises: strengthBlockExercises
            })
            totalExercises += strengthBlockExercises.length
            console.log(`    ✅ ${block} (${s + 1}/${strengthBlocksCount}): ${strengthBlockExercises.length} exercises assigned`)
          }

          // Skip default push below since we already pushed blocks
          continue
        } else {
          // Call assign-exercises function
          const numExercises = getNumExercisesForBlock(block, mainLift, ratios, user?.preferences, isDeload)
          
          const skillTargets = block === 'SKILLS' ? (skillGrid[`W${week}D${dayNumber}`] ?? []) : undefined
          const exerciseResponse = await fetch(`${supabaseUrl}/functions/v1/assign-exercises`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user,
              block: block,
              mainLift: mainLift,
              week: week,
              day: dayNumber,
              isDeload: isDeload,
              numExercises: numExercises,
              weeklySkills: weeklySkills,
              weeklyAccessories: weeklyAccessories,
              weeklyAccessoryCategories: weeklyAccessoryCategories,
              previousDayAccessories: previousDayAccessories,
              previousDaySkills: previousDaySkills,
              dailyStrengthExercises: dailyStrengthExercises,
              usedStrengths: Array.from(usedWeeklyStrengths),
              previousAccessoryCategoryDays: previousAccessoryCategoryDays,
              skillTargets
            })
          })
          
          if (exerciseResponse.ok) {
            try {
              const exerciseResult = await exerciseResponse.json()
              blockExercises = Array.isArray(exerciseResult.exercises) ? exerciseResult.exercises : []
              // Track accessory categories used for policy caps
              if (block === 'ACCESSORIES' && Array.isArray(exerciseResult.usedAccessoryCategories)) {
                const cats: string[] = exerciseResult.usedAccessoryCategories
                cats.forEach((c) => { if (c) weeklyAccessoryCategories[c] = (weeklyAccessoryCategories[c] || 0) + 1 })
                previousAccessoryCategoryDays.push(cats)
              }
            } catch (e) {
              console.error('    ↳ assign-exercises JSON parse error:', e)
            }
            
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
          } else {
            let errText = ''
            try { errText = await exerciseResponse.text() } catch (_) {}
            console.error(`    ↳ assign-exercises HTTP ${exerciseResponse.status} (${block}): ${errText}`)
          }
        }
        
        dayData.blocks.push({
          blockName: block,
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
  
  // Generate test week if requested
  if (includeTestWeek) {
    console.log('🧪 Generating test week...')

    // Determine test week number (last week in the cycle)
    const testWeekNumber = weeksToGenerate[weeksToGenerate.length - 1] + 1

    // Applied Power test week: generate full training days with 1RM tests in Strength block
    if (programType === 'applied_power') {
      console.log('💪 Generating Applied Power test week (full training days with 1RM tests)...')

      // Fetch 1RM test lifts from templates
      const { data: testLifts, error: testLiftsError } = await supabase
        .from('applied_power_test_templates')
        .select('*')
        .order('day', { ascending: true })
        .order('lift_order', { ascending: true })

      if (testLiftsError) {
        console.error('❌ Failed to fetch Applied Power test templates:', testLiftsError.message)
      } else {
        // Group test lifts by day
        const testLiftsByDay: Record<number, any[]> = {}
        testLifts?.forEach((t: any) => {
          if (!testLiftsByDay[t.day]) testLiftsByDay[t.day] = []
          testLiftsByDay[t.day].push(t)
        })

        const testWeekData: any = {
          week: testWeekNumber,
          isTestWeek: true,
          testWeekMessage: 'This is your test week! After completing each test, update your profile with your new results. Your next training cycle will be built using your updated numbers.',
          days: []
        }

        // Main lifts for each day (for technical work context)
        const testDayMainLifts = ['Snatch', 'Back Squat', 'Press', 'Clean and Jerk', 'Front Squat']

        for (let dayNum = 1; dayNum <= 5; dayNum++) {
          const mainLift = testDayMainLifts[dayNum - 1]
          const dayTestLifts = testLiftsByDay[dayNum] || []

          const dayData: any = {
            day: dayNum,
            dayName: `TEST DAY ${dayNum}`,
            mainLift: mainLift,
            isTestWeek: true,
            isDeload: false,
            blocks: []
          }

          // TECHNICAL WORK block (generated normally)
          const techResponse = await fetch(`${supabaseUrl}/functions/v1/assign-exercises`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user,
              block: 'TECHNICAL WORK',
              mainLift: mainLift,
              week: testWeekNumber,
              day: dayNum,
              isDeload: false,
              numExercises: 2,
              weeklySkills: {},
              weeklyAccessories: {},
              previousDayAccessories: [],
              previousDaySkills: []
            })
          })

          if (techResponse.ok) {
            const techResult = await techResponse.json()
            const techExercises = Array.isArray(techResult.exercises) ? techResult.exercises : []
            dayData.blocks.push({
              blockName: 'TECHNICAL WORK',
              exercises: techExercises
            })
            totalExercises += techExercises.length
            console.log(`  📚 Test Day ${dayNum} Technical: ${techExercises.length} exercises`)
          }

          // STRENGTH AND POWER block (1RM tests from templates)
          const strengthExercises = dayTestLifts.map((lift: any) => ({
            name: lift.lift_name,
            sets: 1,
            reps: 'Work up to 1RM',
            weightTime: '',
            notes: lift.notes || '',
            testType: lift.test_type,
            isTestLift: true
          }))

          dayData.blocks.push({
            blockName: 'STRENGTH AND POWER',
            isTestBlock: true,
            exercises: strengthExercises
          })
          totalExercises += strengthExercises.length
          console.log(`  🏋️ Test Day ${dayNum} Strength: ${strengthExercises.map((e: any) => e.name).join(', ')}`)

          // ACCESSORIES block (generated normally)
          const accResponse = await fetch(`${supabaseUrl}/functions/v1/assign-exercises`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user,
              block: 'ACCESSORIES',
              mainLift: mainLift,
              week: testWeekNumber,
              day: dayNum,
              isDeload: false,
              numExercises: 3,
              weeklySkills: {},
              weeklyAccessories: {},
              previousDayAccessories: [],
              previousDaySkills: []
            })
          })

          if (accResponse.ok) {
            const accResult = await accResponse.json()
            const accExercises = Array.isArray(accResult.exercises) ? accResult.exercises : []
            dayData.blocks.push({
              blockName: 'ACCESSORIES',
              exercises: accExercises
            })
            totalExercises += accExercises.length
            console.log(`  💪 Test Day ${dayNum} Accessories: ${accExercises.length} exercises`)
          }

          testWeekData.days.push(dayData)
        }

        weeks.push(testWeekData)
        console.log(`🧪 ✅ Applied Power Test Week ${testWeekNumber} complete`)
      }
    } else if (programType === 'full') {
      // Competitor test week: same strength tests as Applied Power + Skills + Metcons + Engine
      console.log('🏆 Generating Competitor test week...')

      // Fetch 1RM test lifts (same as Applied Power)
      const { data: testLifts, error: testLiftsError } = await supabase
        .from('applied_power_test_templates')
        .select('*')
        .order('day', { ascending: true })
        .order('lift_order', { ascending: true })

      if (testLiftsError) {
        console.error('❌ Failed to fetch strength test templates:', testLiftsError.message)
      }

      // Group test lifts by day
      const testLiftsByDay: Record<number, any[]> = {}
      testLifts?.forEach((t: any) => {
        if (!testLiftsByDay[t.day]) testLiftsByDay[t.day] = []
        testLiftsByDay[t.day].push(t)
      })

      // Fetch Engine test week templates
      let engineTestTemplates: Record<number, any> = {}
      const { data: engineTests, error: engineTestError } = await supabase
        .from('engine_test_week_templates')
        .select('*')
        .order('day', { ascending: true })

      if (engineTestError) {
        console.error('❌ Failed to fetch Engine test week templates:', engineTestError.message)
      } else if (engineTests && engineTests.length > 0) {
        console.log(`⚡ Found ${engineTests.length} Engine test week templates`)
        engineTests.forEach((t: any) => {
          engineTestTemplates[t.day] = t
        })
      }

      const testWeekData: any = {
        week: testWeekNumber,
        isTestWeek: true,
        testWeekMessage: 'This is your test week! After completing each test, update your profile with your new results. Your next training cycle will be built using your updated numbers.',
        days: []
      }

      // Main lifts for each day (for context)
      const testDayMainLifts = ['Snatch', 'Back Squat', 'Press', 'Clean and Jerk', 'Front Squat']

      for (let dayNum = 1; dayNum <= 5; dayNum++) {
        const mainLift = testDayMainLifts[dayNum - 1]
        const dayTestLifts = testLiftsByDay[dayNum] || []

        const dayData: any = {
          day: dayNum,
          dayName: `TEST DAY ${dayNum}`,
          mainLift: mainLift,
          isTestWeek: true,
          isDeload: false,
          blocks: []
        }

        // SKILLS update block on Day 1
        if (dayNum === 1) {
          dayData.blocks.push({
            blockName: 'SKILLS',
            isTestBlock: true,
            isSkillsUpdate: true,
            exercises: [{
              name: 'Review & Update Skills',
              sets: '',
              reps: '',
              weightTime: '',
              notes: 'Update any skills you\'ve acquired or improved this cycle. These changes will be reflected in your next training cycle.',
              isSkillsUpdatePrompt: true
            }]
          })
          console.log(`  🎯 Test Day ${dayNum}: Skills update block added`)
        }

        // TECHNICAL WORK block (generated normally)
        const techResponse = await fetch(`${supabaseUrl}/functions/v1/assign-exercises`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user,
            block: 'TECHNICAL WORK',
            mainLift: mainLift,
            week: testWeekNumber,
            day: dayNum,
            isDeload: false,
            numExercises: 2,
            weeklySkills: {},
            weeklyAccessories: {},
            previousDayAccessories: [],
            previousDaySkills: []
          })
        })

        if (techResponse.ok) {
          const techResult = await techResponse.json()
          const techExercises = Array.isArray(techResult.exercises) ? techResult.exercises : []
          dayData.blocks.push({
            blockName: 'TECHNICAL WORK',
            exercises: techExercises
          })
          totalExercises += techExercises.length
          console.log(`  📚 Test Day ${dayNum} Technical: ${techExercises.length} exercises`)
        }

        // STRENGTH AND POWER block (1RM tests - same as Applied Power)
        if (dayTestLifts.length > 0) {
          const strengthExercises = dayTestLifts.map((lift: any) => ({
            name: lift.lift_name,
            sets: 1,
            reps: 'Work up to 1RM',
            weightTime: '',
            notes: lift.notes || '',
            testType: lift.test_type,
            isTestLift: true
          }))

          dayData.blocks.push({
            blockName: 'STRENGTH AND POWER',
            isTestBlock: true,
            exercises: strengthExercises
          })
          totalExercises += strengthExercises.length
          console.log(`  🏋️ Test Day ${dayNum} Strength: ${strengthExercises.map((e: any) => e.name).join(', ')}`)
        }

        // ACCESSORIES block (generated normally)
        const accResponse = await fetch(`${supabaseUrl}/functions/v1/assign-exercises`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user,
            block: 'ACCESSORIES',
            mainLift: mainLift,
            week: testWeekNumber,
            day: dayNum,
            isDeload: false,
            numExercises: 3,
            weeklySkills: {},
            weeklyAccessories: {},
            previousDayAccessories: [],
            previousDaySkills: []
          })
        })

        if (accResponse.ok) {
          const accResult = await accResponse.json()
          const accExercises = Array.isArray(accResult.exercises) ? accResult.exercises : []
          dayData.blocks.push({
            blockName: 'ACCESSORIES',
            exercises: accExercises
          })
          totalExercises += accExercises.length
          console.log(`  💪 Test Day ${dayNum} Accessories: ${accExercises.length} exercises`)
        }

        // Add regular METCONS block for Competitor test week (not benchmarks)
        const metconResponse = await fetch(`${supabaseUrl}/functions/v1/assign-metcon`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user,
            week: testWeekNumber,
            day: dayNum
          })
        })

        if (metconResponse.ok) {
          try {
            const metconResult = await metconResponse.json()
            const metconExercises = Array.isArray(metconResult.exercises) ? metconResult.exercises : []

            dayData.blocks.push({
              blockName: 'METCONS',
              exercises: metconExercises
            })

            // Add MetCon metadata
            if (metconResult.workoutId) {
              dayData.metconData = {
                workoutId: metconResult.workoutId,
                workoutFormat: metconResult.workoutFormat,
                timeRange: metconResult.timeRange,
                percentileGuidance: metconResult.percentileGuidance,
                workoutNotes: metconResult.workoutNotes || ''
              }
            }

            totalExercises += metconExercises.length
            console.log(`  🏋️ Test Day ${dayNum} MetCon: ${metconResult.workoutId || 'assigned'}`)
          } catch (e) {
            console.error(`  ↳ Test week assign-metcon JSON parse error:`, e)
          }
        } else {
          console.error(`  ↳ Test week assign-metcon failed for day ${dayNum}`)
        }

        // Add Engine test block
        const engineTest = engineTestTemplates[dayNum]
        if (engineTest) {
          const dayType = engineTest.day_type || `Test ${dayNum}`

          dayData.blocks.push({
            blockName: 'ENGINE',
            isTestBlock: true,
            exercises: [{
              name: `Engine ${dayType}`,
              sets: 1,
              reps: '',
              weightTime: '',
              notes: `Test Week - ${dayType}`,
              engineTestDay: dayNum
            }]
          })

          dayData.engineData = {
            workoutId: `test-${dayNum}`,
            dayNumber: dayNum,
            dayType: dayType,
            isTestWeek: true,
            blockCount: engineTest.block_count || 1,
            blockParams: {
              block1: engineTest.block_1_params,
              block2: engineTest.block_2_params,
              block3: engineTest.block_3_params,
              block4: engineTest.block_4_params
            }
          }

          totalExercises += 1
          console.log(`  ⚡ Engine Test ${dayNum}: ${dayType}`)
        }

        testWeekData.days.push(dayData)
        console.log(`  ✅ Test Day ${dayNum}: ${dayData.blocks.length} blocks, ${dayData.blocks.reduce((sum: number, b: any) => sum + b.exercises.length, 0)} exercises`)
      }

      weeks.push(testWeekData)
      console.log(`🧪 ✅ Competitor Test Week ${testWeekNumber} complete`)
    } else if (programType === 'engine') {
      // Engine-only test week: just Engine tests
      console.log('⚡ Generating Engine-only test week...')

      const { data: engineTests, error: engineTestError } = await supabase
        .from('engine_test_week_templates')
        .select('*')
        .order('day', { ascending: true })

      if (engineTestError) {
        console.error('❌ Failed to fetch Engine test week templates:', engineTestError.message)
      } else if (engineTests && engineTests.length > 0) {
        const testWeekData: any = {
          week: testWeekNumber,
          isTestWeek: true,
          testWeekMessage: 'This is your test week! Record your times for each test. These results help you track your conditioning progress over time.',
          days: []
        }

        for (let dayNum = 1; dayNum <= 5; dayNum++) {
          const engineTest = engineTests.find((t: any) => t.day === dayNum)

          const dayData: any = {
            day: dayNum,
            dayName: `TEST DAY ${dayNum}`,
            isTestWeek: true,
            blocks: []
          }

          if (engineTest) {
            const dayType = engineTest.day_type || `Test ${dayNum}`

            dayData.blocks.push({
              blockName: 'ENGINE',
              isTestBlock: true,
              exercises: [{
                name: `Engine ${dayType}`,
                sets: 1,
                reps: '',
                weightTime: '',
                notes: `Test Week - ${dayType}`,
                engineTestDay: dayNum
              }]
            })

            dayData.engineData = {
              workoutId: `test-${dayNum}`,
              dayNumber: dayNum,
              dayType: dayType,
              isTestWeek: true,
              blockCount: engineTest.block_count || 1,
              blockParams: {
                block1: engineTest.block_1_params,
                block2: engineTest.block_2_params,
                block3: engineTest.block_3_params,
                block4: engineTest.block_4_params
              }
            }

            totalExercises += 1
            console.log(`  ⚡ Engine Test ${dayNum}: ${dayType}`)
          }

          testWeekData.days.push(dayData)
        }

        weeks.push(testWeekData)
        console.log(`🧪 ✅ Engine Test Week ${testWeekNumber} complete`)
      }
    }
  }

  console.log(`🎉 Program structure complete: ${weeks.length} weeks, ${totalExercises} total exercises`)

  return {
    weeks: weeks,
    totalExercises: totalExercises
  }
}

// === HELPER FUNCTIONS (Exact Google Script Logic) ===
function getNumExercisesForBlock(block: string, mainLift: string, ratios: any, prefs?: any, isDeload?: boolean): number {
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
      // Deload weeks should not add extra volume
      if (isDeload) return 1
      // Emphasized lifts get an extra variation on the day they appear (non-deload only)
      if (prefs?.emphasizedStrengthLifts && prefs.emphasizedStrengthLifts.includes(mainLift)) {
        return 2
      }
      return 1
    case 'ACCESSORIES':
      return 2
    default:
      return 2
  }
}

// Choose a main lift for the day that the user has equipment for
function getEquipmentGatedMainLift(rotation: string[], dayIndex: number, equipment: string[]): string {
  const required: Record<string, (eq: string[]) => boolean> = {
    'Snatch': (eq) => eq.includes('Barbell'),
    'Clean and Jerk': (eq) => eq.includes('Barbell'),
    'Back Squat': (eq) => eq.includes('Barbell'),
    'Front Squat': (eq) => eq.includes('Barbell'),
    'Press': (eq) => eq.includes('Barbell') || eq.includes('Dumbbells')
  }

  const tryOrder = [rotation[dayIndex % rotation.length], ...rotation]
  for (const lift of tryOrder) {
    const gate = required[lift]
    if (!gate || gate(equipment)) return lift
  }
  // Fallback to first in rotation if none match
  return rotation[dayIndex % rotation.length]
}
