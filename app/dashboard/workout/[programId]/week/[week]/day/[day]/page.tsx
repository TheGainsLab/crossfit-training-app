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
    
    // OPTIMISTIC UPDATE: Update UI immediately
    setCompletions(prev => ({
      ...prev,
      [exerciseName]: { exerciseName, ...completion }
    }))
    console.log('✅ Optimistic UI update applied')
    
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
        console.log('💾 Database update confirmed')
        // Optionally update with server response data if it differs
        setCompletions(prev => ({
          ...prev,
          [exerciseName]: { exerciseName, ...completion }
        }))
      } else {
        throw new Error('Server returned unsuccessful response')
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (err) {
    console.error('❌ Failed to log completion:', err)
    
    // ROLLBACK: Remove optimistic update on failure
    setCompletions(prev => {
      const updated = { ...prev }
      delete updated[exerciseName]
      return updated
    })
    
    // TODO: Show user-friendly error message
    alert('Failed to save completion. Please try again.')
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
  
  // DEBUG: Log the data
  console.log('🔢 PROGRESS DEBUG:')
  console.log('Total exercises:', totalExercises)
  console.log('Completed exercises:', completedExercises)  
  console.log('Completions object:', completions)
  console.log('Workout blocks:', workout.blocks.map(b => ({name: b.blockName, count: b.exercises.length})))
  
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
  const [isExpanded, setIsExpanded] = useState(!completion)
  const [formData, setFormData] = useState({
    setsCompleted: completion?.setsCompleted || '',
    repsCompleted: completion?.repsCompleted || '',
    weightUsed: completion?.weightUsed || '',
    rpe: completion?.rpe || 7,
    quality: completion?.quality || '',
    notes: completion?.notes || '',
    asRx: completion?.wasRx || false
  })

  const isCompleted = completion !== undefined

  const handleDetailedSubmit = () => {
    onComplete({
      setsCompleted: formData.setsCompleted ? parseInt(formData.setsCompleted.toString()) : undefined,
      repsCompleted: formData.repsCompleted.toString(),
      weightUsed: formData.weightUsed ? parseFloat(formData.weightUsed.toString()) : undefined,
      rpe: formData.rpe,
      quality: formData.quality || undefined,
      notes: formData.notes.toString(),
      wasRx: formData.asRx
    })
    setIsExpanded(false)
  }

  const QualityButton = ({ grade, isSelected, onClick }: { grade: string, isSelected: boolean, onClick: () => void }) => {
    const getButtonStyle = () => {
      const baseStyle = "flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border-2"
      
      if (isSelected) {
        switch (grade) {
          case 'A': return `${baseStyle} bg-green-500 text-white border-green-500 shadow-md`
          case 'B': return `${baseStyle} bg-blue-500 text-white border-blue-500 shadow-md`
          case 'C': return `${baseStyle} bg-yellow-500 text-white border-yellow-500 shadow-md`
          case 'D': return `${baseStyle} bg-red-500 text-white border-red-500 shadow-md`
          default: return `${baseStyle} bg-gray-500 text-white border-gray-500`
        }
      } else {
        return `${baseStyle} bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50`
      }
    }

    const getGradeLabel = () => {
      switch (grade) {
        case 'A': return 'Excellent'
        case 'B': return 'Good'
        case 'C': return 'Average'
        case 'D': return 'Poor'
        default: return grade
      }
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={getButtonStyle()}
        title={`${grade} - ${getGradeLabel()}`}
      >
        <div className="text-center">
          <div className="text-lg font-bold">{grade}</div>
          <div className="text-xs opacity-75">{getGradeLabel()}</div>
        </div>
      </button>
    )
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
      isCompleted 
        ? 'border-green-200 bg-green-50' 
        : 'border-gray-200 hover:border-gray-300'
    }`}>
      
      {/* SECTION 1: Exercise Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 text-left hover:bg-gray-50 transition-colors rounded-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Exercise Title */}
            <div className="flex items-center space-x-3 mb-4">
              <h3 className="text-xl font-bold text-gray-900">{exercise.name}</h3>
              {isCompleted && <span className="text-green-600 text-xl">✅</span>}
            </div>
            
            {/* Exercise Specs - Clean Grid */}
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 font-medium">Sets:</span>
                <span className="text-gray-900 font-semibold text-base">{exercise.sets || '-'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 font-medium">Reps:</span>
                <span className="text-gray-900 font-semibold text-base">{exercise.reps || '-'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 font-medium">Weight:</span>
                <span className="text-gray-900 font-semibold text-base">{exercise.weightTime || 'BW'}</span>
              </div>
            </div>

            {/* Completion Summary (when collapsed and completed) */}
            {completion && !isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-600">RPE: <span className="font-semibold text-green-600">{completion.rpe}/10</span></span>
                  {completion.quality && (
                    <span className="text-gray-600">Quality: <span className="font-semibold">{completion.quality}</span></span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Chevron */}
          <div className="ml-4 flex-shrink-0">
            <span className="text-gray-400 text-xl">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </button>

      {/* SECTION 2: Exercise Notes (when expanded) */}
      {isExpanded && exercise.notes && (
        <div className="mx-6 mb-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 text-lg">💡</span>
              <p className="text-blue-800 text-sm leading-relaxed">{exercise.notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Completion Form (when expanded and not completed) */}
      {isExpanded && !isCompleted && (
        <div className="px-6 pb-6 space-y-6">
          
          {/* Performance Inputs Section */}
          <div className="bg-gray-50 rounded-lg p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Performance Data</h4>
            
            {/* As Rx Checkbox */}
            <div className="mb-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.asRx}
                  onChange={(e) => {
                    const isChecked = e.target.checked
                    setFormData(prev => ({
                      ...prev,
                      asRx: isChecked,
                      // Auto-fill with prescribed values when checked
                      setsCompleted: isChecked ? exercise.sets : prev.setsCompleted,
                      repsCompleted: isChecked ? exercise.reps.toString() : prev.repsCompleted,
                      weightUsed: isChecked && exercise.weightTime !== 'BW' ? exercise.weightTime : prev.weightUsed
                    }))
                  }}
                  className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-base font-medium text-gray-700">
                  Completed as prescribed (As Rx)
                </span>
              </label>
            </div>

            <div className={`grid grid-cols-1 gap-4 ${exercise.weightTime === 'BW' ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sets Completed</label>
                <input
                  type="number"
                  value={formData.setsCompleted}
                  onChange={(e) => setFormData(prev => ({ ...prev, setsCompleted: e.target.value, asRx: false }))}
                  disabled={formData.asRx}
                  className={`w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formData.asRx ? 'bg-gray-100 text-gray-500' : ''
                  }`}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reps Completed</label>
                <input
                  type="text"
                  value={formData.repsCompleted}
                  onChange={(e) => setFormData(prev => ({ ...prev, repsCompleted: e.target.value, asRx: false }))}
                  disabled={formData.asRx}
                  className={`w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formData.asRx ? 'bg-gray-100 text-gray-500' : ''
                  }`}
                  placeholder="0"
                />
              </div>
              {exercise.weightTime !== 'BW' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weight Used</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weightUsed}
                    onChange={(e) => setFormData(prev => ({ ...prev, weightUsed: e.target.value, asRx: false }))}
                    disabled={formData.asRx}
                    className={`w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      formData.asRx ? 'bg-gray-100 text-gray-500' : ''
                    }`}
                    placeholder="lbs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* RPE Section */}
          <div className="bg-gray-50 rounded-lg p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Effort Level</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Rate of Perceived Exertion (RPE)</label>
                <span className="text-lg font-bold text-blue-600">{formData.rpe}/10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.rpe}
                onChange={(e) => setFormData(prev => ({ ...prev, rpe: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1 - Very Easy</span>
                <span>5 - Moderate</span>
                <span>10 - Max Effort</span>
              </div>
            </div>
          </div>

          {/* Quality Section */}
          <div className="bg-gray-50 rounded-lg p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Movement Quality</h4>
            <div className="flex gap-3">
              {['A', 'B', 'C', 'D'].map((grade) => (
                <QualityButton
                  key={grade}
                  grade={grade}
                  isSelected={formData.quality === grade}
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    quality: prev.quality === grade ? '' : grade 
                  }))}
                />
              ))}
            </div>
          </div>
          
          {/* Notes Section */}
          <div className="bg-gray-50 rounded-lg p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Additional Notes</h4>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="How did it feel? Any observations, modifications, or thoughts..."
            />
          </div>

          {/* Submit Section */}
          <div className="pt-2">
            <button
              onClick={handleDetailedSubmit}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-base shadow-sm"
            >
              Mark Exercise Complete
            </button>
          </div>
        </div>
      )}

      {/* SECTION 4: Completed State (when expanded and completed) */}
      {isExpanded && isCompleted && (
        <div className="px-6 pb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center">
            <div className="text-green-600 text-3xl mb-2">✅</div>
            <p className="text-green-800 font-medium mb-2">Exercise Completed</p>
            <div className="text-sm text-green-700 space-y-1">
              {completion.rpe && <p>RPE: {completion.rpe}/10</p>}
              {completion.quality && <p>Quality: {completion.quality}</p>}
              {completion.notes && <p className="italic">"{completion.notes}"</p>}
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for the slider */}
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: none;
        }
      `}</style>
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




