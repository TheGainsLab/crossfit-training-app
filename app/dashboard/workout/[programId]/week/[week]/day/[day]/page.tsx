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

// Intensity local state
// Note: kept simple (single bias per day) since we only support Strength & Power for now

// (Intensity controls removed per request)
// Client component that handles all the hooks
function WorkoutPageClient({ programId, week, day }: { programId: string; week: string; day: string }) {
  // (Removed intensity state and loaders)
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [completions, setCompletions] = useState<Record<string, Completion>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({})
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }
  const [isEstimating, setIsEstimating] = useState(false)
  const [isRefreshingAI, setIsRefreshingAI] = useState(false)
  const [allPrograms, setAllPrograms] = useState<Array<{ id: number; weeks_generated: number[] }>>([])
  const [navUrls, setNavUrls] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null })
  
 
  useEffect(() => {
    // Create abort controller for this request to prevent race conditions
    const abortController = new AbortController()
    
    const fetchWorkout = async () => {
      try {
        setLoading(true)
        setError(null) // Clear previous errors
        
        // Server merges program + AI modifications + completions
        const response = await fetch(`/api/workouts/${programId}/week/${week}/day/${day}`, {
          signal: abortController.signal
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch workout')
        }

        const data = await response.json()
        
        if (data.success && data.workout) {
          // Validate workout has blocks with exercises
          if (!data.workout.blocks || !Array.isArray(data.workout.blocks) || data.workout.blocks.length === 0) {
            throw new Error('Workout has no blocks')
          }
          
          // Validate at least one block has exercises
          const hasExercises = data.workout.blocks.some((block: any) => 
            block.exercises && Array.isArray(block.exercises) && block.exercises.length > 0
          )
          
          if (!hasExercises) {
            throw new Error('Workout blocks contain no exercises')
          }
          
          setWorkout(data.workout)
          if (Array.isArray(data.completions)) {
            const completionMap: Record<string, Completion> = {}
            data.completions.forEach((comp: any) => {
              const setNumber = comp.set_number || 1
              const key = setNumber > 1 ? `${comp.exercise_name} - Set ${setNumber}` : comp.exercise_name
              completionMap[key] = {
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
        } else {
          // Handle case where success is false or workout is missing
          throw new Error(data.error || 'Workout data is invalid or missing')
        }
      } catch (err: any) {
        // Don't set error if request was aborted (user navigated away)
        if (err.name === 'AbortError') {
          return
        }
        setError(err instanceof Error ? err.message : 'Unknown error')
        setWorkout(null) // Ensure workout is cleared on error
      } finally {
        setLoading(false)
      }
    }
    
    fetchWorkout()
    
    // Cleanup: abort request if component unmounts or params change
    return () => {
      abortController.abort()
    }
  }, [programId, week, day])

  // Calculate navigation URLs for Prev/Next buttons
  useEffect(() => {
    const calculateNavigation = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (!userData) return

        // Fetch all programs
        const { data: programs } = await supabase
          .from('programs')
          .select('id, weeks_generated')
          .eq('user_id', userData.id)
          .order('generated_at', { ascending: true })

        if (!programs || programs.length === 0) return

        setAllPrograms(programs)

        // Find current program index
        const currentProgramIndex = programs.findIndex((p: { id: number; weeks_generated: number[] }) => p.id === parseInt(programId))
        if (currentProgramIndex === -1) return

        const programIndex = currentProgramIndex + 1 // 1-based index
        const weekNum = parseInt(week)
        const dayNum = parseInt(day)

        // Calculate global week: Global Week = 4 * (programIndex - 1) + week
        const globalWeek = 4 * (programIndex - 1) + weekNum

        // Calculate previous day
        let prevUrl: string | null = null
        if (dayNum > 1) {
          // Same week, previous day
          prevUrl = `/dashboard/workout/${programId}/week/${weekNum}/day/${dayNum - 1}`
        } else if (globalWeek > 1) {
          // Previous week, day 5
          const prevGlobalWeek = globalWeek - 1
          const prevProgramIndex = Math.ceil(prevGlobalWeek / 4)
          const prevProgramWeek = ((prevGlobalWeek - 1) % 4) + 1
          const prevProgram = programs[prevProgramIndex - 1]
          if (prevProgram && prevProgram.weeks_generated.includes(prevProgramWeek)) {
            prevUrl = `/dashboard/workout/${prevProgram.id}/week/${prevProgramWeek}/day/5`
          }
        }

        // Calculate next day
        let nextUrl: string | null = null
        if (dayNum < 5) {
          // Same week, next day
          nextUrl = `/dashboard/workout/${programId}/week/${weekNum}/day/${dayNum + 1}`
        } else {
          // Next week, day 1
          const nextGlobalWeek = globalWeek + 1
          const nextProgramIndex = Math.ceil(nextGlobalWeek / 4)
          const nextProgramWeek = ((nextGlobalWeek - 1) % 4) + 1
          const nextProgram = programs[nextProgramIndex - 1]
          if (nextProgram && nextProgram.weeks_generated.includes(nextProgramWeek)) {
            nextUrl = `/dashboard/workout/${nextProgram.id}/week/${nextProgramWeek}/day/1`
          }
        }

        setNavUrls({ prev: prevUrl, next: nextUrl })
      } catch (err) {
        console.error('Error calculating navigation:', err)
        // Fallback to simple navigation without program boundaries
        const dayNum = parseInt(day)
        const weekNum = parseInt(week)
        setNavUrls({
          prev: dayNum > 1 ? `/dashboard/workout/${programId}/week/${weekNum}/day/${dayNum - 1}` : null,
          next: dayNum < 5 ? `/dashboard/workout/${programId}/week/${weekNum}/day/${dayNum + 1}` : null
        })
      }
    }

    calculateNavigation()
  }, [programId, week, day])


const logCompletion = async (exerciseName: string, block: string, completion: Partial<Completion>) => {
  console.log('🚀 logCompletion called for:', exerciseName)
  console.log('📦 Completion object received:', JSON.stringify(completion, null, 2))
  console.log('🔍 Sets/Reps in completion:', {
    setsCompleted: completion.setsCompleted,
    setsCompletedType: typeof completion.setsCompleted,
    repsCompleted: completion.repsCompleted,
    repsCompletedType: typeof completion.repsCompleted,
    weightUsed: completion.weightUsed,
    rpe: completion.rpe,
    quality: completion.quality,
    wasRx: completion.wasRx
  })
  
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
    
    const requestBody = {
      programId: parseInt(programId),
      userId,
      week: parseInt(week),
      day: parseInt(day),
      block,
      exerciseName: cleanExerciseName,
      setNumber,
      ...completion
    }
    console.log('📤 Request body being sent:', JSON.stringify(requestBody, null, 2))
    console.log('🔍 Sets/Reps in request body:', {
      setsCompleted: requestBody.setsCompleted,
      setsCompletedType: typeof requestBody.setsCompleted,
      repsCompleted: requestBody.repsCompleted,
      repsCompletedType: typeof requestBody.repsCompleted,
      weightUsed: requestBody.weightUsed,
      setNumber: requestBody.setNumber,
      exerciseName: requestBody.exerciseName
    })
    
    const response = await fetch('/api/workouts/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
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
    
    // Update local completions state to reflect the logged tasks
    setCompletions(prev => {
      const updated = { ...prev }
      taskCompletions.forEach(task => {
        // Use the exercise name as the key (metcon tasks don't have set numbers)
        updated[task.exerciseName] = {
          exerciseName: task.exerciseName,
          setsCompleted: 1,
          repsCompleted: '',
          weightUsed: undefined,
          rpe: task.rpe,
          notes: `Part of ${workout?.metconData?.workoutId}`,
          wasRx: true
        }
      })
      return updated
    })
    
  } catch (error) {
    console.error('❌ Failed to log MetCon completion:', error)
  }
}


  const getBlockKey = (blockName: string, index: number) => `${blockName}-${index}`
  const toggleBlock = (blockName: string, index: number) => {
    const key = getBlockKey(blockName, index)
    setExpandedBlocks(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const getBlockColor = (blockName: string) => {
    // All blocks use slate-blue background with charcoal border
    return 'bg-slate-blue border-[#282B34]'
  }


const getBlockStatusIcon = (blockName: string, exercises: Exercise[], completions: Record<string, Completion>) => {
  // Count completed exercises in this block
  const completedCount = exercises.filter(exercise => {
    // Handle exercises with set numbers (e.g., "Exercise - Set 2")
    const setMatch = exercise.notes?.match(/Set (\d+)/);
    const setNumber = setMatch ? parseInt(setMatch[1]) : 1;
    const exerciseKey = setNumber > 1 
      ? `${exercise.name} - Set ${setNumber}`
      : exercise.name;
    
    return completions[exerciseKey] !== undefined;
  }).length;
  
  const totalCount = exercises.length;
  
  // Determine status - only show checkmark when complete, nothing otherwise
  if (completedCount === totalCount && totalCount > 0) {
    // All complete - coral checkmark
    return '✓';
  } else {
    // Not started or partial - show nothing (empty string)
    return '';
  }
};

const getBlockHeaderStyle = (blockName: string, exercises: Exercise[], completions: Record<string, Completion>) => {
  const completedCount = exercises.filter(exercise => {
    const setMatch = exercise.notes?.match(/Set (\d+)/);
    const setNumber = setMatch ? parseInt(setMatch[1]) : 1;
    const exerciseKey = setNumber > 1 
      ? `${exercise.name} - Set ${setNumber}`
      : exercise.name;
    return completions[exerciseKey] !== undefined;
  }).length;
  
  const totalCount = exercises.length;
  const baseStyle = getBlockColor(blockName);
  
  // Always return the same style - single charcoal border
  return baseStyle;
};

const calculateProgress = () => {
  if (!workout) return 0
  const blocks = Array.isArray((workout as any)?.blocks) ? (workout as any).blocks : []
  const totalExercises = blocks.reduce((sum: number, block: any) => sum + (Array.isArray(block.exercises) ? block.exercises.length : 0), 0)
  
  // Count each completion entry separately (don't deduplicate by removing "Set X" suffix)
  // For strength exercises, each set is a separate exercise object, so each completion should count separately
  // This matches how totalExercises counts each exercise object in the array
  const completedExercises = Object.keys(completions).length

  console.log('🔢 PROGRESS DEBUG:')
  console.log('Total exercises:', totalExercises)
  console.log('Completed exercises:', completedExercises)
  console.log('Completion entries:', Object.keys(completions).length)
  console.log('Completions object:', completions)
  console.log('Workout blocks:', blocks.map((b: any) => ({ name: b.blockName, count: Array.isArray(b.exercises) ? b.exercises.length : 0 })))

  // Cap progress at 100% to prevent values like 120%
  const progress = totalExercises > 0 ? Math.min(100, (completedExercises / totalExercises) * 100) : 0
  return progress
}

  if (loading) {
    return (
      <div className="min-h-screen bg-ice-blue flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral mx-auto mb-4"></div>
          <p className="text-charcoal">Loading workout...</p>
        </div>
      </div>
    )
  }

  if (error || !workout) {
    return (
      <div className="min-h-screen bg-ice-blue flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-charcoal mb-2">Workout Not Found</h2>
          <p className="text-charcoal mb-4">{error || 'Workout data is missing'}</p>
          <Link href="/dashboard" className="bg-coral text-white px-4 py-2 rounded-lg hover:bg-coral">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Additional validation: Check if workout has any exercises at all
  // This prevents blank days where workout exists but has no exercises
  const totalExercisesInWorkout = workout.blocks.reduce((sum: number, block: any) => 
    sum + (Array.isArray(block.exercises) ? block.exercises.length : 0), 0
  )

  if (totalExercisesInWorkout === 0) {
    return (
      <div className="min-h-screen bg-ice-blue flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-charcoal mb-2">Empty Workout</h2>
          <p className="text-charcoal mb-4">This workout has no exercises. Please contact support.</p>
          <Link href="/dashboard" className="bg-coral text-white px-4 py-2 rounded-lg hover:bg-coral">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const progress = calculateProgress()

  const handleRefreshAI = async () => {
    try {
      if (isRefreshingAI) return
      setIsRefreshingAI(true)
      const { createClient: createSbClient } = await import('@/lib/supabase/client')
      const sbClient = createSbClient()
      const { data: { session } } = await sbClient.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/ai/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      if (res.status === 200) {
        alert('Queued. Your AI Save will update upcoming sessions.')
      } else if (res.status === 429) {
        const j = await res.json().catch(() => ({}))
        const when = j?.nextAvailableAt ? new Date(j.nextAvailableAt).toLocaleString() : 'later'
        alert(`AI Save limit reached. Next AI Save at ${when}.`)
      } else {
        const t = await res.text().catch(() => '')
        alert(`Failed to enqueue AI Save. ${t}`)
      }
    } catch (e: any) {
      alert(`Failed to enqueue AI Save. ${e?.message || ''}`)
    } finally {
      setIsRefreshingAI(false)
    }
  }

  return (
    <div className="min-h-screen bg-ice-blue">
      <div className="print:hidden max-w-4xl mx-auto px-4 pt-4 flex justify-end">
        <button onClick={handlePrint} className="px-4 py-2 rounded-lg hover:opacity-90" style={{ backgroundColor: '#FE5858', color: '#ffffff' }}>
          Print / Save as PDF
        </button>
      </div>
      
      {/* Header - Optimized for Mobile */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link 
                href="/dashboard" 
                className="flex items-center space-x-2 text-coral hover:text-coral transition-colors"
              >
                <span>←</span>
                <span className="text-charcoal">Dashboard</span>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-charcoal">
                  Week {workout.week}, Day {workout.day}
                </h1>
                {workout.isDeload && (
                  <p className="text-sm text-yellow-600">Deload Week</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-charcoal">Progress</span>
              <div className="w-24 bg-slate-blue rounded-full h-2">
               
<div
  className="h-2 rounded-full transition-all duration-300"
  style={{ width: `${progress}%`, backgroundColor: '#FE5858' }}
></div>

              </div>
              <span className="text-sm font-medium text-charcoal">{Math.round(progress)}%</span>
              {/* AI applied badge if this day was modified by AI */}
              {Boolean((workout as any)?.source === 'ai') && (
                <span className="text-xs text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5" title={(workout as any)?.rationale?.message || 'Updated by AI'}>
                  AI updated
                </span>
              )}
              {/* Optional: small chip for recent AI Save */}
              {/* <span className="text-xs text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">Updated</span> */}
              {/* AI Save button - Hidden for MVP, keep functionality for future */}
              {/* <button
                onClick={handleRefreshAI}
                disabled={isRefreshingAI || Object.keys(completions).length > 0}
                className="ml-3 px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#509895', color: '#ffffff', borderColor: 'transparent' }}
              >
                {isRefreshingAI ? 'Saving…' : 'AI Save'}
              </button> */}
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden">
            {/* Top Row: Dashboard link and Progress */}
            <div className="flex items-center justify-between mb-2">
              <Link 
                href="/dashboard" 
                className="flex items-center space-x-2 px-3 py-2 text-coral hover:text-coral hover:bg-coral/10 rounded-lg transition-colors -ml-3"
              >
                <span>←</span>
                <span className="font-medium text-charcoal">Dashboard</span>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-16 bg-slate-blue rounded-full h-2">
                  <div 
                    className="bg-coral h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-charcoal">{Math.round(progress)}%</span>
                {/* AI Save button - Hidden for MVP, keep functionality for future */}
                {/* <button
                  onClick={handleRefreshAI}
                  disabled={isRefreshingAI || Object.keys(completions).length > 0}
                  className="ml-2 px-2 py-1 text-xs rounded-md border hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#509895', color: '#ffffff', borderColor: 'transparent' }}
                >
                  {isRefreshingAI ? 'Saving…' : 'AI Save'}
                </button> */}
              </div>
            </div>
            
{/* Bottom Row: Week/Day info */}
<div className="text-center">
  <h1 className="text-lg font-bold text-charcoal">            
    Week {workout.week}, Day {workout.day}
                {workout.isDeload && (
                  <span className="ml-2 text-sm text-yellow-600">• Deload</span>
                )}
              </h1>
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="print:hidden max-w-4xl mx-auto px-4 py-6">
        {workout.blocks.map((block, blockIndex) => (
          
<div key={blockIndex} className={`mb-6 rounded-lg border-2 ${getBlockHeaderStyle(block.blockName, block.exercises, completions)}`}>
            {/* Block Header */}
            <button
              onClick={() => toggleBlock(block.blockName, blockIndex)}
              className="w-full p-4 text-left hover:bg-white/50 transition-colors rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getBlockStatusIcon(block.blockName, block.exercises, completions) && (
                    <span className="text-2xl text-coral">{getBlockStatusIcon(block.blockName, block.exercises, completions)}</span>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-charcoal">{
                      (() => {
                        if (block.blockName === 'STRENGTH AND POWER') {
                          const strengthBlocks = workout.blocks.filter(b => b.blockName === 'STRENGTH AND POWER')
                          if (strengthBlocks.length > 1) {
                            const idx = strengthBlocks.indexOf(block)
                            return `STRENGTH AND POWER (${idx + 1}/${strengthBlocks.length})`
                          }
                          return 'STRENGTH AND POWER'
                        }
                        return (block.blockName || '').toUpperCase()
                      })()
                    }</h2>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm" style={{ color: '#282B34' }}>
                    
{block.exercises.filter(ex => {
  const setMatch = ex.notes?.match(/Set (\d+)/);
  const setNumber = setMatch ? parseInt(setMatch[1]) : 1;
  const exerciseKey = setNumber > 1 ? `${ex.name} - Set ${setNumber}` : ex.name;
  return completions[exerciseKey] !== undefined;
}).length}/{block.exercises.length} Complete

                  </span>
                  <span className="text-gray-400">
                    {expandedBlocks[getBlockKey(block.blockName, blockIndex)] ? '▼' : '▶'}
                  </span>
                </div>
              </div>
            </button>

        {/* Block Content */}
{expandedBlocks[getBlockKey(block.blockName, blockIndex)] && (
  <div className="px-4 pb-4 space-y-4">
    {/* Intensity controls removed */}
    {block.exercises.length === 0 ? (
      block.blockName === 'STRENGTH AND POWER' ? (
        <StrengthFallback
          programId={programId}
          week={week}
          day={day}
          mainLift={workout.mainLift}
          blocksInDay={workout.blocks.filter(b => b.blockName === 'STRENGTH AND POWER').length}
          strengthIndexWithinDay={workout.blocks.slice(0, blockIndex + 1).filter(b => b.blockName === 'STRENGTH AND POWER').length - 1}
          onPopulate={(sets) => {
            const updated = { ...workout }
            updated.blocks[blockIndex] = { ...updated.blocks[blockIndex], exercises: sets }
            setWorkout(updated)
          }}
        />
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">✨</div>
          <p>No exercises in this block today</p>
        </div>
      )
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
    
    // Create consistent naming that matches the completion key
    const setMatch = exercise.notes?.match(/Set (\d+)/);
    const setNumber = setMatch ? parseInt(setMatch[1]) : 1;
    const exerciseKey = setNumber > 1 
      ? `${exercise.name} - Set ${setNumber}`
      : exercise.name;
    
    // Apply client-side intensity bias adjustments for Strength & Power only
    const adjustedExercise = exercise

    return (
      <ExerciseCard
        key={exerciseIndex}
        exercise={adjustedExercise}
        block={block.blockName}
        completion={completions[exerciseKey]}
        onComplete={(completion) => {
          logCompletion(exerciseKey, block.blockName, completion);
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
        <div className="relative flex flex-wrap items-center justify-between gap-3 mt-8 pt-6 border-t border-slate-blue">
          {navUrls.prev ? (
            <Link 
              href={navUrls.prev}
              className="px-4 py-2 rounded-lg bg-slate-blue text-charcoal hover:bg-slate-blue"
            >
              ← Prev
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed">
              ← Prev
            </span>
          )}
          
          <Link 
            href="/dashboard"
            className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral"
          >
            Dashboard
          </Link>
          
          {navUrls.next ? (
            <Link 
              href={navUrls.next}
              className="px-4 py-2 rounded-lg bg-slate-blue text-charcoal hover:bg-slate-blue"
            >
              Next →
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed">
              Next →
            </span>
          )}

          {/* AI Calories Estimate */}
          <button
            type="button"
            onClick={async () => {
              console.log('AI Cals button clicked')
              try {
                if (isEstimating) return
                setIsEstimating(true)
                const userId = await getCurrentUserId()
                // Get user's JWT for auth to Edge Function
                const { createClient: createSbClient2 } = await import('@/lib/supabase/client')
                const sbClient2 = createSbClient2()
                const { data: { session: session2 } } = await sbClient2.auth.getSession()
                const userJwt2 = session2?.access_token

                const res = await fetch(`/api/ai/estimate-calories`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(userJwt2 ? { 'Authorization': `Bearer ${userJwt2}` } : {})
                  },
                  body: JSON.stringify({ userId, programId, week, day })
                })
                if (!res.ok) {
                  const errText = await res.text().catch(() => '')
                  throw new Error(`AI request failed (${res.status}): ${errText}`)
                }
                const data = await res.json()
                if (data.success && data.low != null && data.high != null) {
                  const low = data.low as number
                  const high = data.high as number
                  const avg = data.average as number
                  const saveRes = await fetch('/api/workouts/save-calories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ programId: Number(programId), week: Number(week), day: Number(day), calories: avg, low, high })
                  })
                  if (!saveRes.ok) {
                    const t = await saveRes.text().catch(() => '')
                    throw new Error(`Save failed (${saveRes.status}): ${t}`)
                  }
                  // Optionally show range
                  alert(`Estimated calories saved: ${low}–${high} kcal (avg ~${avg} kcal)`)
                } else {
                  alert('Could not parse calorie estimate from AI response.')
                }
              } catch (e: any) {
                console.error('AI calories error:', e)
                alert(`Failed to estimate calories. ${e?.message ? `Details: ${e.message}` : ''}`)
              } finally {
                setIsEstimating(false)
              }
            }}
            className={`relative z-10 px-4 py-2 rounded-lg cursor-pointer pointer-events-auto ${isEstimating ? 'opacity-60 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: '#509895', color: '#ffffff' }}
            disabled={isEstimating}
          >
            {isEstimating ? 'Estimating…' : 'AI Cals'}
          </button>
        </div>
      </main>

      {/* Printable Summary */}
      {workout && (
        <div className="hidden print:block max-w-4xl mx-auto px-4 py-6 bg-white">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Training Day Summary</h1>
          <div className="text-sm text-gray-700 mb-4">
            Program #{workout.programId} • Week {workout.week} • Day {workout.day}
          </div>
          <div className="mb-2"><span className="font-semibold">Day:</span> {workout.dayName}</div>
          <div className="mb-4"><span className="font-semibold">Main Lift:</span> {workout.mainLift}</div>
          <div className="space-y-4">
            {workout.blocks.map((block) => (
              <div key={block.blockName}>
                <h2 className="font-semibold text-gray-900 mb-2">{block.blockName}</h2>
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1" style={{ border: '1px solid #ddd' }}>Exercise</th>
                      <th className="text-left px-2 py-1" style={{ border: '1px solid #ddd' }}>Sets</th>
                      <th className="text-left px-2 py-1" style={{ border: '1px solid #ddd' }}>Reps</th>
                      <th className="text-left px-2 py-1" style={{ border: '1px solid #ddd' }}>Weight/Time</th>
                      <th className="text-left px-2 py-1" style={{ border: '1px solid #ddd' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.exercises.map((ex, i) => (
                      <tr key={`${ex.name}-${i}`}>
                        <td className="px-2 py-1" style={{ border: '1px solid #ddd' }}>{ex.name}</td>
                        <td className="px-2 py-1" style={{ border: '1px solid #ddd' }}>{ex.sets || '-'}</td>
                        <td className="px-2 py-1" style={{ border: '1px solid #ddd' }}>{ex.reps || '-'}</td>
                        <td className="px-2 py-1" style={{ border: '1px solid #ddd' }}>{ex.weightTime && ex.weightTime !== 'BW' ? ex.weightTime : '-'}</td>
                        <td className="px-2 py-1" style={{ border: '1px solid #ddd' }}>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div className="mt-6 text-xs text-gray-500">Generated on {new Date().toLocaleDateString()}</div>
        </div>
      )}
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

function StrengthFallback({
  programId,
  week,
  day,
  mainLift,
  blocksInDay,
  strengthIndexWithinDay,
  onPopulate
}: {
  programId: string
  week: string
  day: string
  mainLift: string
  blocksInDay: number
  strengthIndexWithinDay?: number
  onPopulate: (sets: Exercise[]) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const synthesize = async () => {
    try {
      setLoading(true)
      setError(null)
      const userId = await getCurrentUserId()
      const res = await fetch('/api/strength/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mainLift, week: Number(week), strengthBlocksCount: blocksInDay })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to synthesize')
      const idx = typeof strengthIndexWithinDay === 'number' ? Math.max(0, Math.min(json.blocks.length - 1, strengthIndexWithinDay)) : 0
      const sets = Array.isArray(json.blocks) && json.blocks.length > 0 ? (json.blocks[idx] as Exercise[]) : []
      onPopulate(sets)
    } catch (e: any) {
      setError(e?.message || 'Failed to synthesize')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    synthesize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="text-center py-8 text-gray-500">
      {loading ? (
        <>
          <div className="text-4xl mb-2">⏳</div>
          <p>Building Strength sets…</p>
        </>
      ) : error ? (
        <>
          <div className="text-4xl mb-2">⚠️</div>
          <p>{error}</p>
          <button onClick={synthesize} className="mt-3 px-3 py-2 bg-coral text-white rounded">Retry</button>
        </>
      ) : (
        <>
          <div className="text-4xl mb-2">✨</div>
          <p>Strength sets added</p>
        </>
      )}
    </div>
  )
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
  const [showCues, setShowCues] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [completionType, setCompletionType] = useState(completion ? 'modified' : 'asRx')
  const [formData, setFormData] = useState({
    setsCompleted: completion?.setsCompleted || exercise.sets || '',
    repsCompleted: completion?.repsCompleted || exercise.reps?.toString() || '',
    weightUsed: completion?.weightUsed || (exercise.weightTime && exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : ''),
    rpe: completion?.rpe || 7,
    quality: completion?.quality || '',
    notes: completion?.notes || ''
  })

  // Pre-populate form when switching to Modified if fields are empty
  useEffect(() => {
    if (completionType === 'modified' && !completion) {
      setFormData(prev => ({
        setsCompleted: prev.setsCompleted || exercise.sets || '',
        repsCompleted: prev.repsCompleted || exercise.reps?.toString() || '',
        weightUsed: prev.weightUsed || (exercise.weightTime && exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : ''),
        rpe: prev.rpe || 7,
        quality: prev.quality || '',
        notes: prev.notes || ''
      }))
    }
  }, [completionType, exercise, completion])

  const isCompleted = completion !== undefined

const handleDetailedSubmit = () => {
  // Store reference to current card and next element before state changes
  const currentCardElement = document.activeElement?.closest('.exercise-card') || 
                            document.querySelector(`[data-exercise="${exercise.name}"]`)
  const nextCardElement = currentCardElement?.nextElementSibling
  
  let completionData
  
  if (completionType === 'asRx') {
    // Use prescribed values for As Rx completion
    completionData = {
      setsCompleted: parseInt(exercise.sets.toString()),
      repsCompleted: exercise.reps.toString(),
      weightUsed: exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : undefined,
      rpe: formData.rpe,
      quality: formData.quality || undefined,
      notes: formData.notes.toString(),
      wasRx: true
    }
  } else {
    // Use custom values for Modified completion, with fallback to exercise values
    completionData = {
      setsCompleted: formData.setsCompleted ? parseInt(formData.setsCompleted.toString()) : (parseInt(exercise.sets.toString()) || 1),
      repsCompleted: formData.repsCompleted && formData.repsCompleted.toString().trim() !== '' ? formData.repsCompleted.toString() : exercise.reps.toString(),
      weightUsed: formData.weightUsed ? parseFloat(formData.weightUsed.toString()) : (exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : undefined),
      rpe: formData.rpe,
      quality: formData.quality || undefined,
      notes: formData.notes.toString(),
      wasRx: false
    }
  }
  
  // Complete the exercise
  onComplete(completionData)
  
  // Collapse the exercise
  setIsExpanded(false)
  
  // Smooth scroll to maintain user context after collapse
  setTimeout(() => {
    if (nextCardElement) {
      nextCardElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',  // Align to top of viewport
        inline: 'nearest'
      })
    } else {
      // If no next element, scroll to show the completed exercise nicely
      currentCardElement?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }, 150) // Small delay to allow collapse animation to start
}


  const QualityButton = ({ grade, isSelected, onClick }: { grade: string, isSelected: boolean, onClick: () => void }) => {
    const getButtonStyle = () => {
      const baseStyle = "flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border-2 min-w-0"
      
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
  <div 
    className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
      isCompleted
        ? 'border-coral bg-coral/5'
        : 'border-slate-blue hover:border-coral'
    }`}
    data-exercise={exercise.name}
  >
    
      {/* SECTION 1: Exercise Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 text-left hover:bg-gray-50 transition-colors rounded-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Exercise Title */}
            <div className="flex items-center space-x-3 mb-4">
              <h3 className="text-xl font-bold text-charcoal">{exercise.name}</h3>
              {exercise.notes && (

<div
  onClick={(e) => {
    e.stopPropagation();
    setShowCues(!showCues);
  }}
className="w-6 h-6 bg-coral text-white rounded-full text-xs flex items-center justify-center cursor-pointer"
>
  i
</div>               
              )}
              {isCompleted && <span className="text-coral text-xl">✓</span>}
            </div>

            {/* Expandable Performance Cues */}
            {showCues && exercise.notes && (
              <div className="mb-4">
                <div className="bg-coral/10 rounded-lg p-3">
                  <p className="text-charcoal text-sm">{exercise.notes}</p>
                </div>
              </div>
            )}

            {/* Exercise Specs - Clean Grid */}
            <div className={`grid gap-6 text-sm ${exercise.weightTime && exercise.weightTime !== 'BW' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 font-medium">Sets:</span>
                <span className="text-charcoal font-semibold text-base">{exercise.sets || '-'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 font-medium">Reps:</span>
                <span className="text-charcoal font-semibold text-base">{exercise.reps || '-'}</span>
              </div>
              {exercise.weightTime && exercise.weightTime !== 'BW' && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 font-medium">Weight:</span>
                  <span className="text-charcoal font-semibold text-base">{exercise.weightTime}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Chevron */}
          <div className="ml-4 flex-shrink-0">
            <span className="text-gray-400 text-xl">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </button>

      {/* SECTION 2: Completion / Update Form (shown when expanded) */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-3">
          
          {/* Completion Type Selection - REMOVED HEADER */}
          <div className="bg-ice-blue rounded-lg p-4">
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="completionType"
                  value="asRx"
                  checked={completionType === 'asRx'}
                  onChange={(e) => setCompletionType(e.target.value)}
                  className="w-4 h-4 text-coral border-2 border-gray-300 focus:ring-2 focus:ring-coral"
                />
                <span className="text-base font-medium text-charcoal">
                  As Prescribed (As Rx)
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="completionType"
                  value="modified"
                  checked={completionType === 'modified'}
                  onChange={(e) => setCompletionType(e.target.value)}
                  className="w-4 h-4 text-coral border-2 border-gray-300 focus:ring-2 focus:ring-coral"
                />
                <span className="text-base font-medium text-charcoal">
                  Modified Workout
                </span>
              </label>
            </div>
          </div>

          {/* Performance Inputs Section - Only show for Modified */}
          {completionType === 'modified' && (
            <div className="bg-ice-blue rounded-lg p-4">
              <h4 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Performance</h4>
              
              {/* HORIZONTAL LAYOUT - Even on Mobile */}
              <div className={`grid gap-3 ${exercise.weightTime === 'BW' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Sets</label>
                  <input
                    type="number"
                    value={formData.setsCompleted}
                    onChange={(e) => setFormData(prev => ({ ...prev, setsCompleted: e.target.value }))}
                    className="w-full p-2 border border-slate-blue rounded-lg text-sm focus:ring-2 focus:ring-coral focus:border-coral"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Reps</label>
                  <input
                    type="text"
                    value={formData.repsCompleted}
                    onChange={(e) => setFormData(prev => ({ ...prev, repsCompleted: e.target.value }))}
                    className="w-full p-2 border border-slate-blue rounded-lg text-sm focus:ring-2 focus:ring-coral focus:border-coral"
                    placeholder="0"
                  />
                </div>
                {exercise.weightTime !== 'BW' && (
                  <div>
                    <label className="block text-xs font-medium text-charcoal mb-1">Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.weightUsed}
                      onChange={(e) => setFormData(prev => ({ ...prev, weightUsed: e.target.value }))}
                      className="w-full p-2 border border-slate-blue rounded-lg text-sm focus:ring-2 focus:ring-coral focus:border-coral"
                      placeholder="lbs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RPE Section - SIMPLIFIED HEADER */}
          <div className="bg-ice-blue rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-charcoal uppercase tracking-wide">RPE</h4>
              <span className="text-lg font-bold text-coral">{formData.rpe}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.rpe}
              onChange={(e) => setFormData(prev => ({ ...prev, rpe: parseInt(e.target.value) }))}
              className="w-full h-2 bg-slate-blue rounded-lg appearance-none cursor-pointer mb-2"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1 - Very Easy</span>
              <span>10 - Max Effort</span>
            </div>
          </div>

          {/* Quality Section - CONSISTENT BUTTON SIZING */}
          <div className="bg-ice-blue rounded-lg p-4">
            <h4 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Quality</h4>
            <div className="grid grid-cols-4 gap-2">
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
          
          {/* Notes Section - Collapsible */}
          {!showNotes ? (
            <div className="bg-ice-blue rounded-lg p-4">
              <button
                onClick={() => setShowNotes(true)}
                className="text-sm font-semibold text-charcoal uppercase tracking-wide hover:text-coral transition-colors"
              >
                + Add Notes
              </button>
            </div>
          ) : (
            <div className="bg-ice-blue rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-charcoal uppercase tracking-wide">Notes</h4>
                <button
                  onClick={() => {
                    setShowNotes(false)
                    setFormData(prev => ({ ...prev, notes: '' }))
                  }}
                  className="text-xs text-gray-500 hover:text-charcoal transition-colors"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full p-3 border border-slate-blue rounded-lg text-base focus:ring-2 focus:ring-coral focus:border-coral"
                rows={3}
                placeholder=""
              />
            </div>
          )}

          {/* Submit Section */}
          <div className="pt-2">
            <button
              onClick={handleDetailedSubmit}
              className="w-full bg-coral text-white py-4 px-6 rounded-lg hover:bg-coral transition-colors font-semibold text-base shadow-sm"
            >
              {isCompleted ? 'Update Exercise' : 'Mark Exercise Complete'}
            </button>
          </div>
        </div>
      )}

      {/* No separate completed state; form above supports updates */}

      {/* Custom CSS for the slider */}
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #FE5858;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #FE5858;
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
  const [isExpanded, setIsExpanded] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  
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
      
      setIsCompleted(true)
      setIsExpanded(false)
      
    } catch (error) {
      console.error('Error submitting MetCon:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quality Button Component (matching ExerciseCard)
  const QualityButton = ({ grade, isSelected, onClick }: { grade: string, isSelected: boolean, onClick: () => void }) => {
    const getButtonStyle = () => {
      const baseStyle = "flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border-2 min-w-0"
      
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

  if (!metconData) return null

  const currentBenchmarks = metconData.percentileGuidance[gender]
  const currentRxWeight = metconData.rxWeights[gender]

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
        isCompleted
          ? 'border-coral bg-coral/5'
          : 'border-slate-blue hover:border-coral'
      }`}
    >
      {/* SECTION 1: MetCon Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 text-left hover:bg-gray-50 transition-colors rounded-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* MetCon Title */}
            <div className="flex items-center space-x-3 mb-4">
              <h3 className="text-xl font-bold text-charcoal">{metconData.workoutId || 'MetCon'}</h3>
              {isCompleted && <span className="text-coral text-xl">✅</span>}
            </div>

            {/* Workout Description */}
            {metconData.workoutNotes && (
              <div className="mb-4 text-sm text-charcoal">
                {metconData.workoutNotes}
              </div>
            )}

            {/* Completion Summary (when collapsed and completed) */}
            {isCompleted && !isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-charcoal">Score: <span className="font-semibold text-coral">{workoutScore}</span></span>
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

      {/* SECTION 2: Completion Form (when expanded and not completed) */}
      {isExpanded && !isCompleted && (
        <div className="px-6 pb-6 space-y-3">
          
          {/* Gender Selection */}
          <div className="bg-ice-blue rounded-lg p-4">
            <div className="flex justify-center">
              <div className="grid grid-cols-2 bg-white rounded-lg p-1 border gap-1">
                <button
                  onClick={() => setGender('male')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    gender === 'male' 
                      ? 'bg-coral text-white shadow-sm' 
                      : 'text-charcoal hover:bg-gray-100'
                  }`}
                >
                  Male
                </button>
                <button
                  onClick={() => setGender('female')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    gender === 'female' 
                      ? 'bg-coral text-white shadow-sm' 
                      : 'text-charcoal hover:bg-gray-100'
                  }`}
                >
                  Female
                </button>
              </div>
            </div>
          </div>

          {/* Benchmarks */}
          <div className="bg-ice-blue rounded-lg p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 border border-slate-blue text-center">
                <div className="text-xs text-charcoal font-medium">Excellent</div>
                <div className="font-bold text-charcoal">{currentBenchmarks.excellentScore}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-blue text-center">
                <div className="text-xs text-charcoal font-medium">Median</div>
                <div className="font-bold text-charcoal">{currentBenchmarks.medianScore}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-blue text-center">
                <div className="text-xs text-charcoal font-medium">Rx Weight</div>
                <div className="font-bold text-charcoal">{currentRxWeight}</div>
              </div>
            </div>
          </div>

          {/* Your Score Section */}
          <div className="bg-ice-blue rounded-lg p-4">
            <h4 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Your Score</h4>
            <input
              type="text"
              placeholder="e.g., 12:34, 8 rounds + 15 reps, 674 total reps"
              value={workoutScore}
              onChange={(e) => setWorkoutScore(e.target.value)}
              className="w-full p-3 border border-slate-blue rounded-lg text-base focus:ring-2 focus:ring-coral focus:border-coral"
              disabled={isSubmitting}
            />
          </div>

          {/* Notes Section - Collapsible */}
          {!showNotes ? (
            <div className="bg-ice-blue rounded-lg p-4">
              <button
                onClick={() => setShowNotes(true)}
                className="text-sm font-semibold text-charcoal uppercase tracking-wide hover:text-coral transition-colors"
              >
                + Add Notes
              </button>
            </div>
          ) : (
            <div className="bg-ice-blue rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-charcoal uppercase tracking-wide">Notes</h4>
                <button
                  onClick={() => {
                    setShowNotes(false)
                    setNotes('')
                  }}
                  className="text-xs text-gray-500 hover:text-charcoal transition-colors"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border border-slate-blue rounded-lg text-base focus:ring-2 focus:ring-coral focus:border-coral"
                rows={3}
                placeholder=""
              />
            </div>
          )}

          {/* Task Performance */}
          <div className="bg-ice-blue rounded-lg p-4">
            <h4 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Task Performance</h4>
            <div className="space-y-4">
              {metconData.tasks.map((task, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-slate-blue">
                  {/* Task Header */}
                  <div className="mb-3">
                    <h4 className="font-semibold text-charcoal">{task.exercise}</h4>
                    <p className="text-sm text-charcoal">
                      {task.reps} reps {task.weight_male && `@ ${gender === 'male' ? task.weight_male : task.weight_female} lbs`}
                    </p>
                  </div>
                  
                  {/* RPE Section */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-charcoal uppercase tracking-wide">RPE</label>
                      <span className="text-sm font-bold text-coral">
                        {taskRPEs[task.exercise] || 5}/10
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={taskRPEs[task.exercise] || 5}
                      onChange={(e) => handleTaskRPE(task.exercise, parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-blue rounded-lg appearance-none cursor-pointer mb-2"
                      disabled={isSubmitting}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1 - Very Easy</span>
                      <span>10 - Max Effort</span>
                    </div>
                  </div>
                  
                  {/* Quality Section */}
                  <div>
                    <h4 className="text-xs font-medium text-charcoal mb-2 uppercase tracking-wide">Quality</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {['A', 'B', 'C', 'D'].map((grade) => (
                        <QualityButton
                          key={grade}
                          grade={grade}
                          isSelected={taskQualities[task.exercise] === grade}
                          onClick={() => handleTaskQuality(task.exercise, 
                            taskQualities[task.exercise] === grade ? 'C' : grade
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Section */}
          <div className="pt-2">
            <button
              onClick={handleSubmit}
              disabled={!workoutScore.trim() || isSubmitting}
              className="w-full bg-coral text-white py-4 px-6 rounded-lg hover:bg-coral disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-base shadow-sm"
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
                'Mark Exercise Complete'
              )}
            </button>
          </div>
        </div>
      )}

      {/* No separate completed state for MetCon; keep UI simple */}

      {/* Custom CSS for the slider */}
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #FE5858;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #FE5858;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: none;
        }
      `}</style>
    </div>
  )
}
