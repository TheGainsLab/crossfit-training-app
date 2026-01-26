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
import { fetchBTNWorkouts, logBTNResult, deleteBTNWorkout, BTNWorkout, BTNWorkoutStats } from '@/lib/api/btn'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'

type FilterType = 'all' | 'completed' | 'incomplete'

export default function BTNWorkoutsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [workouts, setWorkouts] = useState<BTNWorkout[]>([])
  const [stats, setStats] = useState<BTNWorkoutStats>({
    total: 0,
    completed: 0,
    incomplete: 0,
    completionRate: 0,
  })
  const [filter, setFilter] = useState<FilterType>('incomplete')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadWorkouts()
    }
  }, [filter, hasAccess])

  const checkAccess = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.replace('/auth/signin')
        return
      }

      // Check BTN subscription access
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('auth_id', user.id)
        .single()

      // Check for NULL subscription_tier
      if (!userData?.subscription_tier) {
        console.error('❌ User missing subscription_tier for BTN access')
        Alert.alert(
          'Subscription Required',
          'Please subscribe to access BTN workouts.',
          [{ text: 'View Plans', onPress: () => router.replace('/subscriptions') }]
        )
        router.replace('/subscriptions')
        return
      }

      // Verify user has BTN tier
      if (userData.subscription_tier !== 'BTN') {
        console.error('❌ Non-BTN user trying to access BTN workouts')
        Alert.alert(
          'Access Denied',
          'This feature is only available for BTN subscribers.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        )
        router.replace('/(tabs)')
        return
      }

      setHasAccess(true)
    } catch (error) {
      console.error('Error checking access:', error)
      Alert.alert('Error', 'Failed to verify access')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const loadWorkouts = async () => {
    try {
      setRefreshing(true)
      setError(null)
      const data = await fetchBTNWorkouts(filter)
      setWorkouts(data.workouts || [])
      setStats(data.stats || { total: 0, completed: 0, incomplete: 0, completionRate: 0 })
    } catch (error: any) {
      console.error('Error loading workouts:', error)
      setError(error.message || 'Failed to load workouts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleWorkoutUpdate = () => {
    loadWorkouts()
  }

  if (loading && !hasAccess) {
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadWorkouts} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Workouts</Text>
          <Text style={styles.subtitle}>Track your training and analyze your progress</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Logged</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completionRate}%</Text>
            <Text style={styles.statLabel}>Complete</Text>
          </View>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'incomplete' && styles.filterButtonActive]}
            onPress={() => setFilter('incomplete')}
          >
            <Text style={[styles.filterButtonText, filter === 'incomplete' && styles.filterButtonTextActive]}>
              To Do ({stats.incomplete})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterButtonText, filter === 'completed' && styles.filterButtonTextActive]}>
              Completed ({stats.completed})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
              All ({stats.total})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error State */}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setError(null)
                loadWorkouts()
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Workout List */}
        {loading && workouts.length === 0 && !error ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FE5858" />
            <Text style={styles.loadingText}>Loading workouts...</Text>
          </View>
        ) : !error && workouts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              {filter === 'completed' ? '📊' : filter === 'incomplete' ? '✅' : '💪'}
            </Text>
            <Text style={styles.emptyTitle}>
              {filter === 'completed' && 'No completed workouts yet!'}
              {filter === 'incomplete' && 'All caught up!'}
              {filter === 'all' && 'No workouts yet!'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'completed' && "When you complete workouts, you'll see them here with your results and stats."}
              {filter === 'incomplete' && 'Generate more workouts to keep training.'}
              {filter === 'all' && "Generate your first workout to start building your library."}
            </Text>
            {filter === 'incomplete' || filter === 'all' ? (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Text style={styles.emptyButtonText}>Generate Workouts</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        ) : !error ? (
          <View style={styles.workoutList}>
            {workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onUpdate={handleWorkoutUpdate}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

// Workout Card Component
interface WorkoutCardProps {
  workout: BTNWorkout
  onUpdate: () => void
}

function WorkoutCard({ workout, onUpdate }: WorkoutCardProps) {
  const [showLogging, setShowLogging] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isCompleted = !!workout.completed_at

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatResult = () => {
    if (workout.result_time) {
      return workout.result_time
    }
    if (workout.result_rounds !== null && workout.result_reps !== null) {
      return `${workout.result_rounds} rounds + ${workout.result_reps} reps`
    }
    if (workout.result_rounds !== null) {
      return `${workout.result_rounds} rounds`
    }
    if (workout.user_score) {
      return workout.user_score
    }
    return null
  }

  const handleDelete = async () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteBTNWorkout(workout.id)
              onUpdate()
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete workout')
            } finally {
              setDeleting(false)
            }
          },
        },
      ]
    )
  }

  const formatWorkoutFormat = () => {
    if (workout.workout_format === 'Rounds For Time' && workout.rounds) {
      return `${workout.rounds} Rounds For Time`
    }
    if (workout.workout_format === 'AMRAP' && workout.amrap_time) {
      return `AMRAP ${workout.amrap_time} min`
    }
    if (workout.pattern) {
      return `${workout.workout_format}: ${workout.pattern}`
    }
    return workout.workout_format
  }

  const result = formatResult()

  return (
    <Card style={styles.workoutCard}>
      <View style={styles.workoutHeader}>
        <Text style={styles.workoutName}>{workout.workout_name}</Text>
        <View style={styles.workoutActions}>
          {!isCompleted ? (
            <Button
              variant="primary"
              size="sm"
              onPress={() => setShowLogging(true)}
              style={styles.actionButton}
            >
              Log Result
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled
              style={styles.actionButton}
            >
              Completed
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onPress={handleDelete}
            disabled={deleting}
            loading={deleting}
            style={styles.actionButton}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </View>
      </View>

      <View style={styles.workoutMeta}>
        <Text style={styles.workoutMetaText}>
          <Text style={styles.workoutMetaLabel}>Time Domain:</Text> {workout.time_domain}
        </Text>
      </View>

      <Card variant="outlined" style={styles.workoutDetails}>
        <Text style={styles.workoutFormat}>{formatWorkoutFormat()}</Text>
        {workout.exercises && workout.exercises.length > 0 ? (
          workout.exercises.map((exercise, index) => (
            <View key={index} style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>
                {workout.workout_format === 'For Time' && workout.pattern
                  ? exercise.name
                  : `${exercise.reps || ''} ${exercise.name}`.trim()}
              </Text>
              {exercise.weight && (
                <Text style={styles.exerciseWeight}>{exercise.weight}</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.noExercises}>No exercises available</Text>
        )}
      </Card>

      {/* Benchmark Scores */}
      {workout.median_score && workout.excellent_score && (
        <Card variant="outlined" style={styles.benchmarkCard}>
          <Text style={styles.benchmarkTitle}>Performance Benchmarks</Text>
          <View style={styles.benchmarkRow}>
            <View style={styles.benchmarkItem}>
              <Text style={styles.benchmarkLabel}>50th Percentile (Median):</Text>
              <Text style={styles.benchmarkValue}>{workout.median_score}</Text>
            </View>
            <View style={styles.benchmarkItem}>
              <Text style={styles.benchmarkLabel}>90th Percentile (Excellent):</Text>
              <Text style={styles.benchmarkValue}>{workout.excellent_score}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Completed Result Display */}
      {isCompleted && result && (
        <Card variant="outlined" style={styles.resultCard}>
          <Text style={styles.resultText}>
            Result: <Text style={styles.resultValue}>{result}</Text>
            {workout.percentile && (
              <Text style={styles.resultPercentile}> ({workout.percentile}%)</Text>
            )}
          </Text>
          {workout.notes && (
            <Text style={styles.resultNotes}>Notes: {workout.notes.toLowerCase()}</Text>
          )}
        </Card>
      )}

      {/* Result Logging Modal */}
      <Modal
        visible={showLogging}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLogging(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ResultLoggingForm
              workout={workout}
              onSuccess={() => {
                setShowLogging(false)
                onUpdate()
              }}
              onCancel={() => setShowLogging(false)}
            />
          </View>
        </View>
      </Modal>
    </Card>
  )
}

// Result Logging Form Component
interface ResultLoggingFormProps {
  workout: BTNWorkout
  onSuccess: () => void
  onCancel: () => void
}

function ResultLoggingForm({ workout, onSuccess, onCancel }: ResultLoggingFormProps) {
  const [result, setResult] = useState('')
  const [notes, setNotes] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [maxHeartRate, setMaxHeartRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [performanceTier, setPerformanceTier] = useState<string | null>(null)
  const [taskRPEs, setTaskRPEs] = useState<{ [key: string]: number }>({})
  const [taskQualities, setTaskQualities] = useState<{ [key: string]: string }>({})

  const isForTime = workout.workout_format?.toLowerCase().includes('time')
  const isAMRAP = workout.workout_format?.toLowerCase().includes('amrap')

  const handleTaskRPE = (exerciseName: string, rpe: number) => {
    setTaskRPEs((prev) => ({ ...prev, [exerciseName]: rpe }))
  }

  const handleTaskQuality = (exerciseName: string, quality: string) => {
    setTaskQualities((prev) => ({ ...prev, [exerciseName]: quality }))
  }

  const formatTimeInput = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 2) {
      return digits
    }
    if (digits.length === 3) {
      return `${digits[0]}:${digits.slice(1)}`
    }
    return `${digits.slice(0, -2)}:${digits.slice(-2)}`
  }

  const handleTimeChange = (value: string) => {
    if (isForTime) {
      setResult(formatTimeInput(value))
    } else {
      setResult(value)
    }
  }

  const handleHeartRateChange = (value: string, setter: (val: string) => void) => {
    const digits = value.replace(/\D/g, '')
    if (digits === '' || parseInt(digits) <= 220) {
      setter(digits)
    }
  }

  const handleSubmit = async () => {
    if (!result.trim()) {
      Alert.alert('Error', 'Please enter a result')
      return
    }

    setSaving(true)
    try {
      const taskCompletions = workout.exercises?.map((exercise) => {
        const exerciseName = exercise.name || exercise.exercise || ''
        return {
          exerciseName,
          rpe: taskRPEs[exerciseName] || 5,
          quality: taskQualities[exerciseName] || 'C',
        }
      })

      const response = await logBTNResult({
        workoutId: workout.id,
        userScore: result.trim(),
        notes: notes.trim() || undefined,
        avgHeartRate: avgHeartRate.trim() ? parseInt(avgHeartRate.trim()) : undefined,
        maxHeartRate: maxHeartRate.trim() ? parseInt(maxHeartRate.trim()) : undefined,
        taskCompletions,
      })

      setPercentile(response.percentile)
      setPerformanceTier(response.performanceTier)
      setShowResult(true)

      setTimeout(() => {
        onSuccess()
      }, 3000)
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save result')
    } finally {
      setSaving(false)
    }
  }

  if (showResult && percentile !== null) {
    return (
      <Card style={styles.successCard}>
        <Text style={styles.successTitle}>Result Logged!</Text>
        <Text style={styles.successScore}>
          Your Score: <Text style={styles.successScoreValue}>{result}</Text>
        </Text>
        <Text style={styles.successPercentile}>{percentile}th Percentile</Text>
        <Text style={styles.successUpdating}>Updating your stats...</Text>
      </Card>
    )
  }

  return (
    <Card style={styles.formCard}>
      <Text style={styles.formTitle}>Log Your Result</Text>
      <ScrollView style={styles.formScroll}>
        {/* Result Input */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>
            {isForTime && 'Time (mm:ss)'}
            {isAMRAP && 'Rounds + Reps (e.g., "5+10" or "5")'}
            {!isForTime && !isAMRAP && 'Result'}
          </Text>
          <TextInput
            style={styles.formInput}
            value={result}
            onChangeText={handleTimeChange}
            placeholder={isForTime ? '8:45' : isAMRAP ? '5+10 or 5' : 'Enter result'}
            keyboardType={isForTime ? 'numeric' : 'default'}
            editable={!saving}
          />
          {isForTime && (
            <Text style={styles.formHint}>Enter time like "845" and it will format to "8:45"</Text>
          )}
          {isAMRAP && (
            <Text style={styles.formHint}>
              Enter "5+10" for 5 rounds plus 10 reps, or just "5" for 5 complete rounds
            </Text>
          )}
        </View>

        {/* Heart Rate Fields */}
        <View style={styles.heartRateRow}>
          <View style={styles.heartRateField}>
            <Text style={styles.formLabel}>Avg HR (optional)</Text>
            <TextInput
              style={styles.formInput}
              value={avgHeartRate}
              onChangeText={(value) => handleHeartRateChange(value, setAvgHeartRate)}
              placeholder="145"
              keyboardType="numeric"
              editable={!saving}
            />
          </View>
          <View style={styles.heartRateField}>
            <Text style={styles.formLabel}>Peak HR (optional)</Text>
            <TextInput
              style={styles.formInput}
              value={maxHeartRate}
              onChangeText={(value) => handleHeartRateChange(value, setMaxHeartRate)}
              placeholder="175"
              keyboardType="numeric"
              editable={!saving}
            />
          </View>
        </View>

        {/* Task Performance Section */}
        {workout.exercises && workout.exercises.length > 0 && (
          <View style={styles.taskSection}>
            <Text style={styles.taskSectionTitle}>Task Performance</Text>
            {workout.exercises.map((exercise, index) => {
              const exerciseName = exercise.name || exercise.exercise || `Exercise ${index + 1}`
              return (
                <Card key={index} variant="outlined" style={styles.taskCard}>
                  <Text style={styles.taskName}>{exerciseName}</Text>
                  {(exercise.reps || exercise.weight) && (
                    <Text style={styles.taskDetails}>
                      {exercise.reps && `${exercise.reps} reps`}
                      {exercise.reps && exercise.weight && ' @ '}
                      {exercise.weight && `${exercise.weight} lbs`}
                    </Text>
                  )}

                  {/* RPE Section */}
                  <View style={styles.rpeSection}>
                    <View style={styles.rpeHeader}>
                      <Text style={styles.rpeLabel}>RPE (1-10)</Text>
                      <Text style={styles.rpeValue}>
                        {taskRPEs[exerciseName] || 5}/10
                      </Text>
                    </View>
                    <View style={styles.rpeInputContainer}>
                      <TouchableOpacity
                        style={styles.rpeButton}
                        onPress={() => {
                          const current = taskRPEs[exerciseName] || 5
                          if (current > 1) {
                            handleTaskRPE(exerciseName, current - 1)
                          }
                        }}
                        disabled={saving}
                      >
                        <Text style={styles.rpeButtonText}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.rpeInput}
                        value={String(taskRPEs[exerciseName] || 5)}
                        onChangeText={(value) => {
                          const num = parseInt(value) || 5
                          if (num >= 1 && num <= 10) {
                            handleTaskRPE(exerciseName, num)
                          }
                        }}
                        keyboardType="numeric"
                        editable={!saving}
                        maxLength={2}
                      />
                      <TouchableOpacity
                        style={styles.rpeButton}
                        onPress={() => {
                          const current = taskRPEs[exerciseName] || 5
                          if (current < 10) {
                            handleTaskRPE(exerciseName, current + 1)
                          }
                        }}
                        disabled={saving}
                      >
                        <Text style={styles.rpeButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.sliderContainer}>
                      <Text style={styles.sliderLabel}>1 - Very Easy</Text>
                      <Text style={styles.sliderLabel}>10 - Max Effort</Text>
                    </View>
                  </View>

                  {/* Quality Section */}
                  <View style={styles.qualitySection}>
                    <Text style={styles.qualityLabel}>Quality</Text>
                    <View style={styles.qualityButtons}>
                      {['A', 'B', 'C', 'D'].map((grade) => {
                        const isSelected = taskQualities[exerciseName] === grade
                        return (
                          <TouchableOpacity
                            key={grade}
                            style={[
                              styles.qualityButton,
                              isSelected && styles.qualityButtonSelected,
                            ]}
                            onPress={() =>
                              handleTaskQuality(
                                exerciseName,
                                taskQualities[exerciseName] === grade ? 'C' : grade
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.qualityButtonText,
                                isSelected && styles.qualityButtonTextSelected,
                              ]}
                            >
                              {grade}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        )}

        {/* Notes Input */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it feel? Any modifications?"
            multiline
            numberOfLines={3}
            editable={!saving}
          />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.formActions}>
        <Button variant="secondary" onPress={onCancel} disabled={saving} style={styles.formButton}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={saving || !result.trim()}
          loading={saving}
          style={[styles.formButton, styles.formButtonPrimary]}
        >
          Save Result
        </Button>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#282B34',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FE5858',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#FE5858',
    fontWeight: '600',
  },
  workoutList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  emptyCard: {
    marginHorizontal: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  workoutCard: {
    padding: 16,
    backgroundColor: '#F4FBFE',
    marginBottom: 16,
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
    flex: 1,
    marginRight: 12,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minWidth: 80,
  },
  workoutMeta: {
    marginBottom: 12,
  },
  workoutMetaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  workoutMetaLabel: {
    fontWeight: '600',
  },
  workoutDetails: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  workoutFormat: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
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
  noExercises: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  benchmarkCard: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  benchmarkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
    textAlign: 'center',
    marginBottom: 12,
  },
  benchmarkRow: {
    flexDirection: 'row',
    gap: 12,
  },
  benchmarkItem: {
    flex: 1,
  },
  benchmarkLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  benchmarkValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
  },
  resultCard: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  resultText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  resultValue: {
    color: '#FE5858',
  },
  resultPercentile: {
    color: '#282B34',
  },
  resultNotes: {
    fontSize: 14,
    color: '#282B34',
    marginTop: 4,
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
    maxHeight: '90%',
    padding: 20,
  },
  formCard: {
    padding: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FE5858',
    textAlign: 'center',
    marginBottom: 16,
  },
  formScroll: {
    maxHeight: 500,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#282B34',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  heartRateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  heartRateField: {
    flex: 1,
  },
  taskSection: {
    marginBottom: 16,
  },
  taskSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  taskCard: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  taskDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  rpeSection: {
    marginBottom: 12,
  },
  rpeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rpeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textTransform: 'uppercase',
  },
  rpeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FE5858',
  },
  rpeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rpeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rpeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
  },
  rpeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#282B34',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    minWidth: 60,
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  qualitySection: {
    marginTop: 12,
  },
  qualityLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  qualityButtonSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  qualityButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  qualityButtonTextSelected: {
    color: '#FFFFFF',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  formButton: {
    flex: 1,
  },
  formButtonPrimary: {
    flex: 2,
  },
  successCard: {
    padding: 24,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 16,
  },
  successScore: {
    fontSize: 18,
    marginBottom: 8,
  },
  successScoreValue: {
    fontWeight: '700',
    color: '#FE5858',
  },
  successPercentile: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 16,
  },
  successUpdating: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
})





