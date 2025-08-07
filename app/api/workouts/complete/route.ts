'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { use } from 'react'

interface Exercise {
  name: string
  sets: number | string
  reps: number | string
  weightTime: string
  notes: string
}

interface Block {
  blockName: string
  exercises: Exercise[]
}

interface WorkoutData {
  programId: number
  week: number
  day: number
  dayName: string
  mainLift: string
  isDeload: boolean
 userGender: string  // ← ADD THIS LINE
  blocks: Block[]
metconData?: {
  id: number
  workoutId: string
  workoutFormat: string
  workoutNotes: string
  timeRange: string
  tasks: Array<{
    reps: string
    time: string
    calories: string
    distance: string
    exercise: string
    weight_male: string
    weight_female: string
  }>
  percentileGuidance: {
    male: {
      excellentScore: string
      medianScore: string
      stdDev: string
    }
    female: {
      excellentScore: string
      medianScore: string
      stdDev: string
    }
  }
  rxWeights: {
    male: string
    female: string
  }
} 
 totalExercises: number 
}


interface Completion {
  exerciseName: string
  setsCompleted?: number
  repsCompleted?: string
  weightUsed?: number
  rpe?: number
  quality?: string
  notes?: string
  wasRx?: boolean
}


const getCurrentUserId = async () => {
  console.log('🔍 getCurrentUserId called')
  
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  
  console.log('📱 Getting auth user...')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError) {
    console.error('❌ Auth error:', authError)
    throw new Error('Auth error: ' + authError.message)
  }
  
  if (!user) {
    console.error('❌ No user found in auth')
    throw new Error('Not authenticated')
  }
  
  console.log('✅ Auth user found:', user.id)
  
  console.log('🔍 Looking up database user...')
  const { data: userData, error: dbError } = await supabase
    .from('users')
    .select('id, auth_id, email')
    .eq('auth_id', user.id)
    .single()
  
  if (dbError) {
    console.error('❌ Database error:', dbError)
    throw new Error('Database error: ' + dbError.message)
  }
  
  console.log('📊 Database query result:', userData)
  
  if (!userData) {
    console.error('❌ No database user found')
    throw new Error('User not found in database')
  }
  
  console.log('✅ Returning user ID:', userData.id)
  return userData.id
}

// Client component that handles all the hooks
function WorkoutPageClient({ programId, week, day }: { programId: string; week: string; day: string }) {
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [completions, setCompletions] = useState<Record<string, Completion>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    'SKILLS': true,
    'STRENGTH AND POWER': true
  })
  
 
  useEffect(() => {
    fetchWorkout()
    fetchCompletions()
  }, [programId, week, day])

  const fetchWorkout = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workouts/${programId}/week/${week}/day/${day}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch workout')
      }

      const data = await response.json()
      if (data.success) {
        setWorkout(data.workout)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchCompletions = async () => {
    try {
      const userId = await getCurrentUserId()
      const response = await fetch(`/api/workouts/complete?userId=${userId}&programId=${programId}&week=${week}&day=${day}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const completionMap: Record<string, Completion> = {}
          data.completions.forEach((comp: any) => {
            completionMap[comp.exercise_name] = {
              exerciseName: comp.exercise_name,
              setsCompleted: comp.sets_completed,
              repsCompleted: comp.reps_completed,
              weightUsed: comp.weight_used,
              rpe: comp.rpe,
              notes: comp.notes,
              wasRx: comp.was_rx
            }
          })
          setCompletions(completionMap)
        }
      }
    } catch (err) {
      console.log('No previous completions found')
    }
  }

const logCompletion = async (exerciseName: string, block: string, completion: Partial<Completion>) => {
  console.log('🚀 logCompletion called for:', exerciseName)
  
  // Extract set number from exercise name if it exists
  const setMatch = exerciseName.match(/Set (\d+)$/);
  const setNumber = setMatch ? parseInt(setMatch[1]) : 1;
  
  // Clean exercise name (remove "- Set X" part)
  const cleanExerciseName = exerciseName.replace(/ - Set \d+$/, '');
  
  try {
    const userId = await getCurrentUserId()
    console.log('🔢 About to make POST with userId:', userId, 'setNumber:', setNumber)
    
    const response = await fetch('/api/workouts/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        programId: parseInt(programId),
        userId,
        week: parseInt(week),
        day: parseInt(day),
        block,
        exerciseName: cleanExerciseName,
        setNumber,
        ...completion
      })
    })
    
    console.log('📡 POST response:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        setCompletions(prev => ({
          ...prev,
          [exerciseName]: { exerciseName, ...completion }
        }))
      }
    }
  } catch (err) {
    console.error('Failed to log completion:', err)
  }
}


const logMetConCompletion = async (workoutScore: string, taskCompletions: {exerciseName: string, rpe: number, quality: string}[]) => {
  try {
    const userId = await getCurrentUserId()
    
    // 1. Log each task to performance_logs
    const taskPromises = taskCompletions.map(task => 
      fetch('/api/workouts/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: parseInt(programId),
          userId,
          week: parseInt(week),
          day: parseInt(day),
          block: 'METCONS',
          exerciseName: task.exerciseName,
          repsCompleted: '', // Tasks don't have individual reps
          rpe: task.rpe,
          quality: task.quality,
          notes: `Part of ${workout?.metconData?.workoutId}`
        })
      })
    )
    
    // 2. Log overall workout to program_metcons
    const metconPromise = fetch('/api/metcons/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programId: parseInt(programId),
        userId,
        week: parseInt(week),
        day: parseInt(day),
        workoutScore,
        metconId: workout?.metconData?.id // We'll need this
      })
    })
    
    // Execute all API calls
    await Promise.all([...taskPromises, metconPromise])
    
    console.log('✅ MetCon completion logged successfully!')
    
    // Update UI to show completion
    // TODO: Update completion state
    
  } catch (error) {
    console.error('❌ Failed to log MetCon completion:', error)
  }
}


  const toggleBlock = (blockName: string) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockName]: !prev[blockName]
    }))
  }

  const getBlockIcon = (blockName: string) => {
    switch (blockName) {
      case 'SKILLS': return '🎯'
      case 'TECHNICAL WORK': return '🔧'
      case 'STRENGTH AND POWER': return '💪'
      case 'ACCESSORIES': return '🔨'
      case 'METCONS': return '🔥'
      default: return '📋'
    }
  }

  const getBlockColor = (blockName: string) => {
    switch (blockName) {
      case 'SKILLS': return 'bg-purple-50 border-purple-200'
      case 'TECHNICAL WORK': return 'bg-blue-50 border-blue-200'
      case 'STRENGTH AND POWER': return 'bg-red-50 border-red-200'
      case 'ACCESSORIES': return 'bg-green-50 border-green-200'
      case 'METCONS': return 'bg-orange-50 border-orange-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const calculateProgress = () => {
    if (!workout) return 0
    const totalExercises = workout.blocks.reduce((sum, block) => sum + block.exercises.length, 0)
    const completedExercises = Object.keys(completions).length
    return totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workout...</p>
        </div>
      </div>
    )
  }

  if (error || !workout) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Workout Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const progress = calculateProgress()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
                ← Dashboard
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {workout.dayName} - {workout.mainLift}
                </h1>
                <p className="text-sm text-gray-600">
                  Week {workout.week}, Day {workout.day}
                  {workout.isDeload && <span className="ml-2 text-yellow-600">• Deload Week</span>}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Progress</div>
              <div className="flex items-center space-x-2">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {workout.blocks.map((block, blockIndex) => (
          <div key={blockIndex} className={`mb-6 rounded-lg border-2 ${getBlockColor(block.blockName)}`}>
            {/* Block Header */}
            <button
              onClick={() => toggleBlock(block.blockName)}
              className="w-full p-4 text-left hover:bg-white/50 transition-colors rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getBlockIcon(block.blockName)}</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{block.blockName}</h2>
                    <p className="text-sm text-gray-600">
                      {block.exercises.length} exercise{block.exercises.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {block.exercises.filter(ex => completions[ex.name]).length}/{block.exercises.length} complete
                  </span>
                  <span className="text-gray-400">
                    {expandedBlocks[block.blockName] ? '▼' : '▶'}
                  </span>
                </div>
              </div>
            </button>

        {/* Block Content */}
{expandedBlocks[block.blockName] && (
  <div className="px-4 pb-4 space-y-4">
    {block.exercises.length === 0 ? (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">✨</div>
        <p>No exercises in this block today</p>
      </div>
    ) : (
      
block.blockName === 'METCONS' ? (

<MetConCard
  metconData={workout.metconData}
  onComplete={(workoutScore, taskCompletions) => {
    logMetConCompletion(workoutScore, taskCompletions)
  }}
/>

) : (
  block.exercises.map((exercise, exerciseIndex) => {
    console.log('Exercise object:', exercise);
    return (
      <ExerciseCard
        key={exerciseIndex}
        exercise={exercise}
        block={block.blockName}
        completion={completions[exercise.name]}
        onComplete={(completion) => {
          // Extract set info from exercise notes
          const setMatch = exercise.notes.match(/Set (\d+)/);
          const setNumber = setMatch ? parseInt(setMatch[1]) : 1;
          const exerciseWithSet = `${exercise.name} - Set ${setNumber}`;
          logCompletion(exerciseWithSet, block.blockName, completion);
        }}
      />
    )
  })
)

    )}
  </div>
)}
          </div>
        ))}

        {/* MetCon Special Section */}
        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Link 
            href={`/dashboard/workout/${programId}/week/${week}/day/${Math.max(1, parseInt(day) - 1)}`}
            className={`px-4 py-2 rounded-lg ${parseInt(day) > 1 
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            ← Previous Day
          </Link>
          
          <Link 
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
          
          <Link 
            href={`/dashboard/workout/${programId}/week/${week}/day/${Math.min(5, parseInt(day) + 1)}`}
            className={`px-4 py-2 rounded-lg ${parseInt(day) < 5 
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            Next Day →
          </Link>
        </div>
      </main>
    </div>
  )
}

// Main page component that handles the async params
export default function WorkoutPage({ 
  params 
}: { 
  params: Promise<{ programId: string; week: string; day: string }> 
}) {
  const resolvedParams = use(params)
  
  return <WorkoutPageClient {...resolvedParams} />
}

// Exercise Card Component
function ExerciseCard({ 
  exercise, 
  block, 
  completion, 
  onComplete 
}: { 
  exercise: Exercise
  block: string
  completion?: Completion
  onComplete: (completion: Partial<Completion>) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true) // Changed to true - always show expanded
  const [formData, setFormData] = useState({
    setsCompleted: completion?.setsCompleted || '',
    repsCompleted: completion?.repsCompleted || '',
    weightUsed: completion?.weightUsed || '',
    rpe: completion?.rpe || '',
    quality: completion?.quality || '',
    notes: completion?.notes || '',
    wasRx: completion?.wasRx ?? true
  })

  const isCompleted = completion !== undefined

  const handleQuickComplete = () => {
    onComplete({
      setsCompleted: typeof exercise.sets === 'number' ? exercise.sets : undefined,
      repsCompleted: exercise.reps.toString(),
      weightUsed: exercise.weightTime ? parseFloat(exercise.weightTime) : undefined,
      wasRx: true
    })
  }

  const handleDetailedSubmit = () => {
    onComplete({
      setsCompleted: formData.setsCompleted ? parseInt(formData.setsCompleted.toString()) : undefined,
      repsCompleted: formData.repsCompleted.toString(),
      weightUsed: formData.weightUsed ? parseFloat(formData.weightUsed.toString()) : undefined,
      rpe: formData.rpe ? parseInt(formData.rpe.toString()) : undefined,
      quality: formData.quality || undefined,
      notes: formData.notes.toString(),
      wasRx: formData.wasRx
    })
    setIsExpanded(false)
  }

  return (
    <div className={`bg-white rounded-lg border-2 transition-all ${
      isCompleted 
        ? 'border-green-200 bg-green-50' 
        : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{exercise.name}</h3>
              {isCompleted && <span className="text-green-600 text-xl">✅</span>}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
              <div>
                <span className="text-gray-600">Sets:</span>
                <span className="ml-1 font-medium">{exercise.sets || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600">Reps:</span>
                <span className="ml-1 font-medium">{exercise.reps || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600">Weight:</span>
                <span className="ml-1 font-medium">{exercise.weightTime || 'BW'}</span>
              </div>
              {completion && (
                <div>
                  <span className="text-gray-600">RPE:</span>
                  <span className="ml-1 font-medium">{completion.rpe || '-'}/10</span>
                </div>
              )}
            </div>

            {exercise.notes && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                <p className="text-sm text-blue-800">💡 {exercise.notes}</p>
              </div>
            )}

            {completion?.notes && (
              <div className="bg-gray-50 border border-gray-200 rounded p-2 mb-3">
                <p className="text-sm text-gray-700">📝 {completion.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isExpanded 
                ? 'bg-gray-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isExpanded ? 'Hide Form' : 'Show Form'}
          </button>
        </div>

        {/* Expanded Form */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sets</label>
                <input
                  type="number"
                  value={formData.setsCompleted}
                  onChange={(e) => setFormData(prev => ({ ...prev, setsCompleted: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                  placeholder={exercise.sets.toString()}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Reps</label>
                <input
                  type="text"
                  value={formData.repsCompleted}
                  onChange={(e) => setFormData(prev => ({ ...prev, repsCompleted: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                  placeholder={exercise.reps.toString()}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Weight</label>
                <input
                  type="number"
                  value={formData.weightUsed}
                  onChange={(e) => setFormData(prev => ({ ...prev, weightUsed: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                  placeholder={exercise.weightTime}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">RPE (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.rpe}
                  onChange={(e) => setFormData(prev => ({ ...prev, rpe: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="7"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Quality</label>
                <select
                  value={formData.quality}
                  onChange={(e) => setFormData(prev => ({ ...prev, quality: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="">-</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full p-2 border rounded text-sm"
                rows={2}
                placeholder="How did it feel? Any observations..."
              />
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.wasRx}
                  onChange={(e) => setFormData(prev => ({ ...prev, wasRx: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Completed as prescribed (Rx)</span>
              </label>
            </div>

            <button
              onClick={handleDetailedSubmit}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isCompleted ? 'Update Completion' : 'Log Completion'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MetConCard({ 
  metconData, 
  onComplete 
}: { 
  metconData?: {
    id: number
    workoutId: string
    workoutFormat: string
    workoutNotes: string
    timeRange: string
    tasks: Array<{
      reps: string
      exercise: string
      weight_male: string
      weight_female: string
    }>
    percentileGuidance: {
      male: { excellentScore: string, medianScore: string }
      female: { excellentScore: string, medianScore: string }
    }
    rxWeights: { male: string, female: string }
  }
  onComplete: (workoutScore: string, taskCompletions: {exerciseName: string, rpe: number, quality: string}[]) => void
}) {
  // ✅ ADD THESE STATE VARIABLES FOR UI FEEDBACK
  const [isExpanded, setIsExpanded] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  
  const [workoutScore, setWorkoutScore] = useState('')
  const [taskRPEs, setTaskRPEs] = useState<{[key: string]: number}>({})
  const [taskQualities, setTaskQualities] = useState<{[key: string]: string}>({})
  const [notes, setNotes] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')

  const handleTaskRPE = (exerciseName: string, rpe: number) => {
    setTaskRPEs(prev => ({...prev, [exerciseName]: rpe}))
  }

  const handleTaskQuality = (exerciseName: string, quality: string) => {
    setTaskQualities(prev => ({...prev, [exerciseName]: quality}))
  }

  // ✅ ENHANCED SUBMIT HANDLER WITH UI FEEDBACK
  const handleSubmit = async () => {
    if (!workoutScore.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const taskCompletions = metconData?.tasks.map(task => ({
        exerciseName: task.exercise,
        rpe: taskRPEs[task.exercise] || 5,
        quality: taskQualities[task.exercise] || 'C'
      })) || []
      
      await onComplete(workoutScore, taskCompletions)
      
      // ✅ SUCCESS FEEDBACK
      setIsCompleted(true)
      setIsExpanded(false)
      setShowSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000)
      
    } catch (error) {
      console.error('Error submitting MetCon:', error)
      // ✅ TODO: Add error feedback here if needed
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!metconData) return null

  const currentBenchmarks = metconData.percentileGuidance[gender]
  const currentRxWeight = metconData.rxWeights[gender]

  return (
    <div className={`rounded-lg border-2 transition-all ${
      isCompleted 
        ? 'bg-green-50 border-green-200' 
        : 'bg-orange-50 border-orange-200'
    }`}>
      {/* ✅ SUCCESS MESSAGE */}
      {showSuccess && (
        <div className="bg-green-500 text-white p-3 rounded-t-lg text-center font-medium">
          ✅ MetCon completion logged successfully!
        </div>
      )}
      
      <div className="p-6">
        {/* Workout Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">
              🔥 {metconData.workoutId}
            </h3>
            {/* ✅ COMPLETION CHECKMARK */}
            {isCompleted && <span className="text-green-600 text-xl">✅</span>}
          </div>
          
          <p className="text-gray-700 mb-2 font-medium">{metconData.workoutNotes}</p>
          <p className="text-sm text-gray-600 mb-1">{metconData.workoutFormat}</p>
          <p className="text-sm text-gray-600 mb-4">Time Range: {metconData.timeRange}</p>
          
          {/* Gender Selection - Only show if not completed */}
          {!isCompleted && (
            <div className="flex justify-center mb-4">
              <div className="flex bg-white rounded-lg p-1 border">
                <button
                  onClick={() => setGender('male')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    gender === 'male' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Male
                </button>
                <button
                  onClick={() => setGender('female')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    gender === 'female' 
                      ? 'bg-pink-500 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Female
                </button>
              </div>
            </div>
          )}
          
          {/* Enhanced Benchmarks */}
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Excellent</div>
              <div className="font-bold text-green-600">{currentBenchmarks.excellentScore}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Median</div>
              <div className="font-bold text-blue-600">{currentBenchmarks.medianScore}</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm text-gray-600">Rx Weight</div>
              <div className="font-bold text-orange-600">{currentRxWeight}</div>
            </div>
          </div>
        </div>

        {/* ✅ TOGGLE BUTTON (like ExerciseCard) */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isExpanded 
                ? 'bg-gray-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isExpanded ? 'Hide Form' : 'Show Form'}
          </button>
        </div>

        {/* ✅ CONDITIONAL FORM DISPLAY */}
        {isExpanded && !isCompleted && (
          <>
            {/* Tasks from Database */}
            <div className="space-y-4 mb-6">
              {metconData.tasks.map((task, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{task.exercise}</h4>
                      <p className="text-sm text-gray-600">
                        {task.reps} reps {task.weight_male && `@ ${gender === 'male' ? task.weight_male : task.weight_female} lbs`}
                      </p>
                    </div>
                  </div>
                  
                  {/* RPE and Quality inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">RPE (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={taskRPEs[task.exercise] || ''}
                        onChange={(e) => handleTaskRPE(task.exercise, parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
                      <select
                        value={taskQualities[task.exercise] || 'C'}
                        onChange={(e) => handleTaskQuality(task.exercise, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={isSubmitting}
                      >
                        <option value="A">A - Excellent</option>
                        <option value="B">B - Good</option>
                        <option value="C">C - Average</option>
                        <option value="D">D - Poor</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Score */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Score</label>
              <input
                type="text"
                placeholder="e.g., 674 total reps, 12:34, 8 rounds + 15"
                value={workoutScore}
                onChange={(e) => setWorkoutScore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
                disabled={isSubmitting}
              />
              
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                placeholder="How did it feel? Any observations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* ✅ ENHANCED SUBMIT BUTTON WITH LOADING STATE */}
            <button
              onClick={handleSubmit}
              disabled={!workoutScore.trim() || isSubmitting}
              className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging MetCon...
                </>
              ) : (
                'Log MetCon Completion'
              )}
            </button>
          </>
        )}

        {/* ✅ COMPLETED STATE DISPLAY */}
        {isCompleted && (
          <div className="text-center py-4">
            <div className="text-green-600 text-4xl mb-2">🎉</div>
            <p className="text-gray-700 font-medium">MetCon completed!</p>
            <p className="text-sm text-gray-600">Your score: {workoutScore}</p>
          </div>
        )}
      </div>
    </div>
  )
}





MacBook-Air-3:crossfit-training-app mattwiebke$ cd app
MacBook-Air-3:app mattwiebke$ cat api/workouts/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CompletionData {
  programId: number
  userId: number
  week: number
  day: number
  block: string
  exerciseName: string
  setNumber?: number 
  setsCompleted?: number
  repsCompleted?: number | string  // Can be number or string like "8-10" or "AMRAP"
  weightUsed?: number
  timeCompleted?: string  // For time-based exercises like "5:30"
  caloriesCompleted?: number  // For calorie-based exercises
  distanceCompleted?: string  // For distance-based exercises
  rpe?: number  // Rate of Perceived Exertion (1-10)
  quality?: string  // Quality grade (A, B, C, D)
  notes?: string
  wasRx?: boolean  // Did they do the workout as prescribed?
  scalingUsed?: string  // What scaling modifications were used
}

// =============================================================================
// WEEKLY SUMMARY FUNCTIONS - NEW ADDITION
// =============================================================================

/**
 * Update weekly summary after workout completion
 * Translates Google Apps Script logic to TypeScript/Supabase
 */
async function updateWeeklySummary(data: {
  userId: number;
  programId: number;
  week: number;
}) {
  try {
    console.log(`📊 Updating weekly summary for User ${data.userId}, Week ${data.week}`);
    
    // Step 1: Aggregate data by training block
    const blockAggregations = await aggregateByTrainingBlock(data);
    
    // Step 2: Get MetCon percentile data
    const metconData = await getMetconAggregation(data);
    
    // Step 3: Calculate overall totals
    const overallTotals = await calculateOverallTotals(data);
    
    // Step 4: Upsert into weekly_summaries
    const summaryData = {
      program_id: data.programId,
      user_id: data.userId,
      week: data.week,
      
      // Training block aggregations
      skills_completed: blockAggregations.SKILLS?.count || 0,
      skills_avg_rpe: blockAggregations.SKILLS?.avgRpe || null,
      skills_avg_quality: blockAggregations.SKILLS?.avgQuality || null,
      
      technical_completed: blockAggregations['TECHNICAL WORK']?.count || 0,
      technical_avg_rpe: blockAggregations['TECHNICAL WORK']?.avgRpe || null,
      technical_avg_quality: blockAggregations['TECHNICAL WORK']?.avgQuality || null,
      
      strength_completed: blockAggregations['STRENGTH AND POWER']?.count || 0,
      strength_avg_rpe: blockAggregations['STRENGTH AND POWER']?.avgRpe || null,
      strength_avg_quality: blockAggregations['STRENGTH AND POWER']?.avgQuality || null,
      
      accessories_completed: blockAggregations.ACCESSORIES?.count || 0,
      accessories_avg_rpe: blockAggregations.ACCESSORIES?.avgRpe || null,
      accessories_avg_quality: blockAggregations.ACCESSORIES?.avgQuality || null,
      
      metcons_completed: metconData.count,
      metcons_avg_percentile: metconData.avgPercentile,
      
      // Overall totals
      total_exercises_completed: overallTotals.totalExercises,
      overall_avg_rpe: overallTotals.avgRpe,
      overall_avg_quality: overallTotals.avgQuality,
      
      calculated_at: new Date().toISOString()
    };

// Upsert (insert or update if exists)
const { error } = await supabase
  .from('weekly_summaries')
  .upsert(summaryData, {
    onConflict: 'program_id,week',
    ignoreDuplicates: false
  });    

    if (error) {
      console.error('❌ Error updating weekly summary:', error);
      return;
    }
    
    console.log(`✅ Updated weekly summary: ${overallTotals.totalExercises} exercises, avg RPE ${overallTotals.avgRpe}`);
    
  } catch (error) {
    console.error('❌ Error in updateWeeklySummary:', error);
  }
}

/**
 * Aggregate performance data by training block
 */
async function aggregateByTrainingBlock(data: { userId: number; week: number }) {
  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('block, rpe, completion_quality')
    .eq('user_id', data.userId)
    .eq('week', data.week);
    
  if (error) {
    console.error('❌ Error fetching performance data:', error);
    return {};
  }
  
  const aggregations: Record<string, any> = {};
  
  // Group by block and calculate averages
  performanceData?.forEach((entry: any) => {
    const block = entry.block;
    
    if (!aggregations[block]) {
      aggregations[block] = {
        count: 0,
        totalRpe: 0,
        totalQuality: 0
      };
    }
    
    aggregations[block].count++;
    aggregations[block].totalRpe += entry.rpe || 0;
    aggregations[block].totalQuality += entry.completion_quality || 0;
  });
  
  // Calculate averages
  Object.keys(aggregations).forEach(block => {
    const blockData = aggregations[block];
    aggregations[block] = {
      count: blockData.count,
      avgRpe: blockData.count > 0 ? Math.round((blockData.totalRpe / blockData.count) * 10) / 10 : null,
      avgQuality: blockData.count > 0 ? Math.round((blockData.totalQuality / blockData.count) * 10) / 10 : null
    };
  });
  
  return aggregations;
}

/**
 * Get MetCon aggregation data
 */
async function getMetconAggregation(data: { programId: number; week: number }) {
  const { data: metconData, error } = await supabase
    .from('program_metcons')
    .select('percentile')
    .eq('program_id', data.programId)
    .eq('week', data.week)
    .not('user_score', 'is', null);
    
  if (error || !metconData?.length) {
    return { count: 0, avgPercentile: null };
  }
  
  const percentiles = metconData.map((m: any) => parseFloat(m.percentile)).filter(p => !isNaN(p));
  const avgPercentile = percentiles.length > 0 
    ? Math.round((percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length) * 100) / 100
    : null;
    
  return {
    count: percentiles.length,
    avgPercentile
  };
}

/**
 * Calculate overall totals across all blocks
 */
async function calculateOverallTotals(data: { userId: number; week: number }) {
  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('rpe, completion_quality')
    .eq('user_id', data.userId)
    .eq('week', data.week);
    
  if (error || !performanceData?.length) {
    return { totalExercises: 0, avgRpe: null, avgQuality: null };
  }
  
  const totalExercises = performanceData.length;
  const validRpe = performanceData.filter((p: any) => p.rpe).map((p: any) => p.rpe);
  const validQuality = performanceData.filter((p: any) => p.completion_quality).map((p: any) => p.completion_quality);
  
  const avgRpe = validRpe.length > 0 
    ? Math.round((validRpe.reduce((sum: number, rpe: number) => sum + rpe, 0) / validRpe.length) * 10) / 10
    : null;
    
  const avgQuality = validQuality.length > 0
    ? Math.round((validQuality.reduce((sum: number, q: number) => sum + q, 0) / validQuality.length) * 10) / 10
    : null;
    
  return { totalExercises, avgRpe, avgQuality };
}

// =============================================================================
// EXISTING ROUTE HANDLERS
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Exercise completion logging called')
    
    const body = await request.json()
    const completionData: CompletionData = body

    // Validate required fields
    if (!completionData.programId || !completionData.userId || 
        !completionData.week || !completionData.day || 
        !completionData.block || !completionData.exerciseName) {
      return NextResponse.json(
        { error: 'Missing required fields: programId, userId, week, day, block, exerciseName' },
        { status: 400 }
      )
    }

    // Validate numeric ranges
    if (completionData.week < 1 || completionData.week > 12) {
      return NextResponse.json(
        { error: 'Week must be between 1 and 12' },
        { status: 400 }
      )
    }

    if (completionData.day < 1 || completionData.day > 5) {
      return NextResponse.json(
        { error: 'Day must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (completionData.rpe && (completionData.rpe < 1 || completionData.rpe > 10)) {
      return NextResponse.json(
        { error: 'RPE must be between 1 and 10' },
        { status: 400 }
      )
    }

    if (completionData.quality && !['A', 'B', 'C', 'D'].includes(completionData.quality)) {
      return NextResponse.json(
        { error: 'Quality must be A, B, C, or D' },
        { status: 400 }
      )
    }

    console.log(`📊 Logging completion: ${completionData.exerciseName} - Week ${completionData.week}, Day ${completionData.day}`)

    // Check if this exact completion already exists (prevent duplicates)
    const { data: existingCompletion } = await supabase
      .from('workout_completions')
      .select('id')
      .eq('user_id', completionData.userId)
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('block', completionData.block)
      .eq('exercise_name', completionData.exerciseName)
      .eq('set_number', completionData.setNumber || 1)
      .single()

    let result
    if (existingCompletion) {
      // Update existing completion
      console.log('🔄 Updating existing completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .update({
          set_number: completionData.setNumber || 1,
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Create new completion
      console.log('✨ Creating new completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .insert({
          user_id: completionData.userId,
          program_id: completionData.programId,
          week: completionData.week,
          day: completionData.day,
          block: completionData.block,
          exercise_name: completionData.exerciseName,
          set_number: completionData.setNumber || 1,
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('❌ Failed to save completion:', result.error)
      return NextResponse.json(
        { error: 'Failed to save workout completion', details: result.error.message },
        { status: 500 }
      )
    }

    // Also log to performance_logs for analytics (including quality grade)
    console.log('📊 Logging to performance_logs for analytics...')
    
    // First, try to find the program_workout_id
    const { data: programWorkout } = await supabase
      .from('program_workouts')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
      .eq('block', completionData.block)
      .single()

    // Check if performance log already exists
    const { data: existingPerfLog } = await supabase
      .from('performance_logs')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('user_id', completionData.userId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
      .single()

    // Convert quality letter grade to numeric if needed
    const qualityNumeric = completionData.quality ? 
      { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[completionData.quality] : null

    const perfLogData = {
      program_id: completionData.programId,
      user_id: completionData.userId,
      program_workout_id: programWorkout?.id,
      week: completionData.week,
      day: completionData.day,
      block: completionData.block,
      exercise_name: completionData.exerciseName,
      sets: completionData.setsCompleted?.toString(),
      set_number: completionData.setNumber || 1,
      reps: completionData.repsCompleted?.toString(),
      weight_time: completionData.weightUsed?.toString(),
      result: completionData.notes,
      rpe: completionData.rpe,
      completion_quality: qualityNumeric,
      quality_grade: completionData.quality,
      logged_at: new Date().toISOString()
    }

    if (existingPerfLog) {
      // Update existing performance log
      await supabase
        .from('performance_logs')
        .update(perfLogData)
        .eq('id', existingPerfLog.id)
    } else {
      // Create new performance log
      await supabase
        .from('performance_logs')
        .insert(perfLogData)
    }

    console.log('✅ Workout completion saved successfully')

    // =============================================================================
    // NEW: UPDATE WEEKLY SUMMARY AFTER SUCCESSFUL COMPLETION
    // =============================================================================
    try {
      await updateWeeklySummary({
        userId: completionData.userId,
        programId: completionData.programId,
        week: completionData.week
      });
    } catch (summaryError) {
      console.error('❌ Error updating weekly summary (non-blocking):', summaryError);
      // Don't fail the entire request if weekly summary update fails
    }

    // Get completion stats for this workout session
    const { data: sessionStats } = await supabase
      .from('workout_completions')
      .select('exercise_name')
      .eq('user_id', completionData.userId)
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)

    const completedExercises = sessionStats?.length || 0

    return NextResponse.json({
      success: true,
      completion: result.data,
      sessionStats: {
        completedExercises,
        week: completionData.week,
        day: completionData.day,
        block: completionData.block
      },
      message: existingCompletion ? 'Workout completion updated successfully' : 'Workout completion logged successfully'
    })

  } catch (error) {
    console.error('❌ Unexpected error logging workout completion:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve completions for a specific workout day
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const programId = searchParams.get('programId')
    const week = searchParams.get('week')
    const day = searchParams.get('day')

    if (!userId || !programId || !week || !day) {
      return NextResponse.json(
        { error: 'Missing required query parameters: userId, programId, week, day' },
        { status: 400 }
      )
    }

    console.log(`📊 Fetching completions for User ${userId}, Program ${programId}, Week ${week}, Day ${day}`)

    const { data: completions, error } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', parseInt(userId))
      .eq('program_id', parseInt(programId))
      .eq('week', parseInt(week))
      .eq('day', parseInt(day))
      .order('completed_at', { ascending: true })

    if (error) {
      console.error('❌ Failed to fetch completions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workout completions', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      completions: completions || [],
      totalCompleted: completions?.length || 0
    })

  } catch (error) {
    console.error('❌ Unexpected error fetching completions:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
MacBook-Air-3:app mattwiebke$ cat api/workouts/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CompletionData {
  programId: number
  userId: number
  week: number
  day: number
  block: string
  exerciseName: string
  setNumber?: number 
  setsCompleted?: number
  repsCompleted?: number | string  // Can be number or string like "8-10" or "AMRAP"
  weightUsed?: number
  timeCompleted?: string  // For time-based exercises like "5:30"
  caloriesCompleted?: number  // For calorie-based exercises
  distanceCompleted?: string  // For distance-based exercises
  rpe?: number  // Rate of Perceived Exertion (1-10)
  quality?: string  // Quality grade (A, B, C, D)
  notes?: string
  wasRx?: boolean  // Did they do the workout as prescribed?
  scalingUsed?: string  // What scaling modifications were used
}

// =============================================================================
// WEEKLY SUMMARY FUNCTIONS - NEW ADDITION
// =============================================================================

/**
 * Update weekly summary after workout completion
 * Translates Google Apps Script logic to TypeScript/Supabase
 */
async function updateWeeklySummary(data: {
  userId: number;
  programId: number;
  week: number;
}) {
  try {
    console.log(`📊 Updating weekly summary for User ${data.userId}, Week ${data.week}`);
    
    // Step 1: Aggregate data by training block
    const blockAggregations = await aggregateByTrainingBlock(data);
    
    // Step 2: Get MetCon percentile data
    const metconData = await getMetconAggregation(data);
    
    // Step 3: Calculate overall totals
    const overallTotals = await calculateOverallTotals(data);
    
    // Step 4: Upsert into weekly_summaries
    const summaryData = {
      program_id: data.programId,
      user_id: data.userId,
      week: data.week,
      
      // Training block aggregations
      skills_completed: blockAggregations.SKILLS?.count || 0,
      skills_avg_rpe: blockAggregations.SKILLS?.avgRpe || null,
      skills_avg_quality: blockAggregations.SKILLS?.avgQuality || null,
      
      technical_completed: blockAggregations['TECHNICAL WORK']?.count || 0,
      technical_avg_rpe: blockAggregations['TECHNICAL WORK']?.avgRpe || null,
      technical_avg_quality: blockAggregations['TECHNICAL WORK']?.avgQuality || null,
      
      strength_completed: blockAggregations['STRENGTH AND POWER']?.count || 0,
      strength_avg_rpe: blockAggregations['STRENGTH AND POWER']?.avgRpe || null,
      strength_avg_quality: blockAggregations['STRENGTH AND POWER']?.avgQuality || null,
      
      accessories_completed: blockAggregations.ACCESSORIES?.count || 0,
      accessories_avg_rpe: blockAggregations.ACCESSORIES?.avgRpe || null,
      accessories_avg_quality: blockAggregations.ACCESSORIES?.avgQuality || null,
      
      metcons_completed: metconData.count,
      metcons_avg_percentile: metconData.avgPercentile,
      
      // Overall totals
      total_exercises_completed: overallTotals.totalExercises,
      overall_avg_rpe: overallTotals.avgRpe,
      overall_avg_quality: overallTotals.avgQuality,
      
      calculated_at: new Date().toISOString()
    };

// Upsert (insert or update if exists)
const { error } = await supabase
  .from('weekly_summaries')
  .upsert(summaryData, {
    onConflict: 'program_id,week',
    ignoreDuplicates: false
  });    

    if (error) {
      console.error('❌ Error updating weekly summary:', error);
      return;
    }
    
    console.log(`✅ Updated weekly summary: ${overallTotals.totalExercises} exercises, avg RPE ${overallTotals.avgRpe}`);
    
  } catch (error) {
    console.error('❌ Error in updateWeeklySummary:', error);
  }
}

/**
 * Aggregate performance data by training block
 */
async function aggregateByTrainingBlock(data: { userId: number; week: number }) {
  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('block, rpe, completion_quality')
    .eq('user_id', data.userId)
    .eq('week', data.week);
    
  if (error) {
    console.error('❌ Error fetching performance data:', error);
    return {};
  }
  
  const aggregations: Record<string, any> = {};
  
  // Group by block and calculate averages
  performanceData?.forEach((entry: any) => {
    const block = entry.block;
    
    if (!aggregations[block]) {
      aggregations[block] = {
        count: 0,
        totalRpe: 0,
        totalQuality: 0
      };
    }
    
    aggregations[block].count++;
    aggregations[block].totalRpe += entry.rpe || 0;
    aggregations[block].totalQuality += entry.completion_quality || 0;
  });
  
  // Calculate averages
  Object.keys(aggregations).forEach(block => {
    const blockData = aggregations[block];
    aggregations[block] = {
      count: blockData.count,
      avgRpe: blockData.count > 0 ? Math.round((blockData.totalRpe / blockData.count) * 10) / 10 : null,
      avgQuality: blockData.count > 0 ? Math.round((blockData.totalQuality / blockData.count) * 10) / 10 : null
    };
  });
  
  return aggregations;
}

/**
 * Get MetCon aggregation data
 */
async function getMetconAggregation(data: { programId: number; week: number }) {
  const { data: metconData, error } = await supabase
    .from('program_metcons')
    .select('percentile')
    .eq('program_id', data.programId)
    .eq('week', data.week)
    .not('user_score', 'is', null);
    
  if (error || !metconData?.length) {
    return { count: 0, avgPercentile: null };
  }
  
  const percentiles = metconData.map((m: any) => parseFloat(m.percentile)).filter(p => !isNaN(p));
  const avgPercentile = percentiles.length > 0 
    ? Math.round((percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length) * 100) / 100
    : null;
    
  return {
    count: percentiles.length,
    avgPercentile
  };
}

/**
 * Calculate overall totals across all blocks
 */
async function calculateOverallTotals(data: { userId: number; week: number }) {
  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('rpe, completion_quality')
    .eq('user_id', data.userId)
    .eq('week', data.week);
    
  if (error || !performanceData?.length) {
    return { totalExercises: 0, avgRpe: null, avgQuality: null };
  }
  
  const totalExercises = performanceData.length;
  const validRpe = performanceData.filter((p: any) => p.rpe).map((p: any) => p.rpe);
  const validQuality = performanceData.filter((p: any) => p.completion_quality).map((p: any) => p.completion_quality);
  
  const avgRpe = validRpe.length > 0 
    ? Math.round((validRpe.reduce((sum: number, rpe: number) => sum + rpe, 0) / validRpe.length) * 10) / 10
    : null;
    
  const avgQuality = validQuality.length > 0
    ? Math.round((validQuality.reduce((sum: number, q: number) => sum + q, 0) / validQuality.length) * 10) / 10
    : null;
    
  return { totalExercises, avgRpe, avgQuality };
}

// =============================================================================
// EXISTING ROUTE HANDLERS
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Exercise completion logging called')
    
    const body = await request.json()
    const completionData: CompletionData = body

    // Validate required fields
    if (!completionData.programId || !completionData.userId || 
        !completionData.week || !completionData.day || 
        !completionData.block || !completionData.exerciseName) {
      return NextResponse.json(
        { error: 'Missing required fields: programId, userId, week, day, block, exerciseName' },
        { status: 400 }
      )
    }

    // Validate numeric ranges
    if (completionData.week < 1 || completionData.week > 12) {
      return NextResponse.json(
        { error: 'Week must be between 1 and 12' },
        { status: 400 }
      )
    }

    if (completionData.day < 1 || completionData.day > 5) {
      return NextResponse.json(
        { error: 'Day must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (completionData.rpe && (completionData.rpe < 1 || completionData.rpe > 10)) {
      return NextResponse.json(
        { error: 'RPE must be between 1 and 10' },
        { status: 400 }
      )
    }

    if (completionData.quality && !['A', 'B', 'C', 'D'].includes(completionData.quality)) {
      return NextResponse.json(
        { error: 'Quality must be A, B, C, or D' },
        { status: 400 }
      )
    }

    console.log(`📊 Logging completion: ${completionData.exerciseName} - Week ${completionData.week}, Day ${completionData.day}`)

    // Check if this exact completion already exists (prevent duplicates)
    const { data: existingCompletion } = await supabase
      .from('workout_completions')
      .select('id')
      .eq('user_id', completionData.userId)
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('block', completionData.block)
      .eq('exercise_name', completionData.exerciseName)
      .eq('set_number', completionData.setNumber || 1)
      .single()

    let result
    if (existingCompletion) {
      // Update existing completion
      console.log('🔄 Updating existing completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .update({
          set_number: completionData.setNumber || 1,
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Create new completion
      console.log('✨ Creating new completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .insert({
          user_id: completionData.userId,
          program_id: completionData.programId,
          week: completionData.week,
          day: completionData.day,
          block: completionData.block,
          exercise_name: completionData.exerciseName,
          set_number: completionData.setNumber || 1,
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('❌ Failed to save completion:', result.error)
      return NextResponse.json(
        { error: 'Failed to save workout completion', details: result.error.message },
        { status: 500 }
      )
    }

    // Also log to performance_logs for analytics (including quality grade)
    console.log('📊 Logging to performance_logs for analytics...')
    
    // First, try to find the program_workout_id
    const { data: programWorkout } = await supabase
      .from('program_workouts')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
      .eq('block', completionData.block)
      .single()

    // Check if performance log already exists
    const { data: existingPerfLog } = await supabase
      .from('performance_logs')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('user_id', completionData.userId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
            .eq('set_number', completionData.setNumber || 1)  // ← Add this line
      .single()

    // Convert quality letter grade to numeric if needed
    const qualityNumeric = completionData.quality ? 
      { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[completionData.quality] : null

    const perfLogData = {
      program_id: completionData.programId,
      user_id: completionData.userId,
      program_workout_id: programWorkout?.id,
      week: completionData.week,
      day: completionData.day,
      block: completionData.block,
      exercise_name: completionData.exerciseName,
      sets: completionData.setsCompleted?.toString(),
      set_number: completionData.setNumber || 1,
      reps: completionData.repsCompleted?.toString(),
      weight_time: completionData.weightUsed?.toString(),
      result: completionData.notes,
      rpe: completionData.rpe,
      completion_quality: qualityNumeric,
      quality_grade: completionData.quality,
      logged_at: new Date().toISOString()
    }

    if (existingPerfLog) {
      // Update existing performance log
      await supabase
        .from('performance_logs')
        .update(perfLogData)
        .eq('id', existingPerfLog.id)
    } else {
      // Create new performance log
      await supabase
        .from('performance_logs')
        .insert(perfLogData)
    }

    console.log('✅ Workout completion saved successfully')

    // =============================================================================
    // NEW: UPDATE WEEKLY SUMMARY AFTER SUCCESSFUL COMPLETION
    // =============================================================================
    try {
      await updateWeeklySummary({
        userId: completionData.userId,
        programId: completionData.programId,
        week: completionData.week
      });
    } catch (summaryError) {
      console.error('❌ Error updating weekly summary (non-blocking):', summaryError);
      // Don't fail the entire request if weekly summary update fails
    }

    // Get completion stats for this workout session
    const { data: sessionStats } = await supabase
      .from('workout_completions')
      .select('exercise_name')
      .eq('user_id', completionData.userId)
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)

    const completedExercises = sessionStats?.length || 0

    return NextResponse.json({
      success: true,
      completion: result.data,
      sessionStats: {
        completedExercises,
        week: completionData.week,
        day: completionData.day,
        block: completionData.block
      },
      message: existingCompletion ? 'Workout completion updated successfully' : 'Workout completion logged successfully'
    })

  } catch (error) {
    console.error('❌ Unexpected error logging workout completion:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve completions for a specific workout day
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const programId = searchParams.get('programId')
    const week = searchParams.get('week')
    const day = searchParams.get('day')

    if (!userId || !programId || !week || !day) {
      return NextResponse.json(
        { error: 'Missing required query parameters: userId, programId, week, day' },
        { status: 400 }
      )
    }

    console.log(`📊 Fetching completions for User ${userId}, Program ${programId}, Week ${week}, Day ${day}`)

    const { data: completions, error } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', parseInt(userId))
      .eq('program_id', parseInt(programId))
      .eq('week', parseInt(week))
      .eq('day', parseInt(day))
      .order('completed_at', { ascending: true })

    if (error) {
      console.error('❌ Failed to fetch completions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workout completions', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      completions: completions || [],
      totalCompleted: completions?.length || 0
    })

  } catch (error) {
    console.error('❌ Unexpected error fetching completions:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

