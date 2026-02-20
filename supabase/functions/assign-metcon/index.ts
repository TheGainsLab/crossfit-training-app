import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignMetconRequest {
  user: any  // User data object passed from generate-program
  week: number
  day: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { user, week, day }: AssignMetconRequest = await req.json()

    console.log(`🔥 Assigning MetCon for ${user.name}, Week ${week}, Day ${day}`)

    // Get MetCons from database
    const { data: metconData, error } = await supabase
      .from('metcons')
      .select('*')
      .eq('sport_id', 1) // CrossFit

    if (error) {
      console.error('Database error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    if (!metconData || metconData.length === 0) {
      console.log('No MetCons found, creating fallback')
      const fallbackResult = createFallbackMetCon(user)
     
return new Response(
  JSON.stringify({
    success: true,
    exercises: fallbackResult.exercises,
    workoutId: fallbackResult.workoutId,
    workoutFormat: fallbackResult.format,
    timeRange: fallbackResult.timeRange,
    percentileGuidance: fallbackResult.percentileGuidance,
    workoutNotes: ''  // Add this line
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)
    }

// Fetch user preferences (optional)
let userPreferences: any = null
try {
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('three_month_goals, monthly_primary_goal, preferred_metcon_exercises, avoided_exercises')
    .eq('user_id', user.id || user.userProfile?.id)
    .single()
  userPreferences = prefs || null
} catch (_) {}

// Pre-filter metcons by equipment, skills, and 1RM before any selection path
const filteredMetcons = filterMetconsForUser(metconData, user)
console.log(`Pre-filtered ${metconData.length} metcons → ${filteredMetcons.length} suitable for user`)

// Try intelligent AI selection first, fallback to original logic
let selectedWorkout;
try {
  if (filteredMetcons.length === 0) {
    throw new Error('No suitable metcons after pre-filtering')
  }

  const intelligentResponse = await fetch(`${supabaseUrl}/functions/v1/intelligent-metcon-selection`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: user.id || user.userProfile?.id,
      week,
      day,
      availableMetcons: filteredMetcons,
      preferences: userPreferences
    })
  });

  if (intelligentResponse.ok) {
    const intelligentData = await intelligentResponse.json();
    if (intelligentData.success) {
      selectedWorkout = intelligentData.selectedMetcon;
      console.log('AI MetCon selection reason:', intelligentData.selectionReason);
    } else {
      throw new Error('Intelligent selection failed');
    }
  } else {
    throw new Error('Intelligent selection service unavailable');
  }
} catch (error) {
  console.warn('Falling back to original MetCon selection:', error.message);
  selectedWorkout = selectMetCon(metconData, user, userPreferences);
}

    // If no workout was selected by either path, return fallback
    if (!selectedWorkout) {
      console.warn('No suitable MetCon found, returning fallback workout')
      const fallbackResult = createFallbackMetCon(user)
      return new Response(
        JSON.stringify({
          success: true,
          exercises: fallbackResult.exercises,
          workoutId: fallbackResult.workoutId,
          workoutFormat: fallbackResult.format,
          timeRange: fallbackResult.timeRange,
          percentileGuidance: fallbackResult.percentileGuidance,
          workoutNotes: ''
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert MetCon to exercises (exact Google Script logic)
    const conversionResult = convertMetConToExercises(selectedWorkout, user)

    // Generate percentile guidance (exact Google Script logic)
    const percentileGuidance = generatePercentileGuidance(selectedWorkout, user)

return new Response(
  JSON.stringify({
    success: true,
    exercises: conversionResult.exercises,
    workoutId: selectedWorkout.workout_id,
    workoutFormat: selectedWorkout.format,
    timeRange: selectedWorkout.time_range,
    percentileGuidance: percentileGuidance,
    workoutNotes: selectedWorkout.workout_notes || ''
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)












  } catch (error) {
    console.error('MetCon assignment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// === SKILL TO EXERCISE MAPPING ===
// Maps exercise names in metcons to user skill indices (from skill_definitions table)
// Skill levels: "Don't have it", "Beginner", "Intermediate", "Advanced"
// Source of truth: skill_definitions table, cross-referenced with assign-exercises findSkillIndex/findSkillIndexForScaling
const EXERCISE_TO_SKILL_INDEX: Record<string, number> = {
  // Basic CrossFit skills (indices 0-1)
  'double-under': 0, 'double under': 0, 'double unders': 0, 'dus': 0,
  'wall ball': 1, 'wall balls': 1, 'wall-ball': 1,

  // Upper Body Pulling (indices 2-5)
  'toes to bar': 2, 'toes-to-bar': 2, 't2b': 2, 'ttb': 2,
  'pull-up': 3, 'pull up': 3, 'pull-ups': 3, 'pullup': 3, 'pullups': 3, 'kipping pull-up': 3, 'butterfly pull-up': 3,
  'chest to bar': 4, 'chest-to-bar': 4, 'c2b': 4, 'ctb': 4, 'chest to bar pull-up': 4,
  'strict pull-up': 5, 'strict pullup': 5, 'strict pull-ups': 5,

  // Upper Body Pressing (indices 6-11)
  'push-up': 6, 'push up': 6, 'push-ups': 6, 'pushup': 6, 'pushups': 6,
  'ring dip': 7, 'ring dips': 7,
  'strict ring dip': 8, 'strict ring dips': 8,
  'handstand push-up': 9, 'hspu': 9, 'handstand push-ups': 9, 'strict hspu': 9, 'strict handstand push-up': 9,
  'wall facing hspu': 10, 'wall-facing hspu': 10, 'wall facing handstand push-up': 10,
  'deficit hspu': 11, 'deficit handstand push-up': 11,

  // Additional Skills (indices 12-25) — corrected to match skill_definitions
  'pistol': 12, 'pistols': 12, 'pistol squat': 12, 'pistol squats': 12, 'alternating pistol': 12, 'alternating pistols': 12,
  'ghd sit-up': 13, 'ghd sit-ups': 13, 'ghd': 13,
  'wall walk': 14, 'wall walks': 14,
  'ring muscle-up': 15, 'ring muscle up': 15, 'ring muscle-ups': 15, 'muscle-up': 15, 'muscle up': 15, 'mu': 15,
  'bar muscle-up': 16, 'bar muscle up': 16, 'bar muscle-ups': 16, 'bmu': 16,
  'rope climb': 17, 'rope climbs': 17,
  'wall facing handstand hold': 18,
  'freestanding handstand hold': 19,
  'legless rope climb': 20, 'legless rope climbs': 20,
  'pegboard': 21, 'pegboard ascent': 21,
  'handstand walk': 22, 'handstand walking': 22, 'hs walk': 22,
  'seated legless rope climb': 23,
  'strict ring muscle-up': 24, 'strict muscle-up': 24, 'strict ring mu': 24,
}

// === 1RM TO EXERCISE MAPPING ===
// Maps exercise names in metcons to user 1RM indices
// 1RM indices: 0=Snatch, 1=Power Snatch, 2=Clean&Jerk, 3=Power Clean, 4=Clean, 5=Jerk,
//              6=Back Squat, 7=Front Squat, 8=OH Squat, 9=Deadlift, 10=Bench, 11=Push Press, 12=Strict Press, 13=Weighted Pullup
const EXERCISE_TO_1RM_INDEX: Record<string, number> = {
  'snatch': 0, 'squat snatch': 0, 'full snatch': 0,
  'power snatch': 1, 'hang power snatch': 1, 'hang snatch': 1,
  'clean and jerk': 2, 'clean & jerk': 2, 'c&j': 2,
  'power clean': 3, 'hang power clean': 3, 'hang clean': 3,
  'clean': 4, 'squat clean': 4, 'full clean': 4,
  'jerk': 5, 'split jerk': 5, 'push jerk': 5,
  'back squat': 6,
  'front squat': 7, 'thruster': 7, 'thrusters': 7, // Thrusters use front squat as reference
  'overhead squat': 8, 'ohs': 8,
  'deadlift': 9, 'deadlifts': 9, 'sumo deadlift': 9,
  'bench press': 10,
  'push press': 11,
  'strict press': 12, 'press': 12, 'shoulder press': 12, 'overhead press': 12,
  'weighted pull-up': 13, 'weighted pullup': 13,
}

// === METCON FILTERING LOGIC (shared by AI and fallback paths) ===

/** Filter metcons by equipment, skills, and 1RM capacity. Returns workouts the user can perform. */
function filterMetconsForUser(metconData: any[], user: any): any[] {
  const userSkills = user.skills || []
  const userOneRMs = user.oneRMs || []
  const userEquipment = user.equipment || []
  const userGender = user.gender || 'Male'

  // Step 1: Strict equipment + skills + 1RM filter
  let suitableWorkouts = metconData.filter(workout => {
    if (!workout || !workout.workout_id || workout.workout_id === '' || !workout.format || workout.format === '') {
      return false
    }

    // --- Equipment Check ---
    const requiredEquipment = workout.required_equipment || []
    if (requiredEquipment.length > 0 && !requiredEquipment.includes('None')) {
      if (userEquipment.length === 0) {
        const isBodyweight = requiredEquipment.every((eq: string) =>
          eq === 'None' || eq === '' || eq.toLowerCase() === 'bodyweight'
        )
        if (!isBodyweight) return false
      } else {
        const hasAllEquipment = requiredEquipment.every((equipment: string) =>
          equipment === 'None' || equipment === '' || userEquipment.includes(equipment)
        )
        if (!hasAllEquipment) return false
      }
    }

    // --- Skills Check ---
    const tasks = workout.tasks || []
    for (const task of tasks) {
      if (!task.exercise) continue
      const exerciseLower = task.exercise.toLowerCase().trim()
      const skillIndex = findSkillIndex(exerciseLower)
      if (skillIndex !== -1 && userSkills[skillIndex] === "Don't have it") return false
    }

    // --- 1RM Weight Check (exclude if weight > 80% of 1RM) ---
    for (const task of tasks) {
      if (!task.exercise) continue
      const exerciseLower = task.exercise.toLowerCase().trim()
      const oneRmIndex = findOneRmIndex(exerciseLower)
      if (oneRmIndex !== -1) {
        const userOneRm = userOneRMs[oneRmIndex]
        if (userOneRm && userOneRm > 0) {
          const maxAllowedWeight = userOneRm * 0.8
          const taskWeight = userGender === 'Female'
            ? parseFloat(task.weight_female || task.weight_female_lbs || '0')
            : parseFloat(task.weight_male || task.weight_male_lbs || '0')
          if (taskWeight > 0 && taskWeight > maxAllowedWeight) return false
        }
      }
    }

    return true
  })

  console.log(`After filtering (equipment, skills, 1RM): ${suitableWorkouts.length} workouts`)

  // Step 2: If no matches, try lenient equipment substitutions (but keep skills/1RM filters)
  if (suitableWorkouts.length === 0) {
    console.log('No matches, trying lenient equipment filtering')
    suitableWorkouts = metconData.filter(workout => {
      if (!workout || !workout.workout_id || workout.workout_id === '' || !workout.format || workout.format === '') {
        return false
      }

      const requiredEquipment = workout.required_equipment || []
      const tasks = workout.tasks || []

      // Lenient equipment check with substitutions (normalized naming)
      const hasEquipmentOrSubstitute = requiredEquipment.every((equipment: string) => {
        if (equipment === 'None' || equipment === '' || equipment.toLowerCase() === 'bodyweight') return true
        if ((equipment === 'Dumbbells' || equipment === 'Dumbbell') && (userEquipment.includes('Kettlebells') || userEquipment.includes('Kettlebell'))) return true
        if ((equipment === 'Kettlebells' || equipment === 'Kettlebell') && (userEquipment.includes('Dumbbells') || userEquipment.includes('Dumbbell'))) return true
        if (equipment === 'Pullup Bar or Rig' && userEquipment.includes('Pull-up Bar')) return true
        return userEquipment.includes(equipment)
      })
      if (!hasEquipmentOrSubstitute) return false

      // Still enforce skills check
      for (const task of tasks) {
        if (!task.exercise) continue
        const exerciseLower = task.exercise.toLowerCase().trim()
        const skillIndex = findSkillIndex(exerciseLower)
        if (skillIndex !== -1 && userSkills[skillIndex] === "Don't have it") return false
      }

      // Still enforce 1RM check
      for (const task of tasks) {
        if (!task.exercise) continue
        const exerciseLower = task.exercise.toLowerCase().trim()
        const oneRmIndex = findOneRmIndex(exerciseLower)
        if (oneRmIndex !== -1) {
          const userOneRm = userOneRMs[oneRmIndex]
          if (userOneRm && userOneRm > 0) {
            const maxAllowedWeight = userOneRm * 0.8
            const taskWeight = userGender === 'Female'
              ? parseFloat(task.weight_female || task.weight_female_lbs || '0')
              : parseFloat(task.weight_male || task.weight_male_lbs || '0')
            if (taskWeight > 0 && taskWeight > maxAllowedWeight) return false
          }
        }
      }

      return true
    })
    console.log(`After lenient equipment filter: ${suitableWorkouts.length} workouts`)
  }

  // Step 3: Final fallback - bodyweight only workouts
  if (suitableWorkouts.length === 0) {
    console.log('Using bodyweight-only workouts as final fallback')
    suitableWorkouts = metconData.filter(workout => {
      if (!workout || !workout.workout_id || !workout.format) return false

      const requiredEquipment = workout.required_equipment || []
      const tasks = workout.tasks || []

      const isBodyweight = requiredEquipment.length === 0 ||
        requiredEquipment.every((eq: string) => eq === 'None' || eq === '' || eq.toLowerCase() === 'bodyweight')
      if (!isBodyweight) return false

      const hasNoWeights = tasks.every((task: any) => {
        const maleWeight = parseFloat(task.weight_male || task.weight_male_lbs || '0')
        const femaleWeight = parseFloat(task.weight_female || task.weight_female_lbs || '0')
        return maleWeight === 0 && femaleWeight === 0
      })

      return hasNoWeights
    })
  }

  return suitableWorkouts
}

// === METCON SELECTION LOGIC ===
function selectMetCon(metconData: any[], user: any, userPreferences?: any): any | null {
  console.log('Starting MetCon selection. Available workouts: ' + metconData.length)

  if (!metconData || metconData.length === 0) {
    console.log('No MetCon data available')
    return null
  }

  let suitableWorkouts = filterMetconsForUser(metconData, user)

  if (suitableWorkouts.length === 0) {
    console.log('No suitable workouts found at all')
    return null
  }

  // Apply user preferences if available (Fix 5)
  if (userPreferences) {
    const avoided = userPreferences.avoided_exercises || []
    const preferred = userPreferences.preferred_metcon_exercises || []

    // Remove metcons containing avoided exercises
    if (avoided.length > 0) {
      const avoidedLower = avoided.map((e: string) => e.toLowerCase().trim())
      const afterAvoid = suitableWorkouts.filter(workout => {
        const tasks = workout.tasks || []
        return !tasks.some((task: any) => {
          if (!task.exercise) return false
          const exLower = task.exercise.toLowerCase().trim()
          return avoidedLower.some((av: string) => exLower.includes(av) || av.includes(exLower))
        })
      })
      // Only apply if it doesn't eliminate all options
      if (afterAvoid.length > 0) {
        console.log(`Preferences: excluded ${suitableWorkouts.length - afterAvoid.length} workouts with avoided exercises`)
        suitableWorkouts = afterAvoid
      }
    }

    // Prefer metcons containing preferred exercises (80% chance to pick from preferred pool)
    if (preferred.length > 0) {
      const preferredLower = preferred.map((e: string) => e.toLowerCase().trim())
      const hasPreferred: any[] = []
      const noPreferred: any[] = []
      for (const workout of suitableWorkouts) {
        const tasks = workout.tasks || []
        const matchesPreferred = tasks.some((task: any) => {
          if (!task.exercise) return false
          const exLower = task.exercise.toLowerCase().trim()
          return preferredLower.some((pref: string) => exLower.includes(pref) || pref.includes(exLower))
        })
        if (matchesPreferred) hasPreferred.push(workout)
        else noPreferred.push(workout)
      }
      if (hasPreferred.length > 0) {
        // 80% chance to select from preferred pool, 20% from full pool for variety
        const usePreferred = Math.random() < 0.8
        const pool = usePreferred ? hasPreferred : suitableWorkouts
        const idx = Math.floor(Math.random() * pool.length)
        console.log(`Preferences: ${hasPreferred.length} workouts match preferred exercises, selecting from ${usePreferred ? 'preferred' : 'full'} pool`)
        return pool[idx]
      }
    }
  }

  // Select a random workout from suitable options
  const randomIndex = Math.floor(Math.random() * suitableWorkouts.length)
  const selectedWorkout = suitableWorkouts[randomIndex]

  console.log(`Selected workout: ${selectedWorkout.workout_id} - ${selectedWorkout.format} - ${selectedWorkout.time_range}`)
  return selectedWorkout
}

// Helper: Find skill index for an exercise name
function findSkillIndex(exerciseName: string): number {
  // Direct lookup
  if (EXERCISE_TO_SKILL_INDEX[exerciseName] !== undefined) {
    return EXERCISE_TO_SKILL_INDEX[exerciseName]
  }

  // Partial match
  for (const [key, index] of Object.entries(EXERCISE_TO_SKILL_INDEX)) {
    if (exerciseName.includes(key) || key.includes(exerciseName)) {
      return index
    }
  }

  return -1 // No skill mapping found
}

// Helper: Find 1RM index for an exercise name
function findOneRmIndex(exerciseName: string): number {
  // Direct lookup
  if (EXERCISE_TO_1RM_INDEX[exerciseName] !== undefined) {
    return EXERCISE_TO_1RM_INDEX[exerciseName]
  }

  // Partial match
  for (const [key, index] of Object.entries(EXERCISE_TO_1RM_INDEX)) {
    if (exerciseName.includes(key) || key.includes(exerciseName)) {
      return index
    }
  }

  return -1 // No 1RM mapping found
}

// === METCON CONVERSION LOGIC (Exact Google Script Logic) ===
function convertMetConToExercises(workout: any, user: any): { exercises: any[] } {
  console.log('Converting MetCon to exercises...')
  console.log(`Workout: ${workout.workout_id}, Format: ${workout.format}, Time: ${workout.time_range}`)

  if (!workout || !workout.tasks) {
    console.log('Invalid workout data, creating fallback')
    return { exercises: createFallbackExercises(user) }
  }

  const exercises: any[] = []
  const tasks = workout.tasks || []

  console.log(`Processing ${tasks.length} tasks`)

  // Process each task in the workout
  tasks.forEach((task: any, index: number) => {
    console.log(`Task ${index + 1}: ${task.reps} ${task.exercise}`)

    const hasReps = task.reps && task.reps !== ''
    const hasDistance = task.distance && task.distance !== ''
    const hasTime = task.time && task.time !== ''
    const hasCalories = task.calories && task.calories !== ''
    const hasExercise = task.exercise && task.exercise !== ''

    if (hasExercise && (hasReps || hasDistance || hasTime || hasCalories)) {
      let selectedWeight = ''
      if (user.gender === 'Female' && task.weight_female && task.weight_female !== '') {
        selectedWeight = task.weight_female
      } else if (task.weight_male && task.weight_male !== '') {
        selectedWeight = task.weight_male
      }

      let weightTime = ''

      if (selectedWeight && selectedWeight !== '') {
        const roundedWeight = roundWeight(parseFloat(selectedWeight), user.units)
        weightTime += roundedWeight.toString()
      }

      if (task.distance && task.distance !== '' && hasReps) {
        weightTime += (weightTime ? ', ' : '') + task.distance
      }
      if (task.time && task.time !== '' && hasReps) {
        weightTime += (weightTime ? ', ' : '') + task.time
      }
      if (task.calories && task.calories !== '' && hasReps) {
        weightTime += (weightTime ? ', ' : '') + task.calories
      }

      let displayReps = task.reps
      if (!hasReps && hasCalories) {
        displayReps = task.calories
      } else if (!hasReps && hasDistance) {
        displayReps = task.distance
      } else if (!hasReps && hasTime) {
        displayReps = task.time
      }

    const exerciseObj = {
  name: task.exercise,
  sets: '',
  reps: displayReps,
  weightTime: weightTime,
  notes: ''  // Changed from exerciseNotes to empty string
}



      exercises.push(exerciseObj)
     console.log(`Added task: ${task.exercise}, ${displayReps} reps, ${weightTime}, Notes: `)
    }
  })

  console.log(`Total tasks added: ${exercises.length}`)

  if (exercises.length === 0) {
    console.log('No valid tasks found, creating fallback exercises')
    return { exercises: createFallbackExercises(user) }
  }

  return { exercises: exercises }
}

// === PERCENTILE GUIDANCE GENERATION (Exact Google Script Logic) ===
function generatePercentileGuidance(workout: any, user: any): any {
  console.log('Generating percentile guidance...')

  if (!workout) {
    return {
      excellentScore: '',
      medianScore: '',
      guidanceRows: []
    }
  }

  // Get gender-specific percentile data
  const excellentScore = (user.gender === 'Male') ? workout.male_p90 : workout.female_p90
  const medianScore = (user.gender === 'Male') ? workout.male_p50 : workout.female_p50
  const stdDev = (user.gender === 'Male') ? workout.male_std_dev : workout.female_std_dev

  console.log(`Selected for ${user.gender}: P90: ${excellentScore}, P50: ${medianScore}, StdDev: ${stdDev}`)

  // Format scores for display
  const displayExcellent = formatScoreForDisplay(excellentScore)
  const displayMedian = formatScoreForDisplay(medianScore)

  console.log(`Formatted scores: Excellent: ${displayExcellent}, Median: ${displayMedian}`)

  const guidanceRows = [
    { label: 'Excellent Score', value: displayExcellent },
    { label: 'Median Score', value: displayMedian },
    { label: 'Your score', value: '' },
    { label: 'Percentile', value: '' }
  ]

  return {
    excellentScore: displayExcellent,
    medianScore: displayMedian,
    stdDev: stdDev,
    guidanceRows: guidanceRows
  }
}

// === FALLBACK CREATION (Exact Google Script Logic) ===
function createFallbackMetCon(user: any): any {
  console.log('Creating fallback MetCon')

  const fallbackExercises = [
    {
      name: 'Air Squats',
      sets: '',
      reps: '10',
      weightTime: '',
      notes: 'FALLBACK - Bodyweight conditioning'
    },
    {
      name: 'Push-ups',
      sets: '',
      reps: '8',
      weightTime: '',
      notes: 'FALLBACK - Bodyweight conditioning'
    },
    {
      name: 'Mountain Climbers',
      sets: '',
      reps: '12',
      weightTime: '',
      notes: 'FALLBACK - Bodyweight conditioning'
    }
  ]

  return {
    exercises: fallbackExercises,
    workoutId: 'FALLBACK-001',
    format: 'AMRAP',
    timeRange: '12 minutes',
    percentileGuidance: {
      excellentScore: '8 rounds',
      medianScore: '5 rounds',
      guidanceRows: [
        { label: 'Excellent Score', value: '8 rounds' },
        { label: 'Median Score', value: '5 rounds' },
        { label: 'Your score', value: '' },
        { label: 'Percentile', value: '' }
      ]
    }
  }
}

function createFallbackExercises(user: any): any[] {
  return [
    {
      name: 'Air Squats',
      sets: '',
      reps: '15',
      weightTime: '',
      notes: 'FALLBACK - Bodyweight conditioning'
    },
    {
      name: 'Push-ups',
      sets: '',
      reps: '10',
      weightTime: '',
      notes: 'FALLBACK - Bodyweight conditioning'
    },
    {
      name: 'Mountain Climbers',
      sets: '',
      reps: '20',
      weightTime: '',
      notes: 'FALLBACK - Bodyweight conditioning'
    }
  ]
}

// === HELPER FUNCTIONS (Exact Google Script Logic) ===
function formatScoreForDisplay(score: any): string {
  if (!score || score === '') return ''

  const scoreStr = score.toString().trim()

  // If it's already in time format, return as-is
  if (isTimeFormat(scoreStr)) {
    return scoreStr
  }

  // If it's a number, check if it should be displayed as time
  const numericValue = parseFloat(scoreStr)
  if (!isNaN(numericValue)) {
    // For MetCons, if the number is between 30 seconds and 2 hours, format as time
    if (numericValue >= 30 && numericValue <= 7200) {
      return secondsToTime(numericValue)
    }
    return scoreStr
  }

  return scoreStr
}

function isTimeFormat(score: string): boolean {
  if (typeof score !== 'string') return false
  const timePattern = /^\d{1,3}:[0-5]\d$/
  return timePattern.test(score.trim())
}

function secondsToTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
