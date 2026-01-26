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
  StatusBar
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase/client'
import { fetchWorkout } from '@/lib/api/workouts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'

interface Program {
  id: number
  user_id: number
  generated_at: string
  weeks_generated: number[]
}

interface WorkoutDay {
  programId: number
  week: number
  day: number
  dayName: string
  isDeload: boolean
  completionPercentage: number
}

export default function Dashboard() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
  const [upcomingWorkoutType, setUpcomingWorkoutType] = useState('Training Day')

  useEffect(() => {
    loadDashboard()
  }, [])

  // Reload dashboard when screen comes into focus (after logging workouts)
  useFocusEffect(
    React.useCallback(() => {
      loadDashboard()
    }, [])
  )

  const loadDashboard = async () => {
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

      // Check for NULL subscription_tier - block access if missing
      if (!userData.subscription_tier) {
        console.error('❌ User missing subscription_tier for dashboard access')
        Alert.alert(
          'Subscription Required',
          'Please subscribe to access this feature.',
          [{ text: 'View Plans', onPress: () => router.replace('/subscriptions') }]
        )
        router.replace('/subscriptions')
        return
      }

      setUserName(userData.email?.split('@')[0] || 'User')
      setSubscriptionTier(userData.subscription_tier)
      setUserId(userData.id)

      // Get user's programs
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

        // Calculate total completed blocks (training blocks at 100% completion)
        await calculateCompletedBlocks(userData.id, programs)

        // Calculate program context (name, total days, current day, month progress)
        await calculateProgramContext(program, userData.subscription_tier || 'Premium', userData.id)

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
    }
  }

  const calculateProgramContext = async (program: any, subscriptionTier: string, userId: number) => {
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

      // Calculate current day (first incomplete day, or last completed + 1)
      const supabase = createClient()
      let currentDayNum = 0
      let completedDays = 0

      for (const week of program.weeks_generated || []) {
        for (let day = 1; day <= 5; day++) {
          const data = await fetchWorkout(program.id, week, day)
          
          if (data.success && data.workout) {
            // Calculate total exercises, skip ENGINE (handled separately)
            let totalExercises = data.workout.blocks.reduce(
              (sum: number, block: any) => {
                if (block.blockName === 'ENGINE') return sum
                return sum + (block.exercises?.length || 0)
              },
              0
            )
            
            // Add 1 for ENGINE if it exists
            const hasEngineData = !!data.workout.engineData
            if (hasEngineData) {
              totalExercises += 1
            }

            if (totalExercises > 0) {
              let completedExercises = new Set(
                (data.completions || []).map((comp: any) => {
                  const setNumber = comp.set_number || 1
                  const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
                  return setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
                })
              ).size
              
              // Check if ENGINE is completed
              if (hasEngineData && data.workout.engineData?.dayNumber) {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                  const { data: userData } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_id', user.id)
                    .single()
                  
                  if (userData) {
                    const { data: engineSession } = await supabase
                      .from('workout_sessions')
                      .select('id')
                      .eq('user_id', (userData as any).id)
                      .eq('program_id', program.id)
                      .eq('program_day_number', data.workout.engineData.dayNumber)
                      .eq('completed', true)
                      .limit(1)
                      .maybeSingle()
                    
                    if (engineSession) {
                      completedExercises += 1
                    }
                  }
                }
              }

              const completionPercentage = Math.round((completedExercises / totalExercises) * 100)
              
              if (completionPercentage === 100) {
                completedDays++
              } else if (currentDayNum === 0 && completionPercentage < 100) {
                // Find first incomplete day
                currentDayNum = completedDays + 1
              }
            }
          }
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
      const monthCompletedDays = Math.max(0, Math.min(completedDays - (monthStartDay - 1), monthTotalDays))
      const monthProgressPercent = monthTotalDays > 0 
        ? Math.round((monthCompletedDays / monthTotalDays) * 100)
        : 0
      setMonthProgress(monthProgressPercent)
    } catch (error) {
      console.error('Error calculating program context:', error)
      setProgramName('Program')
      setTotalProgramDays(0)
      setCurrentDay(0)
      setMonthProgress(0)
    }
  }

  const calculateCompletedBlocks = async (userId: number, programs: Program[]) => {
    try {
      // Count individual training blocks (SKILLS, TECHNICAL, STRENGTH, ACCESSORIES, METCONS, ENGINE)
      const supabase = createClient()
      let totalCompletedBlocks = 0

      // For each program, check block completion status
      for (const program of programs) {
        const availableWeeks = program.weeks_generated || []
        
        // Fetch all completions for this program in one query
        const { data: completions } = await supabase
          .from('performance_logs')
          .select('week, day, block, exercise_name, set_number')
          .eq('user_id', userId)
          .eq('program_id', program.id)

        if (!completions) continue

        // Group completions by week, day, and block
        const completionsByBlock: Record<string, Set<string>> = {}
        completions.forEach((comp: any) => {
          const key = `${comp.week}-${comp.day}-${comp.block || 'unknown'}`
          if (!completionsByBlock[key]) {
            completionsByBlock[key] = new Set()
          }
          const setNumber = comp.set_number || 1
          const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
          const exerciseKey = setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
          completionsByBlock[key].add(exerciseKey)
        })

        // Check each day's blocks for 100% completion
        for (const week of availableWeeks) {
          for (let day = 1; day <= 5; day++) {
            const data = await fetchWorkout(program.id, week, day)
            
            if (data.success && data.workout) {
              // Check each regular block (not METCONS or ENGINE)
              for (const block of data.workout.blocks) {
                const blockNameUpper = (block.blockName || '').toUpperCase().trim()
                
                if (blockNameUpper === 'METCONS') {
                  // Check METCONS completion via program_metcons table
                  if (data.workout.metconData?.id) {
                    const { data: metconCompletion } = await supabase
                      .from('program_metcons')
                      .select('id')
                      .eq('program_id', program.id)
                      .eq('week', week)
                      .eq('day', day)
                      .eq('user_id', userId)
                      .eq('metcon_id', data.workout.metconData.id)
                      .not('completed_at', 'is', null)
                      .maybeSingle()
                    
                    if (metconCompletion) {
                      totalCompletedBlocks++
                    }
                  }
                } else if (blockNameUpper === 'ENGINE') {
                  // Check ENGINE completion via workout_sessions table
                  if (data.workout.engineData?.dayNumber) {
                    const { data: engineSession } = await supabase
                      .from('workout_sessions')
                      .select('id')
                      .eq('user_id', userId)
                      .eq('program_id', program.id)
                      .eq('program_day_number', data.workout.engineData.dayNumber)
                      .eq('completed', true)
                      .limit(1)
                      .maybeSingle()
                    
                    if (engineSession) {
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
      // Fetch workout summaries for each day using direct Supabase calls
      const workouts: WorkoutDay[] = []

      for (let day = 1; day <= 5; day++) {
        const data = await fetchWorkout(programId, week, day)

        if (data.success && data.workout) {
          // Calculate total exercises, skip ENGINE and METCONS (handled separately)
          let totalExercises = data.workout.blocks.reduce(
            (sum: number, block: any) => {
              const blockNameUpper = block.blockName?.toUpperCase() || ''
              if (blockNameUpper === 'ENGINE' || blockNameUpper === 'METCONS') return sum
              return sum + (block.exercises?.length || 0)
            },
            0
          )
          
          // Add metcon tasks count from metconData
          const metconTasksCount = data.workout.metconData?.tasks?.length || 0
          totalExercises += metconTasksCount

          // Add 1 for ENGINE if it exists
          const hasEngineData = !!data.workout.engineData
          if (hasEngineData) {
            totalExercises += 1
          }

          // Count unique completed exercises (handle set numbers)
          let completedExercises = new Set(
            (data.completions || []).map((comp: any) => {
              const setNumber = comp.set_number || 1
              const baseKey = comp.block ? `${comp.block}:${comp.exercise_name}` : comp.exercise_name
              return setNumber > 1 ? `${baseKey} - Set ${setNumber}` : baseKey
            })
          ).size
          
          // Check if ENGINE is completed
          if (hasEngineData && data.workout.engineData?.dayNumber) {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: userData } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()
              
              if (userData) {
                const { data: engineSession } = await supabase
                  .from('workout_sessions')
                  .select('id')
                  .eq('user_id', (userData as any).id)
                  .eq('program_id', programId)
                  .eq('program_day_number', data.workout.engineData.dayNumber)
                  .eq('completed', true)
                  .limit(1)
                  .maybeSingle()
                
                if (engineSession) {
                  completedExercises += 1
                }
              }
            }
          }

          const completionPercentage = totalExercises > 0
            ? Math.round((completedExercises / totalExercises) * 100)
            : 0

          workouts.push({
            programId,
            week,
            day,
            dayName: data.workout.dayName || `Day ${day}`,
            isDeload: data.workout.isDeload || false,
            completionPercentage
          })
        }
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Top Greeting Card */}
      <Card style={[styles.greetingCard, { paddingTop: insets.top + 16 }]}>
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
            <Text style={styles.greetingSubtitle}>
              You've completed{' '}
              <Text style={styles.completedCount}>{totalCompletedBlocks}</Text>
              {' '}Training Block{totalCompletedBlocks !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </Card>

      {/* Program Context */}
      {selectedProgram && totalProgramDays > 0 && (
        <View style={styles.programContext}>
          <Text style={styles.programName}>
            Program • {programName}
          </Text>
          <Text style={styles.currentDay}>
            Day {currentDay}/{totalProgramDays}
          </Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${(currentDay / totalProgramDays) * 100}%` }
              ]}
            />
          </View>
          <View style={styles.monthProgressRow}>
            <Text style={styles.monthProgressLabel}>
              Current month's progress
            </Text>
            <Text style={styles.monthProgressValue}>
              {monthProgress}%
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
            {/* Upcoming Workout Card */}
            {getTodaysWorkout() && (
              <Card style={styles.upcomingWorkoutCard}>
                <View style={styles.upcomingWorkoutHeader}>
                  <View style={styles.upcomingWorkoutIcon}>
                    <Text style={styles.upcomingWorkoutIconText}>⏱</Text>
                  </View>
                  <View style={styles.upcomingWorkoutInfo}>
                    <Text style={styles.upcomingWorkoutTitle}>
                      {upcomingWorkoutType}
                    </Text>
                    <Text style={styles.upcomingWorkoutSubtitle}>
                      {getTodaysWorkout()!.dayName}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.letsGoButton}
                  onPress={() => {
                    const today = getTodaysWorkout()!
                    router.push(
                      `/workout/${today.programId}/week/${today.week}/day/${today.day}`
                    )
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.letsGoButtonText}>
                    Let's go!
                  </Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* Week Navigation */}
            <Card style={styles.weekNavCard}>
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
                        <Text style={styles.workoutDayName}>{workout.dayName}</Text>
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

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Button
                variant="secondary"
                size="lg"
                onPress={() => {
                  const nextIncomplete = currentWeek.find(w => w.completionPercentage < 100)
                  if (nextIncomplete) {
                    router.push(
                      `/workout/${nextIncomplete.programId}/week/${nextIncomplete.week}/day/${nextIncomplete.day}`
                    )
                  }
                }}
                style={styles.continueButton}
              >
                Continue Training →
              </Button>
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
    marginBottom: 16,
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
  programContext: {
    marginBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  upcomingWorkoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FF8C42',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upcomingWorkoutIconText: {
    fontSize: 24,
  },
  upcomingWorkoutInfo: {
    flex: 1,
  },
  upcomingWorkoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  upcomingWorkoutSubtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    backgroundColor: '#C4E2EA',
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
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  weekButtonActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FE5858',
  },
  weekButtonInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  weekButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekButtonTextActive: {
    color: '#FE5858',
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
  progressBarContainer: {
    width: '100%',
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
  quickActions: {
    marginBottom: 16,
  },
  continueButton: {
    width: '100%',
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
})
