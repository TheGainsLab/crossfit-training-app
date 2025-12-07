import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import Svg, { Circle, Text as SvgText, G } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import engineDatabaseService from '@/lib/engine/databaseService'

interface Interval {
  id: number
  type: string
  duration: number
  restDuration?: number
  description?: string
  blockNumber?: number | null
  roundNumber?: number | null
  paceRange?: any
  completed?: boolean
  workCompleted?: boolean
}

interface SessionData {
  intervals: Interval[]
  totalOutput: number
  averagePace: number
  averageHeartRate: number | null
  peakHeartRate: number | null
  perceivedExertion: number | null
}

export default function EnginePage() {
  const router = useRouter()
  const { day } = useLocalSearchParams<{ day?: string }>()
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [programVersion, setProgramVersion] = useState<string>('5-day')
  
  // View state (equipment -> preview -> active)
  const [currentView, setCurrentView] = useState<'equipment' | 'preview' | 'active'>('equipment')
  
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
  const [expandedBreakdown, setExpandedBreakdown] = useState(true)
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
  
  // Completion form
  const [totalOutput, setTotalOutput] = useState('')
  const [averageHeartRate, setAverageHeartRate] = useState('')
  const [peakHeartRate, setPeakHeartRate] = useState('')
  const [rpeValue, setRpeValue] = useState(5)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
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
    { value: 'cal', label: 'Calories' },
    { value: 'meters', label: 'Meters' },
    { value: 'kilometers', label: 'Kilometers' },
    { value: 'watts', label: 'Watts' },
    { value: 'miles', label: 'Miles' }
  ]

  useEffect(() => {
    initializeDatabase()
  }, [])

  useEffect(() => {
    if (connected && day) {
      loadWorkout()
    }
  }, [day, connected])

  // Set initial view to equipment selection when workout loads
  useEffect(() => {
    if (workout) {
      setCurrentView('equipment')
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

  // Check if baseline matches selected unit
  useEffect(() => {
    if (selectedModality && timeTrialSelectedUnit) {
      const baseline = baselines[selectedModality]
      const matches = baseline && baseline.units === timeTrialSelectedUnit
      setHasMatchingBaseline(!!matches)
    } else {
      setHasMatchingBaseline(false)
    }
  }, [selectedModality, timeTrialSelectedUnit, baselines])

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
      const baseline = await engineDatabaseService.loadTimeTrialBaselines(selectedModality) as any
      if (baseline && baseline.calculated_rpm) {
        setBaselines(prev => ({
          ...prev,
          [selectedModality]: {
            baseline: baseline.calculated_rpm,
            units: baseline.units || 'cal',
            date: baseline.date
          }
        }))
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
      )
      
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
      const programType = version === '3-day' ? 'main_3day' : 'main_5day'
      const dayNumber = day ? parseInt(day) : 1

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
        description: workoutData?.description || 'Workout',
        blockNumber: null,
        roundNumber: null
      }]
    }

    const dayType = workoutData.day_type
    const intervals: Interval[] = []
    let intervalId = 1
    
    // Process all blocks
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

      // Handle different day types
      if (dayType === 'endurance' || dayType === 'time_trial' || dayType === 'threshold') {
        // Single continuous interval
        intervals.push({
          id: intervalId++,
          type: dayType,
          duration: workDuration,
          restDuration: 0,
          description: getWorkoutTypeDisplayName(dayType),
          blockNumber: blockNumber,
          roundNumber: 1,
          paceRange: paceRange
        })
      } else {
        // Standard interval workout
        for (let i = 0; i < rounds; i++) {
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: paceRange
          })
        }
      }
    })
    
    // If no intervals created, create a default one
    if (intervals.length === 0) {
      intervals.push({
        id: 1,
        type: dayType,
        duration: workoutData.total_work_time || 1200,
        description: getWorkoutTypeDisplayName(dayType),
        blockNumber: null,
        roundNumber: null
      })
    }
    
    return intervals
  }

  const getWorkoutTypeDisplayName = (dayType: string): string => {
    const displayNames: Record<string, string> = {
      'endurance': 'Endurance',
      'time_trial': 'Time Trial',
      'threshold': 'Threshold',
      'atomic': 'Atomic',
      'towers': 'Towers',
      'polarized': 'Polarized',
      'flux': 'Flux',
      'devour': 'Devour',
      'ascending': 'Ascending',
      'afterburner': 'Afterburner',
      'max_aerobic_power': 'Max Aerobic Power'
    }
    return displayNames[dayType] || dayType.charAt(0).toUpperCase() + dayType.slice(1)
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
        completeCurrentInterval()
      }
    } else {
      // Rest phase completed - move to next interval
      completeCurrentInterval()
    }
  }

  const completeCurrentInterval = () => {
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
    setCurrentView('preview')
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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
    setCurrentView('preview')
    
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

      const sessionDataToSave = {
        program_day: parseInt(day || '1'),
        program_version: programVersion,
        program_day_number: workout?.day_number || parseInt(day || '1'),
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
          total_rest_time: totalRestTime
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
        program_day_number: sessionDataToSave.program_day_number
      })

      const { error } = await supabase
        .from('workout_sessions')
        .insert({
          ...sessionDataToSave,
          user_id: userId
        } as any)

      if (error) throw error

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

      // Show success state
      setSaveSuccess(true)
      
      // Auto-navigate back after showing success
      setTimeout(() => {
        router.back()
      }, 1500)
    } catch (err) {
      console.error('Error saving workout:', err)
      Alert.alert('Error', 'Failed to save workout. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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
          onPress={() => router.back()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getWorkoutTypeDisplayName(workout?.day_type || 'conditioning')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Workout Info */}
        <View style={styles.card}>
          <Text style={styles.dayLabel}>Day {workout.day_number}</Text>
          <Text style={styles.dayType}>{getWorkoutTypeDisplayName(workout.day_type || 'conditioning')}</Text>
          
          {/* Equipment display - only show in preview view */}
          {currentView === 'preview' && selectedModality && (
            <TouchableOpacity
              onPress={() => {
                setSelectedModality('')
                setCurrentView('equipment')
              }}
              style={{ marginTop: 8 }}
            >
              <Text style={styles.equipmentText}>
                {modalities.find(m => m.value === selectedModality)?.label || 'Not selected'}
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
        {currentView === 'equipment' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Modality</Text>
            {selectedModality && timeTrialSelectedUnit && (
              <Text style={styles.previouslySelectedHint}>
                Previously used: {modalities.find(m => m.value === selectedModality)?.label} • {scoreUnits.find(u => u.value === timeTrialSelectedUnit)?.label}
              </Text>
            )}
            
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
                      {category === 'Rowing' ? 'Row' : category === 'Cycling' ? 'Cycle' : category}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={16} color="#FE5858" />}
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
            
            {/* Baseline Warning - show when unit selected but no matching baseline */}
            {selectedModality && timeTrialSelectedUnit && !hasMatchingBaseline && (
              <View style={styles.baselineWarning}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning" size={24} color="#F59E0B" />
                  <Text style={styles.warningTitle}>No Time Trial Baseline</Text>
                </View>
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
                onPress={() => setCurrentView('preview')}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Preview View */}
        {currentView === 'preview' && selectedModality && (
          <>
            {/* Workout Breakdown Section */}
            <TouchableOpacity
              style={[styles.collapsibleHeader, { marginTop: 16 }]}
              onPress={() => setExpandedBreakdown(!expandedBreakdown)}
            >
              <Text style={styles.collapsibleHeaderText}>Workout Breakdown</Text>
              <Ionicons
                name={expandedBreakdown ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#3B82F6"
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
                                  <Text style={styles.roundDetailLabel}>⏱️ Work</Text>
                                  <Text style={styles.roundDetailValue}>{formatTime(workDuration)}</Text>
                                </View>
                                <View style={styles.roundDetailItem}>
                                  <Text style={styles.roundDetailLabel}>🎯 Goal</Text>
                                  <Text style={styles.roundGoalValue}>{goalDisplay}</Text>
                                </View>
                              </View>
                              
                              {restDuration > 0 && (
                                <View style={styles.roundRestRow}>
                                  <Text style={styles.roundRestLabel}>⏸️ Rest</Text>
                                  <Text style={styles.roundRestValue}>{formatTime(restDuration)}</Text>
                                </View>
                              )}
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
              style={styles.collapsibleHeader}
              onPress={() => setExpandedHistory(!expandedHistory)}
            >
              <Text style={styles.collapsibleHeaderText}>Workout History</Text>
              <Ionicons
                name={expandedHistory ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#3B82F6"
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
                  workoutHistory.map((session, index) => (
                    <View key={index} style={styles.historyItem}>
                      <Text style={styles.historyDate}>
                        {session.date ? new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                      </Text>
                      {session.actual_pace && (
                        <Text style={styles.historyPace}>
                          {session.actual_pace.toFixed(1)} {session.units || 'units'}/min
                        </Text>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.noHistoryText}>No previous history</Text>
                )}
              </View>
            )}
            
            {/* Start Button */}
            <TouchableOpacity
              style={styles.startPreviewButton}
              onPress={() => {
                setCurrentView('active')
                // Initialize timer state but don't start counting yet
                if (sessionData.intervals.length > 0) {
                  setTimeRemaining(sessionData.intervals[0].duration)
                  setCurrentInterval(0)
                  setCurrentPhase('work')
                }
                // Don't set isActive to true - let user click Start on timer screen
              }}
            >
              <Text style={styles.startPreviewButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Workout Timer - Only show in active view */}
        {selectedModality && currentView === 'active' && (
          <>
            {/* DEV ONLY: Skip to End Button */}
            {__DEV__ && (isActive || isPaused) && (
              <TouchableOpacity 
                style={styles.devSkipButton} 
                onPress={skipToEnd}
              >
                <Text style={styles.devSkipButtonText}>⚡ Skip to End (Testing)</Text>
              </TouchableOpacity>
            )}

            {/* Workout Info Above Timer */}
            <View style={styles.timerInfoContainer}>
              <Text style={styles.timerWorkoutTitle}>
                {getWorkoutTypeDisplayName(workout.day_type || 'conditioning')}
              </Text>
              
              {/* Phase, Goal, and Round info - only show when workout has started */}
              {(isActive || isPaused || isCompleted) && (
                <>
                  <Text style={[
                    styles.timerPhase, 
                    { color: isPaused ? '#F59E0B' : currentPhase === 'work' ? '#10B981' : '#6B7280' }
                  ]}>
                    {isPaused ? 'PAUSED' : currentPhase === 'work' ? 'Work' : 'Rest'}
                  </Text>
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
            </View>

            {/* Start Button and Back to Preview - Only show when not started */}
            {!isActive && !isPaused && !isCompleted && (
              <View style={styles.timerStartContainer}>
                <TouchableOpacity 
                  style={styles.backToPreviewButton} 
                  onPress={() => setCurrentView('preview')}
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

            {/* Ring Timer */}
            <View style={styles.timerContainer}>
              <Svg width={192} height={192} viewBox="0 0 192 192">
                <G transform="rotate(-90 96 96)">
                  {/* Background circle */}
                  <Circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Progress circle */}
                  {(() => {
                    const totalDuration = currentInt?.duration || 600
                    const progress = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0
                    const circumference = 2 * Math.PI * 88
                    const offset = circumference - (progress / 100) * circumference
                    // Use green for work phase, gray for rest/completed
                    const strokeColor = isCompleted ? '#10B981' : (currentPhase === 'work' && isActive) ? '#10B981' : '#6B7280'
                    
                    return (
                      <Circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke={strokeColor}
                        strokeWidth="8"
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
                  x="96"
                  y="110"
                  textAnchor="middle"
                  fontSize="48"
                  fontWeight={700}
                  fill="#111827"
                >
                  {formatTime(timeRemaining)}
                </SvgText>
              </Svg>
            </View>

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
              </View>
            )}
          </>
        )}

        {/* Completion Form */}
        {isCompleted && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Workout Complete!</Text>
            
            {/* Success Banner */}
            {saveSuccess && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.successText}>Workout Saved Successfully!</Text>
              </View>
            )}
            
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
              <Text style={styles.label}>RPE (1-10): {rpeValue}</Text>
              <View style={styles.rpeContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.rpeButton,
                      rpeValue === value && styles.rpeButtonActive
                    ]}
                    onPress={() => setRpeValue(value)}
                  >
                    <Text style={[
                      styles.rpeButtonText,
                      rpeValue === value && styles.rpeButtonTextActive
                    ]}>
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                  saving && styles.saveButtonDisabled,
                  saveSuccess && styles.saveButtonSuccess
                ]}
                onPress={saveWorkout}
                disabled={saving || saveSuccess}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : saveSuccess ? (
                  <View style={styles.saveButtonContent}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Saved!</Text>
                  </View>
                ) : (
                  <Text style={styles.saveButtonText}>Save Workout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
    color: '#FE5858',
    fontSize: 18,
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
    borderWidth: 2,
    borderColor: '#DAE2EA',
  },
  dayLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  dayType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FE5858',
    marginBottom: 16,
    textTransform: 'capitalize',
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
  previouslySelectedHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: -12,
    marginBottom: 16,
    fontStyle: 'italic',
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
  devSkipButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D97706',
  },
  devSkipButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
    width: 192,
    height: 192,
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
  rpeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  rpeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  rpeButtonActive: {
    backgroundColor: '#FE5858',
  },
  rpeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  rpeButtonTextActive: {
    color: '#FFFFFF',
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
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#DAE2EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryButtonActive: {
    borderColor: '#FE5858',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  categoryButtonTextActive: {
    color: '#282B34',
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
    backgroundColor: '#DAE2EA',
  },
  equipmentButtonActive: {
    borderColor: '#FE5858',
  },
  equipmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  equipmentButtonTextActive: {
    color: '#282B34',
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
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#DAE2EA',
  },
  unitButtonActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FE5858',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    textAlign: 'center',
  },
  unitButtonTextActive: {
    color: '#F8FBFE',
  },
  baselineWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  warningText: {
    fontSize: 14,
    color: '#78350F',
    marginBottom: 12,
    lineHeight: 20,
  },
  warningSubtext: {
    fontSize: 13,
    color: '#78350F',
    marginBottom: 12,
    lineHeight: 20,
  },
  warningCTA: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
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
    borderLeftColor: '#3B82F6',
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
    backgroundColor: '#3B82F6',
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
    color: '#3B82F6',
  },
  roundRestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  roundRestLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  roundRestValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
})

