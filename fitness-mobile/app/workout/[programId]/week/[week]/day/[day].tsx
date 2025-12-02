import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import ExerciseCard from '@/components/ExerciseCard'
import MetConCard from '@/components/MetConCard'
import EngineBlockCard from '@/components/EngineBlockCard'

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
  userGender: string
  blocks: Block[]
  metconData?: any
  engineData?: any
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
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { data: userData, error: dbError } = await supabase
    .from('users')
    .select('id, auth_id, email')
    .eq('auth_id', user.id)
    .single()

  if (dbError || !userData) {
    throw new Error('User not found in database')
  }

  return userData.id
}

export default function WorkoutPage() {
  const { programId, week, day } = useLocalSearchParams<{
    programId: string
    week: string
    day: string
  }>()
  const router = useRouter()

  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [completions, setCompletions] = useState<Record<string, Completion>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchWorkout = async () => {
      try {
        setLoading(true)
        setError(null)

        // TODO: Replace with actual API endpoint when backend is ready
        // For now, we'll use the Supabase client directly
        const supabase = createClient()

        // This is a placeholder - you'll need to implement the actual data fetching
        // based on your backend API structure
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/workouts/${programId}/week/${week}/day/${day}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch workout')
        }

        const data = await response.json()

        if (data.success && data.workout) {
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
          throw new Error(data.error || 'Workout data is invalid or missing')
        }
      } catch (err: any) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setWorkout(null)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkout()
  }, [programId, week, day])

  const toggleBlock = (blockName: string, index: number) => {
    const key = `${blockName}-${index}`
    setExpandedBlocks(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const logCompletion = async (exerciseName: string, block: string, completion: Partial<Completion>) => {
    const setMatch = exerciseName.match(/Set (\d+)$/)
    const setNumber = setMatch ? parseInt(setMatch[1]) : 1
    const cleanExerciseName = exerciseName.replace(/ - Set \d+$/, '')

    try {
      const userId = await getCurrentUserId()

      // Optimistic update
      setCompletions(prev => ({
        ...prev,
        [exerciseName]: { exerciseName, ...completion }
      }))

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

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/workouts/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error('Server returned unsuccessful response')
      }
    } catch (err) {
      console.error('Failed to log completion:', err)
      // Rollback on failure
      setCompletions(prev => {
        const updated = { ...prev }
        delete updated[exerciseName]
        return updated
      })
      alert('Failed to save completion. Please try again.')
    }
  }

  const logMetConCompletion = async (
    workoutScore: string,
    taskCompletions: { exerciseName: string, rpe: number, quality: string }[],
    avgHR?: string,
    peakHR?: string
  ) => {
    try {
      const userId = await getCurrentUserId()

      // Log each task
      const taskPromises = taskCompletions.map(task =>
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/workouts/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            programId: parseInt(programId),
            userId,
            week: parseInt(week),
            day: parseInt(day),
            block: 'METCONS',
            exerciseName: task.exerciseName,
            repsCompleted: '',
            rpe: task.rpe,
            quality: task.quality,
            notes: `Part of ${workout?.metconData?.workoutId}`
          })
        })
      )

      // Log overall workout
      const metconPromise = fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/metcons/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            programId: parseInt(programId),
            userId,
            week: parseInt(week),
            day: parseInt(day),
            workoutScore,
            metconId: workout?.metconData?.id,
            avgHR: avgHR ? parseInt(avgHR) : undefined,
            peakHR: peakHR ? parseInt(peakHR) : undefined
          })
        }
      )

      await Promise.all([...taskPromises, metconPromise])

      // Update local state
      setCompletions(prev => {
        const updated = { ...prev }
        taskCompletions.forEach(task => {
          updated[task.exerciseName] = {
            exerciseName: task.exerciseName,
            setsCompleted: 1,
            repsCompleted: '',
            rpe: task.rpe,
            notes: `Part of ${workout?.metconData?.workoutId}`,
            wasRx: true
          }
        })
        return updated
      })
    } catch (error) {
      console.error('Failed to log MetCon completion:', error)
      alert('Failed to save MetCon completion. Please try again.')
    }
  }

  const calculateProgress = () => {
    if (!workout) return 0
    const totalExercises = workout.blocks.reduce(
      (sum, block) => sum + block.exercises.length,
      0
    )
    const completedExercises = Object.keys(completions).length
    return totalExercises > 0 ? Math.min(100, (completedExercises / totalExercises) * 100) : 0
  }

  if (loading) {
    return (
      <View className="flex-1 bg-ice-blue items-center justify-center">
        <ActivityIndicator size="large" color="#FE5858" />
        <Text className="text-charcoal mt-4">Loading workout...</Text>
      </View>
    )
  }

  if (error || !workout) {
    return (
      <View className="flex-1 bg-ice-blue items-center justify-center px-6">
        <Text className="text-red-600 text-5xl mb-4">⚠️</Text>
        <Text className="text-xl font-semibold text-charcoal mb-2">Workout Not Found</Text>
        <Text className="text-charcoal mb-4">{error || 'Workout data is missing'}</Text>
        <TouchableOpacity
          className="bg-coral px-4 py-2 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const progress = calculateProgress()

  return (
    <View className="flex-1 bg-ice-blue">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-4">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-coral text-lg">← Back</Text>
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-charcoal">
                Week {workout.week}, Day {workout.day}
              </Text>
              {workout.isDeload && (
                <Text className="text-sm text-yellow-600">Deload Week</Text>
              )}
            </View>
          </View>

          <View className="flex-row items-center space-x-2">
            <View className="w-24 bg-slate-blue rounded-full h-2">
              <View
                className="h-2 rounded-full bg-coral"
                style={{ width: `${progress}%` }}
              />
            </View>
            <Text className="text-sm font-medium text-charcoal">
              {Math.round(progress)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-4 py-6">
        {workout.blocks.map((block, blockIndex) => {
          const key = `${block.blockName}-${blockIndex}`
          const isExpanded = expandedBlocks[key]

          return (
            <View
              key={blockIndex}
              className="mb-6 rounded-lg border-2 border-slate-blue bg-slate-blue"
            >
              {/* Block Header */}
              <TouchableOpacity
                onPress={() => toggleBlock(block.blockName, blockIndex)}
                className="p-4"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center space-x-3">
                    <Text className="text-xl font-bold text-charcoal">
                      {block.blockName.toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-row items-center space-x-2">
                    <Text className="text-sm text-charcoal">
                      {block.exercises.filter(ex => {
                        const setMatch = ex.notes?.match(/Set (\d+)/)
                        const setNumber = setMatch ? parseInt(setMatch[1]) : 1
                        const exerciseKey = setNumber > 1 ? `${ex.name} - Set ${setNumber}` : ex.name
                        return completions[exerciseKey] !== undefined
                      }).length}/{block.exercises.length} Complete
                    </Text>
                    <Text className="text-gray-400">
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Block Content */}
              {isExpanded && (
                <View className="px-4 pb-4">
                  {block.blockName === 'METCONS' ? (
                    <MetConCard
                      metconData={workout.metconData}
                      onComplete={(workoutScore, taskCompletions, avgHR, peakHR) => {
                        logMetConCompletion(workoutScore, taskCompletions, avgHR, peakHR)
                      }}
                    />
                  ) : block.blockName === 'ENGINE' ? (
                    <EngineBlockCard
                      engineData={workout.engineData}
                      engineDayNumber={workout.engineData?.dayNumber || 0}
                    />
                  ) : (
                    block.exercises.map((exercise, exerciseIndex) => {
                      const setMatch = exercise.notes?.match(/Set (\d+)/)
                      const setNumber = setMatch ? parseInt(setMatch[1]) : 1
                      const exerciseKey = setNumber > 1
                        ? `${exercise.name} - Set ${setNumber}`
                        : exercise.name

                      return (
                        <ExerciseCard
                          key={exerciseIndex}
                          exercise={exercise}
                          block={block.blockName}
                          completion={completions[exerciseKey]}
                          onComplete={(completion) => {
                            logCompletion(exerciseKey, block.blockName, completion)
                          }}
                        />
                      )
                    })
                  )}
                </View>
              )}
            </View>
          )
        })}

        {/* Navigation */}
        <View className="flex-row items-center justify-between mt-8 pt-6 border-t border-slate-blue">
          <TouchableOpacity
            className="px-4 py-2 rounded-lg bg-slate-blue"
            onPress={() => {
              // TODO: Implement prev/next navigation
            }}
          >
            <Text className="text-charcoal">← Prev</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="px-4 py-2 bg-coral rounded-lg"
            onPress={() => router.back()}
          >
            <Text className="text-white">Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="px-4 py-2 rounded-lg bg-slate-blue"
            onPress={() => {
              // TODO: Implement prev/next navigation
            }}
          >
            <Text className="text-charcoal">Next →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}
