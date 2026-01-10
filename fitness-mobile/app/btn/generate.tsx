import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import { saveBTNWorkouts } from '@/lib/api/btn'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// Types
interface GeneratedWorkout {
  name: string
  format: string
  timeDomain: string
  exercises: Array<{
    name: string
    reps: number
    weight?: string
  }>
  rounds?: number
  amrapTime?: number
  pattern?: string
  medianScore?: string
  excellentScore?: string
}

type BarbellFilter = 'any' | 'required' | 'excluded'
type DumbbellFilter = 'any' | 'required' | 'excluded'
type CardioFilter = 'any' | 'rower' | 'bike' | 'ski' | 'none'
type ExerciseCountFilter = 'any' | '2' | '3'
type WorkoutFormatFilter = 'any' | 'for_time' | 'amrap' | 'rounds_for_time'

const TIME_DOMAINS = [
  '1:00 - 5:00',
  '5:00 - 10:00',
  '10:00 - 15:00',
  '15:00 - 20:00',
  '20:00+',
]

export default function BTNGeneratePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [saved, setSaved] = useState<Set<number>>(new Set())

  // Filter states
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [barbellFilter, setBarbellFilter] = useState<BarbellFilter>('any')
  const [dumbbellFilter, setDumbbellFilter] = useState<DumbbellFilter>('any')
  const [cardioFilter, setCardioFilter] = useState<CardioFilter>('any')
  const [exerciseCount, setExerciseCount] = useState<ExerciseCountFilter>('any')
  const [workoutFormat, setWorkoutFormat] = useState<WorkoutFormatFilter>('any')
  const [includeExercises, setIncludeExercises] = useState<string[]>([])
  const [excludeExercises, setExcludeExercises] = useState<string[]>([])

  // Exercise picker states
  const [availableExercises, setAvailableExercises] = useState<string[]>([])
  const [showIncludePicker, setShowIncludePicker] = useState(false)
  const [showExcludePicker, setShowExcludePicker] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')

  // Generated workouts
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([])

  useEffect(() => {
    checkAccess()
    loadExercises()
  }, [])

  const checkAccess = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/auth/signin')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('auth_id', user.id)
        .single()

      if (userData?.subscription_tier === 'BTN') {
        setHasAccess(true)
      } else {
        Alert.alert('Access Denied', 'BTN subscription required', [
          { text: 'OK', onPress: () => router.back() },
        ])
      }
    } catch (error) {
      console.error('Error checking access:', error)
      Alert.alert('Error', 'Failed to verify access')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const loadExercises = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) return

      // Call the exercises API
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

  const toggleDomain = (domain: string) => {
    // AMRAP requires 6+ min, so 1-5 min domain is incompatible
    if (workoutFormat === 'amrap' && domain === '1:00 - 5:00') return

    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    )
  }

  const isTimeDomainDisabled = (domain: string) => {
    return workoutFormat === 'amrap' && domain === '1:00 - 5:00'
  }

  const handleFormatChange = (format: WorkoutFormatFilter) => {
    setWorkoutFormat(format)
    if (format === 'amrap') {
      setSelectedDomains(prev => prev.filter(d => d !== '1:00 - 5:00'))
    }
  }

  const handleBarbellChange = (value: BarbellFilter) => {
    setBarbellFilter(value)
    // Barbell + Dumbbell can't both be required
    if (value === 'required' && dumbbellFilter === 'required') {
      setDumbbellFilter('any')
    }
  }

  const handleDumbbellChange = (value: DumbbellFilter) => {
    setDumbbellFilter(value)
    // Barbell + Dumbbell can't both be required
    if (value === 'required' && barbellFilter === 'required') {
      setBarbellFilter('any')
    }
  }

  const generateWorkouts = async () => {
    setGenerating(true)
    setSaved(new Set())

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert('Error', 'Please sign in to generate workouts')
        return
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/btn/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          selectedDomains: selectedDomains.length > 0 ? selectedDomains : undefined,
          barbellFilter,
          dumbbellFilter,
          cardioFilter,
          exerciseCount,
          workoutFormat,
          includeExercises: includeExercises.length > 0 ? includeExercises : undefined,
          excludeExercises: excludeExercises.length > 0 ? excludeExercises : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate workouts')
      }

      const data = await response.json()
      setWorkouts(data.workouts || [])

      if (data.workouts?.length === 0) {
        Alert.alert('No Workouts', 'Could not generate workouts with the selected filters. Try adjusting your selections.')
      }
    } catch (error: any) {
      console.error('Error generating workouts:', error)
      Alert.alert('Error', error.message || 'Failed to generate workouts')
    } finally {
      setGenerating(false)
    }
  }

  const saveWorkout = async (workout: GeneratedWorkout, index: number) => {
    setSaving(prev => new Set(prev).add(index))

    try {
      await saveBTNWorkouts([workout])
      setSaved(prev => new Set(prev).add(index))
      Alert.alert('Saved!', 'Workout saved to your list')
    } catch (error: any) {
      console.error('Error saving workout:', error)
      Alert.alert('Error', error.message || 'Failed to save workout')
    } finally {
      setSaving(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  const addIncludeExercise = (exercise: string) => {
    if (!includeExercises.includes(exercise)) {
      setIncludeExercises(prev => [...prev, exercise])
    }
    setShowIncludePicker(false)
    setExerciseSearch('')
  }

  const removeIncludeExercise = (exercise: string) => {
    setIncludeExercises(prev => prev.filter(e => e !== exercise))
  }

  const addExcludeExercise = (exercise: string) => {
    if (!excludeExercises.includes(exercise)) {
      setExcludeExercises(prev => [...prev, exercise])
    }
    setShowExcludePicker(false)
    setExerciseSearch('')
  }

  const removeExcludeExercise = (exercise: string) => {
    setExcludeExercises(prev => prev.filter(e => e !== exercise))
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
      </View>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Generate Workouts</Text>
          <Text style={styles.subtitle}>Customize your workout preferences</Text>
        </View>

        {/* Time Domain Filter */}
        <Card style={styles.filterCard}>
          <Text style={styles.filterTitle}>Time Domain</Text>
          <Text style={styles.filterHint}>Select one or more (empty = all)</Text>
          <View style={styles.chipContainer}>
            {TIME_DOMAINS.map(domain => (
              <TouchableOpacity
                key={domain}
                style={[
                  styles.chip,
                  selectedDomains.includes(domain) && styles.chipSelected,
                  isTimeDomainDisabled(domain) && styles.chipDisabled,
                ]}
                onPress={() => toggleDomain(domain)}
                disabled={isTimeDomainDisabled(domain)}
              >
                <Text style={[
                  styles.chipText,
                  selectedDomains.includes(domain) && styles.chipTextSelected,
                  isTimeDomainDisabled(domain) && styles.chipTextDisabled,
                ]}>
                  {domain}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Equipment Filters */}
        <Card style={styles.filterCard}>
          <Text style={styles.filterTitle}>Equipment</Text>

          {/* Barbell */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Barbell</Text>
            <View style={styles.segmentedControl}>
              {(['any', 'required', 'excluded'] as BarbellFilter[]).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.segmentButton,
                    barbellFilter === option && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleBarbellChange(option)}
                >
                  <Text style={[
                    styles.segmentText,
                    barbellFilter === option && styles.segmentTextActive,
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Dumbbell */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Dumbbell</Text>
            <View style={styles.segmentedControl}>
              {(['any', 'required', 'excluded'] as DumbbellFilter[]).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.segmentButton,
                    dumbbellFilter === option && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleDumbbellChange(option)}
                >
                  <Text style={[
                    styles.segmentText,
                    dumbbellFilter === option && styles.segmentTextActive,
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cardio */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Cardio</Text>
            <View style={styles.segmentedControl}>
              {(['any', 'rower', 'bike', 'ski', 'none'] as CardioFilter[]).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonSmall,
                    cardioFilter === option && styles.segmentButtonActive,
                  ]}
                  onPress={() => setCardioFilter(option)}
                >
                  <Text style={[
                    styles.segmentText,
                    styles.segmentTextSmall,
                    cardioFilter === option && styles.segmentTextActive,
                  ]}>
                    {option === 'none' ? 'None' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Format & Count */}
        <Card style={styles.filterCard}>
          <Text style={styles.filterTitle}>Workout Structure</Text>

          {/* Format */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Format</Text>
            <View style={styles.segmentedControl}>
              {[
                { value: 'any', label: 'Any' },
                { value: 'for_time', label: 'For Time' },
                { value: 'amrap', label: 'AMRAP' },
                { value: 'rounds_for_time', label: 'RFT' },
              ].map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.segmentButton,
                    workoutFormat === option.value && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleFormatChange(option.value as WorkoutFormatFilter)}
                >
                  <Text style={[
                    styles.segmentText,
                    workoutFormat === option.value && styles.segmentTextActive,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Exercise Count */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Exercises</Text>
            <View style={styles.segmentedControl}>
              {[
                { value: 'any', label: 'Any' },
                { value: '2', label: 'Couplet (2)' },
                { value: '3', label: 'Triplet (3)' },
              ].map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.segmentButton,
                    exerciseCount === option.value && styles.segmentButtonActive,
                  ]}
                  onPress={() => setExerciseCount(option.value as ExerciseCountFilter)}
                >
                  <Text style={[
                    styles.segmentText,
                    exerciseCount === option.value && styles.segmentTextActive,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Include/Exclude Exercises */}
        <Card style={styles.filterCard}>
          <Text style={styles.filterTitle}>Custom Exercises</Text>
          <Text style={styles.filterHint}>Custom selections override equipment filters</Text>

          {/* Must Include */}
          <View style={styles.exerciseSection}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.filterLabel}>Must Include</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowIncludePicker(true)}
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {includeExercises.length > 0 && (
              <View style={styles.chipContainer}>
                {includeExercises.map(exercise => (
                  <TouchableOpacity
                    key={exercise}
                    style={styles.exerciseChip}
                    onPress={() => removeIncludeExercise(exercise)}
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
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowExcludePicker(true)}
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {excludeExercises.length > 0 && (
              <View style={styles.chipContainer}>
                {excludeExercises.map(exercise => (
                  <TouchableOpacity
                    key={exercise}
                    style={[styles.exerciseChip, styles.excludeChip]}
                    onPress={() => removeExcludeExercise(exercise)}
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
            title={generating ? 'Generating...' : 'Generate 5 Workouts'}
            onPress={generateWorkouts}
            disabled={generating}
            style={styles.generateButton}
          />
        </View>

        {/* Generated Workouts */}
        {workouts.length > 0 && (
          <View style={styles.workoutsSection}>
            <Text style={styles.sectionTitle}>Generated Workouts</Text>
            {workouts.map((workout, index) => (
              <Card key={index} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View>
                    <Text style={styles.workoutName}>{workout.name}</Text>
                    <Text style={styles.workoutDomain}>{workout.timeDomain}</Text>
                  </View>
                  <Button
                    title={saved.has(index) ? 'Saved' : saving.has(index) ? 'Saving...' : 'Save'}
                    onPress={() => saveWorkout(workout, index)}
                    disabled={saved.has(index) || saving.has(index)}
                    variant={saved.has(index) ? 'secondary' : 'primary'}
                    size="small"
                  />
                </View>

                <View style={styles.workoutContent}>
                  <Text style={styles.workoutFormat}>{formatWorkoutDisplay(workout)}</Text>
                  {workout.exercises.map((exercise, exIndex) => (
                    <View key={exIndex} style={styles.exerciseRow}>
                      <Text style={styles.exerciseName}>
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
                  <View style={styles.benchmarks}>
                    <Text style={styles.benchmarkText}>
                      50th: {workout.medianScore} | 90th: {workout.excellentScore}
                    </Text>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

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
                      addIncludeExercise(exercise)
                    } else {
                      addExcludeExercise(exercise)
                    }
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  filterHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  chipDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipTextDisabled: {
    color: '#9CA3AF',
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: 70,
    alignItems: 'center',
  },
  segmentButtonSmall: {
    minWidth: 50,
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  segmentTextSmall: {
    fontSize: 12,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  exerciseSection: {
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FE5858',
  },
  exerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    gap: 4,
  },
  excludeChip: {
    backgroundColor: '#FEE2E2',
  },
  exerciseChipText: {
    fontSize: 13,
    color: '#374151',
  },
  exerciseChipRemove: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  generateContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  generateButton: {
    backgroundColor: '#FE5858',
  },
  workoutsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  workoutCard: {
    marginBottom: 16,
    padding: 16,
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
    color: '#111827',
  },
  workoutDomain: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  workoutContent: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  workoutFormat: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  exerciseName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  exerciseWeight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
  },
  benchmarks: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  benchmarkText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
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
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalClose: {
    fontSize: 28,
    color: '#6B7280',
    fontWeight: '300',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  exerciseList: {
    maxHeight: 400,
  },
  exerciseOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  exerciseOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  noResults: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
})
