import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { user, week, day } = await req.json()

    console.log(`🏃 Assigning MetCon for ${user.name}, Week ${week}, Day ${day}`)

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
          percentileGuidance: fallbackResult.percentileGuidance
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Select suitable MetCon (exact Google Script logic)
    const selectedWorkout = selectMetCon(metconData, user)
    
    if (!selectedWorkout) {
      console.log('No suitable MetCon found, creating fallback')
      const fallbackResult = createFallbackMetCon(user)
      return new Response(
        JSON.stringify({ 
          success: true, 
          exercises: fallbackResult.exercises,
          workoutId: fallbackResult.workoutId,
          workoutFormat: fallbackResult.format,
          timeRange: fallbackResult.timeRange,
          percentileGuidance: fallbackResult.percentileGuidance
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
        percentileGuidance: percentileGuidance
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

// === METCON SELECTION LOGIC (Exact Google Script Logic) ===
function selectMetCon(metconData: any[], user: any): any | null {
  console.log('Starting MetCon selection. Available workouts: ' + metconData.length)
  
  if (!metconData || metconData.length === 0) {
    console.log('No MetCon data available')
    return null
  }
  
  // Step 1: Filter out completely empty rows and filter by equipment
  let suitableWorkouts = metconData.filter(workout => {
    // Skip completely empty rows
    if (!workout || !workout.workout_id || workout.workout_id === '' || !workout.format || workout.format === '') {
      return false
    }
    
    const requiredEquipment = workout.required_equipment || []
    console.log(`Workout ${workout.workout_id} requires equipment: ${requiredEquipment.join(', ')}`)
    
    // If workout requires no equipment or says "None"
    if (requiredEquipment.length === 0 || requiredEquipment.includes('None')) {
      return true
    }
    
    // If user has no equipment, only allow bodyweight workouts
    if (user.equipment.length === 0) {
      return requiredEquipment.every((eq: string) => eq === 'None' || eq === '' || eq.toLowerCase() === 'bodyweight')
    }
    
    // Check if user has required equipment
    return requiredEquipment.every((equipment: string) => 
      equipment === 'None' || equipment === '' || user.equipment.includes(equipment)
    )
  })
  
  console.log(`After equipment filter: ${suitableWorkouts.length} workouts`)
  
  // Step 2: Filter by level if desired
  if (suitableWorkouts.length > 1) {
    const userLevel = user.ability || 'Beginner'
    const levelPreferred = suitableWorkouts.filter(workout => {
      const workoutLevel = workout.level || 'Beginner'
      return workoutLevel.toLowerCase() === userLevel.toLowerCase()
    })
    
    if (levelPreferred.length > 0) {
      suitableWorkouts = levelPreferred
      console.log(`After level filter (${userLevel}): ${suitableWorkouts.length} workouts`)
    }
  }
  
  // Step 3: If no matches, be more lenient with equipment
  if (suitableWorkouts.length === 0) {
    console.log('No equipment matches, using lenient filtering')
    suitableWorkouts = metconData.filter(workout => {
      // Skip completely empty rows
      if (!workout || !workout.workout_id || workout.workout_id === '' || !workout.format || workout.format === '') {
        return false
      }
      
      const requiredEquipment = workout.required_equipment || []
      
      // Allow basic equipment substitutions
      const hasBasicSubstitutes = requiredEquipment.every((equipment: string) => {
        if (equipment === 'None' || equipment === '' || equipment.toLowerCase() === 'bodyweight') return true
        if (equipment === 'Dumbbells' && user.equipment.includes('Kettlebells')) return true
        if (equipment === 'Pullup Bar or Rig' && user.equipment.includes('Pull-up Bar')) return true
        if (equipment === 'Barbell' && user.equipment.includes('Dumbbells')) return true
        return user.equipment.includes(equipment)
      })
      
      return hasBasicSubstitutes
    })
  }
  
  // Step 4: Final fallback - use any valid workout
  if (suitableWorkouts.length === 0) {
    console.log('Using any available workout as final fallback')
    suitableWorkouts = metconData.filter(workout => 
      workout && workout.workout_id && workout.workout_id !== '' && workout.format && workout.format !== ''
    )
  }
  
  // Step 5: Return null if still nothing (will trigger fallback creation)
  if (suitableWorkouts.length === 0) {
    console.log('No suitable workouts found at all')
    return null
  }
  
  // Select a random workout
  const randomIndex = Math.floor(Math.random() * suitableWorkouts.length)
  const selectedWorkout = suitableWorkouts[randomIndex]
  
  console.log(`Selected workout: ${selectedWorkout.workout_id} - ${selectedWorkout.format} - ${selectedWorkout.time_range}`)
  return selectedWorkout
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
      
      let exerciseNotes = ''
      if (index === 0 && workout.workout_notes && workout.workout_notes !== '') {
        exerciseNotes = workout.workout_notes
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
        notes: exerciseNotes
      }
      
      exercises.push(exerciseObj)
      console.log(`Added task: ${task.exercise}, ${displayReps} reps, ${weightTime}, Notes: ${exerciseNotes}`)
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
