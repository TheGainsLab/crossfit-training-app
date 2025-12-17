# Code Changes for BTN Generator in Training Tab

## 1. Modify `fitness-mobile/app/(tabs)/index.tsx`

### Add these imports at the top:

```typescript
// Add these imports after existing imports
import { GeneratedWorkout, UserProfile } from '@/lib/btn/types'
import { generateTestWorkouts } from '@/lib/btn/utils'
import { exerciseEquipment } from '@/lib/btn/data'
import { saveBTNWorkouts } from '@/lib/api/btn'
```

### Modify the `loadDashboard` function to skip program loading for BTN users:

```typescript
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

    // ⚠️ ADD THIS: Skip program loading for BTN users
    if (userData.subscription_tier === 'BTN') {
      setLoading(false)
      setRefreshing(false)
      isLoadingRef.current = false
      return // Exit early - BTN users see generator, not programs
    }

    // Get user's programs (only for Premium/Applied Power)
    const { data: programs, error: programsError } = await supabase
      .from('programs')
      .select('id, weeks_generated, generated_at, program_data')
      .eq('user_id', userData.id)
      .order('generated_at', { ascending: false })

    // ... rest of existing code for Premium users ...
```

### Add BTN generator state variables (add after existing state):

```typescript
// BTN Generator State (add after line 55)
const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([])
const [isGenerating, setIsGenerating] = useState(false)
const [savedWorkouts, setSavedWorkouts] = useState<Set<number>>(new Set())
const [savingWorkouts, setSavingWorkouts] = useState<Set<number>>(new Set())
const [selectedDomains, setSelectedDomains] = useState<string[]>([])
const [equipmentFilter, setEquipmentFilter] = useState<'all' | 'barbell' | 'no_barbell' | 'gymnastics'>('all')
const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
const [profileLoading, setProfileLoading] = useState(true)

const timeDomains = [
  '1:00 - 5:00',
  '5:00 - 10:00',
  '10:00 - 15:00',
  '15:00 - 20:00',
  '20:00+'
]
```

### Add BTN generator functions (add before the return statement):

```typescript
// BTN Generator Functions (add before the return statement, around line 820)

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
  }
}, [subscriptionTier])

const toggleDomain = (domain: string) => {
  setSelectedDomains(prev => 
    prev.includes(domain)
      ? prev.filter(d => d !== domain)
      : [...prev, domain]
  )
}

const generateWorkouts = async () => {
  setIsGenerating(true)
  try {
    // Determine requiredEquipment based on filter
    let requiredEquipment: string[] | undefined
    if (equipmentFilter === 'barbell') {
      requiredEquipment = ['Barbell']
    } else {
      requiredEquipment = undefined
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
    }
    
    setGeneratedWorkouts(filteredWorkouts)
    setSavedWorkouts(new Set())
  } catch (error) {
    console.error('Generation failed:', error)
    Alert.alert('Error', 'Failed to generate workouts. Please try again.')
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
      throw new Error(result.error || 'Failed to save workout')
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
```

### Modify the return statement to conditionally render:

```typescript
// Replace the existing return statement (around line 839) with:

if (loading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FE5858" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  )
}

// ⚠️ ADD THIS: Conditional rendering based on subscription tier
if (subscriptionTier === 'BTN') {
  return <BTNWorkoutGeneratorView 
    userName={userName}
    generatedWorkouts={generatedWorkouts}
    isGenerating={isGenerating}
    savedWorkouts={savedWorkouts}
    savingWorkouts={savingWorkouts}
    selectedDomains={selectedDomains}
    equipmentFilter={equipmentFilter}
    timeDomains={timeDomains}
    toggleDomain={toggleDomain}
    setEquipmentFilter={setEquipmentFilter}
    generateWorkouts={generateWorkouts}
    saveWorkout={saveWorkout}
    discardWorkout={discardWorkout}
    router={router}
  />
}

// Existing Premium dashboard return (keep as-is)
return (
  <View style={styles.container}>
    {/* ... existing Premium dashboard code ... */}
  </View>
)
```

### Add BTN Generator Component (add before the styles, around line 1060):

```typescript
// BTN Workout Generator Component
function BTNWorkoutGeneratorView({
  userName,
  generatedWorkouts,
  isGenerating,
  savedWorkouts,
  savingWorkouts,
  selectedDomains,
  equipmentFilter,
  timeDomains,
  toggleDomain,
  setEquipmentFilter,
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
  equipmentFilter: 'all' | 'barbell' | 'no_barbell' | 'gymnastics'
  timeDomains: string[]
  toggleDomain: (domain: string) => void
  setEquipmentFilter: (filter: 'all' | 'barbell' | 'no_barbell' | 'gymnastics') => void
  generateWorkouts: () => Promise<void>
  saveWorkout: (workout: GeneratedWorkout, index: number) => Promise<void>
  discardWorkout: (index: number) => void
  router: any
}) {
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

      {/* Generator Card */}
      <Card style={styles.generatorCard}>
        <Text style={styles.sectionTitle}>Select Time Domains (Optional)</Text>
        <View style={styles.domainRow}>
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
            : `Selected ${selectedDomains.length} domain(s)`
          }
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Select Equipment</Text>
        <View style={styles.filterRow}>
          {(['all', 'barbell', 'no_barbell', 'gymnastics'] as const).map(filter => (
            <TouchableOpacity
              key={filter}
              onPress={() => setEquipmentFilter(filter)}
              style={[
                styles.filterButton,
                equipmentFilter === filter && styles.filterButtonSelected
              ]}
            >
              <Text style={[
                styles.filterButtonText,
                equipmentFilter === filter && styles.filterButtonTextSelected
              ]}>
                {filter === 'all' ? 'All' : 
                 filter === 'barbell' ? 'Barbell' :
                 filter === 'no_barbell' ? 'No Barbell' :
                 'Gymnastics'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          variant="primary"
          size="lg"
          onPress={generateWorkouts}
          disabled={isGenerating}
          style={styles.generateButton}
        >
          {isGenerating ? 'Generating...' : 'Generate 5 Workouts'}
        </Button>
      </Card>

      {/* Generated Workouts */}
      {generatedWorkouts.length > 0 && (
        <View style={styles.workoutsSection}>
          <Text style={styles.workoutsTitle}>
            Generated Workouts ({generatedWorkouts.length})
          </Text>
          {generatedWorkouts.map((workout, index) => (
            <Card key={index} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutName}>{workout.name}</Text>
                <View style={styles.workoutBadges}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{workout.format}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{workout.timeDomain}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.exercisesContainer}>
                {workout.exercises.map((exercise, exIndex) => (
                  <Text key={exIndex} style={styles.exerciseText}>
                    {exercise.reps} {exercise.name}
                    {exercise.weight && ` @ ${exercise.weight}`}
                  </Text>
                ))}
              </View>

              {workout.rounds && (
                <Text style={styles.workoutMeta}>Rounds: {workout.rounds}</Text>
              )}
              {workout.amrapTime && (
                <Text style={styles.workoutMeta}>AMRAP: {workout.amrapTime} min</Text>
              )}

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
                      Discard
                    </Button>
                  </>
                )}
              </View>
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
    </ScrollView>
  )
}
```

### Add these styles to the StyleSheet (add to existing styles object):

```typescript
// Add these styles to the existing styles object
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
workoutCard: {
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
```

## 2. Update Redirect in `fitness-mobile/app/index.tsx`

Change line 29 from:
```typescript
router.replace('/btn/generate')
```

To:
```typescript
router.replace('/(tabs)')  // BTN users go to Training tab (which shows generator)
```

This ensures BTN users are redirected to the Training tab where they'll see the generator.

## Summary

These changes will:
1. ✅ Detect BTN subscription tier in the Training tab
2. ✅ Show workout generator for BTN users
3. ✅ Show program dashboard for Premium users
4. ✅ Allow BTN users to generate and save workouts
5. ✅ Link to workouts history page
6. ✅ Update redirects to point BTN users to Training tab

The generator will appear in the Training tab for BTN users, replacing the program dashboard view.
