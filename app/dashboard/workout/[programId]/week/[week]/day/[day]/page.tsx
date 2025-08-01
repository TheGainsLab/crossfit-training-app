
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
        {workout.metconData && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 mt-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                🔥 {workout.metconData.workoutId}
              </h3>
              <p className="text-gray-700 mb-4">{workout.metconData.workoutFormat}</p>
              <p className="text-sm text-gray-600 mb-4">Time Range: {workout.metconData.timeRange}</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="bg-white rounded-lg p-3">
                  <div className="text-sm text-gray-600">Excellent Score</div>
                  <div className="font-bold text-green-600">{workout.metconData.percentileGuidance.excellentScore}</div>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <div className="text-sm text-gray-600">Median Score</div>
                  <div className="font-bold text-blue-600">{workout.metconData.percentileGuidance.medianScore}</div>
                </div>
              </div>
            </div>
          </div>
        )}

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

  const handleSubmit = () => {
    const taskCompletions = metconData?.tasks.map(task => ({
      exerciseName: task.exercise,
      rpe: taskRPEs[task.exercise] || 5,
      quality: taskQualities[task.exercise] || 'C'
    })) || []
    
    onComplete(workoutScore, taskCompletions)
  }

  if (!metconData) return null

  const currentBenchmarks = metconData.percentileGuidance[gender]
  const currentRxWeight = metconData.rxWeights[gender]

  return (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
      {/* Workout Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          🔥 {metconData.workoutId}
        </h3>
        <p className="text-gray-700 mb-2 font-medium">{metconData.workoutNotes}</p>
        <p className="text-sm text-gray-600 mb-1">{metconData.workoutFormat}</p>
        <p className="text-sm text-gray-600 mb-4">Time Range: {metconData.timeRange}</p>
        
        {/* Gender Selection */}
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
                <select
                  value={taskQualities[task.exercise] || 'C'}
                  onChange={(e) => handleTaskQuality(task.exercise, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
        />
        
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          placeholder="How did it feel? Any observations..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!workoutScore.trim()}
        className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        Log MetCon Completion
      </button>
    </div>
  )
}
