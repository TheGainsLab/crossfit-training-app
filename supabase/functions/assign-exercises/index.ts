import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Make Supabase env available across module (handler + helpers)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface AssignExercisesRequest {
  user: any  // User data object passed from generate-program
  block: string
  mainLift: string
  week: number
  day: number
  isDeload: boolean
  numExercises: number
  weeklySkills?: Record<string, number>
  weeklyAccessories?: Record<string, number>
  weeklyAccessoryCategories?: Record<string, number>
  previousDayAccessories?: string[]
  previousDaySkills?: string[]
  dailyStrengthExercises?: string[]
  usedStrengths?: string[]
  previousAccessoryCategoryDays?: string[][]
}

// Default bodyweight exercises fallback (exact from Google Script)
const defaultBodyweightExercises = [
  { name: 'Air Squat', sets: 3, reps: 15, weightTime: '', notes: 'Bodyweight' },
  { name: 'Push-ups', sets: 3, reps: 12, weightTime: '', notes: 'Bodyweight' }
]

// Lifting progression percentages (exact from Google Script)
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const {
      user,
      block,
      mainLift,
      week,
      day,
      isDeload,
      numExercises,
      weeklySkills = {},
      weeklyAccessories = {},
      weeklyAccessoryCategories = {},
      previousDayAccessories = [],
      previousDaySkills = [],
      dailyStrengthExercises = [],
      usedStrengths = [],
      previousAccessoryCategoryDays = [],
      userPreferences: userPreferencesParam = null
    }: AssignExercisesRequest = await req.json()

    console.log(`🏗️ Assigning exercises: ${block} for ${user.name}, Week ${week}, Day ${day}`)

    // Use userPreferences from request if provided, otherwise fetch (optional)
    let userPreferences: any = userPreferencesParam
    if (!userPreferences) {
      try {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('three_month_goals, monthly_primary_goal, preferred_metcon_exercises, avoided_exercises')
          .eq('user_id', user.id || user.userProfile?.id)
          .single()
        userPreferences = prefs || null
      } catch (_) {}
    }

    // Get exercises from database
    const { data: exerciseData, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('sport_id', 1) // CrossFit

    if (error) {
      console.error('Database error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    if (!exerciseData || exerciseData.length === 0) {
      console.log('No exercises found, using bodyweight fallback')
      return new Response(
        JSON.stringify({
          success: true,
          exercises: defaultBodyweightExercises.slice(0, numExercises)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call the main assignment function
    const exercises = await assignExercises(
      exerciseData,
      user,
      block,
      mainLift,
      week,
      day,
      isDeload,
      numExercises,
      weeklySkills,
      weeklyAccessories,
      weeklyAccessoryCategories,
      previousDayAccessories,
      previousDaySkills,
      dailyStrengthExercises,
      usedStrengths,
      previousAccessoryCategoryDays,
      userPreferences,
      supabase
    )

    return new Response(
      JSON.stringify({ success: true, exercises }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Assignment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// === MAIN ASSIGNMENT FUNCTION (Exact Google Script Logic) ===
async function assignExercises(
  exerciseData: any[],
  user: any,
  block: string,
  mainLift: string,
  week: number,
  day: number,
  isDeload: boolean,
  numExercises: number,
  weeklySkills: Record<string, number>,
  weeklyAccessories: Record<string, number>,
  weeklyAccessoryCategories: Record<string, number>,
  previousDayAccessories: string[],
  previousDaySkills: string[],
  dailyStrengthExercises: string[],
  usedStrengths: string[],
  previousAccessoryCategoryDays: string[][],
  userPreferences: any,
  supabase: any
) {
  console.log(`🏗️ Starting exercise assignment for ${block}`)

  // For MetCons, call separate MetCon assignment (this should be handled by assign-metcon function)
  if (block === 'METCONS') {
    console.log('MetCon block - should be handled by assign-metcon function')
    return []
  }

  // STRENGTH AND POWER - FIXED VERSION (Process separately from general filtering)
  if (block === 'STRENGTH AND POWER') {
    console.log('💪 Processing STRENGTH block for:', mainLift)

    // Find strength exercises for this main lift
    const strengthExercises = exerciseData.filter(exercise => {
      if (!exercise.can_be_strength) return false

      const liftGroups = exercise.lift_groups || []
      
      // Family mapping for lift groups (same as Technical Work)
      const pressFamily = ['Strict Press', 'Push Press', 'Press', 'Bench Press']
      const squatFamily = ['Back Squat', 'Front Squat', 'Squat']
      const olyFamily = ['Snatch', 'Clean and Jerk', 'Clean', 'Jerk']
      const deadliftFamily = ['Deadlift']

      // Check exact match first
      let hasMainLift = liftGroups.includes(mainLift) || liftGroups.includes('All')

      // If no exact match, check family matches - but NOT for Olympic lifts (they must be exact)
      if (!hasMainLift) {
        if (olyFamily.includes(mainLift)) {
          // Olympic lifts are distinct - don't use family matching
          // Keep hasMainLift = false (will return false below)
        } else if (pressFamily.includes(mainLift)) {
          hasMainLift = liftGroups.some((group: string) => pressFamily.includes(group))
        } else if (squatFamily.includes(mainLift)) {
          hasMainLift = liftGroups.some((group: string) => squatFamily.includes(group))
        } else if (deadliftFamily.includes(mainLift)) {
          hasMainLift = liftGroups.some((group: string) => deadliftFamily.includes(group))
        }
      }

      if (!hasMainLift) return false

      // Equipment filtering
      const requiredEquipment = exercise.required_equipment || []
      if (user.equipment.length === 0) {
        return exercise.bodyweight_accessible === true
      }
      if (requiredEquipment.length && !requiredEquipment.every((eq: string) => user.equipment.includes(eq))) {
        return false
      }

      // Prefer barbell over dumbbells
      const usesBarbell = requiredEquipment.includes('Barbell')
      const usesDumbbells = requiredEquipment.includes('Dumbbells')
      if (user.equipment.includes('Barbell') && usesDumbbells && !usesBarbell) {
        return false
      }

      return true
    })

    if (strengthExercises.length === 0) {
      console.log('❌ No strength exercises found for:', mainLift, '- generating synthetic main-lift sets')

      // Use progression based on mainLift type/level to synthesize sets for the main lift itself
      const liftType = ['Snatch', 'Clean and Jerk'].includes(mainLift) ? 'Olympic Lifts' :
        ['Back Squat', 'Front Squat'].includes(mainLift) ? 'Squats' : 'Presses'

      const liftLevel = mainLift === 'Snatch' ? (user.snatch_level || 'Beginner') :
        mainLift === 'Clean and Jerk' ? (user.clean_jerk_level || 'Beginner') :
        ['Back Squat', 'Front Squat'].includes(mainLift) ? (user.back_squat_level || 'Beginner') :
        (user.press_level || 'Beginner')

      const progression = liftingProgressions[liftType][liftLevel].find(p => p.week === week)

      if (!progression) {
        console.log('❌ No progression data for week in synthetic path:', week)
        // As an absolute last resort, return a single BW placeholder to avoid empty array
        // Try to find exercise in database to get performance cues
        const syntheticExercise = exerciseData.find(ex => ex.name === mainLift)
        const syntheticCue = syntheticExercise ? getPerformanceCue(syntheticExercise) : null
        const syntheticNotes = syntheticCue || `${liftLevel} - Synthetic`
        return [{ name: mainLift, sets: 1, reps: 5, weightTime: '', notes: syntheticNotes }]
      }

      const oneRMIndex = find1RMIndex(mainLift)
      const oneRM = user.oneRMs && user.oneRMs[oneRMIndex]

      const strengthSets = []
      for (let setIndex = 0; setIndex < progression.reps.length; setIndex++) {
        let weightTime = ''
        if (oneRM && oneRM > 0) {
          const percent = progression.percentages[setIndex] / 100
          const rawWeight = oneRM * percent
          const roundedWeight = roundWeight(rawWeight, user.units)
          weightTime = roundedWeight.toString()
          console.log(`💪 (synthetic) Set ${setIndex + 1}: ${progression.reps[setIndex]} reps @ ${weightTime} (${progression.percentages[setIndex]}% of ${oneRM})`)
        }
        // Try to find exercise in database to get performance cues
        const syntheticExercise = exerciseData.find(ex => ex.name === mainLift)
        const performanceCue = syntheticExercise ? getPerformanceCue(syntheticExercise) : null
        const notesText = performanceCue || liftLevel
        
        strengthSets.push({
          name: mainLift,
          sets: 1,
          reps: progression.reps[setIndex],
          weightTime: weightTime,
          notes: `${notesText} - Set ${setIndex + 1}`
        })
      }

      console.log(`✅ (synthetic) Created ${strengthSets.length} strength sets for ${mainLift}`)
      return strengthSets
    }

    // Filter out weekly-used strength names to avoid repeats
    const usedSet = new Set(Array.isArray(usedStrengths) ? usedStrengths : [])

    // Prioritize exact match: find exercises where the name OR lift_groups exactly matches mainLift
    const exactMatches = strengthExercises.filter(ex => 
      !usedSet.has(ex.name) && 
      (ex.name === mainLift || (ex.lift_groups || []).includes(mainLift))
    )

    // Use exact match if available, otherwise fall back to first available (which might be a family match)
    const candidate = exactMatches[0] || strengthExercises.find(ex => !usedSet.has(ex.name)) || strengthExercises[0]
    const selectedExercise = candidate
    console.log('✅ Selected strength exercise:', selectedExercise.name)

    // Get progression data
    const liftType = ['Snatch', 'Clean and Jerk'].includes(mainLift) ? 'Olympic Lifts' :
      ['Back Squat', 'Front Squat'].includes(mainLift) ? 'Squats' : 'Presses'

    const liftLevel = mainLift === 'Snatch' ? (user.snatch_level || 'Beginner') :
      mainLift === 'Clean and Jerk' ? (user.clean_jerk_level || 'Beginner') :
      ['Back Squat', 'Front Squat'].includes(mainLift) ? (user.back_squat_level || 'Beginner') :
      (user.press_level || 'Beginner')

    console.log('💪 Using progression:', { liftType, liftLevel, week })

    const progression = liftingProgressions[liftType][liftLevel].find(p => p.week === week)

    if (!progression) {
      console.log('❌ No progression data for week:', week)
      return defaultBodyweightExercises.slice(0, 1)
    }

    // CREATE 4 SETS WITH PROGRESSIONS
    const strengthSets = []

    for (let setIndex = 0; setIndex < progression.reps.length; setIndex++) {
      let weightTime = ''

      // Calculate weight from 1RM if available
      if (selectedExercise.one_rm_reference && selectedExercise.one_rm_reference !== 'None') {
        const oneRMIndex = find1RMIndex(selectedExercise.one_rm_reference)
        const oneRM = user.oneRMs && user.oneRMs[oneRMIndex]

        if (oneRM && oneRM > 0) {
          const percent = progression.percentages[setIndex] / 100
          const rawWeight = oneRM * percent
          const roundedWeight = roundWeight(rawWeight, user.units)
          weightTime = roundedWeight.toString()
          console.log(`💪 Set ${setIndex + 1}: ${progression.reps[setIndex]} reps @ ${weightTime} (${progression.percentages[setIndex]}% of ${oneRM})`)
        }
      }

      // Debug: Check if performance_cues exists
      console.log('🔍 Debug selectedExercise:', {
        name: selectedExercise.name,
        hasPerformanceCues: !!selectedExercise.performance_cues,
        performanceCues: selectedExercise.performance_cues,
        performanceCuesType: typeof selectedExercise.performance_cues,
        performanceCuesLength: Array.isArray(selectedExercise.performance_cues) ? selectedExercise.performance_cues.length : 'not array'
      })

      // Get performance cue from database, fallback to liftLevel
      const enhancedNote = generateEnhancedNotes(
        null, // exerciseData not used
        user,
        week,
        block,
        selectedExercise // exerciseRow - this is what's actually used
      )
      
      console.log('🔍 Debug performance cue retrieval:', {
        enhancedNote,
        liftLevel,
        finalNotesText: enhancedNote || liftLevel
      })

      const notesText = enhancedNote || liftLevel
      
      strengthSets.push({
        name: selectedExercise.name,
        sets: 1, // Each row is one set
        reps: progression.reps[setIndex],
        weightTime: weightTime,
        notes: `${notesText} - Set ${setIndex + 1}`
      })
    }

    console.log(`✅ Created ${strengthSets.length} strength sets`)
    return strengthSets
  }

  // Apply filtering logic (exact from Google Script)
  if (block === 'SKILLS') {
    console.log('🎯 Processing SKILLS block...')
    console.log(`📊 Previous day skills: [${previousDaySkills.join(', ')}]`)
    console.log(`📊 User ability: ${user.ability}`)
    console.log(`📊 User skills array length: ${user.skills?.length || 0}`)
  }

  let filtered = exerciseData.filter(exercise => {
    // Check if exercise can be used for this block
    const canBe = block === 'SKILLS' ? exercise.can_be_skills :
      block === 'TECHNICAL WORK' ? exercise.can_be_technical :
      block === 'STRENGTH AND POWER' ? exercise.can_be_strength :
      block === 'ACCESSORIES' ? exercise.can_be_accessories : false

    if (!canBe) {
      if (block === 'SKILLS') {
        // Only log if it's a skills exercise that failed can_be check
        if (exercise.can_be_skills) {
          console.log(`  ❌ ${exercise.name}: can_be_skills is false`)
        }
      }
      return false
    }

    // Equipment filtering (exact logic from Google Script)
    const requiredEquipment = exercise.required_equipment || []
    if (user.equipment.length === 0) {
      return exercise.bodyweight_accessible === true
    }
    if (requiredEquipment.length && !requiredEquipment.every((eq: string) => user.equipment.includes(eq))) {
      return false
    }

    // Prerequisite checking (exact logic from Google Script)
    if (exercise.prerequisite_1 && exercise.prerequisite_1 !== 'None' && !checkPrerequisite(exercise.prerequisite_1, user)) {
      return false
    }
    if (exercise.prerequisite_2 && exercise.prerequisite_2 !== 'None' && !checkPrerequisite(exercise.prerequisite_2, user)) {
      return false
    }


    // SKILLS block specific filtering (keep no-consecutive-days; remove weekly cap)
    if (block === 'SKILLS') {
      const exerciseName = exercise.name

      // Check consecutive day restriction for skills
      if (previousDaySkills.includes(exerciseName)) {
        console.log(`  ❌ ${exerciseName}: Filtered out - appeared on previous day`)
        return false
      }

      // Determine user's level for THIS skill; if index invalid, fall back to overall ability
      const skillIndex = exercise.skill_index
      
      // NEW: Check if skill_index was used yesterday (prevents related exercises on consecutive days)
      if (skillIndex !== null && skillIndex !== undefined && skillIndex >= 0 && skillIndex <= 25) {
        // Get skill_index values from previous day's exercises
        const previousDaySkillIndices = new Set(
          previousDaySkills
            .map(name => {
              const prevEx = exerciseData.find(e => e.name === name)
              return prevEx?.skill_index
            })
            .filter(idx => idx !== null && idx !== undefined && idx >= 0 && idx <= 25)
        )
        
        if (previousDaySkillIndices.has(skillIndex)) {
          console.log(`  ❌ ${exerciseName}: Filtered out - skill_index ${skillIndex} was used on previous day`)
          return false
        }
      }
      const abilityLevel = user.ability === 'Advanced' ? 3 : user.ability === 'Intermediate' ? 2 : 1
      const userSkillLevel = (skillIndex !== null && skillIndex !== undefined && skillIndex >= 0 && skillIndex <= 25)
        ? (user.skills[skillIndex]?.includes('Advanced') ? 3 : user.skills[skillIndex]?.includes('Intermediate') ? 2 : user.skills[skillIndex]?.includes('Beginner') ? 1 : 0)
        : abilityLevel

      const exerciseLevel = exercise.difficulty_level === 'Elite' ? 4 :
        exercise.difficulty_level === 'Advanced' ? 3 :
        exercise.difficulty_level === 'Intermediate' ? 2 :
        exercise.difficulty_level === 'Beginner' ? 1 : 0

      console.log(`  🔍 Checking ${exerciseName}:`)
      console.log(`     - skill_index: ${skillIndex}, difficulty_level: ${exercise.difficulty_level}`)
      console.log(`     - userSkillLevel: ${userSkillLevel} (from ${skillIndex !== null && skillIndex !== undefined && skillIndex >= 0 && skillIndex <= 25 ? `skills[${skillIndex}]=${user.skills[skillIndex]}` : `ability=${user.ability}`})`)
      console.log(`     - exerciseLevel: ${exerciseLevel}`)

      // Only allow exercises at or below the user's level
      if (exerciseLevel > userSkillLevel) {
        console.log(`     ❌ Filtered out - exerciseLevel (${exerciseLevel}) > userSkillLevel (${userSkillLevel})`)
        return false
      }

      // Elite exercises are no longer hard-gated; rely on level gating and other guards

      // Handle Novice skills - filter out if user has the skill
      if (exerciseLevel === 0) { // Novice level
        // First check: If exercise has a skill_index and user has that skill, filter out
        if (skillIndex !== null && skillIndex !== undefined && skillIndex >= 0 && skillIndex <= 25) {
          const userSkillLevel = user.skills[skillIndex]
          if (userSkillLevel && userSkillLevel !== "Don't have it") {
            console.log(`     ❌ Filtered out - user has skill at index ${skillIndex} (${userSkillLevel}), Novice scaling not needed`)
            return false
          }
        }
        
        // Second check: Check scaling_for (with proper parsing for JSON array format)
        const scalingFor = exercise.scaling_for
        if (scalingFor && scalingFor !== 'None') {
          // Parse JSON array format if needed (e.g., "{Push-ups}" or '["Push-ups"]')
          let cleanScalingFor = scalingFor
          if (scalingFor.startsWith('{') || scalingFor.startsWith('[')) {
            try {
              // Try to parse as JSON array/object
              const parsed = JSON.parse(scalingFor)
              cleanScalingFor = Array.isArray(parsed) ? parsed[0] : (typeof parsed === 'string' ? parsed : scalingFor)
            } catch {
              // If not valid JSON, try to extract from braces/brackets
              cleanScalingFor = scalingFor.replace(/[{}[\]"]/g, '').split(',')[0].trim()
            }
          }
          
          const baseSkillIndex = findSkillIndexForScaling(cleanScalingFor)
          if (baseSkillIndex !== -1) {
            const userBaseSkillLevel = user.skills[baseSkillIndex]
            console.log(`     - Novice exercise scaling for: ${cleanScalingFor} (skill_index: ${baseSkillIndex})`)
            console.log(`     - User base skill level: ${userBaseSkillLevel}`)
            if (userBaseSkillLevel !== "Don't have it") {
              console.log(`     ❌ Filtered out - user has base skill (${cleanScalingFor}), so Novice scaling not needed`)
              return false
            } else {
              console.log(`     ✅ Passed - user lacks base skill, Novice scaling is appropriate`)
            }
          } else {
            console.log(`     ⚠️ Could not find skill index for scaling_for: ${scalingFor} (cleaned: ${cleanScalingFor})`)
          }
        }
      }

      console.log(`     ✅ Passed all SKILLS filters`)
    }

    // TECHNICAL WORK block specific filtering (exact logic from Google Script)
    if (block === 'TECHNICAL WORK') {
      const dependencies = exercise.technical_dependency || []
      const exerciseName = exercise.name

      // Don't assign if already used in Strength & Power today
      if (Array.isArray(dailyStrengthExercises) && dailyStrengthExercises.includes(exerciseName)) {
        return false
      }

      // Exact dependency match first
      if (dependencies.includes(mainLift)) return true

      // Family fallback: Press/Squat mapping to tolerate naming variants
      // Olympic lifts require exact matches only (Snatch ≠ Clean, etc.)
      const pressFamily = ['Strict Press', 'Push Press', 'Press']
      const squatFamily = ['Back Squat', 'Front Squat', 'Squat']

      const inFamily = (fam: string[]) => fam.some(n => dependencies.includes(n))
      if (pressFamily.includes(mainLift) && inFamily(pressFamily)) return true
      if (squatFamily.includes(mainLift) && inFamily(squatFamily)) return true
      // Olympic lifts: no family matching - exact match only (already checked above)

      return false
    }

    // ACCESSORIES block specific filtering (simplified)
    if (block === 'ACCESSORIES') {
      // 1. Must have accessory_category
      if (!exercise.accessory_category || exercise.accessory_category === 'None') return false
      
      // 2. Equipment check (already handled above)
      // 3. Prerequisites check (already handled above)
      
      // 4. Prevent same accessory_category on consecutive days
      const previousDayCategories = previousDayAccessories
        .map((name: string) => {
          const prevEx = exerciseData.find((e: any) => e.name === name)
          return prevEx?.accessory_category
        })
        .filter((cat: string) => cat && cat !== 'None')
      
      if (previousDayCategories.includes(exercise.accessory_category)) {
        return false
      }
      
      return true
    }

    return true
  })


  // Add logging here
  console.log(`Filtered ${filtered.length} exercises for ${block}`)
  if (block === 'TECHNICAL WORK') {
    console.log('Technical exercises found:', filtered.map(e => e.name))
  }
  if (block === 'SKILLS') {
    console.log(`✅ SKILLS exercises found (${filtered.length}):`, filtered.map(e => e.name))
    if (filtered.length === 0) {
      console.log('⚠️ WARNING: No SKILLS exercises passed filtering!')
    }
  }


  // Fallback to scaled exercises if no matches (exact logic from Google Script)
  if (filtered.length === 0) {
    console.log('No matches found, searching for scaled exercises')
    filtered = exerciseData.filter(exercise => {
      const scalingFor = exercise.scaling_for
      const scalingOptions = exercise.scaling_options || []
      const userLevel = user.ability === 'Advanced' ? 3 : user.ability === 'Intermediate' ? 2 : 1

      return (scalingFor && exerciseData.some((ex: any) => ex.name === scalingFor && (
        (ex.difficulty_level === 'All' && userLevel >= 1) ||
        (ex.difficulty_level === 'Intermediate' && userLevel >= 2) ||
        (ex.difficulty_level === 'Advanced' && userLevel === 3)
      ))) ||
      scalingOptions.some((opt: string) => exerciseData.some((ex: any) => ex.name === opt && (
        (ex.difficulty_level === 'All' && userLevel >= 1) ||
        (ex.difficulty_level === 'Intermediate' && userLevel >= 2) ||
        (ex.difficulty_level === 'Advanced' && userLevel === 3)
      )))
    })
  }

  // Final fallback to bodyweight exercises if still no matches
  if (filtered.length === 0 && user.equipment.length === 0) {
    console.log('Using bodyweight fallback exercises')
    return defaultBodyweightExercises.slice(0, numExercises)
  }

  // ACCESSORIES block: Enforce weekly slot allocation (simplified)
  let usedAccessoryCategories: string[] = []
  if (block === 'ACCESSORIES') {
    // Define required weekly allocation (10 slots total: 2 per day × 5 days)
    const requiredAllocation: Record<string, number> = {
      'Core': 2,
      'Upper Back': 2,
      'Leg Strength': user.needs_leg_strength ? 2 : 0,
      'Posterior Chain': user.needs_posterior_chain ? 2 : 0,
      'Upper Body Pressing': 2,
      'Upper Body Pulling': 2
    }
    
    // Track what's been assigned this week so far
    const assignedThisWeek = { ...weeklyAccessoryCategories }
    
    // Determine which categories we need to fill for this day
    const categoriesNeeded: string[] = []
    Object.entries(requiredAllocation).forEach(([cat, required]) => {
      const assigned = assignedThisWeek[cat] || 0
      if (assigned < required) {
        categoriesNeeded.push(cat)
      }
    })
    
    // Filter exercises to only those in needed categories (if any categories are still needed)
    // If all categories are filled, allow any category to prevent blocking
    const categoryFiltered = categoriesNeeded.length > 0
      ? filtered.filter((ex: any) => {
          const cat = ex.accessory_category || ''
          return categoriesNeeded.includes(cat)
        })
      : filtered
    
    // Use category-filtered pool if available, otherwise use all filtered
    const poolToUse = categoryFiltered.length > 0 ? categoryFiltered : filtered
    
    // Prevent same category on same day
    const usedCategoriesToday = new Set<string>()
    
    // Simple weighted random selection
    const abilityIndex = user.ability === 'Advanced' ? 'advanced_weight' : 
                         user.ability === 'Intermediate' ? 'intermediate_weight' : 
                         'beginner_weight'
    
    const selectedExercises: any[] = []
    const usedIndices = new Set<number>()
    
    for (let i = 0; i < numExercises && selectedExercises.length < numExercises; i++) {
      // Filter out exercises with categories already used today
      const available = poolToUse.filter((ex: any, idx: number) => {
        if (usedIndices.has(idx)) return false
        const cat = ex.accessory_category || ''
        if (usedCategoriesToday.has(cat)) return false
        return true
      })
      
      if (available.length === 0) {
        // If no available exercises in needed categories, allow any category
        const fallbackAvailable = poolToUse.filter((ex: any, idx: number) => {
          if (usedIndices.has(idx)) return false
          const cat = ex.accessory_category || ''
          if (usedCategoriesToday.has(cat)) return false
          return true
        })
        if (fallbackAvailable.length === 0) break
        
        // Use fallback pool
        const weights = fallbackAvailable.map(ex => 
          parseFloat(ex[abilityIndex]) || parseFloat(ex.default_weight) || 5
        )
        const totalWeight = weights.reduce((sum, w) => sum + w, 0)
        if (totalWeight <= 0) break
        
        let rand = Math.random() * totalWeight
        let selectedIdx = -1
        for (let j = 0; j < fallbackAvailable.length; j++) {
          rand -= weights[j]
          if (rand <= 0) {
            selectedIdx = poolToUse.indexOf(fallbackAvailable[j])
            break
          }
        }
        
        if (selectedIdx === -1) break
        
        const selected = poolToUse[selectedIdx]
        selectedExercises.push(selected)
        usedIndices.add(selectedIdx)
        usedCategoriesToday.add(selected.accessory_category || '')
      } else {
        // Weighted random selection from available pool
        const weights = available.map(ex => 
          parseFloat(ex[abilityIndex]) || parseFloat(ex.default_weight) || 5
        )
        const totalWeight = weights.reduce((sum, w) => sum + w, 0)
        if (totalWeight <= 0) break
        
        let rand = Math.random() * totalWeight
        let selectedIdx = -1
        for (let j = 0; j < available.length; j++) {
          rand -= weights[j]
          if (rand <= 0) {
            selectedIdx = poolToUse.indexOf(available[j])
            break
          }
        }
        
        if (selectedIdx === -1) break
        
        const selected = poolToUse[selectedIdx]
        selectedExercises.push(selected)
        usedIndices.add(selectedIdx)
        usedCategoriesToday.add(selected.accessory_category || '')
      }
    }
    
    // Track categories used
    const usedCats = Array.from(usedCategoriesToday)
    usedAccessoryCategories = usedCats
    
    // Build output exercises
    const out: any[] = []
    for (const selectedExercise of selectedExercises) {
      // Derive effective level for notes parsing
      let effectiveLevel = 'Intermediate'
      const programNotes = parseProgramNotes(selectedExercise.program_notes, effectiveLevel, isDeload, false, week)
      if (!programNotes.sets && !programNotes.weightTime) {
        // Ensure sensible defaults
        programNotes.sets = programNotes.sets || 3
        programNotes.reps = programNotes.reps || 10
      }
      let weightTime = ''
      if (selectedExercise.one_rm_reference && selectedExercise.one_rm_reference !== 'None') {
        const oneRM = user.oneRMs[find1RMIndex(selectedExercise.one_rm_reference)]
        if (oneRM) {
          const percent = programNotes.percent1RM || (isDeload ? 0.5 : 0.65)
          let calculatedWeight = Math.round(oneRM * percent)
          const requiredEquipment = selectedExercise.required_equipment || []
          const isBarbell = requiredEquipment.includes('Barbell')
          if (isBarbell) {
            const weightFloor = user.gender === 'Female' ? (user.units === 'Metric (kg)' ? 15 : 35) : (user.units === 'Metric (kg)' ? 20 : 45)
            calculatedWeight = Math.max(calculatedWeight, weightFloor)
          }

          // Apply accessory weight caps (stored in lbs)
          const accessoryCapLbs = user.gender === 'Female'
            ? selectedExercise.accessory_cap_female
            : selectedExercise.accessory_cap_male;
          if (accessoryCapLbs && accessoryCapLbs > 0) {
            const capInUserUnits = user.units === 'Metric (kg)'
              ? Math.round(accessoryCapLbs / 2.205)
              : accessoryCapLbs;
            if (calculatedWeight > capInUserUnits) {
              console.log(`⚠️ Accessory cap applied: ${selectedExercise.name} ${calculatedWeight} → ${capInUserUnits} (cap: ${accessoryCapLbs}lbs)`);
              calculatedWeight = capInUserUnits;
            }
          }

          const roundedWeight = roundWeight(calculatedWeight, user.units)
          weightTime = roundedWeight.toString()
        }
      } else {
        weightTime = programNotes.weightTime || ''
      }
      out.push({
        name: selectedExercise.name,
        sets: programNotes.sets || '',
        reps: programNotes.reps || '',
        weightTime: weightTime,
        notes: truncateNotes(generateEnhancedNotes(null, user, week, block, selectedExercise)) || programNotes.notes || effectiveLevel
      })
    }

    return out
  }

// Try AI contextual selection first, fallback to probabilistic
let exercises: any[] = [];

try {
  const contextualResponse = await fetch(`${SUPABASE_URL}/functions/v1/contextual-exercise-selection`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filteredExercises: filtered,
      userContext: { ...user, preferences: userPreferences },
      block,
      mainLift,
      numExercises,
      weeklyFrequencies: weeklySkills || weeklyAccessories || {},
      dailyContext: { week, day, isDeload }
    })
  });

  if (contextualResponse.ok) {
    const contextualData = await contextualResponse.json();
    if (contextualData.success && contextualData.selectedExercises.length > 0) {
      // Process AI-selected exercises with your existing logic
      // NEW: Track skill_index values to prevent duplicates (for SKILLS block)
      const usedSkillIndicesToday = new Set<number>();
      
      exercises = contextualData.selectedExercises
        .filter((exercise: any) => {
          // For SKILLS block, filter out exercises with duplicate skill_index
          if (block === 'SKILLS') {
            const skillIndex = exercise.skill_index;
            if (skillIndex !== null && skillIndex !== undefined && skillIndex >= 0 && skillIndex <= 25) {
              if (usedSkillIndicesToday.has(skillIndex)) {
                console.log(`  ⏭️ Skipping ${exercise.name} (AI selection) - skill_index ${skillIndex} already used today`)
                return false;
              }
              usedSkillIndicesToday.add(skillIndex);
            }
          }
          return true;
        })
        .map((exercise: any) => {
        const skillIndex = exercise.skill_index || 99;
        let effectiveLevel;
        
        if (block === 'SKILLS' && skillIndex >= 0 && skillIndex <= 25) {
          const userSkillLevelString = user.skills[skillIndex];
          if (userSkillLevelString === "Don't have it") {
            effectiveLevel = 'Novice';
          } else if (userSkillLevelString === 'Beginner') {
            effectiveLevel = 'Beginner';
          } else if (userSkillLevelString === 'Intermediate') {
            effectiveLevel = 'Intermediate';
          } else if (userSkillLevelString === 'Advanced') {
            const advancedSkillCount = user.skills.filter((s: any) => s === 'Advanced').length;
            const isEliteEligible = advancedSkillCount >= 10;
            effectiveLevel = isEliteEligible ? 'Elite' : 'Advanced';
          } else {
            effectiveLevel = 'Beginner';
          }
        } else if (block === 'TECHNICAL WORK') {
          const liftLevel = mainLift === 'Snatch' ? user.snatch_level || 'Beginner' :
                           mainLift === 'Clean and Jerk' ? user.clean_jerk_level || 'Beginner' :
                           ['Back Squat', 'Front Squat'].includes(mainLift) ? user.back_squat_level || 'Beginner' :
                           user.press_level || 'Beginner';
          effectiveLevel = liftLevel;
        } else if (block === 'ACCESSORIES') {
          effectiveLevel = 'Intermediate';
        } else {
          effectiveLevel = 'Intermediate';
        }

        let programNotes = parseProgramNotes(exercise.program_notes, effectiveLevel, isDeload, false, week);
        if (!programNotes.sets || !programNotes.reps) {
          return null; // Skip exercises with no valid program notes
        }

        let weightTime = '';
        let sets = programNotes.sets || '';
        let reps = programNotes.reps || '';

        if (exercise.one_rm_reference && exercise.one_rm_reference !== 'None') {
          const oneRM = user.oneRMs[find1RMIndex(exercise.one_rm_reference)];
          if (oneRM) {
            const percent = programNotes.percent1RM || (isDeload ? 0.5 : 0.65);
            let calculatedWeight = Math.round(oneRM * percent);
            
            const requiredEquipment = exercise.required_equipment || [];
            const isBarbell = requiredEquipment.includes('Barbell');
            if (isBarbell) {
              const weightFloor = user.gender === 'Female' ?
                (user.units === 'Metric (kg)' ? 15 : 35) :
                (user.units === 'Metric (kg)' ? 20 : 45);
              calculatedWeight = Math.max(calculatedWeight, weightFloor);
            }

            // Apply technical work weight caps (stored in lbs)
            if (block === 'TECHNICAL WORK') {
              const capLbs = user.gender === 'Female'
                ? exercise.technical_cap_female
                : exercise.technical_cap_male;
              if (capLbs && capLbs > 0) {
                // Convert cap to user's units if metric
                const capInUserUnits = user.units === 'Metric (kg)'
                  ? Math.round(capLbs / 2.205)
                  : capLbs;
                if (calculatedWeight > capInUserUnits) {
                  console.log(`⚠️ Technical cap applied: ${exercise.name} ${calculatedWeight} → ${capInUserUnits} (cap: ${capLbs}lbs)`);
                  calculatedWeight = capInUserUnits;
                }
              }
            }

            const roundedWeight = roundWeight(calculatedWeight, user.units);
            weightTime = roundedWeight.toString();
          }
        } else {
          weightTime = programNotes.weightTime || '';
        }

        const enhancedNote = generateEnhancedNotes(null, user, week, block, exercise);

        return {
          name: exercise.name,
          sets: sets,
          reps: reps,
          weightTime: weightTime,
          notes: truncateNotes(enhancedNote) || programNotes.notes || effectiveLevel
        };
      }).filter(Boolean);

      console.log(`Using AI contextual selection: ${exercises.length} exercises selected`);
      if (block === 'SKILLS') {
        console.log(`✅ Final SKILLS selection via AI (${exercises.length} exercises):`, exercises.map(e => e.name))
      }
    } else {
      throw new Error('AI selection returned no valid exercises');
    }
  } else {
    throw new Error('AI selection service unavailable');
  }
} catch (error) {
  console.warn('Falling back to probabilistic selection:', error.message);
  
  // Fallback to your existing probabilistic selection
  const abilityIndex = user.ability === 'Advanced' ? 'advanced_weight' :
    user.ability === 'Intermediate' ? 'intermediate_weight' : 'beginner_weight';

  const weights = filtered.map(exercise => parseFloat(exercise[abilityIndex]) || parseFloat(exercise.default_weight) || 5);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = weights.map(w => w / totalWeight);

  const selectedIndices: number[] = [];
  // NEW: Track skill_index values used today (for SKILLS block)
  const usedSkillIndicesToday = new Set<number>();

  for (let i = 0; i < numExercises; i++) {
    if (!filtered.length) break;

    const rand = Math.random();
    let cumulative = 0;
    let selected = false;

    for (let j = 0; j < probabilities.length; j++) {
      cumulative += probabilities[j];
      if (rand <= cumulative && !selectedIndices.includes(j)) {
        const exercise = filtered[j];
        const skillIndex = exercise.skill_index || 99;
        
        // NEW: Skip if skill_index already used today (for SKILLS block)
        if (block === 'SKILLS' && skillIndex >= 0 && skillIndex <= 25) {
          if (usedSkillIndicesToday.has(skillIndex)) {
            console.log(`  ⏭️ Skipping ${exercise.name} - skill_index ${skillIndex} already used today`)
            continue; // Try next exercise in probability list
          }
        }
        
        if (block === 'SKILLS') {
          console.log(`  🎲 Selected ${exercise.name} (weight: ${filtered[j][abilityIndex] || 'default'}, probability: ${(probabilities[j] * 100).toFixed(2)}%)`)
        }
        
        let effectiveLevel;
        
        if (block === 'SKILLS' && skillIndex >= 0 && skillIndex <= 25) {
          const userSkillLevelString = user.skills[skillIndex];
          if (userSkillLevelString === "Don't have it") {
            effectiveLevel = 'Novice';
          } else if (userSkillLevelString === 'Beginner') {
            effectiveLevel = 'Beginner';
          } else if (userSkillLevelString === 'Intermediate') {
            effectiveLevel = 'Intermediate';
          } else if (userSkillLevelString === 'Advanced') {
            const advancedSkillCount = user.skills.filter((s: any) => s === 'Advanced').length;
            const isEliteEligible = advancedSkillCount >= 10;
            effectiveLevel = isEliteEligible ? 'Elite' : 'Advanced';
          } else {
            effectiveLevel = 'Beginner';
          }
        } else if (block === 'TECHNICAL WORK') {
          const liftLevel = mainLift === 'Snatch' ? user.snatch_level || 'Beginner' :
                           mainLift === 'Clean and Jerk' ? user.clean_jerk_level || 'Beginner' :
                           ['Back Squat', 'Front Squat'].includes(mainLift) ? user.back_squat_level || 'Beginner' :
                           user.press_level || 'Beginner';
          effectiveLevel = liftLevel;
        } else if (block === 'ACCESSORIES') {
          effectiveLevel = 'Intermediate';
        } else {
          effectiveLevel = 'Intermediate';
        }

        let programNotes = parseProgramNotes(exercise.program_notes, effectiveLevel, isDeload, false, week);
        if (!programNotes.sets || !programNotes.reps) {
          continue;
        }

        let weightTime = '';
        let sets = programNotes.sets || '';
        let reps = programNotes.reps || '';

        if (exercise.one_rm_reference && exercise.one_rm_reference !== 'None') {
          const oneRM = user.oneRMs[find1RMIndex(exercise.one_rm_reference)];
          if (oneRM) {
            const percent = programNotes.percent1RM || (isDeload ? 0.5 : 0.65);
            let calculatedWeight = Math.round(oneRM * percent);

            const requiredEquipment = exercise.required_equipment || [];
            const isBarbell = requiredEquipment.includes('Barbell');
            if (isBarbell) {
              const weightFloor = user.gender === 'Female' ?
                (user.units === 'Metric (kg)' ? 15 : 35) :
                (user.units === 'Metric (kg)' ? 20 : 45);
              calculatedWeight = Math.max(calculatedWeight, weightFloor);
            }

            // Apply technical work weight caps (stored in lbs)
            if (block === 'TECHNICAL WORK') {
              const capLbs = user.gender === 'Female'
                ? exercise.technical_cap_female
                : exercise.technical_cap_male;
              if (capLbs && capLbs > 0) {
                // Convert cap to user's units if metric
                const capInUserUnits = user.units === 'Metric (kg)'
                  ? Math.round(capLbs / 2.205)
                  : capLbs;
                if (calculatedWeight > capInUserUnits) {
                  console.log(`⚠️ Technical cap applied: ${exercise.name} ${calculatedWeight} → ${capInUserUnits} (cap: ${capLbs}lbs)`);
                  calculatedWeight = capInUserUnits;
                }
              }
            }

            const roundedWeight = roundWeight(calculatedWeight, user.units);
            weightTime = roundedWeight.toString();
          }
        } else {
          weightTime = programNotes.weightTime || '';
        }

        const enhancedNote = generateEnhancedNotes(null, user, week, block, exercise);

        exercises.push({
          name: exercise.name,
          sets: sets,
          reps: reps,
          weightTime: weightTime,
          notes: truncateNotes(enhancedNote) || programNotes.notes || effectiveLevel
        });

        // NEW: Track skill_index after successful selection
        if (block === 'SKILLS' && skillIndex >= 0 && skillIndex <= 25) {
          usedSkillIndicesToday.add(skillIndex)
        }

        selectedIndices.push(j);
        probabilities.splice(j, 1);
        selected = true;
        break;
      }
    }
    
    // If we couldn't select an exercise (all were filtered), break
    if (!selected) {
      console.log(`  ⚠️ Could not select exercise ${i + 1} - all remaining candidates filtered out`)
      break;
    }
  }

  if (block === 'SKILLS') {
    console.log(`✅ Final SKILLS selection (${exercises.length} exercises):`, exercises.map(e => e.name))
  }
}

return exercises
}

// === HELPER FUNCTIONS (Exact Google Script Logic) ===

function checkPrerequisite(prereq: string, user: any): boolean {
  if (prereq.includes('1RM')) {
    const [exercise, value] = prereq.split(' 1RM > ')
    const oneRMIndex = find1RMIndex(exercise)
    return user.oneRMs[oneRMIndex] && user.oneRMs[oneRMIndex] >= parseInt(value)
  }

  const skillIndex = findSkillIndex(prereq)
  if (skillIndex === -1) return false

  const userSkill = user.skills[skillIndex]
  if (!userSkill || userSkill === "Don't have it") return false

  const requiredLevel = prereq.includes('Advanced') ? 3 : prereq.includes('Intermediate') ? 2 : 1
  const userLevel = userSkill.includes('Advanced') ? 3 : userSkill.includes('Intermediate') ? 2 : 1
  return userLevel >= requiredLevel
}

function find1RMIndex(exercise: string): number {
  const oneRMs = [
    'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (Only)', 'Jerk (Only)',
    'Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press',
    'Strict Press', 'Weighted Pullup'
  ]
  return oneRMs.indexOf(exercise)
}

function findSkillIndex(prereq: string): number {
  const skillMap: Record<string, number> = {
    'Double Unders: Intermediate': 0,
    'Double Unders: Advanced': 0,
    'Wall Balls: Beginner': 1,
    'Wall Balls: Intermediate': 1,
    'Wall Balls: Advanced': 1,
    'Toes to Bar: Beginner': 2,
    'Toes to Bar: Intermediate': 2,
    'Toes to Bar: Advanced': 2,
    'Pull-ups (kipping or butterfly): Beginner': 3,
    'Pull-ups (kipping or butterfly): Intermediate': 3,
    'Pull-ups (kipping or butterfly): Advanced': 3,
    'Chest to Bar Pull-ups: Intermediate': 4,
    'Chest to Bar Pull-ups: Advanced': 4,
    'Strict Pull-ups: Beginner': 5,
    'Strict Pull-ups: Intermediate': 5,
    'Strict Pull-ups: Advanced': 5,
    'Push-ups: Intermediate': 6,
    'Push-ups: Advanced': 6,
    'Ring Dips: Beginner': 7,
    'Ring Dips: Intermediate': 7,
    'Ring Dips: Advanced': 7,
    'Strict Ring Dips: Beginner': 8,
    'Strict Ring Dips: Intermediate': 8,
    'Strict Ring Dips: Advanced': 8,
    'Strict Handstand Push-ups: Intermediate': 9,
    'Strict Handstand Push-ups: Advanced': 9,
    'Wall Facing Handstand Push-ups: Intermediate': 10,
    'Wall Facing Handstand Push-ups: Advanced': 10,
    'Deficit Handstand Push-ups (4"): Advanced': 11,
    'Alternating Pistols: Beginner': 12,
    'Alternating Pistols: Intermediate': 12,
    'Alternating Pistols: Advanced': 12,
    'GHD Sit-ups: Beginner': 13,
    'GHD Sit-ups: Intermediate': 13,
    'GHD Sit-ups: Advanced': 13,
    'Wall Walks: Beginner': 14,
    'Wall Walks: Intermediate': 14,
    'Wall Walks: Advanced': 14,
    'Ring Muscle Ups: Intermediate': 15,
    'Ring Muscle Ups: Advanced': 15,
    'Bar Muscle Ups: Intermediate': 16,
    'Bar Muscle Ups: Advanced': 16,
    'Rope Climbs: Beginner': 17,
    'Rope Climbs: Intermediate': 17,
    'Rope Climbs: Advanced': 17,
    'Wall Facing Handstand Hold: Intermediate': 18,
    'Wall Facing Handstand Hold: Advanced': 18,
    'Freestanding Handstand Hold: Advanced': 19,
    'Legless Rope Climbs: Intermediate': 20,
    'Legless Rope Climbs: Advanced': 20,
    'Pegboard Ascent: Advanced': 21,
    'Handstand Walk (10m or 25"): Advanced': 22,
    'Seated Legless Rope Climbs: Advanced': 23,
    'Strict Ring Muscle Ups: Advanced': 24,
    'Handstand Walk Obstacle Crossings: Advanced': 25
  }
  return skillMap[prereq] !== undefined ? skillMap[prereq] : -1
}

function findSkillIndexForScaling(scalingFor: string): number {
  const scalingMap: Record<string, number> = {
    'Double Unders': 0,
    'Toes to Bar': 2,
    'Handstand Walk (10m or 25")': 22,
    'Handstand Walk (10m or 25\')': 22, // Handle both quote styles
    'Wall Walks': 14,
    'Push-ups': 6,
    'GHD Sit-ups': 13,
    'Strict Pull-ups': 5,
    'Wall Balls': 1,
    'Alternating Pistols': 12,
    'Ring Dips': 7,
    'Strict Ring Dips': 8
  }

  // Try exact match first
  if (scalingMap[scalingFor] !== undefined) {
    return scalingMap[scalingFor]
  }
  
  // Try case-insensitive match
  const lowerScalingFor = scalingFor.toLowerCase().trim()
  for (const [key, value] of Object.entries(scalingMap)) {
    if (key.toLowerCase() === lowerScalingFor) {
      return value
    }
  }
  
  return -1
}



function parseProgramNotes(notes, level, isDeload, isTestWeek, week) {
  if (!notes || typeof notes !== 'object') {
    return {
      sets: 3,
      reps: 10,
      notes: 'Default'
    };
  }
  
  const levelNotes = notes[level];
  if (!levelNotes) {
    return {
      sets: 3,
      reps: 10,
      notes: `${level} Default`
    };
  }
  
  const result = {};
  
  // Check if levelNotes is a string (new format) or object (old format)
  if (typeof levelNotes === 'string') {
    // Parse string format like "5x3,85%" or "2x50" or "5x45s"
    const cleanString = levelNotes.trim().replace(/,$/, '');
    
    // Check for time-based (e.g., "5x45s" or "5x4min")
    const timeMatch = cleanString.match(/(\d+)x(\d+)(s|sec|min|m)/i);
    if (timeMatch) {
      result.sets = parseInt(timeMatch[1]);
      result.weightTime = timeMatch[2] + timeMatch[3];
      // No reps for time-based exercises
    } else {
      // Check for percentage-based (e.g., "5x3,85%")
      const percentMatch = cleanString.match(/(\d+)x(\d+),(\d+)%/);
      if (percentMatch) {
        result.sets = parseInt(percentMatch[1]);
        result.reps = parseInt(percentMatch[2]);
        result.percent1RM = parseInt(percentMatch[3]) / 100;
      } else {
        // Check for rep-only (e.g., "2x50")
        const repMatch = cleanString.match(/(\d+)x(\d+)/);
        if (repMatch) {
          result.sets = parseInt(repMatch[1]);
          result.reps = parseInt(repMatch[2]);
        }
      }
    }
    
    // Apply deload if needed
    if (isDeload && result.sets) {
      result.sets = Math.round(result.sets * 0.6);
    }
    if (isDeload && result.reps) {
      result.reps = Math.round(result.reps * 0.6);
    }
    
  } else {
    // Handle old object format (keep existing logic)
    if (levelNotes.sets) {
      result.sets = isDeload ? Math.round(levelNotes.sets * 0.6) : levelNotes.sets;
    }
    if (levelNotes.reps) {
      result.reps = isDeload ? Math.round(levelNotes.reps * 0.6) : levelNotes.reps;
    }
    if (levelNotes.percent1RM) {
      result.percent1RM = levelNotes.percent1RM / 100;
    }
    if (levelNotes.weightTime) {
      result.weightTime = levelNotes.weightTime;
    }
    if (levelNotes.notes) {
      result.notes = levelNotes.notes;
    }
  }
  
  // Ensure sets and reps are defined (but not for time-based exercises)
  if (!result.weightTime && (!result.sets || !result.reps)) {
    result.sets = result.sets || 3;
    result.reps = result.reps || 10;
    result.notes = result.notes || `${level} Default`;
  }
  
  return result;
}


function checkLevelAppropriate(exerciseLevel: string, userAbility: string): boolean {
  const levelHierarchy: Record<string, string[]> = {
    'Novice': ['Novice'],
    'Beginner': ['Beginner'],
    'Intermediate': ['Beginner', 'Intermediate'],
    'Advanced': ['Beginner', 'Intermediate', 'Advanced']
  }

  return levelHierarchy[userAbility] && levelHierarchy[userAbility].includes(exerciseLevel)
}

function roundWeight(weight: number, userUnits: string): number {
  if (!weight || isNaN(weight)) return weight

  if (userUnits === 'Metric (kg)') {
    // Round to nearest 2.5 kg
    return Math.round(weight / 2.5) * 2.5
  } else {
    // Round to nearest 5 lbs (Imperial)
    return Math.round(weight / 5) * 5
  }
}

function generateEnhancedNotes(exerciseData: any, user: any, week: number, block: string, exerciseRow: any): string | null {
  // Skip MetCons - they use existing database notes
  if (block === 'METCONS') {
    return null
  }

  // Get performance cue from database
  return getPerformanceCue(exerciseRow) || null
}

function getPerformanceCue(exerciseRow: any): string {
  const cues = exerciseRow.performance_cues || []

  if (cues.length === 0) return ''
  if (cues.length === 1) return cues[0]

  // Multiple cues - randomly select one
  return cues[Math.floor(Math.random() * cues.length)]
}

function truncateNotes(notes: string | null): string | null {
  if (!notes || typeof notes !== 'string') return notes

  if (notes.length <= 100) return notes

  // Truncate at 97 characters and add "..."
  return notes.substring(0, 97) + '...'
}
