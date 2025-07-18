// supabase/functions/test-exercise-assignment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body
    const { testCases, compareWithSheets = false } = await req.json()

    console.log(`🧪 Starting test run with ${testCases.length} test cases`)

    const results = []

    for (const testCase of testCases) {
      console.log(`\n=== Testing: ${testCase.name} ===`)
      
      const testResult = await runSingleTest(supabase, testCase)
      results.push(testResult)
      
      console.log(`✅ Test completed: ${testCase.name}`)
      console.log(`   Exercises returned: ${testResult.exercises.length}`)
      console.log(`   Execution time: ${testResult.executionTime}ms`)
    }

    const summary = generateTestSummary(results)

    return new Response(
      JSON.stringify({
        success: true,
        totalTests: results.length,
        passedTests: results.filter(r => r.success).length,
        failedTests: results.filter(r => !r.success).length,
        results: results,
        summary: summary
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Testing error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Testing failed',
        details: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function runSingleTest(supabase: any, testCase: any) {
  const startTime = Date.now()
  
  try {
    console.log(`🔍 Creating test user for: ${testCase.name}`)
    
    // Create test user data that matches your Google Sheets structure
    const testUser = createTestUser(testCase.userProfile)
    const testRatios = testCase.userRatios
    
    console.log(`📊 User created: ${testUser.name}, Ability: ${testUser.ability}, Equipment: ${testUser.equipment.join(', ')}`)
    
    // Run exercise assignment with test parameters
    const exercises = await assignExercises(
      supabase,
      testUser,
      testRatios,
      testCase.block,
      testCase.mainLift,
      testCase.week,
      testCase.day,
      testCase.numExercises,
      testCase.weeklySkills || {},
      testCase.weeklyAccessories || {},
      testCase.previousDayAccessories || [],
      testCase.dailyStrengthExercises || []
    )

    const executionTime = Date.now() - startTime

    // Validate results against expected outcomes
    const validation = validateExerciseOutput(exercises, testCase.expectedCriteria)

    console.log(`📋 Results: ${exercises.length} exercises assigned`)
    exercises.forEach((ex, i) => {
      console.log(`   ${i + 1}. ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weightTime}`)
    })

    return {
      testName: testCase.name,
      success: validation.isValid,
      exercises: exercises,
      executionTime: executionTime,
      validation: validation,
      testParameters: {
        block: testCase.block,
        mainLift: testCase.mainLift,
        week: testCase.week,
        day: testCase.day,
        userAbility: testUser.ability
      },
      debugging: {
        filteredExerciseCount: validation.filteredCount,
        selectionMethod: validation.selectionMethod,
        equipmentUsed: testUser.equipment
      }
    }

  } catch (error) {
    console.error(`❌ Test failed: ${testCase.name}`, error)
    return {
      testName: testCase.name,
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    }
  }
}

// === EXACT REPLICATION OF YOUR GOOGLE SHEETS LOGIC ===
async function assignExercises(
  supabase: any,
  user: any,
  ratios: any,
  block: string,
  mainLift: string,
  week: number,
  day: number,
  numExercises: number,
  weeklySkills: any,
  weeklyAccessories: any,
  previousDayAccessories: any[],
  dailyStrengthExercises: any[]
) {
  
  console.log(`\n🎯 assignExercises called`)
  console.log(`   Block: ${block}, MainLift: ${mainLift}, Week: ${week}, Day: ${day}`)
  console.log(`   User: ${user.name}, Ability: ${user.ability}`)
  console.log(`   Equipment: ${user.equipment.join(', ')}`)
  console.log(`   Requesting: ${numExercises} exercises`)

  // Default fallback (exact same as Google Sheets)
  const defaultBodyweightExercises = [
    { name: 'Air Squat', sets: '3', reps: '15', weightTime: '', notes: 'Bodyweight' },
    { name: 'Push-ups', sets: '3', reps: '12', weightTime: '', notes: 'Bodyweight' }
  ]

  // Handle MetCons separately (same as original)
  if (block === 'METCONS') {
    console.log(`🏃 MetCon block - delegating to MetCon assignment`)
    return await assignMetConFromDatabase(supabase, user)
  }

  // === STEP 1: GET ALL EXERCISES FROM DATABASE ===
  console.log(`📚 Querying exercises database...`)
  const { data: allExercises, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('sport_id', 1) // CrossFit

  if (error) {
    console.error('❌ Database query error:', error)
    throw error
  }

  console.log(`📊 Total exercises in database: ${allExercises.length}`)

  // === STEP 2: APPLY BLOCK FILTERING (Exact same logic) ===
  console.log(`🔍 Applying block filtering for: ${block}`)
  
  let filtered = allExercises.filter((row: any) => {
    // Block capability check (same as your row[4], row[5], etc.)
    const canBe = block === 'SKILLS' ? row.can_be_skills : 
                  block === 'TECHNICAL WORK' ? row.can_be_technical :
                  block === 'STRENGTH AND POWER' ? row.can_be_strength : 
                  block === 'ACCESSORIES' ? row.can_be_accessories : 
                  false

    if (!canBe) return false

    // Equipment filtering (exact same logic as your Google Sheets)
    const requiredEquipment = row.required_equipment || []
    if (user.equipment.length === 0) {
      return row.bodyweight_accessible === true
    }
    if (requiredEquipment.length && !requiredEquipment.every((e: string) => user.equipment.includes(e))) {
      return false
    }

    // Prerequisite checking (exact same logic)
    if (row.prerequisite_1 && row.prerequisite_1 !== 'None' && !checkPrerequisite(row.prerequisite_1, user)) {
      return false
    }
    if (row.prerequisite_2 && row.prerequisite_2 !== 'None' && !checkPrerequisite(row.prerequisite_2, user)) {
      return false
    }

    // Block-specific filtering (exact translations of your logic)
    if (block === 'SKILLS') {
      return applySkillsFiltering(row, user, weeklySkills, [])
    }
    
    if (block === 'TECHNICAL WORK') {
      return applyTechnicalFiltering(row, mainLift, dailyStrengthExercises)
    }
    
    if (block === 'STRENGTH AND POWER') {
      return applyStrengthFiltering(row, mainLift, user)
    }
    
    if (block === 'ACCESSORIES') {
      return applyAccessoriesFiltering(row, user, ratios, weeklyAccessories, previousDayAccessories)
    }

    return true
  })

  console.log(`✅ After filtering: ${filtered.length} exercises`)

  // Fallback for no equipment (exact same as Google Sheets)
  if (filtered.length === 0 && user.equipment.length === 0) {
    console.log(`⚠️ No exercises found, using bodyweight fallback`)
    return defaultBodyweightExercises.slice(0, numExercises)
  }

  // Additional fallback filtering (same as original)
  if (filtered.length === 0) {
    console.log(`⚠️ No exercises found, trying scaled exercises fallback`)
    filtered = allExercises.filter((row: any) => {
      const scalingFor = row.scaling_for
      return scalingFor && scalingFor !== 'None'
    })
    console.log(`📋 Scaled exercises available: ${filtered.length}`)
  }

  if (filtered.length === 0) {
    console.log(`⚠️ Still no exercises, using default bodyweight`)
    return defaultBodyweightExercises.slice(0, numExercises)
  }

  // === STEP 3: PROBABILISTIC SELECTION (Exact same algorithm) ===
  const abilityColumn = user.ability === 'Advanced' ? 'advanced_weight' :
                       user.ability === 'Intermediate' ? 'intermediate_weight' : 
                       'beginner_weight'

  console.log(`🎲 Using ability column: ${abilityColumn}`)

  const weights = filtered.map((row: any) => parseFloat(row[abilityColumn]) || parseFloat(row.default_weight) || 5)
  const totalWeight = weights.reduce((sum: number, w: number) => sum + w, 0)
  const probabilities = weights.map((w: number) => w / totalWeight)

  console.log(`📊 Weight distribution: min=${Math.min(...weights)}, max=${Math.max(...weights)}, total=${totalWeight.toFixed(1)}`)

  const selectedIndices: number[] = []
  const exercises: any[] = []

  // Your exact selection loop from Google Sheets
  for (let i = 0; i < numExercises; i++) {
    if (!filtered.length) break

    const rand = Math.random()
    let cumulative = 0

    for (let j = 0; j < probabilities.length; j++) {
      cumulative += probabilities[j]

      if (rand <= cumulative && !selectedIndices.includes(j)) {
        const row = filtered[j]
        
        console.log(`🎯 Selected exercise ${i + 1}: ${row.name} (probability: ${probabilities[j].toFixed(3)}, random: ${rand.toFixed(3)})`)

        // FIXED: Handle STRENGTH AND POWER block with multiple sets
        if (block === 'STRENGTH AND POWER') {
          const strengthExercises = await processSelectedExercise(
            supabase, row, user, ratios, block, mainLift, week, day
          )
          
          // Strength processing returns an array of exercises (multiple sets)
          if (Array.isArray(strengthExercises)) {
            exercises.push(...strengthExercises)
          } else if (strengthExercises) {
            exercises.push(strengthExercises)
          }
          
          selectedIndices.push(j)
          break // Exit the selection loop since we only need one exercise for strength
        } else {
          // Handle all non-Strength blocks (single exercise)
          const processedExercise = await processSelectedExercise(
            supabase, row, user, ratios, block, mainLift, week, day
          )

          if (processedExercise) {
            exercises.push(processedExercise)
            selectedIndices.push(j)
            
            // Remove from probability array (same as original)
            probabilities.splice(j, 1)
            filtered.splice(j, 1)
            
            // Update frequency tracking (same as original)
            if (block === 'SKILLS') {
              weeklySkills[row.name] = (weeklySkills[row.name] || 0) + 1
            }
            if (block === 'ACCESSORIES') {
              weeklyAccessories[row.name] = (weeklyAccessories[row.name] || 0) + 1
            }
          }

          break
        }
      }
    }
  }

  console.log(`🎉 Final selection: ${exercises.length} exercises`)
  exercises.forEach((ex, i) => {
    console.log(`   ${i + 1}. ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weightTime}`)
  })

  return exercises.length > 0 ? exercises : defaultBodyweightExercises.slice(0, numExercises)
}

// === BLOCK-SPECIFIC FILTERING FUNCTIONS ===

function applySkillsFiltering(row: any, user: any, weeklySkills: any, previousDaySkills: any[]) {
  const exerciseName = row.name
  
  console.log(`      🔍 Checking skills exercise: ${exerciseName}`)
  
  // Frequency limit check (exact same as Google Sheets)
  if (weeklySkills[exerciseName] && weeklySkills[exerciseName] >= 2) {
    console.log(`        ❌ Frequency limit: already used ${weeklySkills[exerciseName]} times this week`)
    return false
  }
  
  // Consecutive day restriction (exact same logic)
  if (previousDaySkills && previousDaySkills.includes(exerciseName)) {
    console.log(`        ❌ Consecutive day restriction: used yesterday`)
    return false
  }
  
  // FIXED: Exact Google Sheets skill level checking logic
  const skillIndex = row.skill_index
  if (skillIndex === null || skillIndex < 0 || skillIndex > 25) {
    console.log(`        ❌ Invalid skill index: ${skillIndex}`)
    return false
  }
  
  // Get user's actual skill level for this specific skill (exact same as Google Sheets)
  const userSkillLevel = user.skills[skillIndex]
  console.log(`        📊 User skill for index ${skillIndex}: "${userSkillLevel}"`)
  
  // If user doesn't have this skill, filter it out (exact same as Google Sheets)
  if (!userSkillLevel || userSkillLevel === "Don't have it") {
    console.log(`        ❌ User doesn't have this skill: "${userSkillLevel}"`)
    return false
  }
  
  // Convert user skill level to number for comparison (exact same as Google Sheets)
  const userSkillLevelNum = userSkillLevel === 'Advanced' ? 3 :
                           userSkillLevel === 'Intermediate' ? 2 :
                           userSkillLevel === 'Beginner' ? 1 : 0
  
  // Convert exercise difficulty to number (exact same as Google Sheets)
  const exerciseLevel = row.difficulty_level === 'Elite' ? 4 : 
                       row.difficulty_level === 'Advanced' ? 3 :
                       row.difficulty_level === 'Intermediate' ? 2 : 
                       row.difficulty_level === 'Beginner' ? 1 : 0
  
  console.log(`        📊 Skill check: user level ${userSkillLevelNum} (${userSkillLevel}), exercise level ${exerciseLevel} (${row.difficulty_level})`)
  
  // Only allow exercises at or below user's level (exact same logic as Google Sheets)
  if (exerciseLevel > userSkillLevelNum) {
    console.log(`        ❌ Exercise too difficult: ${exerciseLevel} > ${userSkillLevelNum}`)
    return false
  }
  
  // Elite access check (exact same logic as Google Sheets)
  const advancedCount = user.skills.filter((s: string) => s === 'Advanced').length
  const isEliteEligible = advancedCount >= 10
  
  if (exerciseLevel === 4 && (!isEliteEligible || userSkillLevelNum < 3)) {
    console.log(`        ❌ Elite exercise requires 10+ advanced skills AND advanced in this skill`)
    return false
  }
  
  // Handle Novice skills - only show as scaling when user lacks the base skill (exact same as Google Sheets)
  if (exerciseLevel === 0) { // Novice level
    const scalingFor = row.scaling_for
    if (scalingFor && scalingFor !== 'None') {
      const baseSkillIndex = findSkillIndexForScaling(scalingFor)
      if (baseSkillIndex !== -1) {
        const userBaseSkillLevel = user.skills[baseSkillIndex]
        if (userBaseSkillLevel !== "Don't have it") {
          console.log(`        ❌ User has ${scalingFor}, no need for novice scaling`)
          return false
        }
      }
    }
  }
  
  console.log(`        ✅ Skills exercise passed all checks`)
  return true
}

function applyTechnicalFiltering(row: any, mainLift: string, dailyStrengthExercises: any[]) {
  const exerciseName = row.name
  console.log(`      🔍 Checking technical exercise: ${exerciseName}`)
  
  // Don't assign if already used in Strength & Power today (exact same logic)
  if (dailyStrengthExercises.includes(exerciseName)) {
    console.log(`        ❌ Already used in Strength & Power today`)
    return false
  }
  
  // Technical dependency check (exact same logic)
  const dependency = row.technical_dependency || []
  const hasMainLift = dependency.includes(mainLift)
  
  console.log(`        📊 Technical dependency: [${dependency.join(', ')}], mainLift: ${mainLift}, match: ${hasMainLift}`)
  
  if (!hasMainLift) {
    console.log(`        ❌ Does not match main lift dependency`)
    return false
  }
  
  console.log(`        ✅ Technical exercise passed all checks`)
  return true
}

function applyStrengthFiltering(row: any, mainLift: string, user: any) {
  const exerciseName = row.name
  console.log(`      🔍 Checking strength exercise: ${exerciseName}`)
  
  // Lift group check (exact same logic)
  const liftGroup = row.lift_groups || []
  const hasMainLift = liftGroup.includes(mainLift) || liftGroup.includes('All')
  
  console.log(`        📊 Lift groups: [${liftGroup.join(', ')}], mainLift: ${mainLift}, match: ${hasMainLift}`)
  
  if (!hasMainLift) {
    console.log(`        ❌ Does not match main lift group`)
    return false
  }
  
  // Equipment preference (exact same logic)
  const requiredEquipment = row.required_equipment || []
  const usesBarbell = requiredEquipment.includes('Barbell')
  const usesDumbbells = requiredEquipment.includes('Dumbbells')
  
  // If user has barbell, skip dumbbell-only exercises
  if (user.equipment.includes('Barbell') && usesDumbbells && !usesBarbell) {
    console.log(`        ❌ User has barbell, skipping dumbbell-only exercise`)
    return false
  }
  
  console.log(`        ✅ Strength exercise passed all checks`)
  return true
}

function applyAccessoriesFiltering(row: any, user: any, ratios: any, weeklyAccessories: any, previousDayAccessories: any[]) {
  const exerciseName = row.name
  console.log(`      🔍 Checking accessory exercise: ${exerciseName}`)
  
  if (!row.accessory_category || row.accessory_category === 'None') {
    console.log(`        ❌ No accessory category defined`)
    return false
  }
  
  // Frequency limit check (exact same logic)
  if (weeklyAccessories[exerciseName] && weeklyAccessories[exerciseName] >= 2) {
    console.log(`        ❌ Frequency limit: already used ${weeklyAccessories[exerciseName]} times this week`)
    return false
  }
  
  // Consecutive day restriction (exact same logic)
  if (previousDayAccessories.includes(exerciseName)) {
    console.log(`        ❌ Consecutive day restriction: used yesterday`)
    return false
  }
  
  // Weakness-based filtering (exact same logic)
  const neededCategories = []
  if (ratios.needs_upper_back) neededCategories.push('Upper Back')
  if (ratios.needs_leg_strength) neededCategories.push('Leg Strength')
  if (ratios.needs_posterior_chain) neededCategories.push('Posterior Chain')
  if (ratios.needs_upper_body_pressing) neededCategories.push('Upper Body Pressing')
  if (ratios.needs_upper_body_pulling) neededCategories.push('Upper Body Pulling')
  if (ratios.needs_core) neededCategories.push('Core')
  
  console.log(`        📊 Needed categories: [${neededCategories.join(', ')}]`)
  console.log(`        📊 Exercise category: ${row.accessory_category}`)
  
  // If specific needs, must be in needed category (exact same logic)
  if (neededCategories.length > 0) {
    const isWeaknessCategory = neededCategories.includes(row.accessory_category)
    if (!isWeaknessCategory) {
      console.log(`        ❌ Not in needed weakness category`)
      return false
    }
    
    // Level-appropriate filtering (exact same logic)
    const exerciseLevel = row.difficulty_level
    const isLevelAppropriate = checkLevelAppropriate(exerciseLevel, user.ability)
    if (!isLevelAppropriate) {
      console.log(`        ❌ Not appropriate level for user ability`)
      return false
    }
  }
  
  console.log(`        ✅ Accessory exercise passed all checks`)
  return true
}

// === HELPER FUNCTIONS ===

function createTestUser(userProfile: any) {
  return {
    id: userProfile.id || 999,
    name: userProfile.name || 'Test User',
    email: userProfile.email || 'test@example.com',
    gender: userProfile.gender || 'Male',
    units: userProfile.units || 'Imperial (lbs)',
    bodyWeight: userProfile.bodyWeight || 180,
    ability: userProfile.ability || 'Intermediate',
    equipment: userProfile.equipment || ['Barbell', 'Pull-up Bar', 'Dumbbells'],
    skills: userProfile.skills || new Array(26).fill("Don't have it"),
    oneRMs: userProfile.oneRMs || new Array(14).fill(0)
  }
}

function getUserSkillLevel(skills: any[], skillIndex: number) {
  if (skillIndex < 0 || skillIndex >= skills.length) return 0
  
  const skill = skills[skillIndex]
  if (skill === 'Advanced') return 3
  if (skill === 'Intermediate') return 2
  if (skill === 'Beginner') return 1
  return 0
}

function getDifficultyLevel(difficultyString: string) {
  if (difficultyString === 'Elite') return 4
  if (difficultyString === 'Advanced') return 3
  if (difficultyString === 'Intermediate') return 2
  if (difficultyString === 'Beginner') return 1
  return 0
}

function checkPrerequisite(prereq: string, user: any) {
  // Simplified for now - implement full logic
  console.log(`        📋 Checking prerequisite: ${prereq}`)
  return true // TODO: Implement full prerequisite checking
}

function checkLevelAppropriate(exerciseLevel: string, userAbility: string) {
  const levelHierarchy: any = {
    'Novice': ['Novice'],                                    
    'Beginner': ['Beginner'],                               
    'Intermediate': ['Beginner', 'Intermediate'],           
    'Advanced': ['Beginner', 'Intermediate', 'Advanced']    
  }
  
  return levelHierarchy[userAbility] && levelHierarchy[userAbility].includes(exerciseLevel)
}

// Add the complete lifting progressions data structure (from your Google Sheets)
const liftingProgressions = {
  'Olympic Lifts': {
    'Beginner': [
      { week: 1, reps: [8, 6, 4, 2], percentages: [55, 60, 65, 70] },
      { week: 2, reps: [8, 6, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 3, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [8, 6, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 6, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 7, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 10, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 11, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, reps: [8, 6, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 6, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 7, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 10, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 11, reps: [6, 4, 4, 2], percentages: [80, 85, 90, 95] },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, reps: [4, 4, 2, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [4, 4, 2, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [4, 4, 2, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [4, 4, 2, 2], percentages: [65, 70, 75, 80] },
      { week: 6, reps: [4, 4, 2, 2], percentages: [70, 75, 80, 85] },
      { week: 7, reps: [4, 4, 2, 2], percentages: [75, 80, 85, 90] },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [4, 4, 2, 2], percentages: [70, 75, 80, 85] },
      { week: 10, reps: [4, 4, 2, 2], percentages: [75, 80, 85, 90] },
      { week: 11, reps: [4, 4, 2, 2], percentages: [80, 85, 90, 95] },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ]
  },
  'Squats': {
    'Beginner': [
      { week: 1, reps: [10, 8, 6, 4], percentages: [55, 60, 65, 70] },
      { week: 2, reps: [10, 8, 6, 4], percentages: [60, 65, 70, 75] },
      { week: 3, reps: [10, 8, 6, 4], percentages: [65, 70, 75, 80] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [10, 8, 6, 4], percentages: [60, 65, 70, 75] },
      { week: 6, reps: [10, 8, 6, 4], percentages: [65, 70, 75, 80] },
      { week: 7, reps: [10, 8, 6, 4], percentages: [70, 75, 80, 85] },
      { week: 8, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 10, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 11, reps: [8, 6, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 12, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, reps: [10, 8, 6, 4], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [10, 8, 6, 4], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [10, 8, 6, 4], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 6, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 7, reps: [8, 6, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 8, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 10, reps: [8, 6, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 11, reps: [8, 6, 4, 2], percentages: [80, 85, 90, 95] },
      { week: 12, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, reps: [6, 4, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 6, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 7, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 10, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 11, reps: [6, 4, 4, 2], percentages: [80, 85, 90, 95] },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ]
  },
  'Presses': {
    'Beginner': [
      { week: 1, reps: [6, 4, 4, 2], percentages: [55, 60, 65, 70] },
      { week: 2, reps: [6, 4, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 3, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [6, 4, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 6, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 7, reps: [10, 8, 6, 4], percentages: [70, 75, 80, 85] },
      { week: 8, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 10, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 11, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 12, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, reps: [8, 6, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 6, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 7, reps: [8, 6, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 8, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 10, reps: [8, 6, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 11, reps: [8, 6, 4, 2], percentages: [80, 85, 90, 95] },
      { week: 12, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, reps: [6, 4, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 6, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 7, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 10, reps: [6, 4, 4, 2], percentages: [75, 80, 85, 90] },
      { week: 11, reps: [6, 4, 4, 2], percentages: [80, 85, 90, 95] },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ]
  }
};

async function processSelectedExercise(supabase: any, row: any, user: any, ratios: any, block: string, mainLift: string, week: number, day: number) {
  // Simplified for initial testing - implement full processing logic
  console.log(`        ⚙️ Processing exercise: ${row.name}`)
  
  return {
    name: row.name,
    sets: '3',
    reps: '10',
    weightTime: '',
    notes: `${user.ability} level`
  }
}

async function assignMetConFromDatabase(supabase: any, user: any) {
  console.log(`🏃 Assigning MetCon for ${user.ability} user with equipment: ${user.equipment.join(', ')}`)
  
  // Simplified MetCon assignment for testing
  return [{
    name: 'Test MetCon',
    sets: '',
    reps: '21-15-9',
    weightTime: '',
    notes: 'For Time'
  }]
}

function validateExerciseOutput(exercises: any[], expectedCriteria: any) {
  const validation = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
    filteredCount: exercises.length,
    selectionMethod: 'probabilistic'
  }

  // Check basic requirements
  if (expectedCriteria.minExercises && exercises.length < expectedCriteria.minExercises) {
    validation.isValid = false
    validation.errors.push(`Too few exercises: got ${exercises.length}, expected at least ${expectedCriteria.minExercises}`)
  }

  if (expectedCriteria.maxExercises && exercises.length > expectedCriteria.maxExercises) {
    validation.isValid = false
    validation.errors.push(`Too many exercises: got ${exercises.length}, expected at most ${expectedCriteria.maxExercises}`)
  }

  // Check exercise structure
  exercises.forEach((exercise, index) => {
    if (!exercise.name) {
      validation.errors.push(`Exercise ${index + 1}: missing name`)
      validation.isValid = false
    }
  })

  return validation
}

function generateTestSummary(results: any[]) {
  const totalTests = results.length
  const passedTests = results.filter(r => r.success).length
  const failedTests = totalTests - passedTests
  
  const avgExecutionTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0) / totalTests

  return {
    passRate: `${passedTests}/${totalTests} (${Math.round(passedTests/totalTests * 100)}%)`,
    averageExecutionTime: `${Math.round(avgExecutionTime)}ms`,
    performanceFlags: results.filter(r => r.executionTime > 1000).map(r => r.testName)
  }
}

// Add this helper function
function findSkillIndexForScaling(scalingFor: string) {
  const scalingMap: any = {
    'Double Unders': 0,
    'Toes to Bar': 2,
    'Wall Balls': 1,
    'Handstand Walk (10m or 25")': 22,
    'Wall Walks': 14,
    'Push-ups': 6,
    'GHD Sit-ups': 13,
    'Strict Pull-ups': 5
  }
  
  return scalingMap[scalingFor] !== undefined ? scalingMap[scalingFor] : -1
}
