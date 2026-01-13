import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, StatusBar, Dimensions, RefreshControl, KeyboardAvoidingView, Platform, Keyboard } from 'react-native'
import Slider from '@react-native-community/slider'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase/client'
import Svg, { Circle, Text as SvgText, G } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import engineDatabaseService from '@/lib/engine/databaseService'
import { fetchWorkout } from '@/lib/api/workouts'
import Dashboard from '@/components/engine/Dashboard'
import { Card } from '@/components/ui/Card'
import WorkoutProgressCard from '@/components/engine/WorkoutProgressCard'

interface Interval {
  id: number
  type: string
  duration: number
  restDuration?: number
  targetPace: any
  description?: string
  blockNumber?: number | null
  roundNumber?: number | null
  paceRange?: any
  paceProgression?: string | null
  workProgression?: string
  isMaxEffort?: boolean
  completed?: boolean
  workCompleted?: boolean
  actualOutput?: number
  fluxDuration?: number
  baseDuration?: number
  fluxStartIntensity?: number
  fluxIncrement?: number
  fluxIntensity?: number | null
  burstTiming?: string
  burstDuration?: number
  burstIntensity?: string
  basePace?: any
}


interface SessionData {
  intervals: Interval[]
  totalOutput: number
  averagePace: number
  averageHeartRate: number | null
  peakHeartRate: number | null
  perceivedExertion: number | null
  rolling_avg_ratio?: number | null
  learned_max_pace?: number | null
}

interface FluxPeriod {
  index: number
  type: 'base' | 'flux'
  duration: number
  startTime: number
  intensity: number
}

interface BurstStatus {
  inBurst: boolean
  timeRemaining: number
  nextBurstIn: number
}

interface PerformanceMetrics {
  rolling_avg_ratio?: number | null
  learned_max_pace?: number | null
}

type EngineView = 'dashboard' | 'workout'

export default function EnginePage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { day, programId, week, programDay, view } = useLocalSearchParams<{
    day?: string
    programId?: string
    week?: string
    programDay?: string
    view?: string
  }>()

  const [currentView, setCurrentView] = useState<EngineView>('dashboard')
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [programVersion, setProgramVersion] = useState<string>('5-day')
  const [currentProgramId, setCurrentProgramId] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  
  // Handle URL view parameter
  useEffect(() => {
    if (view === 'workout') {
      setCurrentView('workout')
      if (day) {
        const dayNumber = parseInt(day, 10)
        if (!isNaN(dayNumber) && dayNumber > 0) {
          setSelectedDay(dayNumber)
        }
      }
    } else {
      setCurrentView('dashboard')
    }
  }, [view, day])

  // Dashboard handlers
  const handleDayClick = (dayNumber: number, dayType?: string) => {
    setSelectedDay(dayNumber)
    setCurrentView('workout')
    // Load workout will be triggered by useEffect watching selectedDay
  }

  const handleAnalyticsClick = () => {
    router.push('/engine/analytics')
  }

  const handleBackToDashboard = () => {
    // If we have program context, navigate back to the main program workout page
    if (programId && week && programDay) {
      const refreshParam = Date.now() // Timestamp to force refresh
      router.push(`/workout/${programId}/week/${week}/day/${programDay}?refresh=${refreshParam}`)
      return
    }

    setSelectedDay(null)
    setCurrentView('dashboard')
    setWorkout(null)
    // Reset form state when navigating back
    setTotalOutput('')
    setAverageHeartRate('')
    setPeakHeartRate('')
    setRpeValue(5)
    setIsCompleted(false)
    setSaveSuccess(false)
    setIntervalScores({})
    setCurrentIntervalScore('')
    // Reset saved values
    setSavedTotalOutput('')
    setSavedAverageHeartRate('')
    setSavedPeakHeartRate('')
    setSavedRpeValue(5)
  }
  
  // Dashboard data
  const [user, setUser] = useState<any>(null)
  const [workouts, setWorkouts] = useState<any[]>([])
  const [completedSessions, setCompletedSessions] = useState<any[]>([])
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  
  // Week-focused view state
  const [currentMonth, setCurrentMonth] = useState<number>(1)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [currentWeekWorkouts, setCurrentWeekWorkouts] = useState<any[]>([])
  const [showMonthView, setShowMonthView] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [userName, setUserName] = useState<string>('')
  
  // View state (equipment -> preview -> active)
  const [workoutView, setWorkoutView] = useState<'equipment' | 'preview' | 'active'>('equipment')
  
  // Modality selection
  const [selectedModality, setSelectedModality] = useState<string>('')
  const [expandedCategory, setExpandedCategory] = useState<string>('')
  
  // Database connection
  const [connected, setConnected] = useState(false)
  
  // Baselines
  const [baselines, setBaselines] = useState<Record<string, { baseline: number; units: string; date?: string }>>({})
  
  // Baseline matching check
  const [hasMatchingBaseline, setHasMatchingBaseline] = useState(false)
  
  // Workout history
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([])
  
  // Performance metrics
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)
  
  // Loading states
  const [loadingBaseline, setLoadingBaseline] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  
  // Collapsible sections
  const [expandedBreakdown, setExpandedBreakdown] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState(false)
  const [expandedSummary, setExpandedSummary] = useState(false)
  
  // Time trial specific state
  const [timeTrialScore, setTimeTrialScore] = useState('')
  const [timeTrialUnits, setTimeTrialUnits] = useState('')
  const [timeTrialSelectedUnit, setTimeTrialSelectedUnit] = useState('')
  const [timeTrialAverageHeartRate, setTimeTrialAverageHeartRate] = useState('')
  const [timeTrialPeakHeartRate, setTimeTrialPeakHeartRate] = useState('')
  const [timeTrialRpeValue, setTimeTrialRpeValue] = useState(5)
  const [timeTrialIsSubmitting, setTimeTrialIsSubmitting] = useState(false)
  const [timeTrialSaveSuccess, setTimeTrialSaveSuccess] = useState(false)
  
  // Workout execution
  const [isActive, setIsActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [currentInterval, setCurrentInterval] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [currentPhase, setCurrentPhase] = useState<'work' | 'rest'>('work')
  const [sessionData, setSessionData] = useState<SessionData>({
    intervals: [],
    totalOutput: 0,
    averagePace: 0,
    averageHeartRate: null,
    peakHeartRate: null,
    perceivedExertion: null
  })
  
  // Interval scoring
  const [intervalScores, setIntervalScores] = useState<Record<number, string>>({})
  const [currentIntervalScore, setCurrentIntervalScore] = useState('')
  
  // Completion form
  const [totalOutput, setTotalOutput] = useState('')
  const [averageHeartRate, setAverageHeartRate] = useState('')
  const [peakHeartRate, setPeakHeartRate] = useState('')
  const [rpeValue, setRpeValue] = useState(5)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  // Saved values for review card display
  const [savedTotalOutput, setSavedTotalOutput] = useState('')
  const [savedAverageHeartRate, setSavedAverageHeartRate] = useState('')
  const [savedPeakHeartRate, setSavedPeakHeartRate] = useState('')
  const [savedRpeValue, setSavedRpeValue] = useState(5)
  
  // Persistent workout saved state
  const [isWorkoutSaved, setIsWorkoutSaved] = useState(false)
  const [lastCompletionTime, setLastCompletionTime] = useState<string | null>(null)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentPhaseRef = useRef<'work' | 'rest'>('work')
  const currentIntervalRef = useRef<number>(0)

  const modalities = [
    { value: 'c2_row_erg', label: 'C2 Rowing Erg', category: 'Rowing' },
    { value: 'rogue_row_erg', label: 'Rogue Rowing Erg', category: 'Rowing' },
    { value: 'c2_bike_erg', label: 'C2 Bike Erg', category: 'Cycling' },
    { value: 'echo_bike', label: 'Echo Bike', category: 'Cycling' },
    { value: 'assault_bike', label: 'Assault Bike', category: 'Cycling' },
    { value: 'airdyne_bike', label: 'AirDyne Bike', category: 'Cycling' },
    { value: 'other_bike', label: 'Other Bike', category: 'Cycling' },
    { value: 'outdoor_bike_ride', label: 'Outdoor Bike Ride', category: 'Cycling' },
    { value: 'c2_ski_erg', label: 'C2 Ski Erg', category: 'Ski' },
    { value: 'assault_runner', label: 'Assault Runner Treadmill', category: 'Treadmill' },
    { value: 'trueform_treadmill', label: 'TrueForm Treadmill', category: 'Treadmill' },
    { value: 'motorized_treadmill', label: 'Motorized Treadmill', category: 'Treadmill' },
    { value: 'outdoor_run', label: 'Outdoor Run', category: 'Running' },
    { value: 'road_run', label: 'Road Run', category: 'Running' },
    { value: 'track_run', label: 'Track Run', category: 'Running' },
    { value: 'trail_run', label: 'Trail Run', category: 'Running' },
    { value: 'trueform', label: 'True Form', category: 'Running' },
    { value: 'assault_runner_run', label: 'Assault Runner', category: 'Running' },
    { value: 'other_treadmill', label: 'Other Treadmill', category: 'Running' },
  ]

  const scoreUnits = [
    { value: 'watts', label: 'Watts' },
    { value: 'meters', label: 'Meters' },
    { value: 'miles', label: 'Miles' },
    { value: 'cal', label: 'Calories' },
    { value: 'kilometers', label: 'Kilometers' }
  ]
  

  // Helper function to navigate back with proper route isolation and refresh trigger
  const navigateBack = () => {
    // If we have program context, navigate to the workout page with refresh parameter
    if (programId && week && programDay) {
      const refreshParam = Date.now() // Timestamp to force refresh
      router.push(`/workout/${programId}/week/${week}/day/${programDay}?refresh=${refreshParam}`)
    } else {
      // Fallback for standalone Engine access - stay within engine tabs
      router.push('/engine/training')
    }
  }

  const navigateToAnalytics = () => {
    router.push('/engine/analytics')
  }

  useEffect(() => {
    initializeDatabase()
  }, [])

  useEffect(() => {
    // Extract and store programId from URL params, or fetch latest program if not provided
    const fetchProgramId = async () => {
      if (programId) {
        setCurrentProgramId(parseInt(programId))
      } else if (userId) {
        // If programId not in URL, fetch user's latest program
        try {
          const supabase = createClient()
          const { data: programs, error } = await supabase
            .from('programs')
            .select('id')
            .eq('user_id', userId)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (!error && programs) {
            const programIdValue = (programs as any).id
            if (programIdValue) {
              setCurrentProgramId(programIdValue)
              console.log('📋 Inferred program_id from latest program:', programIdValue)
            }
          }
        } catch (error) {
          console.error('Error fetching latest program:', error)
        }
      }
    }
    
    fetchProgramId()
  }, [programId, userId])


  useEffect(() => {
    if (connected && day) {
      loadWorkout()
    } else if (connected && !day) {
      loadDashboardData()
    }
  }, [day, connected])

  // Set initial view to equipment selection when workout loads and reset form state
  useEffect(() => {
    if (workout) {
      setWorkoutView('equipment')
      // Reset completion form state when loading a new workout
      setTotalOutput('')
      setAverageHeartRate('')
      setPeakHeartRate('')
      setRpeValue(5)
      setIsCompleted(false)
      setSaveSuccess(false)
      // Reset saved values
      setSavedTotalOutput('')
      setSavedAverageHeartRate('')
      setSavedPeakHeartRate('')
      setSavedRpeValue(5)
    }
  }, [workout])

  // Auto-load last selected modality on mount
  useEffect(() => {
    if (connected && workout && !selectedModality) {
      loadLastSelectedModality()
    }
  }, [connected, workout])

  // Load baseline when modality changes
  useEffect(() => {
    if (connected && selectedModality) {
      loadBaselineForModality()
      loadWorkoutHistory()
      loadPerformanceMetrics()
    }
  }, [connected, selectedModality, workout?.day_type])

  // Load unit preference when modality selected
  useEffect(() => {
    if (connected && selectedModality) {
      loadUnitPreference()
    }
  }, [connected, selectedModality])

  // Reload baseline when unit is selected (to filter by units)
  useEffect(() => {
    if (connected && selectedModality && timeTrialSelectedUnit) {
      loadBaselineForModality()
    }
  }, [connected, selectedModality, timeTrialSelectedUnit])

  // Check if baseline matches selected unit
  useEffect(() => {
    if (selectedModality && timeTrialSelectedUnit) {
      const baseline = baselines[selectedModality]
      const matches = baseline && baseline.units === timeTrialSelectedUnit
      console.log('🔍 Baseline match check:', { 
        baseline, 
        selectedModality, 
        timeTrialSelectedUnit, 
        baselineUnits: baseline?.units,
        matches 
      })
      setHasMatchingBaseline(!!matches)
    } else {
      setHasMatchingBaseline(false)
    }
  }, [selectedModality, timeTrialSelectedUnit, baselines])

  // Check workout saved status when workout loads or equipment changes
  useEffect(() => {
    if (workout && selectedModality && userId) {
      checkWorkoutSavedStatus()
    }
  }, [workout?.id, selectedModality, userId])

  // Debug: Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()
      console.log('🔐 AUTH STATUS:', {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        error
      })
    }
    checkAuth()
  }, [])

  const initializeDatabase = async () => {
    try {
      const isConnected = await engineDatabaseService.initialize()
      setConnected(isConnected)
      if (isConnected) {
        const userIdStr = engineDatabaseService.getUserId()
        if (userIdStr) {
          setUserId(parseInt(userIdStr))
        }
      }
    } catch (error) {
      console.error('Error initializing database:', error)
      setConnected(false)
    }
  }

  const loadDashboardData = async () => {
    if (!connected) return
    
    setLoadingDashboard(true)
    try {
      const version = await engineDatabaseService.loadProgramVersion()
      const userProgramVersion = version || '5-day'
      setProgramVersion(userProgramVersion)

      const [progress, allWorkoutsData] = await Promise.all([
        engineDatabaseService.loadUserProgress(),
        engineDatabaseService.getWorkoutsForProgram(userProgramVersion)
      ])

      if (progress.user) {
        setUser(progress.user)
      }

      const allSessions = progress.completedSessions || []
      const filteredSessions = allSessions.filter((session: any) => {
        const sessionProgramVersion = session.program_version || '5-day'
        return sessionProgramVersion === userProgramVersion
      })

      // Filter workouts by program_type and add program_day_number
      const programType = userProgramVersion === '3-day' ? 'main_3day' : 'main_5day'
      const filteredWorkouts = (allWorkoutsData || []).map((workout: any) => {
        // For 5-day, program_day_number = day_number
        // For 3-day, we'd need mapping, but for now use day_number
        return {
          ...workout,
          program_day_number: workout.program_day_number || workout.day_number,
          day_number: workout.day_number
        }
      }).filter((workout: any) => {
        // Filter by program_type if available, otherwise include all
        return !workout.program_type || workout.program_type === programType
      })

      setCompletedSessions(filteredSessions)
      setWorkouts(filteredWorkouts)
      
      // Calculate current month and set up week view
      if (progress.user) {
        const userData = progress.user as any
        const daysPerMonth = userProgramVersion === '3-day' ? 12 : 20
        const currentDay = userData.current_day || 1
        const calculatedMonth = Math.ceil(currentDay / daysPerMonth) || 1
        setCurrentMonth(calculatedMonth)
        setSelectedWeek(1) // Start with week 1
        
        // Filter workouts for current month and week 1
        const monthStartDay = (calculatedMonth - 1) * daysPerMonth + 1
        const weekStartDay = monthStartDay + (1 - 1) * (userProgramVersion === '3-day' ? 3 : 5)
        const weekEndDay = weekStartDay + (userProgramVersion === '3-day' ? 3 : 5) - 1
        
        const weekWorkouts = filteredWorkouts.filter((w: any) => {
          const dayNum = w.program_day_number || w.day_number
          return dayNum >= weekStartDay && dayNum <= weekEndDay
        }).sort((a: any, b: any) => {
          const dayA = a.program_day_number || a.day_number
          const dayB = b.program_day_number || b.day_number
          return dayA - dayB
        })
        
        setCurrentWeekWorkouts(weekWorkouts)
      }
      
      // Load user name from Supabase
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase
            .from('users')
            .select('name, email, subscription_tier')
            .eq('auth_id', authUser.id)
            .single()
          
          if (profile?.name) {
            setUserName(profile.name)
          } else if (profile?.email) {
            setUserName(profile.email.split('@')[0])
          } else {
            setUserName('User')
          }

          // Check for NULL subscription_tier - block access if missing
          if (!profile?.subscription_tier) {
            console.error('❌ User missing subscription_tier for engine training access')
            Alert.alert(
              'Subscription Required',
              'Please subscribe to access training.',
              [{ text: 'View Plans', onPress: () => router.replace('/subscriptions') }]
            )
            router.replace('/subscriptions')
            return
          }

          const tier = profile.subscription_tier.toUpperCase()
          if (tier === 'FULL-PROGRAM' || tier === 'PREMIUM') {
            setProgramVersion('Premium')
          }
        }
      } catch (error) {
        console.error('Error loading user name:', error)
        setUserName('User')
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setError('Failed to load dashboard data')
    } finally {
      setLoadingDashboard(false)
    }
  }
  
  // Helper functions for week-focused view
  const getDaysPerMonth = () => {
    return programVersion === '3-day' ? 12 : 20
  }
  
  const getDaysPerWeek = () => {
    return programVersion === '3-day' ? 3 : 5
  }
  
  const getWeekDays = (month: number, week: number) => {
    const daysPerMonth = getDaysPerMonth()
    const daysPerWeek = getDaysPerWeek()
    const monthStartDay = (month - 1) * daysPerMonth + 1
    const weekStartDay = monthStartDay + (week - 1) * daysPerWeek
    const weekEndDay = weekStartDay + daysPerWeek - 1
    return { startDay: weekStartDay, endDay: weekEndDay }
  }
  
  const filterWorkoutsForWeek = (workouts: any[], month: number, week: number) => {
    const { startDay, endDay } = getWeekDays(month, week)
    return workouts.filter((w: any) => {
      const dayNum = w.program_day_number || w.day_number
      return dayNum >= startDay && dayNum <= endDay
    }).sort((a: any, b: any) => {
      const dayA = a.program_day_number || a.day_number
      const dayB = b.program_day_number || b.day_number
      return dayA - dayB
    })
  }
  
  const getDayCompletionStatus = (dayNumber: number) => {
    const isCompleted = completedSessions.some((session: any) => {
      const sessionDay = session.program_day_number || session.day_number
      return sessionDay === dayNumber
    })
    return isCompleted ? 100 : 0
  }
  
  const handleWeekChange = (week: number) => {
    setSelectedWeek(week)
    const weekWorkouts = filterWorkoutsForWeek(workouts, currentMonth, week)
    setCurrentWeekWorkouts(weekWorkouts)
  }
  
  const handleViewFullSchedule = () => {
    setShowMonthView(true)
  }
  
  const handleBackToWeekView = () => {
    setShowMonthView(false)
  }
  
  const onRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  const getMonthProgress = () => {
    if (!user) return 0
    const daysPerMonth = getDaysPerMonth()
    const monthStartDay = (currentMonth - 1) * daysPerMonth + 1
    const monthEndDay = currentMonth * daysPerMonth
    
    const completedDaysInMonth = completedSessions.filter((session: any) => {
      const sessionDay = session.program_day_number || session.day_number
      return sessionDay >= monthStartDay && sessionDay <= monthEndDay
    }).length
    
    return Math.round((completedDaysInMonth / daysPerMonth) * 100)
  }

  const loadLastSelectedModality = async () => {
    if (!connected) return
    
    try {
      const lastModality = await engineDatabaseService.loadLastSelectedModality()
      if (lastModality) {
        setSelectedModality(lastModality)
      }
    } catch (error) {
      console.error('Error loading last selected modality:', error)
    }
  }

  const loadBaselineForModality = async () => {
    if (!selectedModality || !connected) return
    
    setLoadingBaseline(true)
    try {
      // Pass selected unit if available to filter by units
      const baseline = await engineDatabaseService.loadTimeTrialBaselines(
        selectedModality,
        timeTrialSelectedUnit || undefined
      ) as any
      
      console.log('🔍 Baseline loaded:', { baseline, selectedModality, timeTrialSelectedUnit })
      
      if (baseline && baseline.calculated_rpm) {
        setBaselines(prev => ({
          ...prev,
          [selectedModality]: {
            baseline: baseline.calculated_rpm,
            units: baseline.units || 'cal',
            date: baseline.date
          }
        }))
      } else {
        // Clear baseline if not found
        setBaselines(prev => {
          const updated = { ...prev }
          delete updated[selectedModality]
          return updated
        })
      }
    } catch (error) {
      console.error('Error loading baseline:', error)
    } finally {
      setLoadingBaseline(false)
    }
  }

  const loadWorkoutHistory = async () => {
    if (!connected || !selectedModality || !workout?.day_type) return
    
    setLoadingHistory(true)
    try {
      const userIdStr = engineDatabaseService.getUserId()
      if (!userIdStr) return

      // Load both workout sessions and time trials for all day types
      const allSessions = await engineDatabaseService.loadCompletedSessions()
      const timeTrials = await engineDatabaseService.loadTimeTrials()
      
      // Convert time trials to same format as workout sessions
      const convertedTrials = (timeTrials || []).map((trial: any) => ({
        id: trial.id,
        user_id: trial.user_id,
        date: trial.date,
        modality: trial.modality,
        day_type: 'time_trial',
        total_output: trial.total_output,
        calculated_rpm: trial.calculated_rpm,
        units: trial.units,
        actual_pace: trial.calculated_rpm,
        target_pace: null,
        performance_ratio: null,
        average_heart_rate: trial.average_heart_rate,
        peak_heart_rate: trial.peak_heart_rate,
        perceived_exertion: trial.perceived_exertion,
        completed: true,
        duration_seconds: trial.duration_seconds || 600,
        program_day_number: trial.program_day_number,
        program_day: null,
        program_version: trial.program_version
      }))
      
      // Combine and filter by modality and day_type
      const allData = [...(allSessions || []), ...convertedTrials]
      const filteredSessions = allData.filter((session: any) => {
        return session.modality === selectedModality && session.day_type === workout.day_type
      })
      
      const sortedSessions = filteredSessions.sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.created_at || 0)
        const dateB = new Date(b.date || b.created_at || 0)
        return dateB.getTime() - dateA.getTime()
      })
      
      setWorkoutHistory(sortedSessions.slice(0, 10))
    } catch (error) {
      console.error('Error loading workout history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadPerformanceMetrics = async () => {
    if (!connected || !selectedModality || !workout?.day_type) return
    
    setLoadingMetrics(true)
    try {
      const userIdStr = engineDatabaseService.getUserId()
      if (!userIdStr) return

      const metrics = await engineDatabaseService.getPerformanceMetrics(
        userIdStr,
        workout.day_type,
        selectedModality
      ) as any
      
      console.log('📈 LOADED PERFORMANCE METRICS:', {
        dayType: workout.day_type,
        modality: selectedModality,
        hasMetrics: !!metrics,
        rollingAvgRatio: metrics?.rolling_avg_ratio,
        rollingCount: metrics?.rolling_count,
        learnedMaxPace: metrics?.learned_max_pace,
        last4Ratios: metrics?.last_4_ratios
      })
      
      setPerformanceMetrics(metrics)
    } catch (error) {
      console.error('Error loading performance metrics:', error)
    } finally {
      setLoadingMetrics(false)
    }
  }

  const loadUnitPreference = async () => {
    if (!connected || !selectedModality) return
    
    try {
      const preference = await engineDatabaseService.loadUnitPreferenceForModality(selectedModality)
      if (preference) {
        setTimeTrialSelectedUnit(preference)
      }
    } catch (error) {
      console.error('Error loading unit preference:', error)
    }
  }

  useEffect(() => {
    currentPhaseRef.current = currentPhase
  }, [currentPhase])

  useEffect(() => {
    currentIntervalRef.current = currentInterval
  }, [currentInterval])

  // Auto-calculate total output from interval scores
  useEffect(() => {
    const scores = Object.values(intervalScores)
    if (scores.length > 0) {
      const sum = scores.reduce((acc, score) => {
        const val = parseFloat(score)
        return isNaN(val) ? acc : acc + val
      }, 0)
      if (sum > 0) {
        setTotalOutput(sum.toString())
      }
    }
  }, [intervalScores])

  // Timer effect
  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1
          if (newTime === 0) {
            handlePhaseCompletion()
          }
          return newTime
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive, timeRemaining, currentPhase, currentInterval])

  // Helper function to construct workout object from engineData
  const constructWorkoutFromEngineData = (engineData: any): any => {
    // Calculate total work time from block params
    const calculateTotalWorkTime = (blockParams: any): number => {
      let totalSeconds = 0
      if (blockParams.block1) {
        const workDuration = blockParams.block1.workDuration || 0
        const rounds = blockParams.block1.rounds || 1
        totalSeconds += workDuration * rounds
      }
      if (blockParams.block2) {
        const workDuration = blockParams.block2.workDuration || 0
        const rounds = blockParams.block2.rounds || 1
        totalSeconds += workDuration * rounds
      }
      if (blockParams.block3) {
        const workDuration = blockParams.block3.workDuration || 0
        const rounds = blockParams.block3.rounds || 1
        totalSeconds += workDuration * rounds
      }
      if (blockParams.block4) {
        const workDuration = blockParams.block4.workDuration || 0
        const rounds = blockParams.block4.rounds || 1
        totalSeconds += workDuration * rounds
      }
      return totalSeconds
    }

    return {
      id: engineData.workoutId,
      day_number: engineData.dayNumber,
      day_type: engineData.dayType,
      total_duration_minutes: engineData.duration,
      block_count: engineData.blockCount,
      block_1_params: engineData.blockParams.block1 || null,
      block_2_params: engineData.blockParams.block2 || null,
      block_3_params: engineData.blockParams.block3 || null,
      block_4_params: engineData.blockParams.block4 || null,
      total_work_time: calculateTotalWorkTime(engineData.blockParams)
    }
  }

  // Load workout when selectedDay changes
  useEffect(() => {
    if (selectedDay && currentView === 'workout') {
      loadWorkout()
    }
  }, [selectedDay, currentView])

  const loadWorkout = async () => {
    if (!selectedDay) return

    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.replace('/auth/signin')
        return
      }

      // Get user ID
      const { data: userData } = await supabase
        .from('users')
        .select('id, current_program')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        setError('User not found')
        return
      }

      const userDataTyped = userData as any
      setUserId(userDataTyped.id)
      const version = userDataTyped.current_program === '3-day' ? '3-day' : '5-day'
      setProgramVersion(version)

      // PATH 1: If we have program context, use engineData from program structure
      if (programId && week && programDay) {
        try {
          console.log('📋 Loading workout from program structure:', { programId, week, programDay })
          
          // Fetch workout data (includes engineData)
          const workoutResponse = await fetchWorkout(
            parseInt(programId),
            parseInt(week),
            parseInt(programDay)
          )
          
          if (workoutResponse.success && workoutResponse.workout?.engineData) {
            const engineData = workoutResponse.workout.engineData
            
            // Construct workout object from engineData
            const workoutFromEngineData = constructWorkoutFromEngineData(engineData)
            
            console.log('✅ Loaded workout from engineData:', workoutFromEngineData)
            
            setWorkout(workoutFromEngineData)
            
            // Parse intervals from block params (works with block_1_params, block_2_params, etc.)
            const intervals = parseWorkoutIntervals(workoutFromEngineData)
            setSessionData(prev => ({
              ...prev,
              intervals
            }))
            
            return // Success - exit early
          } else {
            console.warn('⚠️ No engineData found in program, falling back to workouts table')
            // Fall through to PATH 2
          }
        } catch (error) {
          console.warn('⚠️ Failed to load from program structure, falling back to workouts table:', error)
          // Fall through to PATH 2
        }
      }

      // PATH 2: Fallback - Load from workouts table (for Engine-only subscribers or when program fetch fails)
      const programType = version === '3-day' ? 'main_3day' : 'main_5day'
      const dayNumber = selectedDay

      console.log('📋 Loading workout from workouts table:', { programType, dayNumber })

      // Load workout from workouts table
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('program_type', programType)
        .eq('day_number', dayNumber)
        .single()

      if (workoutError || !workoutData) {
        setError('Workout not found')
        return
      }

      setWorkout(workoutData)
      
      // Parse intervals from block params
      const intervals = parseWorkoutIntervals(workoutData)
      setSessionData(prev => ({
        ...prev,
        intervals
      }))
    } catch (err) {
      console.error('Error loading workout:', err)
      setError(err instanceof Error ? err.message : 'Failed to load workout')
    } finally {
      setLoading(false)
    }
  }

  const parseWorkoutIntervals = (workoutData: any): Interval[] => {
    if (!workoutData || !workoutData.day_type) {
      return [{
        id: 1,
        type: 'Workout',
        duration: (workoutData?.duration || 20) * 60,
        targetPace: null,
        description: workoutData?.description || 'Workout',
        blockNumber: null,
        roundNumber: null
      }]
    }

    const dayType = workoutData.day_type
    const intervals: Interval[] = []
    let intervalId = 1
    
    // Process all blocks (block_1, block_2, block_3, block_4)
    const blocks = [
      { params: workoutData.block_1_params, number: 1 },
      { params: workoutData.block_2_params, number: 2 },
      { params: workoutData.block_3_params, number: 3 },
      { params: workoutData.block_4_params, number: 4 }
    ].filter((block: any) => block.params && Object.keys(block.params).length > 0)

    blocks.forEach((block) => {
      const blockParams = block.params
      const blockNumber = block.number
      
      const workDuration = blockParams.workDuration || 60
      const restDuration = blockParams.restDuration || 0
      const rounds = blockParams.rounds || 1
      const paceRange = blockParams.paceRange || null
      const paceProgression = blockParams.paceProgression || null

      // Special handling for different day types
      if (dayType === 'endurance' || dayType === 'time_trial') {
        // Single continuous interval
        intervals.push({
          id: intervalId++,
          type: dayType,
          duration: workDuration,
          restDuration: 0,
          targetPace: null,
          description: getWorkoutTypeDisplayName(dayType),
          blockNumber: blockNumber,
          roundNumber: 1,
          paceRange: paceRange,
          isMaxEffort: dayType === 'time_trial' || dayType === 'anaerobic' || blockParams.isMaxEffort
        })
      } else if (dayType === 'towers' || dayType === 'towers_block_1') {
        // Towers: different parsing per block
        const workProgression = blockParams.workProgression || 'consistent'
        const paceProgression = blockParams.paceProgression || null
        
        if (blockNumber === 1) {
          // Block 1: Continuous work with increasing pace, no rest
          const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : 0.75
          const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : 0.9
          
          for (let i = 0; i < rounds; i++) {
            // Calculate pace progression if specified
            let currentPaceRange = paceRange
            if (paceProgression === 'increasing' && rounds > 1) {
              const progress = i / (rounds - 1)
              const currentPaceMultiplier = basePace + (maxPace - basePace) * progress
              currentPaceRange = [currentPaceMultiplier, currentPaceMultiplier]
            }
            
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: 0, // Block 1 has no rest
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: currentPaceRange,
              paceProgression: paceProgression === 'increasing' ? 'increasing' : null,
              workProgression: workProgression
            })
          }
        } else if (blockNumber === 2) {
          // Block 2: Single continuous interval
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: 0,
            targetPace: null,
            description: getWorkoutTypeDisplayName(dayType),
            blockNumber: blockNumber,
            roundNumber: 1,
            paceRange: paceRange,
            paceProgression: null,
            workProgression: workProgression
          })
        } else {
          // Block 3+: Consistent work with rest, increasing pace
          const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : 0.8
          const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : 1.05
          
          for (let i = 0; i < rounds; i++) {
            // Calculate pace progression if specified
            let currentPaceRange = paceRange
            if (paceProgression === 'increasing' && rounds > 1) {
              const progress = i / (rounds - 1)
              const currentPaceMultiplier = basePace + (maxPace - basePace) * progress
              currentPaceRange = [currentPaceMultiplier, currentPaceMultiplier]
            }
            
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: currentPaceRange,
              paceProgression: paceProgression === 'increasing' ? 'increasing' : null,
              workProgression: workProgression
            })
          }
        }
      } else if (dayType === 'atomic' || dayType === 'atomic_block_2') {
        // Atomic: short burst intervals - use workDuration and restDuration directly from database
        const workProgression = blockParams.workProgression || 'consistent'
        const paceProgression = blockParams.paceProgression || null
        
        // Check if paceRange is "max_effort" (string) or numeric array
        const isMaxEffort = paceRange === 'max_effort' || (typeof paceRange === 'string' && paceRange.toLowerCase().includes('max'))
        
        // For pace progression, extract base and max pace if available
        const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : null
        const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : null
        const hasPaceProgression = paceProgression === 'increasing' && basePace !== null && maxPace !== null
        
        for (let i = 0; i < rounds; i++) {
          // Calculate pace progression if specified
          let currentPaceRange = paceRange
          if (hasPaceProgression && rounds > 1 && !isMaxEffort) {
            const progress = i / (rounds - 1)
            const currentPaceMultiplier = basePace + (maxPace - basePace) * progress
            currentPaceRange = [currentPaceMultiplier, currentPaceMultiplier]
          }
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Burst ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: isMaxEffort ? null : currentPaceRange,
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression,
            isMaxEffort: isMaxEffort
          })
        }
      } else if ((dayType === 'infinity' || dayType === 'infinity_block_1' || dayType === 'infinity_block_2') && blockNumber !== 3) {
        // Infinity blocks 1 and 2: progressive pace over rounds
        const basePace = paceRange ? paceRange[0] : 0.85
        const maxPace = paceRange ? paceRange[1] : 1.0
        
        for (let i = 0; i < rounds; i++) {
          const progress = rounds > 1 ? i / (rounds - 1) : 0
          const currentPaceMultiplier = basePace + (maxPace - basePace) * progress
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: [currentPaceMultiplier, currentPaceMultiplier],
            paceProgression: 'increasing'
          })
        }
      } else if ((dayType === 'infinity' || dayType === 'infinity_block_1' || dayType === 'infinity_block_2' || dayType === 'infinity_block_3') && blockNumber === 3) {
        // Infinity Block 3: constant pace (no progression)
        for (let i = 0; i < rounds; i++) {
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: paceRange,
            paceProgression: null
          })
        }
      } else if (dayType === 'ascending') {
        // Ascending: increasing work duration with optional pace progression
        const workDurationIncrement = blockParams.workDurationIncrement ?? 30
        const paceIncrement = blockParams.paceIncrement ?? 0
        
        // Calculate base and max pace if paceRange exists and paceIncrement is specified
        const basePace = paceRange ? paceRange[0] : null
        const maxPace = paceRange ? paceRange[1] : null
        const hasPaceProgression = paceIncrement > 0 && basePace !== null && maxPace !== null
        
        for (let i = 0; i < rounds; i++) {
          // Work duration increases each round
          const currentWorkDuration = workDuration + (workDurationIncrement * i)
          
          // Calculate pace progression if specified
          let currentPaceRange = paceRange
          if (hasPaceProgression && rounds > 1) {
            const progress = i / (rounds - 1)
            const currentPaceMin = basePace + ((maxPace - basePace) * progress * (1 + paceIncrement))
            const currentPaceMax = Math.min(maxPace, currentPaceMin + paceIncrement)
            currentPaceRange = [currentPaceMin, currentPaceMax]
          }
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: currentWorkDuration,
            restDuration: restDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: currentPaceRange,
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression
          })
        }
      } else if (dayType === 'descending_devour') {
        // Descending devour: constant work, decreasing rest
        const restDurationIncrement = Math.abs(blockParams.restDurationIncrement ?? 10)
        
        for (let i = 0; i < rounds; i++) {
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: Math.max(0, restDuration - (restDurationIncrement * i)),
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
          paceRange: paceRange
        })
        }
      } else if (dayType === 'devour') {
        // Devour: increasing work duration, decreasing rest duration
        const workDurationIncrement = blockParams.workDurationIncrement ?? 15
        const restDurationIncrement = blockParams.restDurationIncrement ?? 0
        const restProgression = blockParams.restProgression ?? 'decreasing'
        const paceIncrement = blockParams.paceIncrement ?? 0
        
        // Calculate base and max pace if paceRange exists and paceIncrement is specified
        const basePace = paceRange ? paceRange[0] : null
        const maxPace = paceRange ? paceRange[1] : null
        const hasPaceProgression = paceIncrement > 0 && basePace !== null && maxPace !== null
        
        // Determine if rest should decrease
        const shouldDecreaseRest = restDurationIncrement > 0 && restProgression !== 'consistent'
        
        for (let i = 0; i < rounds; i++) {
          // Work duration increases each round
          const currentWorkDuration = workDuration + (workDurationIncrement * i)
          
          // Rest duration: decrease only if configured, otherwise keep constant
          const currentRestDuration = shouldDecreaseRest 
            ? Math.max(0, restDuration - (Math.abs(restDurationIncrement) * i))
            : restDuration
          
          // Calculate pace progression if specified
          let currentPaceRange = paceRange
          if (hasPaceProgression && rounds > 1) {
            const progress = i / (rounds - 1)
            const currentPaceMin = basePace + ((maxPace - basePace) * progress * (1 + paceIncrement))
            const currentPaceMax = Math.min(maxPace, currentPaceMin + paceIncrement)
            currentPaceRange = [currentPaceMin, currentPaceMax]
          }
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: currentWorkDuration,
            restDuration: currentRestDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: currentPaceRange,
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression
          })
        }
      } else if (dayType === 'ascending_devour') {
        // Ascending devour: more aggressive version
        const workDurationIncrement = blockParams.workDurationIncrement ?? 20
        const restDurationIncrement = blockParams.restDurationIncrement ?? 0
        const restProgression = blockParams.restProgression ?? 'decreasing'
        const paceIncrement = blockParams.paceIncrement ?? 0
        
        // Calculate base and max pace if paceRange exists and paceIncrement is specified
        const basePace = paceRange ? paceRange[0] : null
        const maxPace = paceRange ? paceRange[1] : null
        const hasPaceProgression = paceIncrement > 0 && basePace !== null && maxPace !== null
        
        // Determine if rest should decrease
        const shouldDecreaseRest = restDurationIncrement > 0 && restProgression !== 'consistent'
        
        for (let i = 0; i < rounds; i++) {
          // Work duration increases more aggressively each round
          const currentWorkDuration = workDuration + (workDurationIncrement * i)
          
          // Rest duration: decrease only if configured, otherwise keep constant
          const currentRestDuration = shouldDecreaseRest 
            ? Math.max(0, restDuration - (Math.abs(restDurationIncrement) * i))
            : restDuration
          
          // Calculate pace progression if specified
          let currentPaceRange = paceRange
          if (hasPaceProgression && rounds > 1) {
            const progress = i / (rounds - 1)
            // More aggressive pace progression for ascending devour
            const paceMultiplier = 1 + (paceIncrement * 1.5)
            const currentPaceMin = basePace + ((maxPace - basePace) * progress * paceMultiplier)
            const currentPaceMax = Math.min(maxPace, currentPaceMin + (paceIncrement * 1.5))
            currentPaceRange = [currentPaceMin, currentPaceMax]
          }
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: currentWorkDuration,
            restDuration: currentRestDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: currentPaceRange,
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression
          })
        }
      } else if (dayType === 'polarized') {
        // Polarized: continuous work with periodic bursts
        const basePace = blockParams.basePace || [0.7, 0.7]
        const burstTiming = blockParams.burstTiming || 'every_7_minutes'
        const burstDuration = blockParams.burstDuration || 7
        const burstIntensity = blockParams.burstIntensity || 'max_effort'
        
        // Create a single continuous interval for the entire work duration
        intervals.push({
          id: intervalId++,
          type: dayType,
          duration: workDuration,
          restDuration: 0,
          targetPace: null,
          description: getWorkoutTypeDisplayName(dayType),
          blockNumber: blockNumber,
          roundNumber: 1,
          paceRange: basePace,
          burstTiming: burstTiming,
          burstDuration: burstDuration,
          basePace: basePace,
          workProgression: 'continuous_with_bursts'
        })
      } else if (dayType === 'flux' || dayType === 'flux_stages') {
        // Flux: alternating base pace and flux periods
        const baseDuration = blockParams.baseDuration || 300
        const fluxDuration = blockParams.fluxDuration || 60
        const fluxStartIntensity = blockParams.fluxStartIntensity || 0.75
        const fluxIncrement = blockParams.fluxIncrement || 0.05
        const basePace = paceRange || [0.7, 0.7]
        
        // Create a single continuous interval for the entire work duration
        intervals.push({
          id: intervalId++,
          type: dayType,
          duration: workDuration,
          restDuration: 0,
          targetPace: null,
          description: getWorkoutTypeDisplayName(dayType),
          blockNumber: blockNumber,
          roundNumber: 1,
          paceRange: basePace,
          baseDuration: baseDuration,
          fluxDuration: fluxDuration,
          fluxStartIntensity: fluxStartIntensity,
          fluxIncrement: fluxIncrement,
          fluxIntensity: blockParams.fluxIntensity || null,
          workProgression: blockParams.workProgression || 'alternating_paces'
        })
      } else if (dayType === 'afterburner') {
        // Afterburner: each block has different parsing logic
        if (blockNumber === 1) {
          // Block 1: Max effort intervals with rest
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: null,
              paceProgression: null,
              isMaxEffort: true
            })
          }
        } else if (blockNumber === 2) {
          // Block 2: Single continuous interval
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: 0,
            targetPace: null,
            description: getWorkoutTypeDisplayName(dayType),
            blockNumber: blockNumber,
            roundNumber: 1,
            paceRange: paceRange,
            paceProgression: null,
            workProgression: blockParams.workProgression || 'single'
          })
        } else if (blockNumber === 3) {
          // Block 3: Intervals with progressive pace
          const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : 0.99
          const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : 1.14
          
          for (let i = 0; i < rounds; i++) {
            const progress = rounds > 1 ? i / (rounds - 1) : 0
            const currentPaceMultiplier = basePace + (maxPace - basePace) * progress
            
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: [currentPaceMultiplier, currentPaceMultiplier],
              paceProgression: 'increasing',
              workProgression: blockParams.workProgression || 'consistent'
            })
          }
        } else {
          // Additional blocks (4+) - use standard interval parsing
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: paceRange,
              paceProgression: paceProgression,
              workProgression: blockParams.workProgression || 'consistent'
            })
          }
        }
      } else if (dayType === 'synthesis') {
        // Synthesis: repeating pattern - blocks 1 & 3 are max effort, blocks 2 & 4 are continuous
        if (blockNumber === 1 || blockNumber === 3) {
          // Blocks 1 & 3: Max effort intervals with rest
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: null,
              paceProgression: null,
              isMaxEffort: true
            })
          }
        } else if (blockNumber === 2 || blockNumber === 4) {
          // Blocks 2 & 4: Single continuous interval
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: 0,
            targetPace: null,
            description: getWorkoutTypeDisplayName(dayType),
            blockNumber: blockNumber,
            roundNumber: 1,
            paceRange: paceRange,
            paceProgression: null,
            workProgression: blockParams.workProgression || 'consistent'
          })
        } else {
          // Additional blocks (5+) - use standard interval parsing
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: paceRange,
              paceProgression: paceProgression,
              workProgression: blockParams.workProgression || 'consistent'
            })
          }
        }
      } else {
        // Standard interval workout
        for (let i = 0; i < rounds; i++) {
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: paceRange,
            paceProgression: paceProgression,
            isMaxEffort: blockParams.isMaxEffort || false
          })
        }
      }
    })
    
    // If no intervals were created, create a default one
    if (intervals.length === 0) {
      intervals.push({
        id: 1,
        type: dayType,
        duration: workoutData.total_work_time || 1200,
        targetPace: null,
        description: getWorkoutTypeDisplayName(dayType),
        blockNumber: null,
        roundNumber: null
      })
    }
    
    return intervals
  }

  const getWorkoutTypeDisplayName = (dayType: string): string => {
    if (!dayType) return 'Workout'
    const typeMap: Record<string, string> = {
      'time_trial': 'Time Trial',
      'endurance': 'Endurance',
      'anaerobic': 'Anaerobic',
      'max_aerobic_power': 'Max Aerobic Power',
      'interval': 'Interval',
      'polarized': 'Polarized',
      'threshold': 'Threshold',
      'tempo': 'Tempo',
      'recovery': 'Recovery',
      'flux': 'Flux',
      'flux_stages': 'Flux Stages',
      'devour': 'Devour',
      'towers': 'Towers',
      'towers_block_1': 'Towers',
      'afterburner': 'Afterburner',
      'synthesis': 'Synthesis',
      'hybrid_anaerobic': 'Hybrid Anaerobic',
      'hybrid_aerobic': 'Hybrid Aerobic',
      'ascending': 'Ascending',
      'descending': 'Descending',
      'ascending_devour': 'Ascending Devour',
      'descending_devour': 'Descending Devour',
      'infinity': 'Infinity',
      'infinity_block_1': 'Infinity',
      'infinity_block_2': 'Infinity',
      'infinity_block_3': 'Infinity',
      'atomic': 'Atomic',
      'atomic_block_2': 'Atomic',
      'rocket_races_a': 'Rocket Races A',
      'rocket_races_b': 'Rocket Races B'
    }
    
    // If in typeMap, return it
    if (typeMap[dayType]) {
      return typeMap[dayType]
    }
    
    // Otherwise, format by replacing underscores with spaces and capitalizing words
    if (dayType) {
      return dayType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
    
    return 'Conditioning'
  }

  const saveCurrentIntervalScore = () => {
    if (currentIntervalScore.trim()) {
      setIntervalScores(prev => ({
        ...prev,
        [currentIntervalRef.current]: currentIntervalScore.trim()
      }))
      setCurrentIntervalScore('')
    }
  }

  // Check if interval inputs should be shown (only for day types with rest segments)
  const shouldShowIntervalInputs = (): boolean => {
    if (!workout?.day_type || !sessionData.intervals || sessionData.intervals.length === 0) {
      return false
    }

    // Exclude continuous day types
    const continuousDayTypes = ['endurance', 'threshold', 'polarized', 'tempo', 'recovery', 'flux', 'flux_stages', 'time_trial']
    if (continuousDayTypes.includes(workout.day_type)) {
      return false
    }

    // Must have multiple intervals
    if (sessionData.intervals.length === 1) {
      return false
    }

    // Must have at least one interval with rest duration > 0
    const hasRestSegments = sessionData.intervals.some(interval => (interval.restDuration ?? 0) > 0)
    if (!hasRestSegments) {
      return false
    }

    return true
  }

  // Build structured interval data array with pace calculations
  const buildIntervalDataArray = (): any[] | null => {
    if (!shouldShowIntervalInputs()) {
      return null
    }

    // Check if we have actualOutput data from intervals
    const intervalsWithOutput = sessionData.intervals.filter(
      (i: any) => i.actualOutput !== null && i.actualOutput !== undefined
    )
    const intervalsWithoutOutput = sessionData.intervals.filter(
      (i: any) => i.actualOutput === null || i.actualOutput === undefined
    )

    // All-or-nothing validation: if any interval has output, all must have output
    if (intervalsWithOutput.length > 0 && intervalsWithoutOutput.length > 0) {
      console.warn('⚠️ Partial interval data detected - saving workout without interval breakdown')
      return null
    }

    // If no intervals have output, return null
    if (intervalsWithOutput.length === 0) {
      return null
    }

    // All intervals have output - build the structured array
    return sessionData.intervals.map((interval: any) => {
      const output = interval.actualOutput || 0
      const durationMinutes = (interval.duration || 0) / 60
      const calculatedPace = durationMinutes > 0 ? output / durationMinutes : 0

      // Get target pace for this interval
      let targetPaceValue = null
      if (interval.targetPace && typeof interval.targetPace === 'object' && interval.targetPace.pace) {
        targetPaceValue = interval.targetPace.pace
      } else {
        const targetPaceData = calculateTargetPaceWithData(interval)
        if (targetPaceData && targetPaceData.pace) {
          targetPaceValue = targetPaceData.pace
        }
      }

      // Calculate performance ratio for this interval
      const performanceRatio = targetPaceValue && targetPaceValue > 0
        ? calculatedPace / targetPaceValue
        : null

      return {
        interval_number: interval.roundNumber || interval.id,
        actual_output: output,
        target_pace: targetPaceValue,
        actual_pace: calculatedPace,
        performance_ratio: performanceRatio,
        duration: interval.duration,
        rest_duration: interval.restDuration || 0
      }
    })
  }

  // Check if workout has been completed today for this equipment
  const checkWorkoutSavedStatus = async () => {
    if (!userId || !workout?.id || !selectedModality) {
      setIsWorkoutSaved(false)
      setLastCompletionTime(null)
      return
    }
    
    try {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, created_at, total_output')
        .eq('user_id', userId)
        .eq('workout_id', workout.id)
        .eq('modality', selectedModality)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error) {
        console.error('Error checking workout saved status:', error)
        setIsWorkoutSaved(false)
        setLastCompletionTime(null)
        return
      }
      
      if (data) {
        setIsWorkoutSaved(true)
        setLastCompletionTime(data.created_at)
        console.log('✅ Workout already completed today at', data.created_at)
      } else {
        setIsWorkoutSaved(false)
        setLastCompletionTime(null)
      }
    } catch (err) {
      console.error('Error in checkWorkoutSavedStatus:', err)
      setIsWorkoutSaved(false)
      setLastCompletionTime(null)
    }
  }


  const handlePhaseCompletion = () => {
    const phase = currentPhaseRef.current
    const intervalIndex = currentIntervalRef.current
    const currentInt = sessionData.intervals[intervalIndex]
    
    if (phase === 'work') {
      // Work phase completed - switch to rest if exists
      if (currentInt && currentInt.restDuration && currentInt.restDuration > 0) {
        setCurrentPhase('rest')
        setTimeRemaining(currentInt.restDuration)
        // Mark work as completed
        setSessionData(prev => {
          const updatedIntervals = [...prev.intervals]
          if (updatedIntervals[intervalIndex]) {
            updatedIntervals[intervalIndex].workCompleted = true
          }
          return { ...prev, intervals: updatedIntervals }
        })
      } else {
        // No rest period - move to next interval
        // Since we are skipping rest, if they were typing something (unlikely but possible), save it
        saveCurrentIntervalScore()
        completeCurrentInterval()
      }
    } else {
      // Rest phase completed - save score and move to next interval
      saveCurrentIntervalScore()
      completeCurrentInterval()
    }
  }

  const completeCurrentInterval = () => {
    // Dismiss keyboard when moving to next interval
    Keyboard.dismiss()
    
    const intervalIndex = currentIntervalRef.current
    setSessionData(prev => {
      const updatedIntervals = [...prev.intervals]
      if (updatedIntervals[intervalIndex]) {
        updatedIntervals[intervalIndex].completed = true
      }
      
      // Move to next interval
      const nextInterval = intervalIndex + 1
      if (nextInterval < updatedIntervals.length) {
        setCurrentInterval(nextInterval)
        setCurrentPhase('work')
        setTimeRemaining(updatedIntervals[nextInterval].duration)
      } else {
        // All intervals completed
        setIsActive(false)
        setIsCompleted(true)
      }
      
      return { ...prev, intervals: updatedIntervals }
    })
  }

  const startWorkout = () => {
    if (!selectedModality) {
      Alert.alert('Select Modality', 'Please select a modality before starting')
      return
    }
    
    setIsActive(true)
    setIsPaused(false)
    
    if (sessionData.intervals.length > 0) {
      setTimeRemaining(sessionData.intervals[0].duration)
      setCurrentInterval(0)
      setCurrentPhase('work')
    }
  }

  const pauseWorkout = () => {
    setIsActive(false)
    setIsPaused(true)
  }

  const resumeWorkout = () => {
    setIsActive(true)
    setIsPaused(false)
  }

  const completeWorkout = () => {
    setIsActive(false)
    setIsCompleted(true)
  }

  const resetWorkout = () => {
    setIsActive(false)
    setIsPaused(false)
    setIsCompleted(false)
    setCurrentInterval(0)
    setCurrentPhase('work')
    setTotalOutput('')
    setAverageHeartRate('')
    setPeakHeartRate('')
    setRpeValue(5)
    setIntervalScores({})
    setCurrentIntervalScore('')
    
    setSessionData(prev => ({
      ...prev,
      intervals: prev.intervals.map(interval => ({
        ...interval,
        completed: false,
        workCompleted: false
      })),
      totalOutput: 0,
      averagePace: 0,
      averageHeartRate: null,
      peakHeartRate: null,
      perceivedExertion: null
    }))
    
    if (sessionData.intervals.length > 0) {
      setTimeRemaining(sessionData.intervals[0].duration)
    }
    
    // Return to preview screen
    setWorkoutView('preview')
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Check if Rocket Races A was completed
  const rocketRacesACompleted = workoutHistory?.some((session: any) => 
    session.day_type === 'rocket_races_a' && session.completed === true
  ) ? true : (workoutHistory?.length > 0 ? false : null)

  // Calculate target pace using baseline and performance metrics
  // For flux days, this accepts an optional fluxIntensity parameter to calculate flux period pace
  const calculateTargetPaceWithData = (interval: Interval, fluxIntensity: number | null = null): any => {
    if (!selectedModality || !baselines[selectedModality]) {
      return null;
    }
    
    const baseline = baselines[selectedModality].baseline;
    const units = baselines[selectedModality].units;
    const dayType = workout?.day_type;

    // Special handling for Rocket Races B: check if Rocket Races A was completed
    if (dayType === 'rocket_races_b') {
      if (rocketRacesACompleted === false) {
        // Rocket Races A not completed - show message
        return {
          needsRocketRacesA: true,
          message: 'Complete Rocket Races A',
          units: units,
          baseline: baseline
        };
      } else if (rocketRacesACompleted === true && performanceMetrics?.learned_max_pace) {
        // Rocket Races A completed - use inherited pace
        const calculatedIntensity = baseline > 0 
          ? Math.round((performanceMetrics.learned_max_pace / baseline) * 100)
          : 100;
        
        return {
          pace: performanceMetrics.learned_max_pace,
          units: units,
          intensity: calculatedIntensity,
          baseline: baseline,
          source: 'inherited_from_rocket_races_a'
        };
      } else if (rocketRacesACompleted === true) {
        // Rocket Races A completed but no metrics yet
        return {
          needsRocketRacesA: true,
          message: 'Complete Rocket Races A',
          units: units,
          baseline: baseline
        };
      }
      // If rocketRacesACompleted is null, we're still loading - return null
      return null;
    }

    // For max effort days (time_trial, anaerobic, rocket races A), use learned_max_pace if available
    const isMaxEffortDay = dayType === 'time_trial' || 
                          dayType === 'anaerobic' || 
                          dayType === 'rocket_races_a' || 
                          interval.isMaxEffort;

    if (isMaxEffortDay && performanceMetrics?.learned_max_pace) {
      // Use learned max pace for max effort days
      // Calculate intensity percentage compared to baseline (e.g., if learned_max_pace is 25 cal/min and baseline is 20 cal/min, that's 125% of baseline)
      const calculatedIntensity = baseline > 0 
        ? Math.round((performanceMetrics.learned_max_pace / baseline) * 100)
        : 100;
      
      return {
        pace: performanceMetrics.learned_max_pace,
        units: units,
        intensity: calculatedIntensity,
        baseline: baseline,
        source: 'learned_max'
      };
    }

    // For max effort days without learned_max_pace, return max effort marker (no pace)
    if (isMaxEffortDay) {
      return {
        isMaxEffort: true,
        units: units,
        intensity: 100,
        baseline: baseline,
        source: 'max_effort_no_pace'
      };
    }

    // For non-max-effort days, check if paceRange is valid
    if (!interval.paceRange || !Array.isArray(interval.paceRange) || interval.paceRange.length < 2) {
      console.warn('Invalid paceRange for interval:', interval);
      return null;
    }

    // Use paceRange from the interval data
    // Use the midpoint of the range
    let intensityMultiplier = (interval.paceRange[0] + interval.paceRange[1]) / 2;

    // For flux days: if fluxIntensity is provided, multiply base intensity by flux intensity
    // This allows calculating different paces for base vs flux periods
    if (fluxIntensity !== null && typeof fluxIntensity === 'number' && fluxIntensity > 0) {
      intensityMultiplier *= fluxIntensity;
    }

    // Apply performance metrics adjustment - direct multiplication
    let metricsWereApplied = false;
    if (performanceMetrics?.rolling_avg_ratio) {
      intensityMultiplier *= performanceMetrics.rolling_avg_ratio;
      metricsWereApplied = true;
    }

    return {
      pace: baseline * intensityMultiplier,
      units: units,
      intensity: Math.round(intensityMultiplier * 100),
      baseline: baseline,
      source: metricsWereApplied ? 'metrics_adjusted' : 'baseline_only',
      isFluxPace: fluxIntensity !== null // Mark if this is a flux period pace
    };
  };

  const getCurrentTargetPace = (interval: Interval, fluxStatus: any) => {
    if (!interval) return null;

    // For flux days, calculate current pace based on flux status
    if (interval.fluxDuration && fluxStatus) {
      if (fluxStatus.isActive) {
        // In flux period - use flux intensity
        return calculateTargetPaceWithData(interval, fluxStatus.currentIntensity);
      } else {
        // In base period - use base pace
        return calculateTargetPaceWithData(interval, null);
      }
    }

    // For non-flux intervals, use base pace
    return calculateTargetPaceWithData(interval);
  };

  const validateWorkoutInput = (): boolean => {
    // Validate total output
    const output = parseFloat(totalOutput)
    if (isNaN(output)) {
      Alert.alert('Invalid Input', 'Total output must be a valid number')
      return false
    }
    if (output <= 0) {
      Alert.alert('Invalid Input', 'Total output must be greater than 0')
      return false
    }
    if (output > 10000) {
      Alert.alert('Invalid Input', 'Total output seems unusually high. Please check your entry (max: 10,000)')
      return false
    }
    
    // Validate average heart rate if provided
    if (averageHeartRate) {
      const avgHR = parseFloat(averageHeartRate)
      if (isNaN(avgHR)) {
        Alert.alert('Invalid Input', 'Average heart rate must be a valid number')
        return false
      }
      if (avgHR < 40 || avgHR > 220) {
        Alert.alert('Invalid Input', 'Average heart rate must be between 40-220 bpm')
        return false
      }
    }
    
    // Validate peak heart rate if provided
    if (peakHeartRate) {
      const peakHR = parseFloat(peakHeartRate)
      if (isNaN(peakHR)) {
        Alert.alert('Invalid Input', 'Peak heart rate must be a valid number')
        return false
      }
      if (peakHR < 40 || peakHR > 220) {
        Alert.alert('Invalid Input', 'Peak heart rate must be between 40-220 bpm')
        return false
      }
      
      // Check peak >= average if both provided
      if (averageHeartRate) {
        const avgHR = parseFloat(averageHeartRate)
        if (!isNaN(avgHR) && peakHR < avgHR) {
          Alert.alert('Invalid Input', 'Peak heart rate cannot be lower than average heart rate')
          return false
        }
      }
    }
    
    return true
  }

  const skipToEnd = () => {
    // Stop the timer
    setIsActive(false)
    setIsPaused(false)
    
    // Mark all intervals as completed
    setSessionData(prev => ({
      ...prev,
      intervals: prev.intervals.map(interval => ({
        ...interval,
        completed: true,
        workCompleted: true
      }))
    }))
    
    // Set to completed state
    setIsCompleted(true)
  }

  const discardWorkout = () => {
    // Clear completion form data
    setTotalOutput('')
    setAverageHeartRate('')
    setPeakHeartRate('')
    setRpeValue(5)
    
    // Reset workout state
    setIsCompleted(false)
    setIsActive(false)
    setIsPaused(false)
    
    // Reset intervals
    setSessionData(prev => ({
      ...prev,
      intervals: prev.intervals.map(interval => ({
        ...interval,
        completed: false,
        workCompleted: false
      }))
    }))
    
    // Return to preview screen
    setWorkoutView('preview')
    
    Alert.alert('Workout Discarded', 'Your workout was not saved')
  }

  const saveWorkout = async () => {
    if (!userId || !selectedModality || !totalOutput || !timeTrialSelectedUnit) {
      Alert.alert('Missing Information', 'Please select equipment, units, and enter total output')
      return
    }

    // Validate input values
    if (!validateWorkoutInput()) {
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      
      const totalOutputNum = parseFloat(totalOutput)
      const avgHR = averageHeartRate ? parseFloat(averageHeartRate) : null
      const peakHR = peakHeartRate ? parseFloat(peakHeartRate) : null
      
      // Calculate average pace
      const totalDuration = sessionData.intervals.reduce((sum, int) => sum + int.duration, 0)
      const avgPace = totalOutputNum / (totalDuration / 60)
      
      // Calculate average target pace from intervals
      let avgTargetPace = null
      if (sessionData.intervals.length > 0 && baselines[selectedModality]?.baseline) {
        const baseline = baselines[selectedModality].baseline
        
        let totalTargetPace = 0
        let totalTargetDuration = 0
        
        sessionData.intervals.forEach(interval => {
          const paceRange = interval.paceRange
          const isMaxEffort = paceRange === 'max_effort' || 
                              (typeof paceRange === 'string' && paceRange.toLowerCase().includes('max'))
          
          if (!isMaxEffort && paceRange && Array.isArray(paceRange) && paceRange.length >= 2) {
            const intensityMultiplier = (paceRange[0] + paceRange[1]) / 2
            let adjustedMultiplier = intensityMultiplier
            
            // Apply performance metrics if available (matches display logic)
            if (performanceMetrics?.rolling_avg_ratio) {
              adjustedMultiplier *= performanceMetrics.rolling_avg_ratio
            }
            
            const targetPace = baseline * adjustedMultiplier
            const duration = interval.duration || 0
            totalTargetPace += targetPace * duration
            totalTargetDuration += duration
          }
        })
        
        if (totalTargetDuration > 0) {
          avgTargetPace = totalTargetPace / totalTargetDuration
          console.log('🎯 TARGET PACE CALCULATED:', {
            baseline: baselines[selectedModality].baseline,
            avgTargetPace: avgTargetPace,
            hadPerformanceMetrics: !!performanceMetrics?.rolling_avg_ratio,
            rollingAvgRatio: performanceMetrics?.rolling_avg_ratio,
            totalIntervals: sessionData.intervals.length
          })
        }
      }
      
      // Calculate performance ratio (actual / target)
      let performanceRatio = null
      if (avgTargetPace && avgTargetPace > 0 && avgPace > 0) {
        performanceRatio = avgPace / avgTargetPace
        console.log('📊 PERFORMANCE RATIO CALCULATED:', {
          actualPace: avgPace,
          targetPace: avgTargetPace,
          performanceRatio: performanceRatio,
          percentage: (performanceRatio * 100).toFixed(0) + '% of target'
        })
      } else {
        console.warn('⚠️ PERFORMANCE RATIO NOT CALCULATED:', {
          avgTargetPace,
          avgPace,
          reason: !avgTargetPace ? 'no target pace' : !avgPace ? 'no actual pace' : 'invalid values'
        })
      }
      
      // Calculate total work and rest time
      const totalWorkTime = sessionData.intervals.reduce((sum, int) => sum + int.duration, 0)
      const totalRestTime = sessionData.intervals.reduce((sum, int) => sum + (int.restDuration || 0), 0)
      const avgWorkRestRatio = totalRestTime > 0 ? totalWorkTime / totalRestTime : null

      // Determine the correct day number to save
      // Priority: selectedDay (from dashboard click) > workout.day_number > workout.program_day_number > fallback to 1
      const dayNumberToSave = selectedDay || workout?.day_number || workout?.program_day_number || 1
      
      console.log('💾 SAVING WITH DAY NUMBER:', {
        selectedDay,
        workoutDayNumber: workout?.day_number,
        workoutProgramDayNumber: workout?.program_day_number,
        finalDayNumber: dayNumberToSave,
        dayUrlParam: day // For debugging
      })

      const sessionDataToSave = {
        program_day: dayNumberToSave,
        program_version: programVersion,
        program_day_number: dayNumberToSave,
        program_id: currentProgramId || (programId ? parseInt(programId) : null),
        workout_id: workout?.id,
        day_type: workout?.day_type,
        date: new Date().toISOString().split('T')[0],
        completed: true,
        total_output: totalOutputNum,
        actual_pace: avgPace,
        calculated_rpm: avgPace,
        target_pace: avgTargetPace,
        performance_ratio: performanceRatio,
        modality: selectedModality,
        units: timeTrialSelectedUnit,
        average_heart_rate: avgHR,
        peak_heart_rate: peakHR,
        perceived_exertion: rpeValue,
        workout_data: {
          intervals_completed: sessionData.intervals.filter(i => i.completed).length,
          total_intervals: sessionData.intervals.length,
          total_work_time: totalWorkTime,
          total_rest_time: totalRestTime,
          interval_scores: intervalScores,
          interval_data: buildIntervalDataArray()
        },
        avg_work_rest_ratio: avgWorkRestRatio,
        total_work_seconds: totalWorkTime,
        total_rest_seconds: totalRestTime
      }

      console.log('💾 SAVING WORKOUT SESSION:', {
        target_pace: avgTargetPace,
        actual_pace: avgPace,
        performance_ratio: performanceRatio,
        day_type: workout?.day_type,
        modality: selectedModality,
        program_day_number: sessionDataToSave.program_day_number,
        program_id: sessionDataToSave.program_id
      })

      const { error, data: insertedData } = await supabase
        .from('workout_sessions')
        .insert({
          ...sessionDataToSave,
          user_id: userId
        } as any)
        .select()

      if (error) throw error

      // Verify the insert was successful
      if (!insertedData || insertedData.length === 0) {
        throw new Error('Failed to save workout session')
      }

      // Small delay to ensure database consistency before navigation
      await new Promise(resolve => setTimeout(resolve, 500))

      // Update performance metrics in database
      if (workout?.day_type && selectedModality) {
        try {
          const userIdStr = userId.toString()
          const isMaxEffort = ['time_trial', 'anaerobic', 'rocket_races_a', 'rocket_races_b'].includes(workout.day_type)
          
          // For max effort or when we have performance ratio
          if (isMaxEffort || performanceRatio) {
            await engineDatabaseService.updatePerformanceMetrics(
              userIdStr,
              workout.day_type,
              selectedModality,
              performanceRatio || 0,
              avgPace,
              isMaxEffort
            )
            console.log('✅ PERFORMANCE METRICS UPDATED:', {
              userId: userIdStr,
              dayType: workout.day_type,
              modality: selectedModality,
              performanceRatio: performanceRatio,
              actualPace: avgPace,
              isMaxEffort: isMaxEffort
            })
          }
        } catch (metricsError) {
          console.error('⚠️ Error updating performance metrics:', metricsError)
          // Don't fail the save if metrics update fails
        }
      }

      // Store saved values for review card display BEFORE resetting
      setSavedTotalOutput(totalOutput)
      setSavedAverageHeartRate(averageHeartRate)
      setSavedPeakHeartRate(peakHeartRate)
      setSavedRpeValue(rpeValue)

      // Show success state
      setSaveSuccess(true)
      
      // Update workout saved state
      setIsWorkoutSaved(true)
      setLastCompletionTime(new Date().toISOString())
      
      // Reset form state after successful save (for next workout)
      setTotalOutput('')
      setAverageHeartRate('')
      setPeakHeartRate('')
      setRpeValue(5)
      
      // Don't auto-navigate - let user choose from review card
    } catch (err) {
      console.error('Error saving workout:', err)
      Alert.alert('Error', 'Failed to save workout. Please try again.')
    } finally {
      setSaving(false)
    }
  }


  // Render dashboard or navigation views
  if (currentView === 'dashboard') {
    if (loading || loadingDashboard) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FE5858" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )
    }

    // Show month view if requested
    if (showMonthView) {
    return (
        <Dashboard
          onDayClick={handleDayClick}
          onAnalyticsClick={handleAnalyticsClick}
          onBackToWeekView={handleBackToWeekView}
          showTrainingView={true}
        />
      )
    }

    // Week-focused view (default)
    const monthProgress = getMonthProgress()
    const programName = programVersion === 'Premium' 
      ? 'PREMIUM PROGRAM • Full Access'
      : `ENGINE PROGRAM • ${programVersion === '3-day' ? '3-Day' : '5-Day'} Program`

    return (
      <View style={styles.container}>
        {/* Header with Exit button for Program users */}
        {programId && (
          <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 8 }]}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackToDashboard}
            >
              <Ionicons name="arrow-back" size={16} color="#F8FBFE" style={{ marginRight: 6 }} />
              <Text style={styles.backButtonText}>Back to Day Menu</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Greeting Card */}
        <Card style={[styles.greetingCard, !programId && { marginTop: insets.top + 16 }]}>
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
              <Text style={styles.programNameInCard}>
                {programName}
              </Text>
            </View>
          </View>
        </Card>

        {/* Month Progress Bar */}
        <View style={styles.programContext}>
          <View style={styles.progressBarWrapper}>
            <View style={styles.dashboardProgressBarContainer}>
              <View
                style={[
                  styles.dashboardProgressBar,
                  { width: `${monthProgress}%` }
                ]}
              />
            </View>
            <Text style={styles.progressPercentage}>
              {monthProgress}%
            </Text>
          </View>
        </View>

        {/* View Full Program Structure Button */}
                  <TouchableOpacity
          style={styles.viewScheduleButton}
          onPress={handleViewFullSchedule}
          activeOpacity={0.7}
                  >
          <Text style={styles.viewScheduleIcon}>📅</Text>
          <Text style={styles.viewScheduleText}>
            View full program structure
          </Text>
                  </TouchableOpacity>

        <ScrollView
          style={styles.dashboardScrollView}
          contentContainerStyle={styles.dashboardScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {currentWeekWorkouts.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No Workouts Found
              </Text>
              <Text style={styles.emptyText}>
                Please check your program setup
              </Text>
            </Card>
          ) : (
            <>
              {/* Week Navigation */}
              <Card style={styles.weekNavCard}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.weekSelectorContent}
                >
                  <View style={styles.weekSelector}>
                    {[1, 2, 3, 4].map((week) => (
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
              </Card>

              {/* Workout Days */}
              <View style={styles.workoutDays}>
                {currentWeekWorkouts.map((workout) => {
                  const dayNumber = workout.program_day_number || workout.day_number
                  const completionPercentage = getDayCompletionStatus(dayNumber)
                  const dayType = workout.day_type || ''

                  return (
                    <TouchableOpacity
                      key={dayNumber}
                      onPress={() => handleDayClick(dayNumber, dayType)}
                      activeOpacity={0.7}
                    >
                      <Card style={styles.workoutCard}>
                        <View style={styles.workoutCardHeader}>
                          <View style={styles.workoutCardLeft}>
                            <Text style={styles.workoutDayTitle}>
                              Day {dayNumber}
                      </Text>
                            <Text style={styles.workoutDayType}>
                              {getWorkoutTypeDisplayName(dayType)}
                      </Text>
                          </View>
                          <View>
                            {completionPercentage === 100 ? (
                              <View style={styles.statusBadgeComplete}>
                                <Text style={styles.statusBadgeTextComplete}>
                                  ✓ Complete
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
                        <View style={styles.dashboardProgressBarContainer}>
                          <View
                            style={[
                              styles.dashboardProgressBar,
                              { width: `${completionPercentage}%` }
                            ]}
                          />
                        </View>
                      </Card>
                    </TouchableOpacity>
                  )
                })}
            </View>
            </>
          )}
        </ScrollView>
      </View>
    )
  }


  // Workout view (existing code)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading engine workout...</Text>
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
          onPress={handleBackToDashboard}
        >
          <Text style={styles.errorButtonText}>{programId ? 'Back to Day Menu' : 'Go Back'}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const currentInt = sessionData.intervals[currentInterval]
  const progress = sessionData.intervals.length > 0 
    ? (currentInterval + 1) / sessionData.intervals.length 
    : 0

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackToDashboard}
        >
          <Ionicons name="arrow-back" size={16} color="#F8FBFE" style={{ marginRight: 6 }} />
          <Text style={styles.backButtonText}>{programId ? 'Back to Day Menu' : 'Back'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Workout Info */}
        <View style={styles.card}>
          <Text style={styles.dayLabel}>
            Day {workout.day_number} - {getWorkoutTypeDisplayName(workout.day_type || 'conditioning')}
          </Text>
          
          {/* Equipment display - only show in preview view */}
          {workoutView === 'preview' && selectedModality && (
            <TouchableOpacity
              onPress={() => {
                setSelectedModality('')
                setWorkoutView('equipment')
              }}
              style={{ marginTop: 8 }}
            >
              <Text style={styles.equipmentText}>
                {modalities.find(m => m.value === selectedModality)?.label || 'Not selected'}
                <Text style={{ color: '#FE5858', fontWeight: '500' }}> (change)</Text>
              </Text>
            </TouchableOpacity>
          )}
          
          {workout.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{workout.description}</Text>
            </View>
          )}
        </View>

        {/* Equipment Selection View */}
        {workoutView === 'equipment' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Modality</Text>
            
            {/* Category Buttons */}
            <View style={styles.categoryRow}>
              {['Rowing', 'Cycling', 'Ski', 'Running'].map(category => {
                const categoryModalities = modalities.filter(m => m.category === category)
                const isSelected = selectedModality && modalities.find(m => m.value === selectedModality)?.category === category
                const isExpanded = expandedCategory === category
                
                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      (isSelected || isExpanded) && styles.categoryButtonActive
                    ]}
                    onPress={async () => {
                      if (expandedCategory === category) {
                        setExpandedCategory('')
                        setSelectedModality('')
                      } else {
                        setExpandedCategory(category)
                      }
                    }}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      (isSelected || isExpanded) && styles.categoryButtonTextActive
                    ]}>
                      {category === 'Rowing' ? 'Row' : category === 'Cycling' ? 'Bike' : category === 'Running' ? 'Run' : category}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                )
              })}
            </View>
            
            {/* Equipment Sub-menu */}
            {(expandedCategory || selectedModality) && (
              <View style={styles.equipmentSubMenu}>
                {modalities
                  .filter(m => m.category === (expandedCategory || modalities.find(mod => mod.value === selectedModality)?.category))
                  .map(modality => (
                    <TouchableOpacity
                      key={modality.value}
                      style={[
                        styles.equipmentButton,
                        selectedModality === modality.value && styles.equipmentButtonActive
                      ]}
                      onPress={async () => {
                        setSelectedModality(modality.value)
                        setExpandedCategory('')
                        // Save the selection
                        if (connected) {
                          await engineDatabaseService.saveLastSelectedModality(modality.value)
                        }
                        // Stay on equipment selection - user must select unit and click Next
                      }}
                    >
                      <Text style={[
                        styles.equipmentButtonText,
                        selectedModality === modality.value && styles.equipmentButtonTextActive
                      ]}>
                        {modality.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
            
            {/* Unit Selection - Show when modality selected */}
            {selectedModality && (
              <View style={styles.unitSelectionCard}>
                <Text style={styles.unitSelectionTitle}>Select Units</Text>
                <View style={styles.unitGrid}>
                  {scoreUnits.map(unit => (
                    <TouchableOpacity
                      key={unit.value}
                      style={[
                        styles.unitButton,
                        timeTrialSelectedUnit === unit.value && styles.unitButtonActive
                      ]}
                      onPress={async () => {
                        setTimeTrialSelectedUnit(unit.value)
                        if (connected) {
                          try {
                            await engineDatabaseService.saveUnitPreferenceForModality(selectedModality, unit.value)
                          } catch (err) {
                            console.error('Error saving unit preference:', err)
                          }
                        }
                      }}
                    >
                      <Text style={[
                        styles.unitButtonText,
                        timeTrialSelectedUnit === unit.value && styles.unitButtonTextActive
                      ]}>
                        {unit.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            {/* Baseline Warning - show when unit selected but no matching baseline, unless it IS a time trial day */}
            {selectedModality && timeTrialSelectedUnit && !hasMatchingBaseline && workout.day_type !== 'time_trial' && (
              <View style={styles.baselineWarning}>
                  <Text style={styles.warningTitle}>No Time Trial Baseline</Text>
                <Text style={styles.warningText}>
                  You haven't completed a time trial for {modalities.find(m => m.value === selectedModality)?.label} with {scoreUnits.find(u => u.value === timeTrialSelectedUnit)?.label}.
                </Text>
                <Text style={styles.warningSubtext}>
                  Without a baseline, you won't see:{'\n'}
                  • Target pace calculations{'\n'}
                  • Performance goals{'\n'}
                  • Analytics comparisons
                </Text>
                <Text style={styles.warningCTA}>
                  Complete a Time Trial first for the full experience!
                </Text>
              </View>
            )}
            
            {/* Next Button - show when modality AND unit selected */}
            {selectedModality && timeTrialSelectedUnit && (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => setWorkoutView('preview')}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Preview View */}
        {workoutView === 'preview' && selectedModality && (
          <>
            {/* Training Summary Section - Only show when baseline exists */}
            {baselines[selectedModality] && (
              <>
                <TouchableOpacity
                  style={[styles.collapsibleHeader, { marginTop: 16 }]}
                  onPress={() => setExpandedSummary(!expandedSummary)}
                >
                  <Text style={styles.collapsibleHeaderText}>Training Summary</Text>
                  <Ionicons
                    name={expandedSummary ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#FE5858"
                  />
                </TouchableOpacity>
                
                {expandedSummary && (
                  <View style={styles.summaryContent}>
                    {/* Work Duration and Total Work Goal - Side by side */}
                    <View style={styles.summaryRow}>
                      {/* Work Duration */}
                      <View style={styles.summaryMetricCard}>
                        <Text style={styles.summaryMetricLabel}>Work Duration</Text>
                        <Text style={styles.summaryMetricValue}>
                          {formatTime(sessionData.intervals.reduce((sum, interval) => sum + interval.duration, 0))}
                        </Text>
                      </View>
                      
                      {/* Total Work Goal */}
                      {(() => {
                        const totalGoal = (() => {
                          if (!selectedModality || !baselines[selectedModality]) return null;
                          
                          // For anaerobic days, check if user has history
                          if (workout?.day_type === 'anaerobic') {
                            if (!workoutHistory || workoutHistory.length === 0) {
                              return { isMaxEffort: true };
                            }
                          }
                          
                          // For Rocket Races A, always max effort
                          if (workout?.day_type === 'rocket_races_a') {
                            return { isMaxEffort: true };
                          }
                          
                          // Calculate target pace for each interval and sum
                          let totalGoal = 0;
                          let hasValidTargets = false;
                          
                          sessionData.intervals.forEach(interval => {
                            // For flux days, calculate weighted average
                            if (interval.fluxDuration && interval.baseDuration) {
                              // Calculate base pace using the function
                              const basePaceData = calculateTargetPaceWithData(interval, null);
                              if (basePaceData && basePaceData.pace && basePaceData.pace > 0) {
                                const fluxPeriods = calculateFluxPeriods(interval.baseDuration, interval.fluxDuration, interval.duration);
                                let intervalGoal = 0;
                                
                                fluxPeriods.forEach(period => {
                                  const periodDurationInMinutes = (period.end - period.start) / 60;
                                  if (period.type === 'flux') {
                                    const fluxIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
                                      ? interval.fluxIntensity
                                      : (interval.fluxStartIntensity || 0.75) + (period.index * (interval.fluxIncrement || 0.05));
                                    const fluxPaceData = calculateTargetPaceWithData(interval, fluxIntensity);
                                    if (fluxPaceData && fluxPaceData.pace && fluxPaceData.pace > 0) {
                                      intervalGoal += periodDurationInMinutes * fluxPaceData.pace;
                                    }
                                  } else {
                                    intervalGoal += periodDurationInMinutes * basePaceData.pace;
                                  }
                                });
                                
                                if (intervalGoal > 0) {
                                  totalGoal += intervalGoal;
                                  hasValidTargets = true;
                                }
                              }
                            } else {
                              // Standard interval - use the function
                              const targetPaceData = calculateTargetPaceWithData(interval);
                              if (targetPaceData && targetPaceData.pace && targetPaceData.pace > 0 && !targetPaceData.isMaxEffort) {
                                const durationInMinutes = interval.duration / 60;
                                const intervalGoal = durationInMinutes * targetPaceData.pace;
                                totalGoal += intervalGoal;
                                hasValidTargets = true;
                              }
                            }
                          });
                          
                          if (!hasValidTargets) return null;
                          
                          return {
                            totalGoal: totalGoal,
                            units: baselines[selectedModality].units
                          };
                        })();
                        
                        if (totalGoal?.isMaxEffort) {
                          return (
                            <View style={styles.summaryMetricCard}>
                              <Text style={styles.summaryMetricLabel}>Total Work Goal</Text>
                              <Text style={styles.summaryMetricValue}>Max Effort</Text>
                            </View>
                          );
                        } else if (totalGoal) {
                          return (
                            <View style={styles.summaryMetricCard}>
                              <Text style={styles.summaryMetricLabel}>Total Work Goal</Text>
                              <Text style={styles.summaryMetricValue}>
                                {Math.ceil(totalGoal.totalGoal || 0)} <Text style={styles.summaryMetricUnits}>{totalGoal.units}</Text>
                              </Text>
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                    
                    {/* Intensity Comparison - Baseline vs Target */}
                    {(() => {
                      // Get current target pace for first interval
                      const firstInterval = sessionData.intervals[0];
                      if (!firstInterval || !baselines[selectedModality]) return null;
                      
                      // Use the calculateTargetPaceWithData function
                      const targetPaceData = calculateTargetPaceWithData(firstInterval);
                      
                      if (!targetPaceData || !targetPaceData.pace || targetPaceData.isMaxEffort) return null;
                      
                      const baselinePace = baselines[selectedModality].baseline;
                      const targetPace = targetPaceData.pace;
                      const baselineIntensity = 100;
                      const targetIntensity = targetPaceData.intensity || 100;
                      const maxScale = Math.max(baselineIntensity, targetIntensity) * 1.2;
                      const baselineWidth = (baselineIntensity / maxScale) * 100;
                      const targetWidth = (targetIntensity / maxScale) * 100;
                      
                      return (
                        <View style={styles.intensityComparisonCard}>
                          <Text style={styles.intensityComparisonLabel}>Intensity Comparison</Text>
                          
                          {/* Time Trial Baseline */}
                          <View style={styles.intensityRow}>
                            <Text style={styles.intensityLabel}>Time Trial</Text>
                            <View style={styles.intensityBarContainer}>
                              <View style={[styles.intensityBar, { width: `${baselineWidth}%`, backgroundColor: '#6b7280' }]}>
                                <Text style={styles.intensityBarText}>
                                  {Math.round(baselinePace)} {baselines[selectedModality].units}/min
                                </Text>
                              </View>
                            </View>
                          </View>
                          
                          {/* Today's Target */}
                          <View style={styles.intensityRow}>
                            <Text style={styles.intensityLabel}>Today's Target</Text>
                            <View style={styles.intensityBarContainer}>
                              <View style={[styles.intensityBar, { width: `${targetWidth}%`, backgroundColor: '#FE5858' }]}>
                                <Text style={styles.intensityBarText}>
                                  {Math.round(targetPace)} {baselines[selectedModality].units}/min
                                </Text>
                                <Text style={styles.intensityPercentage}>{targetIntensity}%</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </>
            )}
            
            {/* Workout Breakdown Section */}
            <TouchableOpacity
              style={[styles.collapsibleHeader, { marginTop: 16 }]}
              onPress={() => setExpandedBreakdown(!expandedBreakdown)}
            >
              <Text style={styles.collapsibleHeaderText}>Workout Breakdown</Text>
              <Ionicons
                name={expandedBreakdown ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#FE5858"
              />
            </TouchableOpacity>
            
            {expandedBreakdown && (
              <View style={styles.breakdownContent}>
                {/* Detailed Block Breakdown */}
                {(() => {
                  // Group intervals by block
                  const blocksMap = new Map<number, Interval[]>()
                  sessionData.intervals.forEach((int) => {
                    if (int.blockNumber !== null && int.blockNumber !== undefined) {
                      if (!blocksMap.has(int.blockNumber)) {
                        blocksMap.set(int.blockNumber, [])
                      }
                      blocksMap.get(int.blockNumber)!.push(int)
                    }
                  })
                  
                  // If no blocks, show single continuous workout
                  if (blocksMap.size === 0 && sessionData.intervals.length > 0) {
                    const int = sessionData.intervals[0]
                    
                    // Determine target display
                    let targetDisplay = ''
                    const paceRange = int.paceRange
                    const isMaxEffort = paceRange === 'max_effort' || 
                                        (typeof paceRange === 'string' && paceRange.toLowerCase().includes('max'))
                    
                    if (isMaxEffort) {
                      targetDisplay = 'Target: Max Effort'
                    } else if (hasMatchingBaseline && baselines[selectedModality]?.baseline) {
                      // Calculate target pace from baseline × paceRange
                      if (paceRange && Array.isArray(paceRange) && paceRange.length >= 2) {
                        const baseline = baselines[selectedModality].baseline
                        const intensityMultiplier = (paceRange[0] + paceRange[1]) / 2
                        let adjustedMultiplier = intensityMultiplier
                        if (performanceMetrics?.rolling_avg_ratio) {
                          adjustedMultiplier *= performanceMetrics.rolling_avg_ratio
                          console.log('🔧 APPLYING PERFORMANCE ADJUSTMENT TO DISPLAY:', {
                            baseIntensity: intensityMultiplier,
                            rollingAvgRatio: performanceMetrics.rolling_avg_ratio,
                            adjustedIntensity: adjustedMultiplier,
                            percentChange: ((adjustedMultiplier / intensityMultiplier - 1) * 100).toFixed(1) + '%'
                          })
                        }
                        const targetPace = baseline * adjustedMultiplier
                        targetDisplay = `Target: ${Math.round(targetPace)} ${timeTrialSelectedUnit}/min`
                      } else {
                        targetDisplay = '⚠️ Complete time trial to see targets'
                      }
                    } else {
                      targetDisplay = '⚠️ Complete time trial to see targets'
                    }
                    
                    return (
                      <View style={styles.blockBreakdown}>
                        <Text style={styles.blockTitle}>Workout</Text>
                        <View style={styles.blockDetails}>
                          <Text style={styles.blockDetailText}>
                            Work: {formatTime(int.duration)}
                          </Text>
                          {int.restDuration && int.restDuration > 0 && (
                            <Text style={styles.blockDetailText}>
                              Rest: {formatTime(int.restDuration)}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.blockDetailText}>
                          {targetDisplay}
                        </Text>
                      </View>
                    )
                  }
                  
                  // Display each block with individual rounds
                  return Array.from(blocksMap.entries())
                    .sort(([a], [b]) => a - b)
                    .flatMap(([blockNum, intervals]) => {
                      const blockElements = []
                      
                      // Add block header only if there are multiple blocks
                      if (blocksMap.size > 1) {
                        blockElements.push(
                          <Text key={`block-${blockNum}-header`} style={styles.blockHeaderText}>
                            Block {blockNum}
                          </Text>
                        )
                      }
                      
                      // Add each round card
                      intervals.forEach((interval, roundIndex) => {
                        const uniqueKey = `block-${blockNum}-round-${roundIndex}`
                        const workDuration = interval.duration || 0
                        const restDuration = interval.restDuration || 0
                        const paceRange = interval.paceRange
                        const isMaxEffort = paceRange === 'max_effort' || 
                                            (typeof paceRange === 'string' && paceRange.toLowerCase().includes('max'))
                        
                        // Calculate goal for this specific interval
                        let goalDisplay = ''
                        if (isMaxEffort) {
                          goalDisplay = 'Max Effort'
                        } else if (hasMatchingBaseline && baselines[selectedModality]?.baseline) {
                          if (paceRange && Array.isArray(paceRange) && paceRange.length >= 2) {
                            const baseline = baselines[selectedModality].baseline
                            const intensityMultiplier = (paceRange[0] + paceRange[1]) / 2
                            let adjustedMultiplier = intensityMultiplier
                            if (performanceMetrics?.rolling_avg_ratio) {
                              adjustedMultiplier *= performanceMetrics.rolling_avg_ratio
                            }
                            const targetPacePerMin = baseline * adjustedMultiplier
                            const workDurationMinutes = workDuration / 60
                            const goalForInterval = Math.round(targetPacePerMin * workDurationMinutes)
                            goalDisplay = `${goalForInterval} ${timeTrialSelectedUnit}`
                          } else {
                            goalDisplay = '⚠️ Complete time trial'
                          }
                        } else {
                          goalDisplay = '⚠️ Complete time trial'
                        }
                        
                        blockElements.push(
                          <View key={uniqueKey} style={styles.roundCard}>
                            <View style={styles.roundHeader}>
                              <View style={styles.roundBadge}>
                                <Text style={styles.roundBadgeText}>Round {roundIndex + 1}</Text>
                              </View>
                            </View>
                            
                            <View style={styles.roundDetails}>
                              <View style={styles.roundDetailRow}>
                                <View style={styles.roundDetailItem}>
                                  <Text style={styles.roundDetailLabel}>Work</Text>
                                  <Text style={styles.roundDetailValue}>{formatTime(workDuration)}</Text>
                                </View>
                                {restDuration > 0 && (
                                  <View style={styles.roundDetailItem}>
                                    <Text style={styles.roundDetailLabel}>Rest</Text>
                                    <Text style={styles.roundDetailValue}>{formatTime(restDuration)}</Text>
                                  </View>
                                )}
                                <View style={styles.roundDetailItem}>
                                  <Text style={styles.roundDetailLabel}>Goal</Text>
                                  <Text style={styles.roundGoalValue}>{goalDisplay}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        )
                      })
                      
                      return blockElements
                    })
                })()}
              </View>
            )}
            
            {/* Workout History Section */}
            <TouchableOpacity
              style={[styles.collapsibleHeader, { marginTop: 16 }]}
              onPress={() => setExpandedHistory(!expandedHistory)}
            >
              <View style={styles.historyHeaderContent}>
                <Text style={styles.collapsibleHeaderText}>
                  {workout?.day_type ? `${getWorkoutTypeDisplayName(workout.day_type)} History` : 'Previous Sessions'}
                </Text>
                {workoutHistory.length > 0 && (
                  <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>{workoutHistory.length}</Text>
                  </View>
                )}
              </View>
              <Ionicons
                name={expandedHistory ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#FE5858"
              />
            </TouchableOpacity>
            
            {expandedHistory && (
              <View style={styles.historyContent}>
                {loadingHistory ? (
                  <View style={styles.inlineLoadingContainer}>
                    <ActivityIndicator size="small" color="#FE5858" />
                    <Text style={styles.inlineLoadingText}>Loading workout history...</Text>
                  </View>
                ) : workoutHistory.length > 0 ? (
                  <>
                    {workoutHistory.slice(0, 5).map((session, index) => (
                    <View key={index} style={styles.historyItem}>
                        <View style={styles.historyItemContent}>
                      <Text style={styles.historyDate}>
                        {session.date ? new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                      </Text>
                          <View style={styles.historyMetrics}>
                            {session.performance_ratio && (
                              <View style={styles.performanceRatioBadge}>
                                <Text style={styles.performanceRatioText}>
                                  {(session.performance_ratio * 100).toFixed(1)}%
                                </Text>
                              </View>
                            )}
                      {session.actual_pace && (
                              <View style={styles.actualPaceBadge}>
                                <Text style={styles.actualPaceText}>
                                  {session.actual_pace.toFixed(1)} {baselines[selectedModality]?.units || session.units || 'units'}/min
                        </Text>
                              </View>
                      )}
                    </View>
                        </View>
                      </View>
                    ))}
                    
                    {/* Performance Summary */}
                    {selectedModality && baselines[selectedModality] && performanceMetrics?.rolling_avg_ratio && (() => {
                      const sessionsWithPace = workoutHistory.filter((s: any) => s.actual_pace !== null && s.actual_pace !== undefined);
                      const avgPace = sessionsWithPace.length > 0 
                        ? sessionsWithPace.reduce((sum: number, s: any) => sum + s.actual_pace, 0) / sessionsWithPace.length 
                        : null;
                      
                      return (
                        <View style={styles.performanceSummaryCard}>
                          <View style={styles.performanceSummaryContent}>
                            <Text style={styles.performanceSummaryLabel}>
                              {workout?.day_type ? `${getWorkoutTypeDisplayName(workout.day_type)} Summary` : 'Summary'}
                            </Text>
                            <View style={styles.performanceSummaryMetrics}>
                              <View style={styles.performanceRatioBadge}>
                                <Text style={styles.performanceRatioText}>
                                  {(performanceMetrics.rolling_avg_ratio * 100).toFixed(1)}%
                                </Text>
                              </View>
                              {avgPace && (
                                <View style={styles.actualPaceBadge}>
                                  <Text style={styles.actualPaceText}>
                                    {avgPace.toFixed(1)} {baselines[selectedModality]?.units || 'units'}/min
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  <View style={styles.noHistoryContainer}>
                    <Text style={styles.noHistoryText}>No previous sessions for this workout type</Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Completion Status Badge */}
            {isWorkoutSaved && lastCompletionTime && (
              <View style={styles.completionBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.completionText}>
                  Completed today at {new Date(lastCompletionTime).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </Text>
              </View>
            )}
            
            {/* Start Button */}
            <TouchableOpacity
              style={styles.startPreviewButton}
              onPress={() => {
                setWorkoutView('active')
                setIntervalScores({})
                setCurrentIntervalScore('')
                // Initialize timer state but don't start counting yet
                if (sessionData.intervals.length > 0) {
                  setTimeRemaining(sessionData.intervals[0].duration)
                  setCurrentInterval(0)
                  setCurrentPhase('work')
                }
                // Don't set isActive to true - let user click Start on timer screen
              }}
            >
              <Text style={styles.startPreviewButtonText}>
                {isWorkoutSaved ? 'Complete Again' : 'Start Workout'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Workout Timer - Only show in active view */}
        {selectedModality && workoutView === 'active' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Workout Info Above Timer */}
            <View style={styles.timerInfoContainer}>
              
              {/* Phase, Goal, and Round info - only show when workout has started */}
              {(isActive || isPaused || isCompleted) && (
                <>
                  <Text style={[
                    styles.timerPhase, 
                    { color: isPaused ? '#F59E0B' : currentPhase === 'work' ? '#10B981' : '#6B7280' }
                  ]}>
                    {isPaused ? 'PAUSED' : currentPhase === 'work' ? 'Work' : 'Rest'}
                  </Text>
                  
                  {currentPhase === 'rest' && isActive && !isCompleted ? (
                    <View style={styles.restScoreContainer}>
                      <Text style={styles.restScoreLabel}>Log Last Interval Output:</Text>
                      <View style={styles.restScoreInputWrapper}>
                        <TextInput
                          style={styles.restScoreInput}
                          value={currentIntervalScore}
                          onChangeText={setCurrentIntervalScore}
                          placeholder={`Enter ${timeTrialSelectedUnit === 'cal' ? 'calories' : timeTrialSelectedUnit}`}
                          keyboardType="numeric"
                          placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity 
                          style={styles.restScoreSaveButton}
                          onPress={saveCurrentIntervalScore}
                        >
                          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      {(() => {
                        // Calculate goal for current interval
                        let goalText = ''
                        if (currentInt && currentPhase === 'work') {
                          const paceRange = currentInt.paceRange
                          const isMaxEffort = paceRange === 'max_effort' || 
                                              (typeof paceRange === 'string' && paceRange.toLowerCase().includes('max'))
                          
                          if (isMaxEffort) {
                            goalText = 'Max Effort'
                          } else if (hasMatchingBaseline && baselines[selectedModality]?.baseline) {
                            if (paceRange && Array.isArray(paceRange) && paceRange.length >= 2) {
                              const baseline = baselines[selectedModality].baseline
                              const intensityMultiplier = (paceRange[0] + paceRange[1]) / 2
                              let adjustedMultiplier = intensityMultiplier
                              if (performanceMetrics?.rolling_avg_ratio) {
                                adjustedMultiplier *= performanceMetrics.rolling_avg_ratio
                              }
                              const targetPace = baseline * adjustedMultiplier
                              const durationMinutes = (currentInt.duration || 0) / 60
                              const goal = Math.round(targetPace * durationMinutes)
                              goalText = `Goal: ${goal} ${timeTrialSelectedUnit === 'cal' ? 'calories' : timeTrialSelectedUnit}`
                            }
                          }
                        }
                        return goalText ? <Text style={styles.timerGoal}>{goalText}</Text> : null
                      })()}
                      {(() => {
                        // Calculate round information
                        if (currentInt?.roundNumber) {
                          // Find total rounds in the same block
                          const blockNum = currentInt.blockNumber
                          const roundsInBlock = sessionData.intervals.filter(
                            (int: Interval) => int.blockNumber === blockNum
                          ).length
                          return (
                            <Text style={styles.timerRound}>
                              Round {currentInt.roundNumber} of {roundsInBlock}
                            </Text>
                          )
                        }
                        return null
                      })()}
                    </>
                  )}
                </>
              )}
            </View>

            {/* Start Button and Back to Preview - Only show when not started */}
            {!isActive && !isPaused && !isCompleted && (
              <View style={styles.timerStartContainer}>
                <TouchableOpacity 
                  style={styles.backToPreviewButton} 
                  onPress={() => setWorkoutView('preview')}
                >
                  <Ionicons name="arrow-back" size={20} color="#282B34" />
                  <Text style={styles.backToPreviewButtonText}>Back to Preview</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.startButtonFull} onPress={startWorkout}>
                  <Ionicons name="play-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.startButtonFullText}>Start Workout</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Advanced Status Displays */}
            {isActive && !isCompleted && (
              <>
                {/* Flux Status Display */}
                {currentInt?.fluxDuration && (
                  <View style={styles.statusDisplay}>
                    <Text style={styles.statusTitle}>FLUX TRAINING</Text>
                    {(() => {
                      const totalDuration = currentInt?.duration || 0
                      const elapsedTime = totalDuration - timeRemaining
                      const fluxStatus = getFluxStatus(currentInt, elapsedTime)
                      if (fluxStatus?.isActive) {
                        return (
                          <Text style={styles.statusText}>
                            Flux: {formatTime(fluxStatus.timeRemainingInFlux)} @ {(fluxStatus.currentIntensity * 100).toFixed(0)}%
                          </Text>
                        )
                      } else if (fluxStatus?.nextFluxIn) {
                        return (
                          <Text style={styles.statusText}>
                            Next flux: {formatTime(fluxStatus.nextFluxIn)}
                          </Text>
                        )
                      }
                      return null
                    })()}
                  </View>
                )}

                {/* Burst Status Display */}
                {currentInt?.burstTiming && (
                  <View style={styles.statusDisplay}>
                    <Text style={styles.statusTitle}>POLARIZED TRAINING</Text>
                    {(() => {
                      const totalDuration = currentInt?.duration || 0
                      const elapsedTime = totalDuration - timeRemaining
                      const burstStatus = getBurstStatus(currentInt, elapsedTime)
                      if (burstStatus?.isActive) {
                        return (
                          <Text style={styles.statusText}>
                            Burst: {formatTime(burstStatus.timeRemainingInBurst)}
                          </Text>
                        )
                      } else if (burstStatus?.nextBurstIn) {
                        return (
                          <Text style={styles.statusText}>
                            Next burst: {formatTime(burstStatus.nextBurstIn)}
                          </Text>
                        )
                      }
                      return null
                    })()}
                  </View>
                )}
              </>
            )}

            {/* Ring Timer */}
            {(() => {
              const screenWidth = Dimensions.get('window').width
              const buttonWidth = screenWidth - 48 // 24px padding on each side
              const timerSize = buttonWidth
              const center = timerSize / 2
              const radius = (timerSize - 24) / 2 // Account for stroke width
              const circumference = 2 * Math.PI * radius
              
              return (
                <View style={[styles.timerContainer, { width: timerSize, height: timerSize }]}>
                  <Svg width={timerSize} height={timerSize} viewBox={`0 0 ${timerSize} ${timerSize}`}>
                    <G transform={`rotate(-90 ${center} ${center})`}>
                      {/* Background circle */}
                      <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="#E5E7EB"
                        strokeWidth="12"
                        fill="none"
                      />
                      {/* Progress circle */}
                      {(() => {
                        const totalDuration = currentInt?.duration || 600
                        const progress = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0
                        const offset = circumference - (progress / 100) * circumference
                        // Use green for work phase, gray for rest/completed
                        const strokeColor = isCompleted ? '#10B981' : (currentPhase === 'work' && isActive) ? '#10B981' : '#6B7280'
                        
                        return (
                          <Circle
                            cx={center}
                            cy={center}
                            r={radius}
                            stroke={strokeColor}
                            strokeWidth="12"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                          />
                        )
                      })()}
                    </G>
                    {/* Timer Display - Only time */}
                    <SvgText
                      x={center}
                      y={center + 20}
                      textAnchor="middle"
                      fontSize={timerSize * 0.24}
                      fontWeight={700}
                      fill="#111827"
                    >
                      {formatTime(timeRemaining)}
                    </SvgText>
                  </Svg>
                </View>
              )
            })()}

            {/* Controls - Circular buttons at bottom */}
            {(isActive || isPaused) && (
              <View style={styles.timerControls}>
                <TouchableOpacity style={styles.stopButton} onPress={resetWorkout}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.pauseButton} 
                  onPress={isActive ? pauseWorkout : resumeWorkout}
                >
                  <Ionicons name={isActive ? "pause" : "play"} size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipRoundButton} onPress={skipToEnd}>
                  <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Workout Progress Card */}
            {sessionData.intervals.length > 0 && (
              <WorkoutProgressCard
                intervals={sessionData.intervals}
                currentInterval={currentInterval}
                isActive={isActive}
                baselines={baselines}
                selectedModality={selectedModality}
                calculateTargetPaceWithData={calculateTargetPaceWithData}
                shouldShowIntervalInputs={shouldShowIntervalInputs}
                onIntervalOutputChange={(intervalId, value) => {
                  const numValue = parseFloat(value)
                  const outputValue = isNaN(numValue) || numValue < 0 ? null : numValue
                  
                  setSessionData(prev => ({
                    ...prev,
                    intervals: prev.intervals.map(interval =>
                      interval.id === intervalId
                        ? { ...interval, actualOutput: outputValue }
                        : interval
                    )
                  }))
                }}
              />
            )}
          </KeyboardAvoidingView>
        )}

        {/* Completion Form or Review Card */}
        {isCompleted && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Workout Complete!</Text>
            
            {saveSuccess ? (
              /* Review Card - shown after successful save */
              <>
            {/* Success Banner */}
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.successText}>Workout Saved Successfully!</Text>
              </View>

                {/* Workout Summary */}
                <Text style={styles.summaryHeader}>Workout Summary</Text>
                
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryStatCard}>
                    <Text style={styles.summaryStatLabel}>Score</Text>
                    <Text style={styles.summaryStatValue}>{savedTotalOutput || '—'}</Text>
                  </View>
                  
                  <View style={styles.summaryStatCard}>
                    <Text style={styles.summaryStatLabel}>Avg HR</Text>
                    <Text style={styles.summaryStatValue}>{savedAverageHeartRate ? `${savedAverageHeartRate} bpm` : '—'}</Text>
                  </View>
                  
                  <View style={styles.summaryStatCard}>
                    <Text style={styles.summaryStatLabel}>Peak HR</Text>
                    <Text style={styles.summaryStatValue}>{savedPeakHeartRate ? `${savedPeakHeartRate} bpm` : '—'}</Text>
                  </View>
                  
                  <View style={styles.summaryStatCard}>
                    <Text style={styles.summaryStatLabel}>RPE</Text>
                    <Text style={styles.summaryStatValue}>{savedRpeValue}/10</Text>
                  </View>
                </View>

                {/* Navigation Buttons */}
                <TouchableOpacity
                  style={styles.reviewNavButton}
                  onPress={handleBackToDashboard}
                >
                  <Ionicons name="arrow-back" size={20} color="#F8FBFE" />
                  <Text style={styles.reviewNavButtonText}>{programId ? 'Back to Day Menu' : 'Back to Training'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.reviewNavButton, styles.reviewNavButtonSecondary]}
                  onPress={navigateToAnalytics}
                >
                  <Ionicons name="stats-chart-outline" size={20} color="#282B34" />
                  <Text style={styles.reviewNavButtonTextSecondary}>View Analytics</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Form - shown before save */
              <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Score (required)</Text>
              <TextInput
                style={styles.input}
                value={totalOutput}
                onChangeText={setTotalOutput}
                placeholder=""
                keyboardType="numeric"
              />
            </View>

            {/* Optional Interval Breakdown */}
            {shouldShowIntervalInputs() && (
              <View style={styles.formGroup}>
                <TouchableOpacity 
                  style={styles.intervalToggle}
                  onPress={() => setExpandedBreakdown(!expandedBreakdown)}
                >
                  <Text style={styles.intervalToggleText}>
                    {expandedBreakdown ? 'Hide Interval Breakdown' : 'Log per Interval (Optional)'}
                  </Text>
                  <Ionicons name={expandedBreakdown ? "chevron-up" : "chevron-down"} size={16} color="#6B7280" />
                </TouchableOpacity>
                
                {expandedBreakdown && (
                  <View style={styles.intervalInputGrid}>
                    {sessionData.intervals.map((interval, idx) => (
                      <View key={idx} style={styles.intervalInputRow}>
                        <Text style={styles.intervalInputLabel}>
                          {interval.type === 'rest' ? 'Rest' : `Round ${interval.roundNumber || idx + 1}`}
                        </Text>
                        <TextInput
                          style={styles.intervalInput}
                          value={intervalScores[idx] || ''}
                          onChangeText={(text) => setIntervalScores(prev => ({ ...prev, [idx]: text }))}
                          placeholder="0"
                          keyboardType="numeric"
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.formGroup}>
              <View style={styles.heartRateRow}>
                <View style={styles.heartRateField}>
                  <Text style={styles.label}>Avg HR</Text>
                  <TextInput
                    style={styles.input}
                    value={averageHeartRate}
                    onChangeText={setAverageHeartRate}
                    placeholder=""
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.heartRateField}>
                  <Text style={styles.label}>Peak HR</Text>
                  <TextInput
                    style={styles.input}
                    value={peakHeartRate}
                    onChangeText={setPeakHeartRate}
                    placeholder=""
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.rpeHeader}>
                <Text style={styles.label}>RPE</Text>
                <Text style={styles.rpeValue}>{rpeValue}/10</Text>
              </View>
              <View style={styles.sliderContainer}>
                <Slider
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={rpeValue}
                  onValueChange={(value) => setRpeValue(value)}
                  minimumTrackTintColor="#FE5858"
                  maximumTrackTintColor="#DAE2EA"
                  thumbTintColor="#FE5858"
                  style={styles.slider}
                />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1 - Very Easy</Text>
                <Text style={styles.sliderLabel}>10 - Max Effort</Text>
              </View>
            </View>

            <View style={styles.completionButtonsContainer}>
              <TouchableOpacity
                style={styles.discardButton}
                onPress={discardWorkout}
                disabled={saving}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.saveButton, 
                      saving && styles.saveButtonDisabled
                ]}
                onPress={saveWorkout}
                    disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Workout</Text>
                )}
              </TouchableOpacity>
            </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// Calculation functions from web app (adapted for mobile)

const calculateFluxPeriods = (baseDuration: number, fluxDuration: number, totalDuration: number): any[] => {
  if (!baseDuration || !fluxDuration || !totalDuration) return [];

  const periods = [];
  let currentTime = 0;
  let periodIndex = 0;

  // Pattern: Base -> Flux -> Base -> Flux -> ...
  while (currentTime < totalDuration) {
    const isBase = periodIndex % 2 === 0;
    const periodDuration = isBase ? baseDuration : fluxDuration;
    const periodEnd = Math.min(currentTime + periodDuration, totalDuration);

    periods.push({
      start: currentTime,
      end: periodEnd,
      type: isBase ? 'base' : 'flux',
      index: Math.floor(periodIndex / 2) // Flux period index (0, 1, 2, ...)
    });

    currentTime = periodEnd;
    periodIndex++;
  }

  return periods;
};

const calculateBurstTimes = (burstTiming: string | null, totalDuration: number, burstDuration: number): Array<{ start: number; end: number }> => {
  if (!burstTiming || !totalDuration) return [];

  // Parse interval from burstTiming (e.g., "every_5_minutes" -> 5)
  const timingMap: Record<string, number> = {
    'every_5_minutes': 5,
    'every_7_minutes': 7,
    'every_10_minutes': 10,
    'every_15_minutes': 15
  };

  const intervalMinutes = timingMap[burstTiming] || 7;
  const intervalSeconds = intervalMinutes * 60;

  const burstTimes = [];
  let currentTime = intervalSeconds; // First burst at intervalSeconds

  while (currentTime <= totalDuration) {
    burstTimes.push({
      start: currentTime,
      end: Math.min(currentTime + burstDuration, totalDuration)
    });
    currentTime += intervalSeconds;
  }

  return burstTimes;
};

const getFluxStatus = (interval: Interval, elapsedTime: number): any => {
  if (!interval || !interval.fluxDuration || !interval.baseDuration) {
    return null;
  }

  const totalDuration = interval.duration;
  const fluxPeriods = calculateFluxPeriods(interval.baseDuration, interval.fluxDuration, totalDuration);

  // Find current period
  const currentPeriod = fluxPeriods.find(p => elapsedTime >= p.start && elapsedTime < p.end);

  if (currentPeriod) {
    const timeRemainingInPeriod = Math.ceil(currentPeriod.end - elapsedTime);

    if (currentPeriod.type === 'flux') {
      // In flux period - calculate current intensity
      const fluxStartIntensity = interval.fluxStartIntensity || 1.0;
      const fluxIncrement = interval.fluxIncrement || 0.1;
      // Use fixed fluxIntensity if available, otherwise calculate progressively
      const currentIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
        ? interval.fluxIntensity
        : fluxStartIntensity + (currentPeriod.index * fluxIncrement);

      return {
        isActive: true,
        currentIntensity: currentIntensity,
        timeRemainingInFlux: timeRemainingInPeriod,
        nextFluxIn: null
      };
    } else {
      // In base period - find next flux
      const nextFluxPeriod = fluxPeriods.find(p => p.type === 'flux' && p.start > elapsedTime);

      if (nextFluxPeriod) {
        return {
          isActive: false,
          currentIntensity: null,
          timeRemainingInFlux: null,
          nextFluxIn: Math.ceil(nextFluxPeriod.start - elapsedTime)
        };
      }
    }
  }

  // No current period found
  return {
    isActive: false,
    currentIntensity: null,
    timeRemainingInFlux: null,
    nextFluxIn: null
  };
};

const getBurstStatus = (interval: Interval, elapsedTime: number): any => {
  if (!interval || !interval.burstTiming || !interval.burstDuration) {
    return null;
  }

  const totalDuration = interval.duration;
  const burstTimes = calculateBurstTimes(interval.burstTiming, totalDuration, interval.burstDuration);

  // Find if currently in a burst
  const activeBurst = burstTimes.find(bt => elapsedTime >= bt.start && elapsedTime < bt.end);

  if (activeBurst) {
    return {
      isActive: true,
      timeRemainingInBurst: Math.ceil(activeBurst.end - elapsedTime),
      nextBurstIn: null
    };
  }

  // Find next burst
  const nextBurst = burstTimes.find(bt => elapsedTime < bt.start);

  if (nextBurst) {
    return {
      isActive: false,
      timeRemainingInBurst: null,
      nextBurstIn: Math.ceil(nextBurst.start - elapsedTime)
    };
  }

  // No more bursts remaining
  return {
    isActive: false,
    timeRemainingInBurst: null,
    nextBurstIn: null
  };
};

// These functions will be defined inside the component to access state

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
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8FBFE',
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
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FE5858',
    borderWidth: 1,
    borderColor: '#282B34',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#F8FBFE',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#282B34',
  },
  dayLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 16,
    textAlign: 'center',
  },
  equipmentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#282B34',
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    color: '#374151',
  },
  descriptionContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 16,
  },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
  modalityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  modalityButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  modalityButtonText: {
    color: '#282B34',
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FE5858',
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  timerInfoContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  timerWorkoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  timerPhase: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  timerGoal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  timerRound: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  timerStartContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  backToPreviewButton: {
    backgroundColor: '#DAE2EA',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#282B34',
  },
  backToPreviewButtonText: {
    color: '#282B34',
    fontSize: 16,
    fontWeight: '600',
  },
  timerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 24,
  },
  restScoreContainer: {
    marginTop: 8,
    alignItems: 'center',
    width: '100%',
  },
  restScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  restScoreInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '80%',
  },
  restScoreInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#282B34',
    textAlign: 'center',
  },
  restScoreSaveButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 12,
  },
  intervalToggleText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  intervalInputGrid: {
    gap: 8,
    marginBottom: 16,
  },
  intervalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FBFE',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  intervalInputLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  intervalInput: {
    width: 80,
    height: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#282B34',
    textAlign: 'center',
  },
  stopButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FE5858',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skipRoundButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D97706',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 32,
    alignSelf: 'center',
  },
  controlsStack: {
    gap: 12,
  },
  startButtonFull: {
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  startButtonFullText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pauseButtonFull: {
    backgroundColor: '#DAE2EA',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  pauseButtonFullText: {
    color: '#282B34',
    fontSize: 16,
    fontWeight: '600',
  },
  resumeButtonFull: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  resumeButtonFullText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButtonFull: {
    backgroundColor: '#282B34',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resetButtonFullText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  startWorkoutButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  startWorkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  heartRateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heartRateField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#282B34',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#282B34',
  },
  rpeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rpeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FE5858',
  },
  sliderContainer: {
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  completionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  discardButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9CA3AF',
  },
  discardButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonSuccess: {
    backgroundColor: '#10B981',
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 16,
    marginTop: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryStatCard: {
    width: '48%',
    backgroundColor: '#F8FBFE',
    borderWidth: 1,
    borderColor: '#DAE2EA',
    borderRadius: 8,
    padding: 12,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginTop: 4,
  },
  reviewNavButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#FE5858',
    borderWidth: 1,
    borderColor: '#282B34',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  reviewNavButtonSecondary: {
    backgroundColor: '#FFFFFF',
  },
  reviewNavButtonText: {
    color: '#F8FBFE',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewNavButtonTextSecondary: {
    color: '#282B34',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryButtonActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FE5858',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  equipmentSubMenu: {
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#282B34',
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  equipmentButtonActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FE5858',
  },
  equipmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  equipmentButtonTextActive: {
    color: '#FFFFFF',
  },
  unitSelectionCard: {
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: '#282B34',
    marginTop: 12,
    marginBottom: 12,
  },
  unitSelectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 16,
    textAlign: 'center',
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  unitButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  unitButtonActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FE5858',
  },
  unitButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#282B34',
    textAlign: 'center',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  baselineWarning: {
    backgroundColor: '#DAE2EA',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#282B34',
    marginBottom: 12,
    lineHeight: 20,
  },
  warningSubtext: {
    fontSize: 13,
    color: '#282B34',
    marginBottom: 12,
    lineHeight: 20,
  },
  warningCTA: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  nextButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    backgroundColor: '#DAE2EA',
    borderRadius: 8,
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  changeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#FE5858',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FE5858',
    borderRadius: 4,
  },
  changeButtonText: {
    fontSize: 12,
    color: '#FE5858',
    fontWeight: '600',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#FE5858',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  collapsibleHeaderText: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  breakdownContent: {
    padding: 16,
    backgroundColor: '#F8FBFE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  blockBreakdown: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  blockHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  blockDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  blockDetailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  roundCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DAE2EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roundHeader: {
    marginBottom: 10,
  },
  roundBadge: {
    backgroundColor: '#FE5858',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roundBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  roundDetails: {
    gap: 8,
  },
  roundDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  roundDetailItem: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    padding: 10,
    borderRadius: 6,
  },
  roundDetailLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  roundDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  roundGoalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FE5858',
  },
  roundRestItem: {
    backgroundColor: '#F8FBFE',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  roundRestLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  roundRestValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  effortBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#FE5858',
  },
  effortBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FBFE',
  },
  historyContent: {
    padding: 16,
    backgroundColor: '#F8FBFE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyItem: {
    padding: 16,
    backgroundColor: '#F8FBFE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  historyPace: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#282B34',
    backgroundColor: '#F8FBFE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  noHistoryText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 12,
  },
  noHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  inlineLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  inlineLoadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  summaryCard: {
    backgroundColor: '#DAE2EA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#282B34',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryContent: {
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  summaryMetricLabel: {
    fontSize: 12,
    color: '#282B34',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: '500',
  },
  summaryMetricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#282B34',
  },
  summaryMetricUnits: {
    fontSize: 16,
    fontWeight: '500',
  },
  intensityComparisonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FE5858',
    marginTop: 12,
  },
  intensityComparisonLabel: {
    fontSize: 12,
    color: '#282B34',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    fontWeight: '500',
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  intensityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#282B34',
    width: 96,
  },
  intensityBarContainer: {
    flex: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
  },
  intensityBar: {
    height: '100%',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  intensityBarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  intensityPercentage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '500',
  },
  historyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  historyBadge: {
    backgroundColor: '#FE5858',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBadgeText: {
    color: '#F8FBFE',
    fontSize: 12,
    fontWeight: '600',
  },
  historyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    gap: 12,
  },
  historyMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  performanceRatioBadge: {
    backgroundColor: '#FE5858',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  performanceRatioText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FBFE',
  },
  actualPaceBadge: {
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  actualPaceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#282B34',
  },
  performanceSummaryCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#DAE2EA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FE5858',
  },
  performanceSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  performanceSummaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  performanceSummaryMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startPreviewButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  startPreviewButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  completionText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  programHeader: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  monthsContainer: {
    gap: 16,
    marginTop: 16,
  },
  monthCard: {
    backgroundColor: '#DAE2EA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FE5858',
  },
  monthCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  monthCardCompletion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  weeksContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  weekTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FE5858',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  weekTabActive: {
    backgroundColor: '#DAE2EA',
  },
  weekTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  weekTabTextActive: {
    fontWeight: '700',
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  weekHeaderBar: {
    width: 4,
    height: 24,
    backgroundColor: '#FE5858',
    borderRadius: 2,
  },
  weekHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  weekCompletionBadge: {
    backgroundColor: '#FE5858',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  weekCompletionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  daysContainer: {
    gap: 12,
    marginTop: 16,
  },
  dayCard: {
    backgroundColor: '#DAE2EA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FE5858',
  },
  dayCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  dayCardType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  dayCardStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  // Week-focused view styles
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
  programNameInCard: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  programContext: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  progressBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dashboardProgressBarContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  dashboardProgressBar: {
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
  dashboardScrollView: {
    flex: 1,
  },
  dashboardScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statusDisplay: {
    backgroundColor: 'rgba(254, 88, 88, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
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
  weekNavCard: {
    marginBottom: 16,
    padding: 16,
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
  workoutDayType: {
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
})

