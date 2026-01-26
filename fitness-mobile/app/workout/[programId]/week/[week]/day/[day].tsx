import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase/client'
import { fetchWorkout } from '@/lib/api/workouts'
import { logExerciseCompletion } from '@/lib/api/completions'
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
  isTestWeek: boolean
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
  const { programId, week, day, refresh } = useLocalSearchParams<{
    programId: string
    week: string
    day: string
    refresh?: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [completions, setCompletions] = useState<Record<string, Completion>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({})
  const [allPrograms, setAllPrograms] = useState<Array<{ id: number; weeks_generated: number[] }>>([])
  const [isMetconCompleted, setIsMetconCompleted] = useState(false)
  const [isEngineCompleted, setIsEngineCompleted] = useState(false)

  useEffect(() => {
    const loadWorkout = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/auth/signin')
          return
        }

        // Get user ID and subscription tier for block filtering
        const { data: userData } = await supabase
          .from('users')
          .select('id, subscription_tier')
          .eq('auth_id', user.id)
          .single()

        if (!userData) {
          setError('User not found')
          return
        }

        // Check for NULL subscription_tier - block access if missing
        if (!userData.subscription_tier) {
          console.error('❌ User missing subscription_tier for workout access')
          Alert.alert(
            'Subscription Required',
            'Please subscribe to access workouts.',
            [{ text: 'View Plans', onPress: () => router.replace('/subscriptions') }]
          )
          setError('Subscription required')
          router.replace('/subscriptions')
          return
        }

        // Fetch all programs for navigation
        const { data: programs } = await supabase
          .from('programs')
          .select('id, weeks_generated')
          .eq('user_id', userData.id)
          .order('generated_at', { ascending: true })

        if (programs) {
          setAllPrograms(programs)
        }

        const data = await fetchWorkout(
          parseInt(programId),
          parseInt(week),
          parseInt(day)
        )

        if (data.success && data.workout) {
          // Filter blocks based on subscription tier
          let filteredWorkout = { ...data.workout };
          
          // Normalize tier for comparison
          const normalizedTier = (userData.subscription_tier || '').toUpperCase();
          
          const TIER_BLOCKS: { [key: string]: string[] } = {
              'ENGINE': ['ENGINE'],
              'BTN': [], // BTN users shouldn't be here, but handle gracefully
              'APPLIED_POWER': ['TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES'],
              'PREMIUM': ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS', 'ENGINE']
            };
            
            const allowedBlocks = TIER_BLOCKS[normalizedTier] || TIER_BLOCKS['PREMIUM'];
            
            // Filter blocks
            filteredWorkout.blocks = data.workout.blocks.filter((block: Block) => 
              allowedBlocks.includes(block.blockName)
            );
            
            // Remove metcon/engine data if not allowed
            if (!allowedBlocks.includes('METCONS')) {
              filteredWorkout.metconData = undefined;
            }
            if (!allowedBlocks.includes('ENGINE')) {
              filteredWorkout.engineData = undefined;
            }
            
            console.log(`🔒 Filtered blocks for ${normalizedTier}:`, filteredWorkout.blocks.map((b: Block) => b.blockName));
          
          setWorkout(filteredWorkout)
          if (Array.isArray(data.completions)) {
            const completionMap: Record<string, Completion> = {}
            data.completions.forEach((comp: any) => {
              const setNumber = comp.set_number || 1
              // Include block in key to avoid collisions between exercises with same name in different blocks
              const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
              const key = setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
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
            console.log('🔑 COMPLETION KEYS:', Object.keys(completionMap))
            console.log('📦 RAW COMPLETIONS FROM DB:', data.completions.map((c: any) => ({ block: c.block, name: c.exercise_name })))
            setCompletions(completionMap)
          }
          
          // Check if metcon is completed (all-or-nothing)
          if (data.workout?.metconData?.id) {
            const { data: metconCompletion } = await supabase
              .from('program_metcons')
              .select('id')
              .eq('program_id', parseInt(programId))
              .eq('week', parseInt(week))
              .eq('day', parseInt(day))
              .eq('user_id', userData.id)
              .eq('metcon_id', data.workout.metconData.id)
              .not('completed_at', 'is', null)
              .maybeSingle()
            
            setIsMetconCompleted(!!metconCompletion)
          } else {
            setIsMetconCompleted(false)
          }

          // Check if engine is completed
          if (data.workout?.engineData?.dayNumber) {
            let query = supabase
              .from('workout_sessions')
              .select('id')
              .eq('user_id', userData.id)
              .eq('program_day_number', data.workout.engineData.dayNumber)
              .eq('completed', true)
            
            // Filter by program_id if available
            if (programId) {
              query = query.eq('program_id', parseInt(programId))
            }
            
            const { data: engineSession } = await query
              .limit(1)
              .maybeSingle()
            
            setIsEngineCompleted(!!engineSession)
          } else {
            setIsEngineCompleted(false)
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

    loadWorkout()
  }, [programId, week, day])

  // Re-check engine completion when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const checkEngineCompletion = async () => {
        console.log('🔄 useFocusEffect running - checking engine completion')
        
        if (!workout?.engineData?.dayNumber) {
          console.log('❌ No engine data found, skipping check')
          return
        }

        console.log('✅ Engine data found, dayNumber:', workout.engineData.dayNumber)

        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single()

          if (!userData) return

          console.log('🔍 Querying for engine session:', {
            userId: (userData as any).id,
            programDayNumber: workout.engineData.dayNumber
          })

          let query = supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', (userData as any).id)
            .eq('program_day_number', workout.engineData.dayNumber)
            .eq('completed', true)
          
          // Filter by program_id if available
          if (programId) {
            query = query.eq('program_id', parseInt(programId))
          }
          
          const { data: engineSession } = await query
            .limit(1)
            .maybeSingle()

          console.log('🔍 Engine session result:', engineSession ? 'FOUND ✅' : 'NOT FOUND ❌')
          console.log('🔍 Setting isEngineCompleted to:', !!engineSession)
          
          setIsEngineCompleted(!!engineSession)
        } catch (error) {
          console.error('Error checking engine completion:', error)
        }
      }

      checkEngineCompletion()
    }, [workout, refresh]) // Add refresh to dependencies to trigger check when returning from Engine
  )

  // Automatically collapse completed blocks
  useEffect(() => {
    if (!workout) return

    const blocksToCollapse: string[] = []
    
    workout.blocks.forEach((block, blockIndex) => {
      const key = `${block.blockName}-${blockIndex}`
      
      // Calculate completion status
      let completedCount = 0
      let totalCount = 0
      
      if (block.blockName === 'METCONS') {
        totalCount = workout.metconData?.tasks?.length || 0
        completedCount = isMetconCompleted ? totalCount : 0
      } else if (block.blockName === 'ENGINE') {
        totalCount = 1
        completedCount = isEngineCompleted ? 1 : 0
      } else {
        completedCount = block.exercises.filter(ex => {
          const setMatch = ex.notes?.match(/Set (\d+)/)
          const setNumber = setMatch ? parseInt(setMatch[1]) : 1
          const setSuffix = setNumber > 1 ? ` - Set ${setNumber}` : ''
          const blockKey = `${block.blockName}:${ex.name}${setSuffix}`
          const legacyKey = `${ex.name}${setSuffix}`
          return completions[blockKey] !== undefined || completions[legacyKey] !== undefined
        }).length
        totalCount = block.exercises.length
      }
      
      const isBlockComplete = completedCount === totalCount && totalCount > 0
      
      // If block is complete, mark it for collapse
      if (isBlockComplete) {
        blocksToCollapse.push(key)
      }
    })
    
    // Collapse all completed blocks
    if (blocksToCollapse.length > 0) {
      setExpandedBlocks(prev => {
        const updated = { ...prev }
        blocksToCollapse.forEach(key => {
          updated[key] = false
        })
        return updated
      })
    }
  }, [workout, completions, isMetconCompleted, isEngineCompleted])

  const toggleBlock = (blockName: string, index: number) => {
    const key = `${blockName}-${index}`
    setExpandedBlocks(prev => ({
      ...prev,
      [key]: prev[key] === true ? false : true // Toggle, default to collapsed (undefined = collapsed)
    }))
  }

  const navigateToPrevDay = () => {
    const currentDay = parseInt(day)
    const currentWeek = parseInt(week)
    const currentProgramId = parseInt(programId)

    if (allPrograms.length === 0) return

    // Find current program index (1-based)
    const currentProgramIndex = allPrograms.findIndex(p => p.id === currentProgramId)
    if (currentProgramIndex === -1) return

    const programIndex = currentProgramIndex + 1 // 1-based
    const globalWeek = 4 * (programIndex - 1) + currentWeek

    if (currentDay > 1) {
      // Same week, previous day
      router.push(`/workout/${programId}/week/${currentWeek}/day/${currentDay - 1}`)
    } else if (globalWeek > 1) {
      // Previous week, day 5
      const prevGlobalWeek = globalWeek - 1
      const prevProgramIndex = Math.ceil(prevGlobalWeek / 4)
      const prevProgramWeek = ((prevGlobalWeek - 1) % 4) + 1
      const prevProgram = allPrograms[prevProgramIndex - 1]
      
      if (prevProgram && prevProgram.weeks_generated.includes(prevProgramWeek)) {
        router.push(`/workout/${prevProgram.id}/week/${prevProgramWeek}/day/5`)
      }
    }
  }

  const navigateToNextDay = () => {
    const currentDay = parseInt(day)
    const currentWeek = parseInt(week)
    const currentProgramId = parseInt(programId)

    if (allPrograms.length === 0) return

    // Find current program index (1-based)
    const currentProgramIndex = allPrograms.findIndex(p => p.id === currentProgramId)
    if (currentProgramIndex === -1) return

    const programIndex = currentProgramIndex + 1 // 1-based
    const globalWeek = 4 * (programIndex - 1) + currentWeek

    if (currentDay < 5) {
      // Same week, next day
      router.push(`/workout/${programId}/week/${currentWeek}/day/${currentDay + 1}`)
    } else {
      // Next week, day 1
      const nextGlobalWeek = globalWeek + 1
      const nextProgramIndex = Math.ceil(nextGlobalWeek / 4)
      const nextProgramWeek = ((nextGlobalWeek - 1) % 4) + 1
      const nextProgram = allPrograms[nextProgramIndex - 1]
      
      if (nextProgram && nextProgram.weeks_generated.includes(nextProgramWeek)) {
        router.push(`/workout/${nextProgram.id}/week/${nextProgramWeek}/day/1`)
      }
    }
  }

  const canNavigatePrev = (): boolean => {
    const currentDay = parseInt(day)
    const currentWeek = parseInt(week)
    const currentProgramId = parseInt(programId)

    if (allPrograms.length === 0) return false

    const currentProgramIndex = allPrograms.findIndex(p => p.id === currentProgramId)
    if (currentProgramIndex === -1) return false

    const programIndex = currentProgramIndex + 1
    const globalWeek = 4 * (programIndex - 1) + currentWeek

    if (currentDay > 1) return true
    if (currentDay === 1 && globalWeek > 1) {
      const prevGlobalWeek = globalWeek - 1
      const prevProgramIndex = Math.ceil(prevGlobalWeek / 4)
      const prevProgramWeek = ((prevGlobalWeek - 1) % 4) + 1
      const prevProgram = allPrograms[prevProgramIndex - 1]
      return prevProgram !== undefined && prevProgram.weeks_generated.includes(prevProgramWeek)
    }
    return false
  }

  const canNavigateNext = (): boolean => {
    const currentDay = parseInt(day)
    const currentWeek = parseInt(week)
    const currentProgramId = parseInt(programId)

    if (allPrograms.length === 0) return false

    const currentProgramIndex = allPrograms.findIndex(p => p.id === currentProgramId)
    if (currentProgramIndex === -1) return false

    const programIndex = currentProgramIndex + 1
    const globalWeek = 4 * (programIndex - 1) + currentWeek

    if (currentDay < 5) return true
    if (currentDay === 5) {
      const nextGlobalWeek = globalWeek + 1
      const nextProgramIndex = Math.ceil(nextGlobalWeek / 4)
      const nextProgramWeek = ((nextGlobalWeek - 1) % 4) + 1
      const nextProgram = allPrograms[nextProgramIndex - 1]
      return nextProgram !== undefined && nextProgram.weeks_generated.includes(nextProgramWeek)
    }
    return false
  }

  const logCompletion = async (exerciseName: string, block: string, completion: Partial<Completion>, setNumber: number = 1) => {
    const setSuffix = setNumber > 1 ? ` - Set ${setNumber}` : ''
    const completionKey = `${block}:${exerciseName}${setSuffix}`

    try {
      const userId = await getCurrentUserId()

      // Optimistic update with block-prefixed key
      setCompletions(prev => ({
        ...prev,
        [completionKey]: { exerciseName, ...completion }
      }))

      await logExerciseCompletion({
        programId: parseInt(programId),
        userId,
        week: parseInt(week),
        day: parseInt(day),
        block,
        exerciseName,
        setNumber,
        ...completion
      })
    } catch (err) {
      console.error('Failed to log completion:', err)
      // Rollback on failure
      setCompletions(prev => {
        const updated = { ...prev }
        delete updated[completionKey]
        return updated
      })
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('Completion error details:', errorMessage)
      alert(`Failed to save completion: ${errorMessage}`)
    }
  }

  const logMetConCompletion = async (
    workoutScore: string,
    taskCompletions: { exerciseName: string, rpe: number, quality: string }[],
    avgHR?: string,
    peakHR?: string,
    notes?: string
  ) => {
    try {
      const userId = await getCurrentUserId()
      const supabase = createClient()

      // 1. Log each task to performance_logs (direct Supabase)
      console.log('📝 Saving', taskCompletions.length, 'MetCon tasks to performance_logs')
      
      const taskResults = await Promise.all(
        taskCompletions.map(async (task) => {
          // Check if log already exists
          const { data: existingLog } = await supabase
            .from('performance_logs')
            .select('id')
            .eq('program_id', parseInt(programId))
            .eq('user_id', userId)
            .eq('week', parseInt(week))
            .eq('day', parseInt(day))
            .eq('block', 'METCONS')
            .eq('exercise_name', task.exerciseName)
            .eq('set_number', 1)
            .maybeSingle()

          const perfLogData: any = {
            program_id: parseInt(programId),
            user_id: userId,
            week: parseInt(week),
            day: parseInt(day),
            block: 'METCONS',
            exercise_name: task.exerciseName,
            set_number: 1,
            reps: null,
            rpe: task.rpe,
            completion_quality: task.quality ? { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[task.quality] : null,
            quality_grade: task.quality,
            logged_at: new Date().toISOString()
          }

          let data: any, error: any
          if (existingLog && (existingLog as any).id) {
            // Update existing
            const result = await (supabase
              .from('performance_logs') as any)
              .update(perfLogData)
              .eq('id', (existingLog as any).id)
              .select()
            data = result.data
            error = result.error
          } else {
            // Insert new
            const result = await (supabase
              .from('performance_logs') as any)
              .insert(perfLogData)
              .select()
            data = result.data
            error = result.error
          }
          
          if (error) {
            console.error(`❌ Failed to save task "${task.exerciseName}":`, error)
            throw error
          }
          
          console.log(`✅ Saved task "${task.exerciseName}"`)
          return data
        })
      )
      
      console.log('✅ Successfully saved', taskResults.length, 'tasks to performance_logs')

      // 2. Call Edge Function for MetCon completion
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase.functions.invoke('complete-metcon', {
        body: {
          programId: parseInt(programId),
          userId,
          week: parseInt(week),
          day: parseInt(day),
          workoutScore,
          metconId: workout?.metconData?.id,
          avgHR: avgHR ? parseInt(avgHR) : undefined,
          peakHR: peakHR ? parseInt(peakHR) : undefined,
          notes: notes || undefined
        }
      })

      if (error) {
        throw error
      }

      if (!data?.success) {
        throw new Error(data?.error || 'MetCon completion failed')
      }

      // Update local state
      setIsMetconCompleted(true) // Mark metcon as completed (all tasks)
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

      console.log('✅ MetCon completion logged successfully!')
    } catch (error) {
      console.error('❌ Failed to log MetCon completion:', error)
      alert('Failed to save MetCon completion. Please try again.')
    }
  }

  const calculateProgress = () => {
    if (!workout) return 0

    // Count exercises, but skip ENGINE and METCONS blocks (handled separately)
    let totalItems = 0

    workout.blocks.forEach((block) => {
      const blockNameUpper = (block.blockName || '').toUpperCase().trim()
      if (blockNameUpper === 'ENGINE' || blockNameUpper === 'METCONS') {
        // Skip - these are counted separately
      } else {
        totalItems += block.exercises.length
      }
    })

    // Add metcon tasks count from metconData
    const metconTasksCount = workout.metconData?.tasks?.length || 0
    totalItems += metconTasksCount

    // Add 1 for ENGINE if it exists
    if (workout.engineData) {
      totalItems += 1
    }

    // Count completed items from completions map
    let completedItems = Object.keys(completions).length

    // Add 1 for ENGINE if completed
    if (workout.engineData && isEngineCompleted) {
      completedItems += 1
    }

    console.log('📊 PROGRESS CALCULATION:', {
      totalItems,
      completedItems,
      metconTasksCount,
      hasEngineData: !!workout.engineData,
      isEngineCompleted,
      percentage: Math.round((completedItems / totalItems) * 100)
    })

    return totalItems > 0 ? Math.min(100, (completedItems / totalItems) * 100) : 0
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    )
  }

  if (error || !workout) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Workout Not Found</Text>
        <Text style={styles.errorMessage}>{error || 'Workout data is missing'}</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.backButtonContainer}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.headerTitle}>
                Week {workout.week}, Day {workout.day}
              </Text>
              {workout.isTestWeek && (
                <Text style={styles.testWeekLabel}>Test Week</Text>
              )}
              {workout.isDeload && (
                <Text style={styles.deloadLabel}>Deload Week</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {workout.blocks.map((block, blockIndex) => {
          const key = `${block.blockName}-${blockIndex}`
          
          // Special handling for METCONS blocks - all or nothing
          let completedCount = 0
          let totalCount = 0
          
          if (block.blockName === 'METCONS') {
            // Count tasks from metconData
            totalCount = workout.metconData?.tasks?.length || 0
            // Metcons are all-or-nothing: if completed, all tasks count as done
            completedCount = isMetconCompleted ? totalCount : 0
          } else if (block.blockName === 'ENGINE') {
            // Engine workouts: single workout, check completion from database
            totalCount = 1
            completedCount = isEngineCompleted ? 1 : 0
          } else {
            // Regular exercise blocks (Skills, Technical, Strength, Accessories)
            completedCount = block.exercises.filter(ex => {
              const setMatch = ex.notes?.match(/Set (\d+)/)
              const setNumber = setMatch ? parseInt(setMatch[1]) : 1
              const setSuffix = setNumber > 1 ? ` - Set ${setNumber}` : ''

              // Check with block prefix (standard) and without (legacy)
              const blockKey = `${block.blockName}:${ex.name}${setSuffix}`
              const legacyKey = `${ex.name}${setSuffix}`
              const foundBlock = completions[blockKey] !== undefined
              const foundLegacy = completions[legacyKey] !== undefined

              if (block.blockName === 'SKILLS') {
                console.log(`🔍 SKILLS: "${ex.name}" blockKey="${blockKey}"(${foundBlock}) legacyKey="${legacyKey}"(${foundLegacy})`)
              }
              return foundBlock || foundLegacy
            }).length

            totalCount = block.exercises.length
          }
          
          const isBlockComplete = completedCount === totalCount && totalCount > 0
          
          // Completed blocks default to collapsed unless explicitly expanded
          const isExpanded = isBlockComplete ? false : (expandedBlocks[key] === true)

          // Format block name
          let displayBlockName = block.blockName.toUpperCase()
          
          // Map block names to display names
          if (block.blockName === 'STRENGTH AND POWER') {
            const strengthBlocks = workout.blocks.filter(b => b.blockName === 'STRENGTH AND POWER')
            if (strengthBlocks.length > 1) {
              const idx = strengthBlocks.indexOf(block)
              displayBlockName = `STRENGTH (${idx + 1}/${strengthBlocks.length})`
            } else {
              displayBlockName = 'STRENGTH'
            }
          } else if (block.blockName === 'TECHNICAL WORK') {
            displayBlockName = 'TECHNICAL'
          }

          return (
            <View
              key={blockIndex}
              style={[
                styles.blockContainer,
                isBlockComplete ? styles.blockContainerComplete : styles.blockContainerDefault
              ]}
            >
              {/* Block Header */}
              <TouchableOpacity
                onPress={() => toggleBlock(block.blockName, blockIndex)}
                style={styles.blockHeader}
                activeOpacity={0.7}
              >
                <View style={styles.blockHeaderContent}>
                  <View style={styles.blockHeaderLeft}>
                    {isBlockComplete ? (
                      <Text style={styles.blockCompleteIcon}>✓</Text>
                    ) : null}
                    <View style={{ marginLeft: isBlockComplete ? 12 : 0 }}>
                      <Text style={styles.blockTitle}>
                        {displayBlockName}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.blockHeaderRight}>
                    <Text style={styles.blockProgress}>
                      {completedCount}/{totalCount} Complete
                    </Text>
                    <Text style={[styles.expandIcon, { marginLeft: 8 }]}>
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Block Content */}
              {isExpanded ? (
                <View style={styles.blockContent}>
                  {block.blockName === 'METCONS' ? (
                    <MetConCard
                      metconData={workout.metconData}
                      onComplete={(workoutScore, taskCompletions, avgHR, peakHR, notes) => {
                        logMetConCompletion(workoutScore, taskCompletions, avgHR, peakHR, notes)
                      }}
                    />
                  ) : block.blockName === 'ENGINE' ? (
                    <EngineBlockCard
                      engineData={workout.engineData}
                      engineDayNumber={workout.engineData?.dayNumber || 0}
                      programId={programId ? parseInt(programId) : undefined}
                      week={week ? parseInt(week) : undefined}
                      day={day ? parseInt(day) : undefined}
                      refreshTrigger={refresh}
                    />
                  ) : (
                    block.exercises.map((exercise, exerciseIndex) => {
                      const setMatch = exercise.notes?.match(/Set (\d+)/)
                      const setNumber = setMatch ? parseInt(setMatch[1]) : 1
                      const setSuffix = setNumber > 1 ? ` - Set ${setNumber}` : ''
                      const completionKey = `${block.blockName}:${exercise.name}${setSuffix}`

                      return (
                        <ExerciseCard
                          key={exerciseIndex}
                          exercise={exercise}
                          block={block.blockName}
                          completion={completions[completionKey]}
                          onComplete={(completion) => {
                            logCompletion(exercise.name, block.blockName, completion, setNumber)
                          }}
                        />
                      )
                    })
                  )}
                </View>
              ) : null}
            </View>
          )
        })}

        {/* Navigation */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.navButton, !canNavigatePrev() && styles.navButtonDisabled]}
            onPress={navigateToPrevDay}
            disabled={!canNavigatePrev()}
          >
            <Text style={[styles.navButtonText, !canNavigatePrev() && styles.navButtonTextDisabled]}>
              ← Prev
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonPrimary}
            onPress={() => router.push('/(tabs)/')}
          >
            <Text style={styles.navButtonTextPrimary}>Training Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, !canNavigateNext() && styles.navButtonDisabled]}
            onPress={navigateToNextDay}
            disabled={!canNavigateNext()}
          >
            <Text style={[styles.navButtonText, !canNavigateNext() && styles.navButtonTextDisabled]}>
              Next →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDFBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#EDFBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#282B34',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#EDFBFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#282B34',
    marginBottom: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonContainer: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282B34',
  },
  backButtonText: {
    color: '#EDFBFE',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  deloadLabel: {
    fontSize: 14,
    color: '#D97706',
    marginTop: 2,
  },
  testWeekLabel: {
    fontSize: 14,
    color: '#059669',
    marginTop: 2,
    fontWeight: '600',
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  blockContainer: {
    marginBottom: 24,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  blockContainerDefault: {
    borderColor: '#C4E2EA',
  },
  blockContainerComplete: {
    borderColor: '#FE5858',
    backgroundColor: '#FFF5F5',
  },
  blockHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  blockHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockCompleteIcon: {
    fontSize: 24,
    color: '#FE5858',
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  blockHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockProgress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#282B34',
  },
  expandIcon: {
    color: '#9CA3AF',
    fontSize: 18,
  },
  blockContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#C4E2EA',
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#C4E2EA',
  },
  navButtonPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FE5858',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282B34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#282B34',
    fontSize: 16,
  },
  navButtonTextPrimary: {
    color: '#EDFBFE',
    fontSize: 16,
    fontWeight: '700',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonTextDisabled: {
    color: '#9CA3AF',
  },
})
