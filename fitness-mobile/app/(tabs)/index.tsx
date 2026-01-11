import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  Modal,
  TextInput
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import { fetchWorkout } from '@/lib/api/workouts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { GeneratedWorkout, UserProfile } from '@/lib/btn/types'
import { saveBTNWorkouts } from '@/lib/api/btn'
import { generateTestWorkouts } from '@/lib/btn/utils'

interface Program {
  id: number
  user_id: number
  generated_at: string
  weeks_generated: number[]
  program_data?: any
}

interface WorkoutDay {
  programId: number
  week: number
  day: number
  dayName: string
  isDeload: boolean
  isTestWeek: boolean
  completionPercentage: number
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [currentWeek, setCurrentWeek] = useState<WorkoutDay[]>([])
  const [userName, setUserName] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState('')
  const [userId, setUserId] = useState<number | null>(null)
  const [totalCompletedBlocks, setTotalCompletedBlocks] = useState(0)
  const [programName, setProgramName] = useState('')
  const [totalProgramDays, setTotalProgramDays] = useState(0)
  const [currentDay, setCurrentDay] = useState(0)
  const [monthProgress, setMonthProgress] = useState(0)
  const [totalTasksAssigned, setTotalTasksAssigned] = useState(0)
  const [totalTasksCompleted, setTotalTasksCompleted] = useState(0)
  const [upcomingWorkoutType, setUpcomingWorkoutType] = useState('Training Day')
  const isLoadingRef = React.useRef(false)

  // BTN Generator State
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [savedWorkouts, setSavedWorkouts] = useState<Set<number>>(new Set())
  const [savingWorkouts, setSavingWorkouts] = useState<Set<number>>(new Set())
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [barbellFilter, setBarbellFilter] = useState<'any' | 'required' | 'excluded'>('any')
  const [dumbbellFilter, setDumbbellFilter] = useState<'any' | 'required' | 'excluded'>('any')
  const [cardioFilter, setCardioFilter] = useState<'any' | 'rower' | 'bike' | 'ski' | 'none'>('any')
  const [exerciseCount, setExerciseCount] = useState<'any' | '2' | '3'>('any')
  const [workoutFormat, setWorkoutFormat] = useState<'any' | 'for_time' | 'amrap' | 'rounds_for_time'>('any')
  const [includeExercises, setIncludeExercises] = useState<string[]>([])
  const [excludeExercises, setExcludeExercises] = useState<string[]>([])
  const [availableExercises, setAvailableExercises] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const timeDomains = [
    '1:00 - 5:00',
    '5:00 - 10:00',
    '10:00 - 15:00',
    '15:00 - 20:00',
    '20:00+'
  ]

  useEffect(() => {
    loadDashboard()
  }, [])

  // Reload dashboard when tab comes into focus (after logging workouts)
  // OPTIMIZED: Prevent concurrent loads
  useFocusEffect(
    React.useCallback(() => {
      if (!isLoadingRef.current) {
        loadDashboard()
      }
    }, [])
  )

  const loadDashboard = async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    
    try {
      setLoading(true)
      const supabase = createClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/signin')
        return
      }

      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, subscription_tier')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        Alert.alert('Error', 'User data not found')
        return
      }

      setUserName(userData.email?.split('@')[0] || 'User')
      setSubscriptionTier(userData.subscription_tier || 'Premium')
      setUserId(userData.id)

      // Skip program loading for BTN users - they see generator instead
      if (userData.subscription_tier === 'BTN') {
        setLoading(false)
        setRefreshing(false)
        isLoadingRef.current = false
        return
      }

      // Get user's programs (only for Premium/Applied Power)
      const { data: programs, error: programsError } = await supabase
        .from('programs')
        .select('id, weeks_generated, generated_at, program_data')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })

      if (programsError) {
        console.error('Error fetching programs:', programsError)
      }

      if (programs && programs.length > 0) {
        const program = programs[0]
        setPrograms(programs)
        setSelectedProgram(program)

        // Batch fetch all completions for the program once
        const supabase = createClient()
        const { data: allCompletions } = await supabase
          .from('performance_logs')
          .select('program_id, week, day, block, exercise_name, set_number')
          .eq('user_id', userData.id)
          .in('program_id', programs.map(p => p.id))

        // Fetch user gender once (needed for workout calculations)
        const { data: userWithGender } = await supabase
          .from('users')
          .select('gender')
          .eq('id', userData.id)
          .single()

        const userGender = userWithGender?.gender || 'male'

        // Calculate total completed blocks (training blocks at 100% completion)
        await calculateCompletedBlocks(userData.id, programs, allCompletions || [])

        // Calculate program context (name, total days, current day, month progress)
        await calculateProgramContext(program, userData.subscription_tier || 'Premium', userData.id, allCompletions || [], userGender)

        // Determine which week to show (use the first week that has been generated)
        const availableWeeks = program.weeks_generated || []
        if (availableWeeks.length > 0) {
          // Show the first available week (or could be smarter about current week)
          const weekToShow = availableWeeks[0]
          setSelectedWeek(weekToShow)
          await loadWeekWorkouts(program.id, weekToShow, userData.id)
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      Alert.alert('Error', 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
      isLoadingRef.current = false
    }
  }

  const calculateProgramContext = async (program: any, subscriptionTier: string, userId: number, allCompletions: any[], userGender: string) => {
    try {
      // Determine program name based on subscription tier
      const programType = subscriptionTier === 'APPLIED_POWER' ? 'Applied Power' : 'Full Program'
      const programNameText = `${programType} (${program.weeks_generated?.length || 0}-Week)`
      setProgramName(programNameText)

      // Calculate total days from program_data
      const programData = program.program_data || {}
      const weeks = programData.weeks || []
      let totalDays = 0
      weeks.forEach((week: any) => {
        if (week.days && Array.isArray(week.days)) {
          totalDays += week.days.length
        }
      })
      setTotalProgramDays(totalDays)

      // Calculate total training blocks
      let totalBlocks = 0
      const blockBreakdown: any[] = []
      
      for (const week of program.weeks_generated || []) {
        const weekData = weeks.find((w: any) => w.week === week)
        if (!weekData) continue
        
        for (const dayData of weekData.days || []) {
          const hasMetcon = !!dayData.metconData
          const hasEngine = !!dayData.engineData
          
          // Don't count blocks that have separate data structures
          const regularBlocks = (dayData.blocks || []).filter((b: any) => {
            const blockNameUpper = (b.blockName || '').toUpperCase().trim()
            if (blockNameUpper === 'METCONS' && hasMetcon) return false
            if (blockNameUpper === 'ENGINE' && hasEngine) return false
            return true
          }).length
          
          const blockNames = (dayData.blocks || []).filter((b: any) => {
            const blockNameUpper = (b.blockName || '').toUpperCase().trim()
            if (blockNameUpper === 'METCONS' && hasMetcon) return false
            if (blockNameUpper === 'ENGINE' && hasEngine) return false
            return true
          }).map((b: any) => b.blockName).join(', ')
          
          const dayTotal = regularBlocks + (hasMetcon ? 1 : 0) + (hasEngine ? 1 : 0)
          
          totalBlocks += dayTotal
          
          blockBreakdown.push({
            week,
            day: dayData.day,
            regularBlocks,
            blockNames,
            hasMetcon,
            hasEngine,
            dayTotal
          })
        }
      }

      // Calculate current day (first incomplete day, or last completed + 1)
      const supabase = createClient()
      let currentDayNum = 0
      let completedDays = 0

      // Batch fetch all ENGINE completions once for this program
      const { data: engineSessions } = await supabase
        .from('workout_sessions')
        .select('program_day_number')
        .eq('user_id', userId)
        .eq('program_id', program.id)
        .eq('completed', true)

      const engineCompletionSet = new Set<number>()
      if (engineSessions) {
        engineSessions.forEach((es: any) => {
          if (es.program_day_number) {
            engineCompletionSet.add(es.program_day_number)
          }
        })
      }

      // Filter completions for this program
      const programCompletions = allCompletions.filter((c: any) => c.program_id === program.id)

      // Initialize task totals
      let totalTasksAssigned = 0
      let totalTasksCompleted = 0
      const dayBreakdown: any[] = []

      // Collect all unique METCON workoutIds from program_data
      const metconWorkoutIds = new Set<string>()
      for (const week of program.weeks_generated || []) {
        const weekData = weeks.find((w: any) => w.week === week)
        if (!weekData) continue
        
        for (const dayData of weekData.days || []) {
          if (dayData.metconData?.workoutId) {
            metconWorkoutIds.add(dayData.metconData.workoutId)
          }
        }
      }

      // Batch fetch METCON data with tasks from database
      const metconTasksMap = new Map<string, number>()
      if (metconWorkoutIds.size > 0) {
        const { data: metconsData } = await supabase
          .from('metcons')
          .select('workout_id, tasks')
          .in('workout_id', Array.from(metconWorkoutIds))
        
        if (metconsData) {
          metconsData.forEach((metcon: any) => {
            const taskCount = Array.isArray(metcon.tasks) ? metcon.tasks.length : 0
            metconTasksMap.set(metcon.workout_id, taskCount)
          })
        }
      }

      // First pass: Calculate task totals across ALL days (for progress bar)
      for (const week of program.weeks_generated || []) {
        const weekData = weeks.find((w: any) => w.week === week)
        if (!weekData) continue

        for (let day = 1; day <= 5; day++) {
          const dayData = weekData.days?.find((d: any) => d.day === day)
          if (!dayData) continue

          // Get completions for this day
          const dayCompletions = programCompletions.filter(
            (c: any) => c.week === week && c.day === day
          )

          // Calculate total exercises from dayData (skip ENGINE and METCONS)
          let regularBlockExercises = (dayData.blocks || []).reduce(
            (sum: number, block: any) => {
              const blockNameUpper = (block.blockName || '').toUpperCase().trim()
              if (blockNameUpper === 'ENGINE' || blockNameUpper === 'METCONS') return sum
              return sum + (block.exercises?.length || 0)
            },
            0
          )

          // Add metcon tasks count from database lookup
          const metconWorkoutId = dayData.metconData?.workoutId
          const metconTasksCount = metconWorkoutId 
            ? (metconTasksMap.get(metconWorkoutId) || 0)
            : 0

          // Add 1 for ENGINE if it exists
          const hasEngineData = !!dayData.engineData
          const engineTask = hasEngineData ? 1 : 0

          let totalExercises = regularBlockExercises + metconTasksCount + engineTask

          if (totalExercises > 0) {
            let completedExercises = new Set(
              dayCompletions.map((comp: any) => {
                const setNumber = comp.set_number || 1
                const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
                return setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
              })
            ).size
            
            // Check if ENGINE is completed (from batch query)
            if (hasEngineData && dayData.engineData?.dayNumber) {
              if (engineCompletionSet.has(dayData.engineData.dayNumber)) {
                completedExercises += 1
              }
            }

            // Accumulate task totals (for progress bar)
            totalTasksAssigned += totalExercises
            totalTasksCompleted += completedExercises

            // Log breakdown for this day
            dayBreakdown.push({
              week,
              day,
              regularBlockExercises,
              metconTasksCount,
              engineTask,
              totalExercises,
              completedExercises,
              dayTotalAssigned: totalExercises,
              dayTotalCompleted: completedExercises
            })
          }
        }
      }

      // Second pass: Find current day (first incomplete day, or last completed + 1)
      // Reset for finding current day
      currentDayNum = 0
      completedDays = 0
      for (const week of program.weeks_generated || []) {
        const weekData = weeks.find((w: any) => w.week === week)
        if (!weekData) continue

        for (let day = 1; day <= 5; day++) {
          const dayData = weekData.days?.find((d: any) => d.day === day)
          if (!dayData) continue

          // Get completions for this day
          const dayCompletions = programCompletions.filter(
            (c: any) => c.week === week && c.day === day
          )

          // Calculate total exercises from dayData (skip ENGINE and METCONS)
          let totalExercises = (dayData.blocks || []).reduce(
            (sum: number, block: any) => {
              const blockNameUpper = (block.blockName || '').toUpperCase().trim()
              if (blockNameUpper === 'ENGINE' || blockNameUpper === 'METCONS') return sum
              return sum + (block.exercises?.length || 0)
            },
            0
          )

          // Add metcon tasks count from database lookup
          const metconWorkoutId2 = dayData.metconData?.workoutId
          const metconTasksCount2 = metconWorkoutId2 
            ? (metconTasksMap.get(metconWorkoutId2) || 0)
            : 0
          totalExercises += metconTasksCount2

          // Add 1 for ENGINE if it exists
          const hasEngineData = !!dayData.engineData
          if (hasEngineData) {
            totalExercises += 1
          }

          if (totalExercises > 0) {
            let completedExercises = new Set(
              dayCompletions.map((comp: any) => {
                const setNumber = comp.set_number || 1
                const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
                return setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
              })
            ).size
            
            // Check if ENGINE is completed (from batch query)
            if (hasEngineData && dayData.engineData?.dayNumber) {
              if (engineCompletionSet.has(dayData.engineData.dayNumber)) {
                completedExercises += 1
              }
            }

            const completionPercentage = Math.round((completedExercises / totalExercises) * 100)
            
            if (completionPercentage === 100) {
              completedDays++
            } else if (currentDayNum === 0 && completionPercentage < 100) {
              // Found first incomplete day - can stop checking
              currentDayNum = completedDays + 1
              break // Exit inner loop
            }
          }
        }
        
        // If we found the current day, stop checking remaining weeks
        if (currentDayNum > 0) {
          break
        }
      }

      // If all days are complete, set current day to total days
      if (currentDayNum === 0) {
        currentDayNum = completedDays > 0 ? completedDays : 1
      }

      setCurrentDay(currentDayNum)

      // Calculate month progress (assuming 4 weeks = 1 month, ~20 days)
      const daysPerMonth = 20
      const currentMonth = Math.ceil(currentDayNum / daysPerMonth)
      const monthStartDay = (currentMonth - 1) * daysPerMonth + 1
      const monthEndDay = Math.min(currentMonth * daysPerMonth, totalDays)
      const monthTotalDays = monthEndDay - monthStartDay + 1
      // Use currentDayNum instead of completedDays to include the current day in progress
      const daysInMonth = Math.max(0, Math.min(currentDayNum - monthStartDay + 1, monthTotalDays))
      const monthProgressPercent = monthTotalDays > 0 
        ? Math.round((daysInMonth / monthTotalDays) * 100)
        : 0
      setMonthProgress(monthProgressPercent)

      // Set task totals
      setTotalTasksAssigned(totalTasksAssigned)
      setTotalTasksCompleted(totalTasksCompleted)
    } catch (error) {
      console.error('Error calculating program context:', error)
      setProgramName('Program')
      setTotalProgramDays(0)
      setCurrentDay(0)
      setMonthProgress(0)
      setTotalTasksAssigned(0)
      setTotalTasksCompleted(0)
    }
  }

  const calculateCompletedBlocks = async (userId: number, programs: Program[], allCompletions: any[]) => {
    try {
      // Count individual training blocks (SKILLS, TECHNICAL, STRENGTH, ACCESSORIES, METCONS, ENGINE)
      // OPTIMIZED: Only check the current/active program instead of all programs
      const supabase = createClient()
      let totalCompletedBlocks = 0

      // Only check the most recent/active program
      const activeProgram = programs[0] // Most recent program
      if (!activeProgram) {
        setTotalCompletedBlocks(0)
        return
      }

      const availableWeeks = activeProgram.weeks_generated || []
      const programData = activeProgram.program_data || {}
      const weeks = programData.weeks || []
      
      // Filter completions for this program
      const programCompletions = allCompletions.filter((c: any) => c.program_id === activeProgram.id)

      // Group completions by week, day, and block
      const completionsByBlock: Record<string, Set<string>> = {}
      programCompletions.forEach((comp: any) => {
        const key = `${comp.week}-${comp.day}-${comp.block || 'unknown'}`
        if (!completionsByBlock[key]) {
          completionsByBlock[key] = new Set()
        }
        const setNumber = comp.set_number || 1
        const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
        const exerciseKey = setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
        completionsByBlock[key].add(exerciseKey)
      })

      // Batch fetch all METCONS completions for this program
      const { data: metconCompletions } = await supabase
        .from('program_metcons')
        .select('program_id, week, day, metcon_id')
        .eq('program_id', activeProgram.id)
        .eq('user_id', userId)
        .not('completed_at', 'is', null)

      const metconCompletionSet = new Set<string>()
      if (metconCompletions) {
        metconCompletions.forEach((mc: any) => {
          metconCompletionSet.add(`${mc.program_id}-${mc.week}-${mc.day}-${mc.metcon_id}`)
        })
      }

      // Batch fetch all ENGINE completions for this program
      const { data: engineSessions } = await supabase
        .from('workout_sessions')
        .select('program_day_number')
        .eq('user_id', userId)
        .eq('program_id', activeProgram.id)
        .eq('completed', true)

      const engineCompletionSet = new Set<number>()
      if (engineSessions) {
        engineSessions.forEach((es: any) => {
          if (es.program_day_number) {
            engineCompletionSet.add(es.program_day_number)
          }
        })
      }

      // Check each day's blocks for 100% completion (only current program)
      // OPTIMIZED: Use program_data directly instead of calling fetchWorkout()
      for (const week of availableWeeks) {
        const weekData = weeks.find((w: any) => w.week === week)
        if (!weekData) continue

        for (let day = 1; day <= 5; day++) {
          const dayData = weekData.days?.find((d: any) => d.day === day)
          if (!dayData) continue

          // Check each regular block (not METCONS or ENGINE)
          for (const block of dayData.blocks || []) {
            const blockNameUpper = (block.blockName || '').toUpperCase().trim()
            
            if (blockNameUpper === 'METCONS') {
              // Check METCONS completion from batch query
              if (dayData.metconData?.id) {
                const metconKey = `${activeProgram.id}-${week}-${day}-${dayData.metconData.id}`
                if (metconCompletionSet.has(metconKey)) {
                  totalCompletedBlocks++
                }
              }
            } else if (blockNameUpper === 'ENGINE') {
              // Check ENGINE completion from batch query
              if (dayData.engineData?.dayNumber) {
                if (engineCompletionSet.has(dayData.engineData.dayNumber)) {
                  totalCompletedBlocks++
                }
              }
            } else {
              // Regular block - check if all exercises are completed
              const blockKey = `${week}-${day}-${block.blockName}`
              const completedInBlock = completionsByBlock[blockKey]?.size || 0
              const totalInBlock = block.exercises?.length || 0
              
              if (totalInBlock > 0 && completedInBlock >= totalInBlock) {
                totalCompletedBlocks++
              }
            }
          }
        }
      }

      setTotalCompletedBlocks(totalCompletedBlocks)
    } catch (error) {
      console.error('Error calculating completed blocks:', error)
      setTotalCompletedBlocks(0)
    }
  }

  const loadWeekWorkouts = async (programId: number, week: number, userId: number) => {
    try {
      const supabase = createClient()
      
      // Fetch program data if not available in state
      let programData: any = null
      if (selectedProgram && selectedProgram.id === programId && selectedProgram.program_data) {
        programData = selectedProgram.program_data
      } else {
        // Fetch program data from database
        const { data: program } = await supabase
          .from('programs')
          .select('program_data')
          .eq('id', programId)
          .single()
        
        if (!program || !program.program_data) {
          console.error('Program data not available')
          setCurrentWeek([])
          return
        }
        programData = program.program_data
      }

      const weeks = programData.weeks || []
      const weekData = weeks.find((w: any) => w.week === week)

      if (!weekData) {
        console.error(`Week ${week} not found in program data`)
        setCurrentWeek([])
        return
      }

      // Batch fetch all completions for the week in one query
      const { data: allCompletions } = await supabase
        .from('performance_logs')
        .select('week, day, block, exercise_name, set_number')
        .eq('program_id', programId)
        .eq('week', week)
        .eq('user_id', userId)

      // Batch fetch all ENGINE sessions for the week in one query
      // Include both sessions with program_id (new) and without program_id (old for backward compatibility)
      const { data: engineSessions } = await supabase
        .from('workout_sessions')
        .select('program_day_number, program_id')
        .eq('user_id', userId)
        .eq('completed', true)
        .or(`program_id.eq.${programId},program_id.is.null`)

      const engineCompletionSet = new Set<number>()
      if (engineSessions) {
        engineSessions.forEach((es: any) => {
          // Only include if program_id matches OR is null (old sessions for backward compatibility)
          if (es.program_day_number && (es.program_id === programId || es.program_id === null)) {
            engineCompletionSet.add(es.program_day_number)
          }
        })
      }

      // Collect all unique METCON workoutIds from the week's days
      const metconWorkoutIds = new Set<string>()
      for (const dayData of weekData.days || []) {
        if (dayData.metconData?.workoutId) {
          metconWorkoutIds.add(dayData.metconData.workoutId)
        }
      }

      // Batch fetch METCON data with tasks from database
      const metconTasksMap = new Map<string, number>()
      if (metconWorkoutIds.size > 0) {
        const { data: metconsData } = await supabase
          .from('metcons')
          .select('workout_id, tasks')
          .in('workout_id', Array.from(metconWorkoutIds))
        
        if (metconsData) {
          metconsData.forEach((metcon: any) => {
            const taskCount = Array.isArray(metcon.tasks) ? metcon.tasks.length : 0
            metconTasksMap.set(metcon.workout_id, taskCount)
          })
        }
      }

      // Process all days in parallel (using Promise.all for any async operations)
      const workouts: WorkoutDay[] = []

      for (let day = 1; day <= 5; day++) {
        const dayData = weekData.days?.find((d: any) => d.day === day)
        if (!dayData) continue

        // Calculate total exercises, skip ENGINE and METCONS (handled separately)
        let totalExercises = (dayData.blocks || []).reduce(
          (sum: number, block: any) => {
            const blockNameUpper = block.blockName?.toUpperCase() || ''
            if (blockNameUpper === 'ENGINE' || blockNameUpper === 'METCONS') return sum
            return sum + (block.exercises?.length || 0)
          },
          0
        )

        // Add metcon tasks count from database lookup
        const metconWorkoutId = dayData.metconData?.workoutId
        const metconTasksCount = metconWorkoutId 
          ? (metconTasksMap.get(metconWorkoutId) || 0)
          : 0
        totalExercises += metconTasksCount

        // Add 1 for ENGINE if it exists
        const hasEngineData = !!dayData.engineData
        if (hasEngineData) {
          totalExercises += 1
        }

        // Get completions for this day from batch query
        const dayCompletions = (allCompletions || []).filter(
          (c: any) => c.day === day
        )

        // Count unique completed exercises (handle set numbers with block prefix)
        let completedExercises = new Set(
          dayCompletions.map((comp: any) => {
            const setNumber = comp.set_number || 1
            const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
            return setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
          })
        ).size

        // Check if ENGINE is completed (from batch query)
        if (hasEngineData && dayData.engineData?.dayNumber) {
          if (engineCompletionSet.has(dayData.engineData.dayNumber)) {
            completedExercises += 1
          }
        }

        const completionPercentage = totalExercises > 0
          ? Math.round((completedExercises / totalExercises) * 100)
          : 0

        workouts.push({
          programId,
          week,
          day,
          dayName: dayData.dayName || `Day ${day}`,
          isDeload: dayData.isDeload || false,
          isTestWeek: dayData.isTestWeek || false,
          completionPercentage
        })
      }

      setCurrentWeek(workouts)
      
      // Update upcoming workout type when workouts load
      if (workouts.length > 0) {
        const firstUnstarted = workouts.find(w => w.completionPercentage === 0)
        const upcomingWorkout = firstUnstarted || workouts.find(w => w.completionPercentage < 100) || workouts[0]
        if (upcomingWorkout) {
          const workoutType = await getWorkoutType(upcomingWorkout.programId, upcomingWorkout.week, upcomingWorkout.day)
          setUpcomingWorkoutType(workoutType)
        }
      }
    } catch (error) {
      console.error('Error loading week workouts:', error)
      setCurrentWeek([])
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadDashboard()
  }

  const handleWeekChange = async (week: number) => {
    if (!selectedProgram || !userId) return
    setSelectedWeek(week)
    await loadWeekWorkouts(selectedProgram.id, week, userId)
  }

  const handleProgramChange = async (program: Program) => {
    setSelectedProgram(program)
    const availableWeeks = program.weeks_generated || []
    if (availableWeeks.length > 0) {
      const weekToShow = availableWeeks[0]
      setSelectedWeek(weekToShow)
      await loadWeekWorkouts(program.id, weekToShow, userId!)
    }
  }

  const getTodaysWorkout = () => {
    if (currentWeek.length === 0) return null
    
    // Find the first training day with nothing logged (0% completion)
    // Skip days that are 100% complete or partially complete
    const firstUnstarted = currentWeek.find(w => w.completionPercentage === 0)
    
    // If all days have some completion, return the first incomplete day as fallback
    if (!firstUnstarted) {
      const incomplete = currentWeek.find(w => w.completionPercentage < 100)
      return incomplete || currentWeek[0]
    }
    
    return firstUnstarted
  }

  const getWorkoutType = async (programId: number, week: number, day: number): Promise<string> => {
    try {
      const data = await fetchWorkout(programId, week, day)
      if (data.success && data.workout) {
        const blocks = data.workout.blocks || []
        // Check for Engine block
        if (blocks.some((b: any) => b.blockName === 'ENGINE')) {
          return 'Engine'
        }
        // Check for MetCon block
        if (blocks.some((b: any) => b.blockName === 'METCONS')) {
          return 'MetCon'
        }
      }
      return 'Training Day'
    } catch (error) {
      return 'Training Day'
    }
  }

  const getPreviousWeek = () => {
    if (!selectedProgram) return null
    const availableWeeks = selectedProgram.weeks_generated || []
    const currentIndex = availableWeeks.indexOf(selectedWeek)
    if (currentIndex > 0) {
      return availableWeeks[currentIndex - 1]
    }
    return null
  }

  const getNextWeek = () => {
    if (!selectedProgram) return null
    const availableWeeks = selectedProgram.weeks_generated || []
    const currentIndex = availableWeeks.indexOf(selectedWeek)
    if (currentIndex < availableWeeks.length - 1) {
      return availableWeeks[currentIndex + 1]
    }
    return null
  }

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.replace('/auth/signin')
          }
        }
      ]
    )
  }

  // BTN Generator Functions
  const fetchUserProfile = async () => {
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

      // Fetch user profile data
      const [equipmentRes, skillsRes, oneRmsRes, userInfoRes] = await Promise.all([
        supabase.from('user_equipment').select('equipment_name').eq('user_id', userData.id),
        supabase.from('user_skills').select('skill_name, skill_level').eq('user_id', userData.id),
        supabase.from('user_one_rms').select('exercise_name, one_rm').eq('user_id', userData.id),
        supabase.from('users').select('gender, units').eq('id', userData.id).single()
      ])

      const equipment = equipmentRes.data?.map(e => e.equipment_name) || []
      const skills: { [key: string]: string } = {}
      skillsRes.data?.forEach(s => { skills[s.skill_name] = s.skill_level })
      const oneRMs: { [key: string]: number } = {}
      oneRmsRes.data?.forEach(r => { oneRMs[r.exercise_name] = r.one_rm })

      setUserProfile({
        equipment,
        skills,
        oneRMs,
        gender: userInfoRes.data?.gender || 'Male',
        units: userInfoRes.data?.units || 'lbs'
      })
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    if (subscriptionTier === 'BTN') {
      fetchUserProfile()
      loadAvailableExercises()
    }
  }, [subscriptionTier])

  const toggleDomain = (domain: string) => {
    // AMRAP requires 6+ min, so 1-5 min domain is incompatible
    if (workoutFormat === 'amrap' && domain === '1:00 - 5:00') return

    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    )
  }

  const handleFormatChange = (format: 'any' | 'for_time' | 'amrap' | 'rounds_for_time') => {
    setWorkoutFormat(format)
    if (format === 'amrap') {
      setSelectedDomains(prev => prev.filter(d => d !== '1:00 - 5:00'))
    }
  }

  const handleBarbellChange = (value: 'any' | 'required' | 'excluded') => {
    setBarbellFilter(value)
    // Barbell + Dumbbell can't both be required
    if (value === 'required' && dumbbellFilter === 'required') {
      setDumbbellFilter('any')
    }
  }

  const handleDumbbellChange = (value: 'any' | 'required' | 'excluded') => {
    setDumbbellFilter(value)
    // Barbell + Dumbbell can't both be required
    if (value === 'required' && barbellFilter === 'required') {
      setBarbellFilter('any')
    }
  }

  const loadAvailableExercises = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/btn/exercises`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableExercises(data.exercises || [])
      }
    } catch (error) {
      console.error('Error loading exercises:', error)
    }
  }

  const generateWorkouts = async () => {
    setIsGenerating(true)
    try {
      // Build requiredEquipment and excludeEquipment arrays
      const requiredEquipment: string[] = []
      const excludeEquipment: string[] = []

      if (barbellFilter === 'required') {
        requiredEquipment.push('Barbell')
      } else if (barbellFilter === 'excluded') {
        excludeEquipment.push('Barbell')
      }

      if (dumbbellFilter === 'required') {
        requiredEquipment.push('Dumbbells')
      } else if (dumbbellFilter === 'excluded') {
        excludeEquipment.push('Dumbbells')
      }

      // Convert exercise count to number
      const exerciseCountNum = exerciseCount === 'any' ? undefined : parseInt(exerciseCount)

      // Convert workout format to internal format string
      const formatFilter = workoutFormat === 'any' ? undefined :
        workoutFormat === 'for_time' ? 'For Time' :
        workoutFormat === 'amrap' ? 'AMRAP' : 'Rounds For Time'

      // Convert cardio filter
      const cardioOption = cardioFilter === 'any' ? undefined : cardioFilter

      // Generate workouts using local utility function
      const workouts = generateTestWorkouts(
        selectedDomains.length > 0 ? selectedDomains : undefined,
        userProfile || undefined,
        requiredEquipment.length > 0 ? requiredEquipment : undefined,
        excludeEquipment.length > 0 ? excludeEquipment : undefined,
        exerciseCountNum,
        formatFilter,
        cardioOption,
        includeExercises.length > 0 ? includeExercises : undefined,
        excludeExercises.length > 0 ? excludeExercises : undefined
      )

      setGeneratedWorkouts(workouts)
      setSavedWorkouts(new Set())

      if (workouts.length === 0) {
        Alert.alert('No Workouts', 'Could not generate workouts with the selected filters. Try adjusting your selections.')
      }
    } catch (error: any) {
      console.error('Generation failed:', error)
      Alert.alert('Error', error.message || 'Failed to generate workouts. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const saveWorkout = async (workout: GeneratedWorkout, index: number) => {
    setSavingWorkouts(prev => new Set(prev).add(index))
    
    try {
      const result = await saveBTNWorkouts([workout])
      if (result.success) {
        setSavedWorkouts(prev => new Set(prev).add(index))
        Alert.alert('Success', 'Workout saved!')
      } else {
        throw new Error('Failed to save workout')
      }
    } catch (error: any) {
      console.error('Save failed:', error)
      Alert.alert('Error', error.message || 'Failed to save workout')
    } finally {
      setSavingWorkouts(prev => {
        const newSet = new Set(prev)
        newSet.delete(index)
        return newSet
      })
    }
  }

  const discardWorkout = (index: number) => {
    setGeneratedWorkouts(prev => prev.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  // BTN users see generator in Training tab
  if (subscriptionTier === 'BTN') {
    return <BTNWorkoutGeneratorView
      userName={userName}
      generatedWorkouts={generatedWorkouts}
      isGenerating={isGenerating}
      savedWorkouts={savedWorkouts}
      savingWorkouts={savingWorkouts}
      selectedDomains={selectedDomains}
      barbellFilter={barbellFilter}
      dumbbellFilter={dumbbellFilter}
      cardioFilter={cardioFilter}
      exerciseCount={exerciseCount}
      workoutFormat={workoutFormat}
      includeExercises={includeExercises}
      excludeExercises={excludeExercises}
      availableExercises={availableExercises}
      timeDomains={timeDomains}
      toggleDomain={toggleDomain}
      handleBarbellChange={handleBarbellChange}
      handleDumbbellChange={handleDumbbellChange}
      setCardioFilter={setCardioFilter}
      setExerciseCount={setExerciseCount}
      handleFormatChange={handleFormatChange}
      setIncludeExercises={setIncludeExercises}
      setExcludeExercises={setExcludeExercises}
      generateWorkouts={generateWorkouts}
      saveWorkout={saveWorkout}
      discardWorkout={discardWorkout}
      router={router}
    />
  }

  return (
    <View style={styles.container}>
      {/* Top Greeting Card */}
      <Card style={styles.greetingCard}>
        <View style={styles.greetingContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.greetingText}>
            <Text style={styles.greetingTitle}>
              Hello, {userName}!
            </Text>
            {selectedProgram && programName && (
              <Text style={styles.programNameInCard}>
                Program • {programName}
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* Program Context */}
      {selectedProgram && totalProgramDays > 0 && (
        <View style={styles.programContext}>
          <View style={styles.progressBarWrapper}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { 
                    width: totalTasksAssigned > 0 
                      ? `${Math.min((totalTasksCompleted / totalTasksAssigned) * 100, 100)}%` 
                      : '0%' 
                  }
                ]}
              />
            </View>
            <Text style={styles.progressPercentage}>
              {totalTasksAssigned > 0 
                ? `${Math.round((totalTasksCompleted / totalTasksAssigned) * 100)}%`
                : '0%'}
            </Text>
          </View>
        </View>
      )}

      {/* View Full Plan Schedule Button */}
      {selectedProgram && (
        <TouchableOpacity
          style={styles.viewScheduleButton}
          onPress={() => router.push('/program')}
          activeOpacity={0.7}
        >
          <Text style={styles.viewScheduleIcon}>📅</Text>
          <Text style={styles.viewScheduleText}>
            View full plan schedule
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {currentWeek.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No Workouts Found
            </Text>
            <Text style={styles.emptyText}>
              Please generate your program on the web app
            </Text>
          </Card>
        ) : (
          <>
            {/* Week Navigation */}
            <Card style={styles.weekNavCard}>
              {currentWeek[0]?.isTestWeek && (
                <View style={styles.weekNavHeader}>
                  <Text style={styles.testWeekText}>Test Week</Text>
                </View>
              )}
              {currentWeek[0]?.isDeload && (
                <View style={styles.weekNavHeader}>
                  <Text style={styles.deloadText}>Deload Week</Text>
                </View>
              )}

              {/* Week Selector */}
              {selectedProgram && selectedProgram.weeks_generated && selectedProgram.weeks_generated.length > 1 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.weekSelectorContent}
                >
                  <View style={styles.weekSelector}>
                    {selectedProgram.weeks_generated.map((week) => (
                      <TouchableOpacity
                        key={week}
                        onPress={() => handleWeekChange(week)}
                        style={[
                          styles.weekButton,
                          week === selectedWeek ? styles.weekButtonActive : styles.weekButtonInactive
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.weekButtonText,
                          week === selectedWeek ? styles.weekButtonTextActive : styles.weekButtonTextInactive
                        ]}>
                          Week {week}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            </Card>

            {/* Workout Days */}
            <View style={styles.workoutDays}>
              {currentWeek.map((workout) => (
                <TouchableOpacity
                  key={workout.day}
                  onPress={() =>
                    router.push(
                      `/workout/${workout.programId}/week/${workout.week}/day/${workout.day}`
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Card style={styles.workoutCard}>
                    <View style={styles.workoutCardHeader}>
                      <View style={styles.workoutCardLeft}>
                        <Text style={styles.workoutDayTitle}>
                          Day {workout.day}
                        </Text>
                      </View>
                      <View>
                        {workout.completionPercentage === 100 ? (
                          <View style={styles.statusBadgeComplete}>
                            <Text style={styles.statusBadgeTextComplete}>
                              ✓ Complete
                            </Text>
                          </View>
                        ) : workout.completionPercentage > 0 ? (
                          <View style={styles.statusBadgeProgress}>
                            <Text style={styles.statusBadgeTextProgress}>
                              {workout.completionPercentage}%
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.statusBadgeNotStarted}>
                            <Text style={styles.statusBadgeTextNotStarted}>
                              Pending
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          { width: `${workout.completionPercentage}%` }
                        ]}
                      />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>

            {/* Program Selection (if multiple programs) */}
            {programs.length > 1 && (
              <Card style={styles.programSelectCard}>
                <Text style={styles.programSelectTitle}>
                  Switch Program
                </Text>
                <View style={styles.programList}>
                  {programs.map((program) => (
                    <TouchableOpacity
                      key={program.id}
                      onPress={() => handleProgramChange(program)}
                      activeOpacity={0.7}
                      style={[
                        styles.programItem,
                        selectedProgram?.id === program.id ? styles.programItemActive : styles.programItemInactive
                      ]}
                    >
                      <Text style={[
                        styles.programItemTitle,
                        selectedProgram?.id === program.id ? styles.programItemTitleActive : styles.programItemTitleInactive
                      ]}>
                        Program from {new Date(program.generated_at).toLocaleDateString()}
                      </Text>
                      <Text style={[
                        styles.programItemSubtext,
                        selectedProgram?.id === program.id ? styles.programItemSubtextActive : styles.programItemSubtextInactive
                      ]}>
                        {program.weeks_generated?.length || 0} weeks
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#282B34',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerContent: {
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  subscriptionText: {
    fontSize: 14,
    color: '#4B5563',
  },
  navScrollContent: {
    paddingRight: 16,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  greetingCard: {
    marginTop: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 20,
  },
  greetingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FE5858',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greetingText: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: 16,
    color: '#282B34',
  },
  completedCount: {
    color: '#FE5858',
    fontWeight: '700',
  },
  programNameInCard: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  programContext: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  programName: {
    fontSize: 14,
    color: '#282B34',
    marginBottom: 8,
  },
  currentDay: {
    fontSize: 32,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 12,
  },
  monthProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  monthProgressLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  monthProgressValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  viewScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  viewScheduleIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  viewScheduleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FE5858',
  },
  upcomingWorkoutCard: {
    marginBottom: 16,
    padding: 20,
  },
  upcomingWorkoutHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  upcomingWorkoutSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
  },
  letsGoButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letsGoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#282B34',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    color: '#4B5563',
    textAlign: 'center',
    fontSize: 16,
  },
  programCard: {
    marginBottom: 16,
    padding: 16,
  },
  programLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  programTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  programSubtext: {
    fontSize: 14,
    color: '#4B5563',
  },
  todaysWorkout: {
    backgroundColor: '#FE5858',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  todaysWorkoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todaysWorkoutLeft: {
    flex: 1,
  },
  todaysWorkoutTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  todaysWorkoutSubtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.95,
  },
  todaysWorkoutDayName: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.85,
    marginTop: 4,
  },
  todaysWorkoutIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 999,
    padding: 8,
  },
  todaysWorkoutIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  weekNavCard: {
    marginBottom: 16,
    padding: 16,
  },
  weekNavHeader: {
    marginBottom: 16,
  },
  weekTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  deloadText: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  testWeekText: {
    fontSize: 14,
    color: '#059669',
    marginTop: 4,
    fontWeight: '600',
  },
  weekNavButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DAE2EA',
  },
  navButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: '#9CA3AF',
  },
  weekSelectorContent: {
    paddingRight: 8,
  },
  weekSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  weekButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  weekButtonActive: {
    backgroundColor: '#FE5858',
  },
  weekButtonInactive: {
    backgroundColor: '#F3F4F6',
  },
  weekButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekButtonTextActive: {
    color: '#FFFFFF',
  },
  weekButtonTextInactive: {
    color: '#282B34',
  },
  workoutDays: {
    marginBottom: 16,
    gap: 12,
  },
  workoutCard: {
    padding: 20,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  workoutCardLeft: {
    flex: 1,
  },
  workoutDayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  workoutDayName: {
    fontSize: 14,
    color: '#4B5563',
  },
  statusBadgeComplete: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeTextComplete: {
    color: '#065F46',
    fontWeight: '600',
    fontSize: 12,
  },
  statusBadgeProgress: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeTextProgress: {
    color: '#92400E',
    fontWeight: '600',
    fontSize: 12,
  },
  statusBadgeNotStarted: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeTextNotStarted: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 12,
  },
  progressBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FE5858',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    minWidth: 45,
    textAlign: 'right',
  },
  programSelectCard: {
    padding: 16,
  },
  programSelectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 16,
  },
  programList: {
    gap: 8,
  },
  programItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  programItemActive: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  programItemInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  programItemTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  programItemTitleActive: {
    color: '#FFFFFF',
  },
  programItemTitleInactive: {
    color: '#282B34',
  },
  programItemSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  programItemSubtextActive: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  programItemSubtextInactive: {
    color: '#4B5563',
  },
  // BTN Generator Styles
  generatorCard: {
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 12,
  },
  domainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  domainButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  domainButtonSelected: {
    borderColor: '#FE5858',
    backgroundColor: '#FEE2E2',
  },
  domainButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  domainButtonTextSelected: {
    color: '#FE5858',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonSelected: {
    borderColor: '#FE5858',
    backgroundColor: '#FEE2E2',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterButtonTextSelected: {
    color: '#FE5858',
  },
  generateButton: {
    marginTop: 8,
  },
  workoutsSection: {
    marginBottom: 16,
  },
  workoutsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 16,
  },
  btnWorkoutCard: {
    padding: 16,
    marginBottom: 12,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    flex: 1,
  },
  workoutBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  exercisesContainer: {
    marginBottom: 8,
  },
  exerciseText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  workoutMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  savedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#D1FAE5',
  },
  savedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  linkCard: {
    padding: 16,
    marginBottom: 32,
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FE5858',
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  // Additional BTN Generator styles
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  filterButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonTextSmall: {
    fontSize: 13,
  },
  domainButtonDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  domainButtonTextDisabled: {
    color: '#9CA3AF',
  },
  exerciseSection: {
    marginTop: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FE5858',
    borderRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  excludeChip: {
    backgroundColor: '#FEF3C7',
  },
  exerciseChipText: {
    fontSize: 14,
    color: '#374151',
  },
  exerciseChipRemove: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  generateContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  workoutDomain: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  workoutContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  workoutFormat: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseWeight: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  benchmarkText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
  },
  modalClose: {
    fontSize: 28,
    color: '#6B7280',
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  exerciseList: {
    maxHeight: 300,
  },
  exerciseOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  exerciseOptionText: {
    fontSize: 16,
    color: '#282B34',
  },
  noResults: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
    paddingVertical: 24,
  },
})

// BTN Workout Generator Component
function BTNWorkoutGeneratorView({
  userName,
  generatedWorkouts,
  isGenerating,
  savedWorkouts,
  savingWorkouts,
  selectedDomains,
  barbellFilter,
  dumbbellFilter,
  cardioFilter,
  exerciseCount,
  workoutFormat,
  includeExercises,
  excludeExercises,
  availableExercises,
  timeDomains,
  toggleDomain,
  handleBarbellChange,
  handleDumbbellChange,
  setCardioFilter,
  setExerciseCount,
  handleFormatChange,
  setIncludeExercises,
  setExcludeExercises,
  generateWorkouts,
  saveWorkout,
  discardWorkout,
  router
}: {
  userName: string
  generatedWorkouts: GeneratedWorkout[]
  isGenerating: boolean
  savedWorkouts: Set<number>
  savingWorkouts: Set<number>
  selectedDomains: string[]
  barbellFilter: 'any' | 'required' | 'excluded'
  dumbbellFilter: 'any' | 'required' | 'excluded'
  cardioFilter: 'any' | 'rower' | 'bike' | 'ski' | 'none'
  exerciseCount: 'any' | '2' | '3'
  workoutFormat: 'any' | 'for_time' | 'amrap' | 'rounds_for_time'
  includeExercises: string[]
  excludeExercises: string[]
  availableExercises: string[]
  timeDomains: string[]
  toggleDomain: (domain: string) => void
  handleBarbellChange: (value: 'any' | 'required' | 'excluded') => void
  handleDumbbellChange: (value: 'any' | 'required' | 'excluded') => void
  setCardioFilter: (value: 'any' | 'rower' | 'bike' | 'ski' | 'none') => void
  setExerciseCount: (value: 'any' | '2' | '3') => void
  handleFormatChange: (value: 'any' | 'for_time' | 'amrap' | 'rounds_for_time') => void
  setIncludeExercises: (exercises: string[]) => void
  setExcludeExercises: (exercises: string[]) => void
  generateWorkouts: () => Promise<void>
  saveWorkout: (workout: GeneratedWorkout, index: number) => Promise<void>
  discardWorkout: (index: number) => void
  router: any
}) {
  const [showIncludePicker, setShowIncludePicker] = useState(false)
  const [showExcludePicker, setShowExcludePicker] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')

  const isTimeDomainDisabled = (domain: string) => {
    return workoutFormat === 'amrap' && domain === '1:00 - 5:00'
  }

  const filteredExercises = availableExercises.filter(e =>
    e.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
    !includeExercises.includes(e) &&
    !excludeExercises.includes(e)
  )

  const formatWorkoutDisplay = (workout: GeneratedWorkout) => {
    if (workout.format === 'AMRAP' && workout.amrapTime) {
      return `${workout.amrapTime} min AMRAP`
    }
    if (workout.format === 'Rounds For Time' && workout.rounds) {
      return `${workout.rounds} Rounds For Time`
    }
    if (workout.format === 'For Time' && workout.pattern) {
      return `For Time: ${workout.pattern}`
    }
    return workout.format
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <Card style={styles.greetingCard}>
        <View style={styles.greetingContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.greetingText}>
            <Text style={styles.greetingTitle}>Hello, {userName}!</Text>
            <Text style={styles.programNameInCard}>BTN Workout Generator</Text>
          </View>
        </View>
      </Card>

      {/* Time Domain Filter */}
      <Card style={styles.generatorCard}>
        <Text style={styles.sectionTitle}>Time Domain</Text>
        <Text style={styles.helperText}>Select one or more (empty = all)</Text>
        <View style={styles.domainRow}>
          {timeDomains.map((domain) => (
            <TouchableOpacity
              key={domain}
              onPress={() => toggleDomain(domain)}
              disabled={isTimeDomainDisabled(domain)}
              style={[
                styles.domainButton,
                selectedDomains.includes(domain) && styles.domainButtonSelected,
                isTimeDomainDisabled(domain) && styles.domainButtonDisabled
              ]}
            >
              <Text style={[
                styles.domainButtonText,
                selectedDomains.includes(domain) && styles.domainButtonTextSelected,
                isTimeDomainDisabled(domain) && styles.domainButtonTextDisabled
              ]}>
                {domain}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Equipment Filters */}
      <Card style={styles.generatorCard}>
        <Text style={styles.sectionTitle}>Equipment</Text>

        {/* Barbell */}
        <Text style={styles.filterLabel}>Barbell</Text>
        <View style={styles.filterRow}>
          {(['any', 'required', 'excluded'] as const).map(option => (
            <TouchableOpacity
              key={option}
              onPress={() => handleBarbellChange(option)}
              style={[styles.filterButton, barbellFilter === option && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterButtonText, barbellFilter === option && styles.filterButtonTextSelected]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dumbbell */}
        <Text style={styles.filterLabel}>Dumbbell</Text>
        <View style={styles.filterRow}>
          {(['any', 'required', 'excluded'] as const).map(option => (
            <TouchableOpacity
              key={option}
              onPress={() => handleDumbbellChange(option)}
              style={[styles.filterButton, dumbbellFilter === option && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterButtonText, dumbbellFilter === option && styles.filterButtonTextSelected]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cardio */}
        <Text style={styles.filterLabel}>Cardio</Text>
        <View style={styles.filterRow}>
          {(['any', 'rower', 'bike', 'ski', 'none'] as const).map(option => (
            <TouchableOpacity
              key={option}
              onPress={() => setCardioFilter(option)}
              style={[styles.filterButton, styles.filterButtonSmall, cardioFilter === option && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterButtonText, styles.filterButtonTextSmall, cardioFilter === option && styles.filterButtonTextSelected]}>
                {option === 'none' ? 'None' : option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Format & Count */}
      <Card style={styles.generatorCard}>
        <Text style={styles.sectionTitle}>Workout Structure</Text>

        {/* Format */}
        <Text style={styles.filterLabel}>Format</Text>
        <View style={styles.filterRow}>
          {[
            { value: 'any', label: 'Any' },
            { value: 'for_time', label: 'For Time' },
            { value: 'amrap', label: 'AMRAP' },
            { value: 'rounds_for_time', label: 'RFT' },
          ].map(option => (
            <TouchableOpacity
              key={option.value}
              onPress={() => handleFormatChange(option.value as any)}
              style={[styles.filterButton, workoutFormat === option.value && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterButtonText, workoutFormat === option.value && styles.filterButtonTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Exercise Count */}
        <Text style={styles.filterLabel}>Exercises</Text>
        <View style={styles.filterRow}>
          {[
            { value: 'any', label: 'Any' },
            { value: '2', label: 'Couplet (2)' },
            { value: '3', label: 'Triplet (3)' },
          ].map(option => (
            <TouchableOpacity
              key={option.value}
              onPress={() => setExerciseCount(option.value as any)}
              style={[styles.filterButton, exerciseCount === option.value && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterButtonText, exerciseCount === option.value && styles.filterButtonTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Include/Exclude */}
      <Card style={styles.generatorCard}>
        <Text style={styles.sectionTitle}>Custom Exercises</Text>
        <Text style={styles.helperText}>Custom selections override equipment filters</Text>

        {/* Must Include */}
        <View style={styles.exerciseSection}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.filterLabel}>Must Include</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowIncludePicker(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {includeExercises.length > 0 && (
            <View style={styles.chipContainer}>
              {includeExercises.map(exercise => (
                <TouchableOpacity
                  key={exercise}
                  style={styles.exerciseChip}
                  onPress={() => setIncludeExercises(includeExercises.filter(e => e !== exercise))}
                >
                  <Text style={styles.exerciseChipText}>{exercise}</Text>
                  <Text style={styles.exerciseChipRemove}>×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Must Exclude */}
        <View style={styles.exerciseSection}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.filterLabel}>Must Exclude</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowExcludePicker(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {excludeExercises.length > 0 && (
            <View style={styles.chipContainer}>
              {excludeExercises.map(exercise => (
                <TouchableOpacity
                  key={exercise}
                  style={[styles.exerciseChip, styles.excludeChip]}
                  onPress={() => setExcludeExercises(excludeExercises.filter(e => e !== exercise))}
                >
                  <Text style={styles.exerciseChipText}>{exercise}</Text>
                  <Text style={styles.exerciseChipRemove}>×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Card>

      {/* Generate Button */}
      <View style={styles.generateContainer}>
        <Button
          variant="primary"
          size="lg"
          onPress={generateWorkouts}
          disabled={isGenerating}
          style={styles.generateButton}
        >
          {isGenerating ? 'Generating...' : 'Generate 5 Workouts'}
        </Button>
      </View>

      {/* Generated Workouts */}
      {generatedWorkouts.length > 0 && (
        <View style={styles.workoutsSection}>
          <Text style={styles.workoutsTitle}>
            Generated Workouts ({generatedWorkouts.length})
          </Text>
          {generatedWorkouts.map((workout, index) => (
            <Card key={index} style={styles.btnWorkoutCard}>
              <View style={styles.workoutHeader}>
                <View>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  <Text style={styles.workoutDomain}>{workout.timeDomain}</Text>
                </View>
                <View style={styles.workoutActions}>
                  {savedWorkouts.has(index) ? (
                    <View style={styles.savedBadge}>
                      <Text style={styles.savedText}>✓ Saved</Text>
                    </View>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => saveWorkout(workout, index)}
                        disabled={savingWorkouts.has(index)}
                      >
                        {savingWorkouts.has(index) ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => discardWorkout(index)}
                      >
                        ×
                      </Button>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.workoutContent}>
                <Text style={styles.workoutFormat}>{formatWorkoutDisplay(workout)}</Text>
                {workout.exercises.map((exercise, exIndex) => (
                  <View key={exIndex} style={styles.exerciseRow}>
                    <Text style={styles.exerciseText}>
                      {workout.format === 'For Time' && workout.pattern
                        ? exercise.name
                        : `${exercise.reps} ${exercise.name}`}
                    </Text>
                    {exercise.weight && (
                      <Text style={styles.exerciseWeight}>{exercise.weight}#</Text>
                    )}
                  </View>
                ))}
              </View>

              {workout.medianScore && workout.excellentScore && (
                <Text style={styles.benchmarkText}>
                  50th: {workout.medianScore} | 90th: {workout.excellentScore}
                </Text>
              )}
            </Card>
          ))}
        </View>
      )}

      {/* Link to Workouts */}
      <Card style={styles.linkCard}>
        <TouchableOpacity
          onPress={() => router.push('/btn/workouts')}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonText}>View My Workouts →</Text>
        </TouchableOpacity>
      </Card>

      {/* Exercise Picker Modal */}
      <Modal
        visible={showIncludePicker || showExcludePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowIncludePicker(false)
          setShowExcludePicker(false)
          setExerciseSearch('')
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showIncludePicker ? 'Add Exercise to Include' : 'Add Exercise to Exclude'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowIncludePicker(false)
                  setShowExcludePicker(false)
                  setExerciseSearch('')
                }}
              >
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              autoFocus
            />

            <ScrollView style={styles.exerciseList}>
              {filteredExercises.map(exercise => (
                <TouchableOpacity
                  key={exercise}
                  style={styles.exerciseOption}
                  onPress={() => {
                    if (showIncludePicker) {
                      setIncludeExercises([...includeExercises, exercise])
                    } else {
                      setExcludeExercises([...excludeExercises, exercise])
                    }
                    setShowIncludePicker(false)
                    setShowExcludePicker(false)
                    setExerciseSearch('')
                  }}
                >
                  <Text style={styles.exerciseOptionText}>{exercise}</Text>
                </TouchableOpacity>
              ))}
              {filteredExercises.length === 0 && (
                <Text style={styles.noResults}>No exercises found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}
