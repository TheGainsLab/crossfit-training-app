import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { createClient } from '@/lib/supabase/client'

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
  
  // Modality selection
  const [selectedModality, setSelectedModality] = useState<string>('')
  const [showModalitySelection, setShowModalitySelection] = useState(false)
  
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
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentPhaseRef = useRef<'work' | 'rest'>('work')
  const currentIntervalRef = useRef<number>(0)

  const modalities = [
    { value: 'c2_row_erg', label: 'C2 Rowing Erg' },
    { value: 'rogue_row_erg', label: 'Rogue Rowing Erg' },
    { value: 'c2_bike_erg', label: 'C2 Bike Erg' },
    { value: 'echo_bike', label: 'Echo Bike' },
    { value: 'assault_bike', label: 'Assault Bike' },
    { value: 'c2_ski_erg', label: 'C2 Ski Erg' },
    { value: 'assault_runner', label: 'Assault Runner' },
    { value: 'motorized_treadmill', label: 'Motorized Treadmill' },
    { value: 'outdoor_run', label: 'Outdoor Run' },
  ]

  useEffect(() => {
    loadWorkout()
  }, [day])

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

      setUserId(userData.id)
      const version = userData.current_program === '3-day' ? '3-day' : '5-day'
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
      'afterburner': 'Afterburner'
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
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const saveWorkout = async () => {
    if (!userId || !selectedModality || !totalOutput) {
      Alert.alert('Missing Information', 'Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      
      const totalOutputNum = parseFloat(totalOutput)
      const avgHR = averageHeartRate ? parseFloat(averageHeartRate) : null
      const peakHR = peakHeartRate ? parseFloat(peakHeartRate) : null
      
      // Calculate average pace (simplified - would need baseline for actual calculation)
      const avgPace = totalOutputNum / (sessionData.intervals.reduce((sum, int) => sum + int.duration, 0) / 60)
      
      // Calculate total work and rest time
      const totalWorkTime = sessionData.intervals.reduce((sum, int) => sum + int.duration, 0)
      const totalRestTime = sessionData.intervals.reduce((sum, int) => sum + (int.restDuration || 0), 0)
      const avgWorkRestRatio = totalRestTime > 0 ? totalWorkTime / totalRestTime : null

      const sessionDataToSave = {
        program_day: parseInt(day || '1'),
        program_version: programVersion,
        program_day_number: parseInt(day || '1'),
        workout_id: workout?.id,
        day_type: workout?.day_type,
        date: new Date().toISOString().split('T')[0],
        completed: true,
        total_output: totalOutputNum,
        actual_pace: avgPace,
        target_pace: null,
        performance_ratio: null,
        modality: selectedModality,
        units: 'cal', // Default - would need to get from user preferences
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

      const { error } = await supabase
        .from('workout_sessions')
        .insert({
          ...sessionDataToSave,
          user_id: userId
        })

      if (error) throw error

      Alert.alert('Success', 'Workout saved successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ])
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
        <Text style={styles.headerTitle}>Engine Conditioning</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Workout Info */}
        <View style={styles.card}>
          <Text style={styles.dayLabel}>Day {workout.day_number}</Text>
          <Text style={styles.dayType}>{getWorkoutTypeDisplayName(workout.day_type || 'conditioning')}</Text>
          
          {workout.duration && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Duration:</Text>
              <Text style={styles.infoValue}>{workout.duration} minutes</Text>
            </View>
          )}

          {workout.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{workout.description}</Text>
            </View>
          )}
        </View>

        {/* Modality Selection */}
        {!selectedModality && !isActive && !isCompleted && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Modality</Text>
            <View style={styles.modalityGrid}>
              {modalities.map(modality => (
                <TouchableOpacity
                  key={modality.value}
                  style={styles.modalityButton}
                  onPress={() => setSelectedModality(modality.value)}
                >
                  <Text style={styles.modalityButtonText}>{modality.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Workout Timer */}
        {selectedModality && (isActive || isPaused || isCompleted) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {currentInt?.description || `Interval ${currentInterval + 1}`}
            </Text>
            
            {/* Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {currentInterval + 1} / {sessionData.intervals.length}
              </Text>
            </View>

            {/* Timer */}
            <View style={styles.timerContainer}>
              <Text style={styles.timerLabel}>{currentPhase === 'work' ? 'Work' : 'Rest'}</Text>
              <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
            </View>

            {/* Controls */}
            {!isCompleted && (
              <View style={styles.controlsContainer}>
                {!isActive && !isPaused ? (
                  <TouchableOpacity style={styles.startButton} onPress={startWorkout}>
                    <Text style={styles.startButtonText}>Start Workout</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {isActive ? (
                      <TouchableOpacity style={styles.pauseButton} onPress={pauseWorkout}>
                        <Text style={styles.pauseButtonText}>Pause</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.resumeButton} onPress={resumeWorkout}>
                        <Text style={styles.resumeButtonText}>Resume</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.resetButton} onPress={resetWorkout}>
                      <Text style={styles.resetButtonText}>Reset</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Completion Form */}
        {isCompleted && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Workout Complete!</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Total Output *</Text>
              <TextInput
                style={styles.input}
                value={totalOutput}
                onChangeText={setTotalOutput}
                placeholder="Enter total output"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Average Heart Rate</Text>
              <TextInput
                style={styles.input}
                value={averageHeartRate}
                onChangeText={setAverageHeartRate}
                placeholder="Optional"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Peak Heart Rate</Text>
              <TextInput
                style={styles.input}
                value={peakHeartRate}
                onChangeText={setPeakHeartRate}
                placeholder="Optional"
                keyboardType="numeric"
              />
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

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
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
        )}

        {/* Start Button */}
        {selectedModality && !isActive && !isPaused && !isCompleted && (
          <TouchableOpacity style={styles.startWorkoutButton} onPress={startWorkout}>
            <Text style={styles.startWorkoutButtonText}>Start Engine Workout</Text>
          </TouchableOpacity>
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
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerLabel: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FE5858',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  startButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  pauseButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  pauseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resumeButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resumeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  saveButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
})

