'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Check } from 'lucide-react'

interface Exercise {
  name: string
  sets: string
  reps: string
  weightTime: string
  notes: string
}

interface Block {
  block: string
  exercises: Exercise[]
}

interface Day {
  day: number
  dayName: string
  mainLift: string
  isDeload: boolean
  blocks: Block[]
  metconData?: {
    workoutId: string
    workoutFormat: string
    timeRange: string
    percentileGuidance: any
  }
}

interface Week {
  week: number
  days: Day[]
}

interface ProgramData {
  weeks: Week[]
  totalExercises: number
  metadata?: any
}

interface ExerciseTracking {
  completed: boolean
  rpe: number | null
  quality: string | null
}

// Updated getBlockStyles with new properties
const getBlockStyles = (blockName: string) => {
  const styles: Record<string, { 
    borderColor: string
    leftBorderColor: string
    bgColor: string
    accentBg: string
    headerColor: string
  }> = {
    'SKILLS': {
      borderColor: 'border-blue-200',
      leftBorderColor: 'border-l-blue-500',
      bgColor: 'bg-blue-50',
      accentBg: 'bg-blue-500',
      headerColor: 'text-blue-900'
    },
    'TECHNICAL WORK': {
      borderColor: 'border-orange-200', 
      leftBorderColor: 'border-l-orange-500',
      bgColor: 'bg-orange-50',
      accentBg: 'bg-orange-500',
      headerColor: 'text-orange-900'
    },
    'STRENGTH AND POWER': {
      borderColor: 'border-green-200',
      leftBorderColor: 'border-l-green-500', 
      bgColor: 'bg-green-50',
      accentBg: 'bg-green-500',
      headerColor: 'text-green-900'
    },
    'ACCESSORIES': {
      borderColor: 'border-purple-200',
      leftBorderColor: 'border-l-purple-500',
      bgColor: 'bg-purple-50',
      accentBg: 'bg-purple-500',
      headerColor: 'text-purple-900'
    },
    'METCONS': {
      borderColor: 'border-red-200',
      leftBorderColor: 'border-l-red-500',
      bgColor: 'bg-red-50',
      accentBg: 'bg-red-500',
      headerColor: 'text-red-900'
    }
  }
  
  return styles[blockName] || {
    borderColor: 'border-gray-300',
    leftBorderColor: 'border-l-gray-300', 
    bgColor: 'bg-gray-50',
    accentBg: 'bg-gray-500',
    headerColor: 'text-gray-900'
  }
}

// New formatWeight function
const formatWeight = (weightTime: string) => {
  if (!weightTime) return ''
  if (weightTime.includes('kg') || weightTime.includes('lbs') || 
      weightTime.includes('s') || weightTime.includes('min')) {
    return weightTime
  }
  return `${weightTime} lbs`
}

export default function ProgramPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [programId, setProgramId] = useState<number | null>(null)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [selectedDay, setSelectedDay] = useState(1)
  const [user, setUser] = useState<User | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [exerciseTracking, setExerciseTracking] = useState<Record<string, ExerciseTracking>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadProgram()
  }, [])

  // Load existing workout data when week/day changes
  useEffect(() => {
    if (programId && userId) {
      loadWorkoutData()
    }
  }, [selectedWeek, selectedDay, programId, userId])

  const loadProgram = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      setUser(user)

      // Get user ID from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        setLoading(false)
        return
      }
      setUserId(userData.id)

      // Fetch the latest program for this user
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (programError || !programData) {
        setError('No program found. Please complete the intake assessment.')
        setLoading(false)
        return
      }

      setProgramId(programData.id)
      setProgram(programData.program_data)
      setLoading(false)
    } catch (err) {
      console.error('Error loading program:', err)
      setError('Failed to load program')
      setLoading(false)
    }
  }

  const loadWorkoutData = async () => {
    try {
      // Load existing workout completion data
      const { data: workoutData, error } = await supabase
        .from('program_workouts')
        .select('exercise_name, user_rpe, completed_at')
        .eq('program_id', programId)
        .eq('week', selectedWeek)
        .eq('day', selectedDay)

      if (!error && workoutData) {
        const tracking: Record<string, ExerciseTracking> = {}
        workoutData.forEach(workout => {
          const key = `${selectedWeek}-${selectedDay}-${workout.exercise_name}`
          tracking[key] = {
            completed: !!workout.completed_at,
            rpe: workout.user_rpe,
            quality: null // We'll need to add quality field to DB
          }
        })
        setExerciseTracking(prev => ({ ...prev, ...tracking }))
      }
    } catch (err) {
      console.error('Error loading workout data:', err)
    }
  }

  // Updated updateExerciseTracking with set number support
  const updateExerciseTracking = async (
    exerciseName: string, 
    block: string,
    field: 'completed' | 'rpe' | 'quality', 
    value: boolean | number | string | null,
    setNumber?: number
  ) => {
    const key = setNumber 
      ? `${selectedWeek}-${selectedDay}-${exerciseName}-set${setNumber}`
      : `${selectedWeek}-${selectedDay}-${exerciseName}`
    setSaving(key)

    // Update local state immediately
    setExerciseTracking(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }))

    try {
      // Find the workout in the database
      const { data: existingWorkout } = await supabase
        .from('program_workouts')
        .select('id')
        .eq('program_id', programId)
        .eq('week', selectedWeek)
        .eq('day', selectedDay)
        .eq('exercise_name', exerciseName)
        .eq('block', block)
        .single()

      if (existingWorkout) {
        // Update existing record
        const updates: any = {}
        if (field === 'completed') {
          updates.completed_at = value ? new Date().toISOString() : null
        } else if (field === 'rpe') {
          updates.user_rpe = value
        }
        // Note: quality field needs to be added to database

        await supabase
          .from('program_workouts')
          .update(updates)
          .eq('id', existingWorkout.id)
      } else {
        // Create new record
        const currentDay = program?.weeks.find(w => w.week === selectedWeek)?.days.find(d => d.day === selectedDay)
        const exerciseOrder = currentDay?.blocks.findIndex(b => b.block === block) || 0

        await supabase
          .from('program_workouts')
          .insert({
            program_id: programId,
            week: selectedWeek,
            day: selectedDay,
            block: block,
            exercise_order: exerciseOrder,
            exercise_name: exerciseName,
            completed_at: field === 'completed' && value ? new Date().toISOString() : null,
            user_rpe: field === 'rpe' ? value : null
          })
      }

      // Also log to performance_logs for analytics
      if (field === 'completed' && value) {
        await supabase
          .from('performance_logs')
          .insert({
            program_id: programId,
            user_id: userId,
            week: selectedWeek,
            day: selectedDay,
            block: block,
            exercise_name: exerciseName,
            rpe: exerciseTracking[key]?.rpe,
            completion_quality: exerciseTracking[key]?.quality === 'A' ? 4 :
                              exerciseTracking[key]?.quality === 'B' ? 3 :
                              exerciseTracking[key]?.quality === 'C' ? 2 :
                              exerciseTracking[key]?.quality === 'D' ? 1 : null
          })
      }
    } catch (err) {
      console.error('Error updating exercise:', err)
    } finally {
      setSaving(null)
    }
  }

  // Updated getExerciseTracking with set number support
  const getExerciseTracking = (exerciseName: string, setNumber?: number): ExerciseTracking => {
    const key = setNumber 
      ? `${selectedWeek}-${selectedDay}-${exerciseName}-set${setNumber}`
      : `${selectedWeek}-${selectedDay}-${exerciseName}`
    return exerciseTracking[key] || { completed: false, rpe: null, quality: null }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your program...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error}</p>
            <a 
              href="/intake" 
              className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Go to Assessment
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!program || !program.weeks) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Program Data</h2>
            <p className="text-yellow-700">Program structure not found. Please contact support.</p>
          </div>
        </div>
      </div>
    )
  }

  const currentWeek = program.weeks.find(w => w.week === selectedWeek)
  const currentDay = currentWeek?.days.find(d => d.day === selectedDay)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your CrossFit Training Program
          </h1>
          <p className="text-gray-600">
            {program.weeks.length} weeks generated • {program.totalExercises} total exercises
          </p>
        </div>
   
        {/* Navigation */}
        <div className="flex gap-4 mb-6">
          <a
            href="/profile"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            View Profile Analysis
          </a>
        </div>  
        
        {/* Week Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex space-x-2 overflow-x-auto">   
            {program.weeks.map((week) => (
              <button
                key={week.week}
                onClick={() => {
                  setSelectedWeek(week.week)
                  setSelectedDay(1)
                }}
                className={`px-4 py-2 rounded-md whitespace-nowrap ${
                  selectedWeek === week.week
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week {week.week}
                {[4, 8, 12].includes(week.week) && (
                  <span className="ml-2 text-xs">(Deload)</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Day Selector */}
        {currentWeek && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex space-x-2 overflow-x-auto">
              {currentWeek.days.map((day) => (
                <button
                  key={day.day}
                  onClick={() => setSelectedDay(day.day)}
                  className={`px-4 py-2 rounded-md whitespace-nowrap ${
                    selectedDay === day.day
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day.dayName}
                  <span className="block text-xs mt-1">{day.mainLift}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Workout Display */}
        {currentDay && (
          <div className="space-y-8">
            {/* Day Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentDay.dayName} - {currentDay.mainLift}
              </h2>
              {currentDay.isDeload && (
                <p className="text-yellow-600 font-medium mt-1">Deload Week - Reduced Volume</p>
              )}
            </div>

            {/* Workout Blocks */}
            {currentDay.blocks.map((block, blockIndex) => {
              const blockStyles = getBlockStyles(block.block)
              
              return (
                <div key={blockIndex} className="bg-white rounded-xl shadow-md overflow-hidden">
                  {/* Updated block header */}
                  <div className="flex items-center gap-4 p-6 border-b border-gray-200">
                    <div className={`w-1 h-8 ${blockStyles.accentBg} rounded-full`}></div>
                    <h3 className={`text-2xl font-bold ${blockStyles.headerColor}`}>
                      {block.block}
                    </h3>
                  </div>
                  
                  {/* Exercises wrapped in container */}
                  <div className="p-6">
                    {block.exercises.length === 0 ? (
                      <p className="text-gray-500 italic">No exercises assigned</p>
                    ) : (
                      <div className="space-y-3">
                        {block.block === 'STRENGTH AND POWER' ? (
                          // STRENGTH AND POWER: Use grouped "Set 1:", "Set 2:" format
                          (() => {
                            const groupedExercises = block.exercises.reduce((acc, exercise, index) => {
                              const exerciseName = exercise.name;
                              if (!acc[exerciseName]) {
                                acc[exerciseName] = [];
                              }
                              acc[exerciseName].push({ ...exercise, originalIndex: index });
                              return acc;
                            }, {} as Record<string, (Exercise & { originalIndex: number })[]>);

                            return Object.entries(groupedExercises).map(([exerciseName, exerciseGroup]) => {
                              const key = `${selectedWeek}-${selectedDay}-${exerciseName}`;
                              const isSaving = saving === key;
                              
                              return (
                                <div key={exerciseName} className="space-y-2">
                                  <h4 className="font-semibold text-gray-900 text-lg mb-3">
                                    {exerciseName.toUpperCase()}
                                  </h4>
                                  
                                  {/* Display each set with individual tracking */}
                                  {exerciseGroup.map((set, setIndex) => {
                                    const tracking = getExerciseTracking(exerciseName, setIndex + 1);
                                    const setKey = `${key}-set${setIndex + 1}`;
                                    const isSetSaving = saving === setKey;
                                    
                                    return (
                                      <div 
                                        key={setIndex} 
                                        className={`border-l-4 rounded-lg p-4 transition-all duration-200 ${
                                          tracking.completed 
                                            ? `${blockStyles.leftBorderColor} ${blockStyles.bgColor} shadow-sm` 
                                            : `${blockStyles.leftBorderColor} bg-white hover:bg-gray-50`
                                        }`}
                                      >
                                        <div className="flex justify-between items-center">
                                          <div className="flex-1">
                                            <div className="text-sm text-gray-700">
                                              <span className="font-medium">Set {setIndex + 1}:</span>
                                              {set.reps && <span className="ml-2">{set.reps} reps</span>}
                                              {set.weightTime && (
                                                <span className="ml-2 font-semibold">
                                                  @ {formatWeight(set.weightTime)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center gap-3 ml-4">
                                            {/* Updated Done button */}
                                            <div className="flex flex-col items-center">
                                              <label className="text-xs text-gray-600 mb-1">Done</label>
                                              <button
                                                onClick={() => updateExerciseTracking(exerciseName, block.block, 'completed', !tracking.completed, setIndex + 1)}
                                                className={`
                                                  w-8 h-8 rounded-md border-2 flex items-center justify-center transition-colors
                                                  ${tracking.completed 
                                                    ? 'bg-blue-500 border-blue-500' 
                                                    : 'border-gray-300 hover:border-gray-400 bg-white'
                                                  }
                                                `}
                                                disabled={isSetSaving}
                                              >
                                                {tracking.completed && <Check className="w-5 h-5 text-white" />}
                                              </button>
                                            </div>

                                            {/* RPE Selector */}
                                            <div className="flex flex-col items-center">
                                              <label className="text-xs text-gray-600 mb-1">RPE</label>
                                              <select
                                                value={tracking.rpe || ''}
                                                onChange={(e) => updateExerciseTracking(exerciseName, block.block, 'rpe', e.target.value ? parseInt(e.target.value) : null, setIndex + 1)}
                                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                disabled={isSetSaving}
                                              >
                                                <option value="">-</option>
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                                  <option key={num} value={num}>{num}</option>
                                                ))}
                                              </select>
                                            </div>

                                            {/* Quality Selector */}
                                            <div className="flex flex-col items-center">
                                              <label className="text-xs text-gray-600 mb-1">Quality</label>
                                              <select
                                                value={tracking.quality || ''}
                                                onChange={(e) => updateExerciseTracking(exerciseName, block.block, 'quality', e.target.value || null, setIndex + 1)}
                                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                disabled={isSetSaving}
                                              >
                                                <option value="">-</option>
                                                <option value="A">A</option>
                                                <option value="B">B</option>
                                                <option value="C">C</option>
                                                <option value="D">D</option>
                                              </select>
                                            </div>

                                            {/* Saving indicator */}
                                            {isSetSaving && (
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Show notes from first set */}
                                  {exerciseGroup[0].notes && !exerciseGroup[0].notes.includes('Set') && (
                                    <p className="text-sm text-gray-500 mt-2 italic">
                                      {exerciseGroup[0].notes}
                                    </p>
                                  )}
                                </div>
                              );
                            });
                          })()
                        ) : (
                          // ALL OTHER BLOCKS: Use old "Sets: X, Reps: Y" format
                          block.exercises.map((exercise, exIndex) => {
                            const tracking = getExerciseTracking(exercise.name);
                            const key = `${selectedWeek}-${selectedDay}-${exercise.name}`;
                            const isSaving = saving === key;
                            
                            return (
                              <div 
                                key={exIndex} 
                                className={`border-l-4 rounded-lg p-4 transition-all duration-200 ${
                                  tracking.completed 
                                    ? `${blockStyles.leftBorderColor} ${blockStyles.bgColor} shadow-sm` 
                                    : `${blockStyles.leftBorderColor} bg-white hover:bg-gray-50`
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900">
                                      {exercise.name}
                                    </h4>
                                    <div className="text-sm text-gray-600 mt-1">
                                      {exercise.sets && (
                                        <span className="mr-4">Sets: {exercise.sets}</span>
                                      )}
                                      {exercise.reps && (
                                        <span className="mr-4">Reps: {exercise.reps}</span>
                                      )}
                                      {exercise.weightTime && (
                                        <span className="mr-4">
                                          {exercise.weightTime.includes('kg') || exercise.weightTime.includes('lbs') 
                                            ? `Weight: ${exercise.weightTime}`
                                            : exercise.weightTime
                                          }
                                        </span>
                                      )}
                                    </div>
                                    {exercise.notes && (
                                      <p className="text-sm text-gray-500 mt-1 italic">
                                        {exercise.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 ml-4">
                                    {/* Updated Done button */}
                                    <div className="flex flex-col items-center">
                                      <label className="text-xs text-gray-600 mb-1">Done</label>
                                      <button
                                        onClick={() => updateExerciseTracking(exercise.name, block.block, 'completed', !tracking.completed)}
                                        className={`
                                          w-8 h-8 rounded-md border-2 flex items-center justify-center transition-colors
                                          ${tracking.completed 
                                            ? 'bg-blue-500 border-blue-500' 
                                            : 'border-gray-300 hover:border-gray-400 bg-white'
                                          }
                                        `}
                                        disabled={isSaving}
                                      >
                                        {tracking.completed && <Check className="w-5 h-5 text-white" />}
                                      </button>
                                    </div>

                                    {/* RPE Selector */}
                                    <div className="flex flex-col items-center">
                                      <label className="text-xs text-gray-600 mb-1">RPE</label>
                                      <select
                                        value={tracking.rpe || ''}
                                        onChange={(e) => updateExerciseTracking(exercise.name, block.block, 'rpe', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isSaving}
                                      >
                                        <option value="">-</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                          <option key={num} value={num}>{num}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Quality Selector */}
                                    <div className="flex flex-col items-center">
                                      <label className="text-xs text-gray-600 mb-1">Quality</label>
                                      <select
                                        value={tracking.quality || ''}
                                        onChange={(e) => updateExerciseTracking(exercise.name, block.block, 'quality', e.target.value || null)}
                                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isSaving}
                                      >
                                        <option value="">-</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                      </select>
                                    </div>

                                    {/* Saving indicator */}
                                    {isSaving && (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Updated MetCon specific display */}
                    {block.block === 'METCONS' && currentDay.metconData && (
                      <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                        <h5 className="font-semibold text-red-900 mb-3">Workout Details</h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Format:</span>
                            <span className="ml-2 text-gray-900">{currentDay.metconData.workoutFormat}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Time Domain:</span>
                            <span className="ml-2 text-gray-900">{currentDay.metconData.timeRange}</span>
                          </div>
                          {currentDay.metconData.percentileGuidance && (
                            <>
                              <div>
                                <span className="font-medium text-gray-700">Target (50%):</span>
                                <span className="ml-2 text-gray-900 font-semibold">
                                  {currentDay.metconData.percentileGuidance.medianScore}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Excellent (90%):</span>
                                <span className="ml-2 text-gray-900 font-semibold">
                                  {currentDay.metconData.percentileGuidance.excellentScore}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
