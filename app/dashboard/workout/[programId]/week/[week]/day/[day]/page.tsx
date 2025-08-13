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

// Improved Exercise Card Component with RPE Slider and Quality Buttons
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
  const [isExpanded, setIsExpanded] = useState(true)
  const [formData, setFormData] = useState({
    setsCompleted: completion?.setsCompleted || '',
    repsCompleted: completion?.repsCompleted || '',
    weightUsed: completion?.weightUsed || '',
    rpe: completion?.rpe || 7,
    quality: completion?.quality || '',
    notes: completion?.notes || ''
  })

  const isCompleted = completion !== undefined

  const handleDetailedSubmit = () => {
    onComplete({
      setsCompleted: formData.setsCompleted ? parseInt(formData.setsCompleted.toString()) : undefined,
      repsCompleted: formData.repsCompleted.toString(),
      weightUsed: formData.weightUsed ? parseFloat(formData.weightUsed.toString()) : undefined,
      rpe: formData.rpe,
      quality: formData.quality || undefined,
      notes: formData.notes.toString()
    })
    setIsExpanded(false)
  }

  // Quality button component
  const QualityButton = ({ grade, isSelected, onClick }: { grade: string, isSelected: boolean, onClick: () => void }) => {
    const getButtonStyle = () => {
      const baseStyle = "px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border-2"
      
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
        case 'A': return 'A - Excellent'
        case 'B': return 'B - Good'
        case 'C': return 'C - Average'
        case 'D': return 'D - Poor'
        default: return grade
      }
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={getButtonStyle()}
        title={getGradeLabel()}
      >
        {grade}
      </button>
    )
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

        {/* Improved Form */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Basic Inputs - Stacked for mobile, side-by-side on larger screens */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sets</label>
                <input
                  type="number"
                  value={formData.setsCompleted}
                  onChange={(e) => setFormData(prev => ({ ...prev, setsCompleted: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="How many sets?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reps</label>
                <input
                  type="text"
                  value={formData.repsCompleted}
                  onChange={(e) => setFormData(prev => ({ ...prev, repsCompleted: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Reps completed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weight</label>
                <input
                  type="number"
                  value={formData.weightUsed}
                  onChange={(e) => setFormData(prev => ({ ...prev, weightUsed: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Weight used"
                />
              </div>
            </div>

            {/* RPE Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RPE (Rate of Perceived Exertion): <span className="font-bold text-blue-600">{formData.rpe}/10</span>
              </label>
              <div className="px-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.rpe}
                  onChange={(e) => setFormData(prev => ({ ...prev, rpe: parseInt(e.target.value) }))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 - Very Easy</span>
                  <span>5 - Moderate</span>
                  <span>10 - Max Effort</span>
                </div>
              </div>
            </div>

            {/* Quality Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Quality</label>
              <div className="grid grid-cols-4 gap-3">
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
              <div className="text-xs text-gray-500 mt-2 text-center">
                A = Excellent • B = Good • C = Average • D = Poor
              </div>
            </div>
            
            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="How did it feel? Any observations..."
              />
            </div>

            <button
              onClick={handleDetailedSubmit}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-base"
            >
              {isCompleted ? 'Update Completion' : 'Mark Complete'}
            </button>
          </div>
        )}
      </div>

      {/* Add custom CSS for the slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
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




