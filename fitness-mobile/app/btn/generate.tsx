import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import { fetchBTNUserProfile, saveBTNWorkouts, BTNUserProfile } from '@/lib/api/btn'
import { generateTestWorkouts } from '@/lib/btn/utils'
import { GeneratedWorkout, UserProfile } from '@/lib/btn/types'
import { exerciseEquipment } from '@/lib/btn/data'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

const timeDomains = [
  '1:00 - 5:00',
  '5:00 - 10:00',
  '10:00 - 15:00',
  '15:00 - 20:00',
  '20:00+'
]

type EquipmentFilter = 'all' | 'barbell' | 'no_barbell' | 'gymnastics'

export default function BTNGeneratePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all')
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [savedWorkouts, setSavedWorkouts] = useState<Set<number>>(new Set())
  const [savingWorkouts, setSavingWorkouts] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      fetchUserProfile()
    }
  }, [hasAccess])

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

  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true)
      setProfileError(null)
      const data = await fetchBTNUserProfile()
      if (data.success && data.profile) {
        setUserProfile(data.profile)
        console.log('✅ User profile loaded:', {
          equipment: data.profile.equipment.length,
          skills: Object.keys(data.profile.skills).length,
          oneRMs: Object.keys(data.profile.oneRMs).length
        })
      }
    } catch (error: any) {
      console.error('❌ Error fetching user profile:', error)
      setProfileError(error.message || 'Failed to load profile. Using default generator settings.')
      // Continue without profile - generator will use defaults
    } finally {
      setProfileLoading(false)
    }
  }

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => 
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    )
  }

  const generateWorkouts = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      console.log('🎲 Generating workouts...')
      console.log('Selected domains:', selectedDomains.length > 0 ? selectedDomains : 'all (random)')
      console.log('Equipment filter:', equipmentFilter)
      console.log('Using profile:', userProfile ? 'Yes' : 'No (default generator)')
      
      // Determine requiredEquipment based on filter
      let requiredEquipment: string[] | undefined
      if (equipmentFilter === 'barbell') {
        requiredEquipment = ['Barbell']
      } else {
        requiredEquipment = undefined // 'all', 'no_barbell', or 'gymnastics' - handled post-generation
      }
      
      const workouts = generateTestWorkouts(
        selectedDomains.length > 0 ? selectedDomains : undefined,
        userProfile || undefined,
        requiredEquipment
      )
      
      // Apply post-generation filtering for 'no_barbell' and 'gymnastics'
      let filteredWorkouts = workouts
      if (equipmentFilter === 'no_barbell' || equipmentFilter === 'gymnastics') {
        filteredWorkouts = workouts.filter(workout => {
          // Calculate required_equipment for this workout
          const equipmentSet = new Set<string>()
          workout.exercises.forEach((exercise: any) => {
            const exerciseName = exercise.name || exercise.exercise
            const equipment = exerciseEquipment[exerciseName] || []
            equipment.forEach(eq => equipmentSet.add(eq))
          })
          const reqEq = Array.from(equipmentSet)
          
          if (equipmentFilter === 'no_barbell') {
            return !reqEq.includes('Barbell')
          } else if (equipmentFilter === 'gymnastics') {
            return reqEq.some(eq => 
              eq === 'Pullup Bar or Rig' || 
              eq === 'High Rings' || 
              eq === 'Climbing Rope'
            )
          }
          return true
        })
        
        if (filteredWorkouts.length < 5) {
          console.warn(`⚠️ Only ${filteredWorkouts.length} workouts match filter, showing available workouts`)
        }
      }
      
      if (filteredWorkouts.length === 0) {
        setError('No workouts match your selected filters. Try adjusting your equipment or time domain selections.')
        return
      }
      
      // Display workouts immediately
      setGeneratedWorkouts(filteredWorkouts)
      setSavedWorkouts(new Set()) // Clear saved state
      console.log(`✅ Generated ${filteredWorkouts.length} workouts`)
    } catch (error: any) {
      console.error('❌ Generation failed:', error)
      setError(error.message || 'Failed to generate workouts. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const saveWorkout = async (workout: GeneratedWorkout, index: number) => {
    setSavingWorkouts(prev => new Set(prev).add(index))
    
    try {
      const result = await saveBTNWorkouts([workout])
      
      if (result.success) {
        // Mark as saved
        setSavedWorkouts(prev => new Set(prev).add(index))
        Alert.alert('Success', 'Workout saved successfully!')
      } else {
        throw new Error('Failed to save workout')
      }
    } catch (error: any) {
      console.error('❌ Save failed:', error)
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
    setSavedWorkouts(prev => {
      const newSet = new Set(prev)
      newSet.delete(index)
      return newSet
    })
  }

  if (loading || !hasAccess) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>BTN Workout Generator</Text>
        <Text style={styles.subtitle}>Build a personalized workout library</Text>
      </View>

      <Card style={styles.card}>
        {/* Time Domain Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time Domains:</Text>
          <View style={styles.buttonRow}>
            {timeDomains.map((domain) => (
              <TouchableOpacity
                key={domain}
                onPress={() => toggleDomain(domain)}
                style={[
                  styles.domainButton,
                  selectedDomains.includes(domain) && styles.domainButtonSelected
                ]}
              >
                <Text style={[
                  styles.domainButtonText,
                  selectedDomains.includes(domain) && styles.domainButtonTextSelected
                ]}>
                  {domain}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>
            {selectedDomains.length === 0 
              ? 'No domains selected - will generate 5 random workouts'
              : selectedDomains.length >= 5
              ? `Will generate 1 workout from each selected domain`
              : `Will generate at least 1 from each selected domain, filling remainder randomly`
            }
          </Text>
        </View>

        {/* Dividing line */}
        <View style={styles.divider} />

        {/* Equipment Filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Equipment:</Text>
          <View style={styles.buttonRow}>
            {(['all', 'barbell', 'no_barbell', 'gymnastics'] as const).map(filter => (
              <TouchableOpacity
                key={filter}
                onPress={() => setEquipmentFilter(filter)}
                style={[
                  styles.equipmentButton,
                  equipmentFilter === filter && styles.equipmentButtonSelected
                ]}
              >
                <Text style={[
                  styles.equipmentButtonText,
                  equipmentFilter === filter && styles.equipmentButtonTextSelected
                ]}>
                  {filter === 'all' ? 'All' : 
                   filter === 'barbell' ? 'Barbell' :
                   filter === 'no_barbell' ? 'No Barbell' :
                   'Gymnastics'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>
            {equipmentFilter === 'all' 
              ? 'No equipment filter - workouts may include any equipment'
              : equipmentFilter === 'barbell'
              ? 'All workouts will include at least one barbell exercise'
              : equipmentFilter === 'no_barbell'
              ? 'Workouts will not include barbell exercises'
              : 'All workouts will include at least one gymnastics exercise'
            }
          </Text>
        </View>

        {/* Profile Error Warning */}
        {profileError && (
          <Card style={styles.warningCard}>
            <Text style={styles.warningText}>⚠️ {profileError}</Text>
            <TouchableOpacity
              onPress={fetchUserProfile}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setError(null)
                generateWorkouts()
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Generate Button */}
        <Button
          onPress={generateWorkouts}
          disabled={isGenerating || profileLoading}
          loading={isGenerating}
          style={styles.generateButton}
        >
          {isGenerating ? 'Generating Workouts...' : 'Generate 5 Workouts'}
        </Button>

        {/* Empty State */}
        {!isGenerating && generatedWorkouts.length === 0 && !error && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💪</Text>
            <Text style={styles.emptyTitle}>No Workouts Generated Yet</Text>
            <Text style={styles.emptyText}>
              Select your preferences above and tap "Generate 5 Workouts" to create your personalized workout library.
            </Text>
          </Card>
        )}

        {/* Generated Workouts */}
        {generatedWorkouts.length > 0 && (
          <View style={styles.workoutsSection}>
            <Text style={styles.workoutsTitle}>Generated Workouts ({generatedWorkouts.length})</Text>
            {generatedWorkouts.map((workout, index) => (
              <View key={index} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  <View style={styles.workoutActions}>
                    {!savedWorkouts.has(index) ? (
                      <>
                        <TouchableOpacity
                          onPress={() => saveWorkout(workout, index)}
                          disabled={savingWorkouts.has(index)}
                          style={[styles.actionButton, styles.saveButton]}
                        >
                          {savingWorkouts.has(index) ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.saveButtonText}>Save</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => discardWorkout(index)}
                          disabled={savingWorkouts.has(index)}
                          style={[styles.actionButton, styles.discardButton]}
                        >
                          <Text style={styles.discardButtonText}>Discard</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={[styles.actionButton, styles.savedButton]}>
                        <Text style={styles.savedButtonText}>✓ Saved</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.workoutMeta}>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>Time Domain: </Text>
                    {workout.timeDomain}
                  </Text>
                </View>

                <View style={styles.workoutFormat}>
                  <Text style={styles.formatText}>
                    {workout.format === 'Rounds For Time' && workout.rounds
                      ? `${workout.rounds} Rounds For Time`
                      : workout.format === 'AMRAP' && workout.amrapTime
                      ? `AMRAP ${workout.amrapTime} minutes`
                      : `${workout.format}${workout.pattern ? `: ${workout.pattern}` : ''}`}
                  </Text>
                  {workout.exercises.map((exercise, exIndex) => (
                    <View key={exIndex} style={styles.exerciseRow}>
                      <Text style={styles.exerciseText}>
                        {workout.format === 'For Time' && workout.pattern
                          ? exercise.name
                          : `${exercise.reps} ${exercise.name}`}
                      </Text>
                      {exercise.weight && (
                        <Text style={styles.weightText}>{exercise.weight}</Text>
                      )}
                    </View>
                  ))}
                </View>

                {/* Benchmark Scores */}
                {workout.medianScore && workout.excellentScore && (
                  <View style={styles.benchmarksCard}>
                    <Text style={styles.benchmarksTitle}>Performance Benchmarks</Text>
                    <View style={styles.benchmarksGrid}>
                      <View style={styles.benchmarkItem}>
                        <Text style={styles.benchmarkLabel}>50th Percentile (Median):</Text>
                        <Text style={styles.benchmarkValue}>{workout.medianScore}</Text>
                      </View>
                      <View style={styles.benchmarkItem}>
                        <Text style={styles.benchmarkLabel}>90th Percentile (Excellent):</Text>
                        <Text style={styles.benchmarkValue}>{workout.excellentScore}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#282B34',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    padding: 20,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  buttonRow: {
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
  equipmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  equipmentButtonSelected: {
    borderColor: '#FE5858',
    backgroundColor: '#FEE2E2',
  },
  equipmentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  equipmentButtonTextSelected: {
    color: '#FE5858',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginVertical: 24,
  },
  generateButton: {
    width: '100%',
    marginTop: 8,
  },
  workoutsSection: {
    marginTop: 32,
  },
  workoutsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#282B34',
    marginBottom: 16,
  },
  workoutCard: {
    backgroundColor: '#F8FBFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#282B34',
    flex: 1,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#FE5858',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  discardButton: {
    backgroundColor: '#DAE2EA',
  },
  discardButtonText: {
    color: '#282B34',
    fontSize: 14,
    fontWeight: '500',
  },
  savedButton: {
    backgroundColor: '#FE5858',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  workoutMeta: {
    marginBottom: 12,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  metaLabel: {
    fontWeight: '600',
  },
  workoutFormat: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#282B34',
  },
  formatText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  exerciseText: {
    fontSize: 14,
    color: '#282B34',
  },
  weightText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FE5858',
  },
  benchmarksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  benchmarksTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
    textAlign: 'center',
    marginBottom: 12,
  },
  benchmarksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  benchmarkItem: {
    flex: 1,
    minWidth: '45%',
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
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 8,
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 8,
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
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    marginTop: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
})
