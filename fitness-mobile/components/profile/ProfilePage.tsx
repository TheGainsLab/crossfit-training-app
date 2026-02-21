import React, { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  StyleSheet
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { getMealTemplates, deleteMealTemplate, MealTemplate } from '@/lib/api/mealTemplates'
import FrequentFoodsScreen from '@/components/nutrition/FrequentFoodsScreen'
import { Ionicons } from '@expo/vector-icons'

interface ProfileData {
  user_summary: {
    name: string
    email: string
    gender: string
    units: string
    body_weight: number | null
    equipment: string[]
  }
  one_rms: {
    snatch: number | null
    clean_and_jerk: number | null
    power_snatch: number | null
    power_clean: number | null
    clean_only: number | null
    jerk_only: number | null
    back_squat: number | null
    front_squat: number | null
    overhead_squat: number | null
    deadlift: number | null
    bench_press: number | null
    push_press: number | null
    strict_press: number | null
    weighted_pullup: number | null
  }
  benchmarks: {
    mile_run: string | null
    five_k_run: string | null
    ten_k_run: string | null
    one_k_row: string | null
    two_k_row: string | null
    five_k_row: string | null
    air_bike_10_min: string | null
  }
  skills_assessment: {
    dont_have: string[]
    beginner: string[]
    intermediate: string[]
    advanced: string[]
    advanced_count: number
    total_skills_assessed: number
  }
  technical_focus?: {
    snatch_technical_count: number
    clean_jerk_technical_count: number
  }
  accessory_needs?: {
    needs_upper_back: boolean
    needs_leg_strength: boolean
    needs_posterior_chain: boolean
    needs_upper_body_pressing: boolean
    needs_upper_body_pulling: boolean
    needs_core: boolean
  }
  generated_at: string
}

interface FoundationProgressProps {
  lift: string
  weight: string
  ratio: number
  thresholds: {
    beginner: number
    intermediate: number
    advanced: number
    elite: number
  }
  field: string
  isEditing?: boolean
  displayValue?: string
  onPress?: () => void
  onBlur?: () => void
  onChangeText?: (text: string) => void
  saving?: boolean
  unit?: string
}

interface OlympicProgressProps {
  lift: string
  weight: string
  current: number
  target: number
  field: string
  isEditing?: boolean
  displayValue?: string
  onPress?: () => void
  onBlur?: () => void
  onChangeText?: (text: string) => void
  saving?: boolean
  unit?: string
}

const OlympicProgress = ({ lift, weight, current, target, field, isEditing, displayValue, onPress, onBlur, onChangeText, saving, unit }: OlympicProgressProps) => {
  const position = Math.min((current / target), 1) * 100
  
  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.header}>
        <Text style={progressStyles.liftLabel}>{lift}:</Text>
        {isEditing ? (
          <View style={progressStyles.editingContainer}>
            <TextInput
              value={displayValue}
              onChangeText={onChangeText}
              onBlur={onBlur}
              keyboardType="numeric"
              placeholder="0"
              style={progressStyles.editingInput}
              autoFocus
              editable={!saving}
            />
            {unit && <Text style={progressStyles.unitText}>{unit}</Text>}
            {saving && <Text style={progressStyles.savingText}>Saving...</Text>}
          </View>
        ) : (
          <TouchableOpacity onPress={onPress}>
            <Text style={progressStyles.weightText}>{weight}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Progress Bar Container */}
      <View style={progressStyles.progressBarContainer}>
        {/* Background Bar */}
        <View style={progressStyles.progressBarBackground} />
        
        {/* Progress Fill */}
        <View
          style={[progressStyles.progressBarFill, { width: `${position}%` }]}
        />
        
        {/* Current Value Badge - Positioned on bar at current percentage */}
        {current > 0 && (
          <View style={[progressStyles.currentValueBadge, { 
            position: 'absolute',
            left: `${position}%`,
            top: -12,
            marginLeft: -25, // Center the badge
          }]}>
            <Text style={progressStyles.currentValueText}>{Math.round(current)}%</Text>
          </View>
        )}
      </View>
      
      {/* Target Label - Below bar on the right */}
      <View style={progressStyles.targetContainer}>
        <Text style={progressStyles.targetText}>{Math.round(target)}%</Text>
      </View>
    </View>
  )
}

const FoundationProgress = ({ lift, weight, ratio, thresholds, field, isEditing, displayValue, onPress, onBlur, onChangeText, saving, unit }: FoundationProgressProps) => {
  const maxValue = thresholds.elite
  const position = Math.min((ratio / maxValue) * 100, 100)
  
  // Determine current level
  let currentLevel = 'Beginner'
  if (ratio >= thresholds.elite * 0.9) currentLevel = 'Elite'
  else if (ratio >= thresholds.advanced * 0.9) currentLevel = 'Advanced'
  else if (ratio >= thresholds.intermediate * 0.9) currentLevel = 'Intermediate'

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.header}>
        <Text style={progressStyles.liftLabel}>{lift}:</Text>
        {isEditing ? (
          <View style={progressStyles.editingContainer}>
            <TextInput
              value={displayValue}
              onChangeText={onChangeText}
              onBlur={onBlur}
              keyboardType="numeric"
              placeholder="0"
              style={progressStyles.editingInput}
              autoFocus
              editable={!saving}
            />
            {unit && <Text style={progressStyles.unitText}>{unit}</Text>}
            {saving && <Text style={progressStyles.savingText}>Saving...</Text>}
          </View>
        ) : (
          <TouchableOpacity onPress={onPress}>
            <Text style={progressStyles.weightText}>{weight}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Progress Bar Container */}
      <View style={progressStyles.progressBarContainer}>
        {/* Background Bar with Level Sections */}
        <View style={progressStyles.foundationBarBackground}>
          <View style={[progressStyles.foundationBarSection, { backgroundColor: '#D1D5DB', borderRightWidth: 1, borderRightColor: '#FFFFFF' }]} />
          <View style={[progressStyles.foundationBarSection, { backgroundColor: 'rgba(218, 226, 234, 0.5)', borderRightWidth: 1, borderRightColor: '#FFFFFF' }]} />
          <View style={[progressStyles.foundationBarSection, { backgroundColor: 'rgba(254, 88, 88, 0.2)', borderRightWidth: 1, borderRightColor: '#FFFFFF' }]} />
          <View style={[progressStyles.foundationBarSection, { backgroundColor: 'rgba(40, 43, 52, 0.2)' }]} />
        </View>
        
        {/* Progress Fill */}
        <View
          style={[progressStyles.foundationProgressFill, { width: `${position}%` }]}
        />
        
        {/* Current Value Badge - Positioned on bar at ratio value */}
        <View style={[progressStyles.currentValueBadge, { 
          position: 'absolute',
          left: `${position}%`,
          top: -12,
          marginLeft: -25, // Center the badge (approximately half of badge width)
        }]}>
          <Text style={progressStyles.currentValueText}>{ratio.toFixed(1)}x</Text>
        </View>
      </View>
      
      {/* Level Labels */}
      <View style={progressStyles.levelLabels}>
        <View style={progressStyles.levelLabel}>
          <Text style={progressStyles.levelValue}>{thresholds.beginner}</Text>
          <Text style={progressStyles.levelText}>Beginner</Text>
        </View>
        <View style={[progressStyles.levelLabel, progressStyles.levelLabelCenter]}>
          <Text style={progressStyles.levelValue}>{thresholds.intermediate}</Text>
          <Text style={progressStyles.levelText}>Intermediate</Text>
        </View>
        <View style={[progressStyles.levelLabel, progressStyles.levelLabelCenter]}>
          <Text style={progressStyles.levelValue}>{thresholds.advanced}</Text>
          <Text style={progressStyles.levelText}>Advanced</Text>
        </View>
        <View style={[progressStyles.levelLabel, progressStyles.levelLabelEnd]}>
          <Text style={progressStyles.levelValue}>{thresholds.elite}</Text>
          <Text style={progressStyles.levelText}>Elite</Text>
        </View>
      </View>
    </View>
  )
}

const progressStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liftLabel: {
    fontWeight: '600',
    color: '#282B34',
    fontSize: 16,
  },
  editingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editingInput: {
    width: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#FE5858',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
  },
  unitText: {
    fontSize: 14,
    color: '#4B5563',
  },
  savingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  weightText: {
    fontWeight: '600',
    color: '#282B34',
    fontSize: 16,
  },
  progressBarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 16,
    backgroundColor: '#C4E2EA',
    borderRadius: 999,
  },
  progressBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#D1D5DB', // Light gray instead of coral
  },
  foundationBarBackground: {
    width: '100%',
    height: 16,
    backgroundColor: '#C4E2EA',
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  foundationBarSection: {
    flex: 1,
  },
  foundationProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#C4E2EA',
  },
  targetContainer: {
    marginTop: 4,
    alignItems: 'flex-end', // Align target to the right
  },
  targetText: {
    color: '#6B7280', // Lighter gray for target
    fontSize: 12,
    fontWeight: '500',
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  levelLabel: {
    alignItems: 'flex-start',
  },
  levelLabelCenter: {
    alignItems: 'center',
  },
  levelLabelEnd: {
    alignItems: 'flex-end',
  },
  levelValue: {
    fontSize: 12,
    color: '#282B34',
  },
  levelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#282B34',
  },
  currentValueBadge: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 50,
  },
  currentValueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
})

const skillCategories = [
  {
    name: 'Basic CrossFit skills',
    skills: ['Double Unders', 'Wall Balls']
  },
  {
    name: 'Upper Body Pulling',
    skills: ['Toes to Bar', 'Pull-ups (kipping or butterfly)', 'Chest to Bar Pull-ups', 'Strict Pull-ups']
  },
  {
    name: 'Upper Body Pressing',
    skills: ['Push-ups', 'Ring Dips', 'Strict Ring Dips', 'Strict Handstand Push-ups', 'Wall Facing Handstand Push-ups', 'Deficit Handstand Push-ups (4")']
  },
  {
    name: 'Additional Common Skills',
    skills: ['Alternating Pistols', 'GHD Sit-ups', 'Wall Walks']
  },
  {
    name: 'Advanced Upper Body Pulling',
    skills: ['Ring Muscle Ups', 'Bar Muscle Ups', 'Rope Climbs']
  },
  {
    name: 'Holds',
    skills: ['Wall Facing Handstand Hold', 'Freestanding Handstand Hold']
  },
  {
    name: 'Advanced Gymnastics',
    skills: ['Legless Rope Climbs', 'Pegboard Ascent', 'Handstand Walk (10m or 25\')', 'Seated Legless Rope Climbs', 'Strict Ring Muscle Ups', 'Handstand Walk Obstacle Crossings']
  }
]

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  const [age, setAge] = useState<number | null>(null)
  const [intakeStatus, setIntakeStatus] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['foundation-strength', 'one-rm-lifts'])
  const [userSkills, setUserSkills] = useState<{[key: string]: string}>({})
  const [editingBenchmark, setEditingBenchmark] = useState<string | null>(null)
  const [benchmarkValues, setBenchmarkValues] = useState<{[key: string]: string}>({})
  const [savingBenchmark, setSavingBenchmark] = useState(false)
  const [editingLift, setEditingLift] = useState<string | null>(null)
  const [liftValues, setLiftValues] = useState<{[key: string]: string}>({})
  const [savingLift, setSavingLift] = useState(false)
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [showFrequentFoods, setShowFrequentFoods] = useState(false)
  const [frequentFoodsCount, setFrequentFoodsCount] = useState(0)
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number>(5)

  // Reload profile when screen comes into focus (e.g., returning from Settings)
  useFocusEffect(
    useCallback(() => {
      loadProfile()
    }, [])
  )

  useEffect(() => {
    if (profile) {
      loadFrequentFoodsCount()
    }
  }, [profile])

  const loadFrequentFoodsCount = async () => {
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

      const userId = (userData as any).id

      // Get counts from all frequent foods tables
      const [restaurants, brands, foods, meals] = await Promise.all([
        supabase.from('favorite_restaurants').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('favorite_brands').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('food_favorites').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('meal_templates').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ])

      const total = (restaurants.count || 0) + (brands.count || 0) + (foods.count || 0) + (meals.count || 0)
      setFrequentFoodsCount(total)
    } catch (error) {
      console.error('Error loading frequent foods count:', error)
    }
  }

  const loadProfile = async () => {
    try {
      const supabase = createClient()
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Get user data for height/age AND intake_status
      const { data: userData } = await supabase
        .from('users')
        .select('id, height, age, intake_status')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        setError('User data not found')
        setLoading(false)
        return
      }

      const userIdValue = (userData as any).id
      setUserId(userIdValue)
      setHeight((userData as any).height)
      setAge((userData as any).age)
      setIntakeStatus((userData as any).intake_status)

      // Get training_days_per_week for TDEE calculation
      const { data: prefsData } = await supabase
        .from('user_preferences')
        .select('training_days_per_week')
        .eq('user_id', userIdValue)
        .single()
      if (prefsData && typeof (prefsData as any).training_days_per_week === 'number') {
        setTrainingDaysPerWeek((prefsData as any).training_days_per_week)
      }

      // Get profile data
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userIdValue)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (!profileData) {
        setError('No profile found. Please complete the intake assessment.')
        setLoading(false)
        return
      }

      // Load 1RMs from user_one_rms table (single source of truth for 1RMs)
      const { data: oneRMsData } = await supabase
        .from('user_one_rms')
        .select('one_rm_index, exercise_name, one_rm')
        .eq('user_id', userIdValue)

      // Map 1RMs to profile structure
      const oneRMsMap: any = {}
      if (oneRMsData && oneRMsData.length > 0) {
        const liftMapping: { [key: number]: string } = {
          0: 'snatch',
          1: 'power_snatch',
          2: 'clean_and_jerk',
          3: 'power_clean',
          4: 'clean_only',
          5: 'jerk_only',
          6: 'back_squat',
          7: 'front_squat',
          8: 'overhead_squat',
          9: 'deadlift',
          10: 'bench_press',
          11: 'push_press',
          12: 'strict_press',
          13: 'weighted_pullup'
        }
        
        oneRMsData.forEach((rm: any) => {
          const fieldName = liftMapping[rm.one_rm_index]
          if (fieldName) {
            oneRMsMap[fieldName] = rm.one_rm
          }
        })
      }

      // Merge 1RMs into profile data (prioritize user_one_rms table)
      const mergedProfile = {
        ...((profileData as any).profile_data),
        one_rms: {
          ...((profileData as any).profile_data?.one_rms || {}),
          ...oneRMsMap
        }
      }

      setProfile(mergedProfile)

      // Load user skills
      const { data: skillsData } = await supabase
        .from('user_skills')
        .select('skill_name, skill_level')
        .eq('user_id', userIdValue)

      if (skillsData) {
        const skillsMap: {[key: string]: string} = {}
        skillsData.forEach((skill: { skill_name: string; skill_level: string }) => {
          skillsMap[skill.skill_name] = skill.skill_level
        })
        setUserSkills(skillsMap)
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('Failed to load profile')
      setLoading(false)
    }
  }

  const loadMealTemplates = async () => {
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

      // TODO: Re-enable meal templates functionality if needed
      // setTemplatesLoading(true)
      // const templates = await getMealTemplates((userData as any).id)
      // setMealTemplates(templates)
    } catch (error) {
      console.error('Error loading meal templates:', error)
    } finally {
      // setTemplatesLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    // TODO: Re-enable if meal templates are shown in profile
    /*
    Alert.alert(
      'Delete Meal Template',
      `Are you sure you want to delete "${templateName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteMealTemplate(templateId)
              if (!result.success) {
                throw new Error(result.error || 'Failed to delete template')
              }
              Alert.alert('Success', 'Meal template deleted')
              loadMealTemplates() // Reload templates
            } catch (error: any) {
              console.error('Error deleting template:', error)
              Alert.alert('Error', error.message || 'Failed to delete template')
            }
          },
        },
      ]
    )
    */
  }

  const handleSignOut = async () => {
    console.log('Sign out button pressed') // Debug log
    try {
      console.log('Attempting sign out...') // Debug log
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        Alert.alert('Error', 'Failed to sign out. Please try again.')
        return
      }
      console.log('Sign out successful, navigating...') // Debug log
      router.replace('/auth/signin')
    } catch (err) {
      console.error('Sign out exception:', err)
      Alert.alert('Error', 'Failed to sign out. Please try again.')
    }
  }

  const formatWeight = (weight: number | null) => {
    if (!weight) return 'Not recorded'
    const unit = profile?.user_summary.units.includes('kg') ? 'kg' : 'lbs'
    return `${weight} ${unit}`
  }

  const calculateBMR = (): number | null => {
    if (!profile?.user_summary.body_weight || !height || !age) return null
    const weight = profile.user_summary.body_weight
    const isMetric = profile.user_summary.units.includes('kg')
    const gender = profile.user_summary.gender
    
    const weightKg = isMetric ? weight : weight * 0.453592
    const heightCm = isMetric ? height : height * 2.54
    
    const s = gender === 'Male' ? 5 : -161
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s
    
    return Math.round(bmr)
  }

  const getActivityMultiplier = (days: number): number => {
    if (days <= 2) return 1.375
    if (days <= 4) return 1.55
    if (days <= 6) return 1.725
    return 1.9
  }

  const calculateTDEE = (): number | null => {
    const bmr = calculateBMR()
    if (!bmr) return null
    return Math.round(bmr * getActivityMultiplier(trainingDaysPerWeek))
  }

  const getSkillLevel = (skillName: string): string => {
    if (userSkills[skillName]) {
      return userSkills[skillName]
    }
    if (profile?.skills_assessment.advanced.includes(skillName)) return 'Advanced'
    if (profile?.skills_assessment.intermediate.includes(skillName)) return 'Intermediate'
    if (profile?.skills_assessment.beginner.includes(skillName)) return 'Beginner'
    return "Don't have it"
  }

  const getSkillDisplayName = (skillName: string): string => {
    const displayNameMap: { [key: string]: string } = {
      'Strict Handstand Push-ups': 'Strict H S P U',
      'Wall Facing Handstand Push-ups': 'Wall Facing H S P U',
      'Deficit Handstand Push-ups (4")': 'Deficit H S P U (4")',
      'Pull-ups (kipping or butterfly)': 'Pullups',
      'Wall Facing Handstand Hold': 'Wall Facing HS Hold',
      'Freestanding Handstand Hold': 'Freestanding HS Hold',
      'Handstand Walk (10m or 25\')': 'Handstand Walk',
      'Handstand Walk Obstacle Crossings': 'HS Walk Obstacle',
      'Seated Legless Rope Climbs': 'Seated Legless'
    }
    return displayNameMap[skillName] || skillName
  }

  const renderSkillLevelIndicator = (level: string) => {
    const getFilledCount = (level: string): number => {
      if (level === 'Advanced') return 3
      if (level === 'Intermediate') return 2
      if (level === 'Beginner') return 1
      return 0 // "Don't have it"
    }

    const filledCount = getFilledCount(level)
    
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#C4E2EA',
              backgroundColor: index < filledCount ? '#FE5858' : 'transparent'
            }}
          />
        ))}
      </View>
    )
  }

  const getCategoryStats = (skills: string[]): string => {
    const completed = skills.filter(skill => {
      const level = getSkillLevel(skill)
      return level === 'Advanced' || level === 'Intermediate' || level === 'Beginner'
    }).length
    return `${completed}/${skills.length}`
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(name => name !== category)
        : [...prev, category]
    )
  }

  const saveBenchmark = async (field: string, value: string) => {
    setSavingBenchmark(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) throw new Error('User not found')

      const userId = (userData as any).id

      // Get current benchmarks
      const { data: currentUser } = await supabase
        .from('users')
        .select('conditioning_benchmarks')
        .eq('id', userId)
        .single()

      const currentBenchmarks = (currentUser as any)?.conditioning_benchmarks || {}
      
      // Map profile field names to database field names
      const dbFieldMap: {[key: string]: string} = {
        'mile_run': 'mile_run',
        'five_k_run': 'five_k_run',
        'ten_k_run': 'ten_k_run',
        'one_k_row': 'one_k_row',
        'two_k_row': 'two_k_row',
        'five_k_row': 'five_k_row',
        'air_bike_10_min': 'ten_min_air_bike'
      }
      
      const dbField = dbFieldMap[field] || field
      const updatedBenchmarks = {
        ...currentBenchmarks,
        [dbField]: value || null
      }

      const { error } = await (supabase as any)
        .from('users')
        .update({
          conditioning_benchmarks: updatedBenchmarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      if (profile) {
        setProfile({
          ...profile,
          benchmarks: {
            ...profile.benchmarks,
            [field]: value || null
          }
        })
      }
      
      setEditingBenchmark(null)
    } catch (error) {
      console.error('Error saving benchmark:', error)
      Alert.alert('Error', 'Failed to save benchmark. Please try again.')
    } finally {
      setSavingBenchmark(false)
    }
  }

  const saveLift = async (field: string, value: string) => {
    setSavingLift(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) throw new Error('User not found')

      const userId = (userData as any).id

      // Map profile field names to database structure
      const liftMap: {[key: string]: {index: number, name: string}} = {
        'snatch': { index: 0, name: 'Snatch' },
        'clean_and_jerk': { index: 1, name: 'Clean and Jerk' },
        'power_snatch': { index: 2, name: 'Power Snatch' },
        'power_clean': { index: 3, name: 'Power Clean' },
        'clean_only': { index: 4, name: 'Clean (clean only)' },
        'jerk_only': { index: 5, name: 'Jerk (from rack or blocks, max Split or Power Jerk)' },
        'back_squat': { index: 6, name: 'Back Squat' },
        'front_squat': { index: 7, name: 'Front Squat' },
        'overhead_squat': { index: 8, name: 'Overhead Squat' },
        'deadlift': { index: 9, name: 'Deadlift' },
        'bench_press': { index: 10, name: 'Bench Press' },
        'push_press': { index: 11, name: 'Push Press' },
        'strict_press': { index: 12, name: 'Strict Press' },
        'weighted_pullup': { index: 13, name: 'Weighted Pullup (do not include body weight)' }
      }

      const liftInfo = liftMap[field]
      if (!liftInfo) throw new Error('Invalid lift field')

      const weightValue = value.trim() ? parseFloat(value.trim()) : null
      
      if (weightValue && !isNaN(weightValue) && weightValue > 0) {
        // Delete existing record first
        await supabase
          .from('user_one_rms')
          .delete()
          .eq('user_id', userId)
          .eq('one_rm_index', liftInfo.index)

        // Then insert the new value
        const { error } = await (supabase as any)
          .from('user_one_rms')
          .insert({
            user_id: userId,
            one_rm_index: liftInfo.index,
            exercise_name: liftInfo.name,
            one_rm: weightValue,
            recorded_at: new Date().toISOString()
          })

        if (error) throw error
      } else {
        // Delete if value is empty or 0
        const { error } = await supabase
          .from('user_one_rms')
          .delete()
          .eq('user_id', userId)
          .eq('one_rm_index', liftInfo.index)

        if (error) throw error
      }

      // Update local state
      if (profile) {
        setProfile({
          ...profile,
          one_rms: {
            ...profile.one_rms,
            [field]: weightValue
          }
        })
      }
      
      setEditingLift(null)
    } catch (error) {
      console.error('Error saving lift:', error)
      Alert.alert('Error', 'Failed to save lift. Please try again.')
    } finally {
      setSavingLift(false)
    }
  }

  // Helper functions for ratios
  const safeRatio = (numerator: number | null, denominator: number | null, asPercent = true): string => {
    if (!numerator || !denominator || denominator === 0) return 'N/A'
    const ratio = numerator / denominator
    return asPercent ? `${Math.round(ratio * 100)}%` : ratio.toFixed(1) + 'x'
  }

  const getRatioStatusWithRange = (numerator: number | null, denominator: number | null, minRange: number, maxRange: number): { backgroundColor: string, status: string | null, value: string } => {
    if (!numerator || !denominator || denominator === 0) {
      return { backgroundColor: '#9CA3AF', status: null, value: 'N/A' }
    }
    const ratio = numerator / denominator
    const value = `${Math.round(ratio * 100)}%`
    
    if (ratio >= minRange && ratio <= maxRange) {
      return { backgroundColor: '#10B981', status: null, value }
    } else if (ratio > maxRange) {
      return { backgroundColor: '#EF4444', status: 'high', value }
    } else {
      return { backgroundColor: '#EF4444', status: 'low', value }
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.errorButton}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.noProfileText}>No profile data found. Please complete the intake assessment.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.errorButton}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Show Frequent Foods screen if requested
  if (showFrequentFoods) {
    return (
      <FrequentFoodsScreen 
        onBack={() => {
          setShowFrequentFoods(false)
          loadFrequentFoodsCount() // Reload count when returning
        }}
      />
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Athlete Profile</Text>
            <Text style={styles.headerSubtitle}>
              {profile.user_summary.name} • {new Date(profile.generated_at).toLocaleDateString()}
            </Text>
            {(calculateTDEE() !== null || calculateBMR() !== null) && (
              <View style={styles.bmiBmrContainer}>
                {calculateBMR() !== null && (
                  <Text style={styles.bmiBmrText}>
                    <Text style={styles.bmiBmrLabel}>BMR:</Text> {calculateBMR()} kcal/day
                  </Text>
                )}
                {calculateTDEE() !== null && (
                  <Text style={styles.bmiBmrText}>
                    <Text style={styles.bmiBmrLabel}>TDEE:</Text> {calculateTDEE()} kcal/day
                  </Text>
                )}
              </View>
            )}
          </View>
          <Button
            variant="primary"
            size="sm"
            onPress={() => router.push('/settings')}
          >
            Settings
          </Button>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Intake Status Banner */}
        {(intakeStatus === 'draft' || intakeStatus === null || intakeStatus === 'generating' || intakeStatus === 'failed') && (
          <Card style={styles.intakeBanner}>
            {intakeStatus === 'draft' || intakeStatus === null ? (
              <>
                <Text style={styles.intakeBannerTitle}>Complete Your Intake</Text>
                <Text style={styles.intakeBannerText}>
                  Finish your intake assessment to generate your personalized program.
                </Text>
                <Button
                  variant="primary"
                  size="md"
                  onPress={() => router.push('/intake')}
                  style={styles.intakeBannerButton}
                >
                  Complete Intake
                </Button>
              </>
            ) : intakeStatus === 'generating' ? (
              <>
                <Text style={styles.intakeBannerTitle}>Generating Your Program</Text>
                <Text style={styles.intakeBannerText}>
                  Your personalized program is being created. This usually takes about 60 seconds.
                </Text>
                <ActivityIndicator size="small" color="#FE5858" style={{ marginTop: 8 }} />
              </>
            ) : intakeStatus === 'failed' ? (
              <>
                <Text style={styles.intakeBannerTitle}>Program Generation Failed</Text>
                <Text style={styles.intakeBannerText}>
                  There was an error generating your program. Please try completing your intake again.
                </Text>
                <Button
                  variant="primary"
                  size="md"
                  onPress={() => router.push('/intake')}
                  style={styles.intakeBannerButton}
                >
                  Retry Intake
                </Button>
              </>
            ) : null}
          </Card>
        )}

        {/* Subscription Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
            <TouchableOpacity onPress={() => router.push('/subscription-status')}>
              <Text style={styles.toggleText}>[+ Manage]</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <TouchableOpacity
            style={styles.subscriptionRow}
            onPress={() => router.push('/subscription-status')}
          >
            <Ionicons name="card-outline" size={24} color="#FE5858" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.subscriptionText}>View subscription status</Text>
              <Text style={styles.subscriptionSubtext}>Manage plans and billing</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Strength Summary */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>STRENGTH SUMMARY</Text>
            <TouchableOpacity onPress={() => toggleCategory('foundation-strength')}>
              <Text style={styles.toggleText}>
                [{expandedCategories.includes('foundation-strength') ? '- Hide' : '+ View'}]
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>Primary strength to weight ratios</Text>
          
          {expandedCategories.includes('foundation-strength') && (
            <>
              <FoundationProgress
                lift="Back Squat"
                weight={formatWeight(profile.one_rms.back_squat)}
                ratio={profile.one_rms.back_squat && profile.user_summary.body_weight
                  ? parseFloat((profile.one_rms.back_squat / profile.user_summary.body_weight).toFixed(1))
                  : 0}
                thresholds={profile.user_summary.gender === 'Female' ? {
                  beginner: 0.9,
                  intermediate: 1.2,
                  advanced: 1.5,
                  elite: 1.9
                } : {
                  beginner: 1.0,
                  intermediate: 1.4,
                  advanced: 1.8,
                  elite: 2.4
                }}
                field="back_squat"
                isEditing={editingLift === 'back_squat'}
                displayValue={liftValues['back_squat'] !== undefined ? liftValues['back_squat'] : (profile.one_rms.back_squat ? profile.one_rms.back_squat.toString() : '')}
                onPress={() => {
                  setEditingLift('back_squat')
                  setLiftValues({...liftValues, back_squat: profile.one_rms.back_squat ? profile.one_rms.back_squat.toString() : ''})
                }}
                onBlur={() => {
                  const value = liftValues['back_squat'] || (profile.one_rms.back_squat ? profile.one_rms.back_squat.toString() : '')
                  saveLift('back_squat', value)
                }}
                onChangeText={(text) => setLiftValues({...liftValues, back_squat: text})}
                saving={savingLift}
                unit={profile.user_summary.units.includes('kg') ? 'kg' : 'lbs'}
              />
              
              <FoundationProgress
                lift="Deadlift"
                weight={formatWeight(profile.one_rms.deadlift)}
                ratio={profile.one_rms.deadlift && profile.user_summary.body_weight
                  ? parseFloat((profile.one_rms.deadlift / profile.user_summary.body_weight).toFixed(1))
                  : 0}
                thresholds={profile.user_summary.gender === 'Female' ? {
                  beginner: 1.1,
                  intermediate: 1.3,
                  advanced: 1.7,
                  elite: 2.1
                } : {
                  beginner: 1.3,
                  intermediate: 1.6,
                  advanced: 2.2,
                  elite: 2.7
                }}
                field="deadlift"
                isEditing={editingLift === 'deadlift'}
                displayValue={liftValues['deadlift'] !== undefined ? liftValues['deadlift'] : (profile.one_rms.deadlift ? profile.one_rms.deadlift.toString() : '')}
                onPress={() => {
                  setEditingLift('deadlift')
                  setLiftValues({...liftValues, deadlift: profile.one_rms.deadlift ? profile.one_rms.deadlift.toString() : ''})
                }}
                onBlur={() => {
                  const value = liftValues['deadlift'] || (profile.one_rms.deadlift ? profile.one_rms.deadlift.toString() : '')
                  saveLift('deadlift', value)
                }}
                onChangeText={(text) => setLiftValues({...liftValues, deadlift: text})}
                saving={savingLift}
                unit={profile.user_summary.units.includes('kg') ? 'kg' : 'lbs'}
              />
              
              <FoundationProgress
                lift="Bench Press"
                weight={formatWeight(profile.one_rms.bench_press)}
                ratio={profile.one_rms.bench_press && profile.user_summary.body_weight
                  ? parseFloat((profile.one_rms.bench_press / profile.user_summary.body_weight).toFixed(1))
                  : 0}
                thresholds={profile.user_summary.gender === 'Female' ? {
                  beginner: 0.6,
                  intermediate: 0.8,
                  advanced: 1.0,
                  elite: 1.3
                } : {
                  beginner: 0.8,
                  intermediate: 1.1,
                  advanced: 1.4,
                  elite: 1.7
                }}
                field="bench_press"
                isEditing={editingLift === 'bench_press'}
                displayValue={liftValues['bench_press'] !== undefined ? liftValues['bench_press'] : (profile.one_rms.bench_press ? profile.one_rms.bench_press.toString() : '')}
                onPress={() => {
                  setEditingLift('bench_press')
                  setLiftValues({...liftValues, bench_press: profile.one_rms.bench_press ? profile.one_rms.bench_press.toString() : ''})
                }}
                onBlur={() => {
                  const value = liftValues['bench_press'] || (profile.one_rms.bench_press ? profile.one_rms.bench_press.toString() : '')
                  saveLift('bench_press', value)
                }}
                onChangeText={(text) => setLiftValues({...liftValues, bench_press: text})}
                saving={savingLift}
                unit={profile.user_summary.units.includes('kg') ? 'kg' : 'lbs'}
              />
            </>
          )}
        </View>

        {/* Olympic Lifts */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>OLYMPIC LIFTS</Text>
            <TouchableOpacity onPress={() => toggleCategory('olympic-lifts')}>
              <Text style={styles.toggleText}>
                [{expandedCategories.includes('olympic-lifts') ? '- Hide' : '+ View'}]
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>Key Olympic lifting ratios</Text>

          {expandedCategories.includes('olympic-lifts') && (
            <>
              <OlympicProgress
                lift="Snatch"
                weight={formatWeight(profile.one_rms.snatch)}
                current={profile.one_rms.snatch && profile.one_rms.back_squat
                  ? Math.round((profile.one_rms.snatch / profile.one_rms.back_squat) * 100)
                  : 0}
                target={60}
                field="snatch"
                isEditing={editingLift === 'snatch'}
                displayValue={liftValues['snatch'] !== undefined ? liftValues['snatch'] : (profile.one_rms.snatch ? profile.one_rms.snatch.toString() : '')}
                onPress={() => {
                  setEditingLift('snatch')
                  setLiftValues({...liftValues, snatch: profile.one_rms.snatch ? profile.one_rms.snatch.toString() : ''})
                }}
                onBlur={() => {
                  const value = liftValues['snatch'] || (profile.one_rms.snatch ? profile.one_rms.snatch.toString() : '')
                  saveLift('snatch', value)
                }}
                onChangeText={(text) => setLiftValues({...liftValues, snatch: text})}
                saving={savingLift}
                unit={profile.user_summary.units.includes('kg') ? 'kg' : 'lbs'}
              />

              <OlympicProgress
                lift="Clean & Jerk"
                weight={formatWeight(profile.one_rms.clean_and_jerk)}
                current={profile.one_rms.clean_and_jerk && profile.one_rms.back_squat
                  ? Math.round((profile.one_rms.clean_and_jerk / profile.one_rms.back_squat) * 100)
                  : 0}
                target={76}
                field="clean_and_jerk"
                isEditing={editingLift === 'clean_and_jerk'}
                displayValue={liftValues['clean_and_jerk'] !== undefined ? liftValues['clean_and_jerk'] : (profile.one_rms.clean_and_jerk ? profile.one_rms.clean_and_jerk.toString() : '')}
                onPress={() => {
                  setEditingLift('clean_and_jerk')
                  setLiftValues({...liftValues, clean_and_jerk: profile.one_rms.clean_and_jerk ? profile.one_rms.clean_and_jerk.toString() : ''})
                }}
                onBlur={() => {
                  const value = liftValues['clean_and_jerk'] || (profile.one_rms.clean_and_jerk ? profile.one_rms.clean_and_jerk.toString() : '')
                  saveLift('clean_and_jerk', value)
                }}
                onChangeText={(text) => setLiftValues({...liftValues, clean_and_jerk: text})}
                saving={savingLift}
                unit={profile.user_summary.units.includes('kg') ? 'kg' : 'lbs'}
              />
            </>
          )}
        </View>

        {/* 1RM Lifts Overview */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1RM LIFTS</Text>
            <TouchableOpacity onPress={() => toggleCategory('one-rm-lifts')}>
              <Text style={styles.toggleText}>
                [{expandedCategories.includes('one-rm-lifts') ? '- Hide' : '+ View'}]
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>Complete overview of all 1RM strength lifts</Text>

          {expandedCategories.includes('one-rm-lifts') && (
            <View style={styles.oneRMLiftsContainer}>
              {/* Olympic Lifts */}
              <View style={styles.oneRMLiftGroup}>
                <Text style={styles.oneRMLiftGroupTitle}>Olympic Lifts</Text>
                <View style={styles.oneRMLiftGrid}>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Snatch</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.snatch ? formatWeight(profile.one_rms.snatch) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Clean & Jerk</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.clean_and_jerk ? formatWeight(profile.one_rms.clean_and_jerk) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Power Snatch</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.power_snatch ? formatWeight(profile.one_rms.power_snatch) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Power Clean</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.power_clean ? formatWeight(profile.one_rms.power_clean) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Clean Only</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.clean_only ? formatWeight(profile.one_rms.clean_only) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Jerk Only</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.jerk_only ? formatWeight(profile.one_rms.jerk_only) : 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Squat Variations */}
              <View style={styles.oneRMLiftGroup}>
                <Text style={styles.oneRMLiftGroupTitle}>Squat Variations</Text>
                <View style={styles.oneRMLiftGrid}>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Back Squat</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.back_squat ? formatWeight(profile.one_rms.back_squat) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Front Squat</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.front_squat ? formatWeight(profile.one_rms.front_squat) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Overhead Squat</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.overhead_squat ? formatWeight(profile.one_rms.overhead_squat) : 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Pressing */}
              <View style={styles.oneRMLiftGroup}>
                <Text style={styles.oneRMLiftGroupTitle}>Pressing</Text>
                <View style={styles.oneRMLiftGrid}>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Bench Press</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.bench_press ? formatWeight(profile.one_rms.bench_press) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Push Press</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.push_press ? formatWeight(profile.one_rms.push_press) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Strict Press</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.strict_press ? formatWeight(profile.one_rms.strict_press) : 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Pulling */}
              <View style={styles.oneRMLiftGroup}>
                <Text style={styles.oneRMLiftGroupTitle}>Pulling</Text>
                <View style={styles.oneRMLiftGrid}>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Deadlift</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.deadlift ? formatWeight(profile.one_rms.deadlift) : 'Not set'}
                    </Text>
                  </View>
                  <View style={styles.oneRMLiftItem}>
                    <Text style={styles.oneRMLiftLabel}>Weighted Pull-up</Text>
                    <Text style={styles.oneRMLiftValue}>
                      {profile.one_rms.weighted_pullup ? formatWeight(profile.one_rms.weighted_pullup) : 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Key Ratios */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>KEY RATIOS</Text>
            <TouchableOpacity onPress={() => toggleCategory('strength-ratios')}>
              <Text style={styles.toggleText}>
                [{expandedCategories.includes('strength-ratios') ? '- Hide' : '+ View'}]
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>Lift-to-lift ratios for technical balance</Text>
          
          {expandedCategories.includes('strength-ratios') && (
            <View>
              {/* Olympic Balance */}
              <View style={styles.ratioSubsection}>
                <Text style={styles.ratioSubsectionTitle}>OLYMPIC BALANCE</Text>
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.power_snatch, profile.one_rms.snatch, 0.74, 0.80)
                  return (
                    <View style={styles.ratioRow}>
                      <Text style={styles.ratioLabel}>Power Snatch to Snatch</Text>
                      <View style={styles.ratioValueContainer}>
                        <View style={[styles.ratioIndicator, { backgroundColor: status.backgroundColor }]} />
                        <Text style={styles.ratioValue}>{status.value}</Text>
                        {status.status && <Text style={styles.ratioStatus}>{status.status}</Text>}
                      </View>
                    </View>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.power_clean, profile.one_rms.clean_only, 0.79, 0.85)
                  return (
                    <View style={styles.ratioRow}>
                      <Text style={styles.ratioLabel}>Power Clean to Clean</Text>
                      <View style={styles.ratioValueContainer}>
                        <View style={[styles.ratioIndicator, { backgroundColor: status.backgroundColor }]} />
                        <Text style={styles.ratioValue}>{status.value}</Text>
                        {status.status && <Text style={styles.ratioStatus}>{status.status}</Text>}
                      </View>
                    </View>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.jerk_only, profile.one_rms.clean_only, 0.975, 1.075)
                  return (
                    <View style={styles.ratioRow}>
                      <Text style={styles.ratioLabel}>Jerk to Clean</Text>
                      <View style={styles.ratioValueContainer}>
                        <View style={[styles.ratioIndicator, { backgroundColor: status.backgroundColor }]} />
                        <Text style={styles.ratioValue}>{status.value}</Text>
                        {status.status && <Text style={styles.ratioStatus}>{status.status}</Text>}
                      </View>
                    </View>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.snatch, profile.one_rms.clean_and_jerk, 0.775, 0.825)
                  return (
                    <View style={styles.ratioRow}>
                      <Text style={styles.ratioLabel}>Snatch to Clean and Jerk</Text>
                      <View style={styles.ratioValueContainer}>
                        <View style={[styles.ratioIndicator, { backgroundColor: status.backgroundColor }]} />
                        <Text style={styles.ratioValue}>{status.value}</Text>
                        {status.status && <Text style={styles.ratioStatus}>{status.status}</Text>}
                      </View>
                    </View>
                  )
                })()}
              </View>

              {/* Strength Balance */}
              <View>
                <Text style={styles.ratioSubsectionTitle}>STRENGTH BALANCE</Text>
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.front_squat, profile.one_rms.back_squat, 0.8, 0.875)
                  return (
                    <View style={styles.ratioRow}>
                      <Text style={styles.ratioLabel}>Front Squat to Back Squat</Text>
                      <View style={styles.ratioValueContainer}>
                        <View style={[styles.ratioIndicator, { backgroundColor: status.backgroundColor }]} />
                        <Text style={styles.ratioValue}>{status.value}</Text>
                        {status.status && <Text style={styles.ratioStatus}>{status.status}</Text>}
                      </View>
                    </View>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.overhead_squat, profile.one_rms.snatch, 1.05, 1.2)
                  return (
                    <View style={styles.ratioRow}>
                      <Text style={styles.ratioLabel}>Overhead Squat to Snatch</Text>
                      <View style={styles.ratioValueContainer}>
                        <View style={[styles.ratioIndicator, { backgroundColor: status.backgroundColor }]} />
                        <Text style={styles.ratioValue}>{status.value}</Text>
                        {status.status && <Text style={styles.ratioStatus}>{status.status}</Text>}
                      </View>
                    </View>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.push_press, profile.one_rms.strict_press, 1.25, 1.45)
                  return (
                    <View style={styles.ratioRow}>
                      <Text style={styles.ratioLabel}>Push Press to Strict Press</Text>
                      <View style={styles.ratioValueContainer}>
                        <View style={[styles.ratioIndicator, { backgroundColor: status.backgroundColor }]} />
                        <Text style={styles.ratioValue}>{status.value}</Text>
                        {status.status && <Text style={styles.ratioStatus}>{status.status}</Text>}
                      </View>
                    </View>
                  )
                })()}
              </View>
            </View>
          )}
        </View>

        {/* Technical Focus */}
        {profile.technical_focus && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TECHNICAL FOCUS</Text>
              <TouchableOpacity onPress={() => toggleCategory('technical-focus')}>
                <Text style={styles.toggleText}>
                  [{expandedCategories.includes('technical-focus') ? '- Hide' : '+ View'}]
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionDescription}>Targets for technical improvements</Text>
            
            {expandedCategories.includes('technical-focus') && (() => {
              const snatchStrengthDeficit = profile.one_rms.snatch && profile.one_rms.back_squat
                ? (profile.one_rms.snatch / profile.one_rms.back_squat) < 0.6
                : false
              const snatchReceivingDeficit = profile.one_rms.power_snatch && profile.one_rms.snatch
                ? (profile.one_rms.power_snatch / profile.one_rms.snatch) >= 0.88
                : false
              const snatchOverheadDeficit = profile.one_rms.overhead_squat && profile.one_rms.snatch
                ? (profile.one_rms.overhead_squat / profile.one_rms.snatch) < 1.1
                : false
              const snatchDeficits = [snatchStrengthDeficit, snatchReceivingDeficit, snatchOverheadDeficit].filter(Boolean).length
              const snatchStrong = 3 - snatchDeficits

              const cjStrengthDeficit = profile.one_rms.clean_and_jerk && profile.one_rms.back_squat
                ? (profile.one_rms.clean_and_jerk / profile.one_rms.back_squat) < 0.75
                : false
              const cjReceivingDeficit = profile.one_rms.power_clean && profile.one_rms.clean_only
                ? (profile.one_rms.power_clean / profile.one_rms.clean_only) >= 0.88
                : false
              const cjJerkDeficit = profile.one_rms.jerk_only && profile.one_rms.clean_only
                ? (profile.one_rms.jerk_only / profile.one_rms.clean_only) < 0.9
                : false
              const cjDeficits = [cjStrengthDeficit, cjReceivingDeficit, cjJerkDeficit].filter(Boolean).length
              const cjStrong = 3 - cjDeficits

              // Create and sort Snatch items (checkmarks first, then X's)
              const snatchItems = [
                {
                  hasDeficit: snatchStrengthDeficit,
                  title: 'Strength Deficit:',
                  description: `Snatch (${formatWeight(profile.one_rms.snatch)}) is ${safeRatio(profile.one_rms.snatch, profile.one_rms.back_squat)} of back squat (target: 60%+)`
                },
                {
                  hasDeficit: snatchReceivingDeficit,
                  title: 'Receiving Position:',
                  description: `Power snatch is ${safeRatio(profile.one_rms.power_snatch, profile.one_rms.snatch)} of snatch (target: <88%)`
                },
                {
                  hasDeficit: snatchOverheadDeficit,
                  title: 'Overhead Stability:',
                  description: `Overhead squat is ${safeRatio(profile.one_rms.overhead_squat, profile.one_rms.snatch)} of snatch (target: 110%+)`
                }
              ].sort((a, b) => (a.hasDeficit ? 1 : 0) - (b.hasDeficit ? 1 : 0))

              // Create and sort Clean & Jerk items (checkmarks first, then X's)
              const cjItems = [
                {
                  hasDeficit: cjStrengthDeficit,
                  title: 'Overall Strength:',
                  description: `C&J (${formatWeight(profile.one_rms.clean_and_jerk)}) is ${safeRatio(profile.one_rms.clean_and_jerk, profile.one_rms.back_squat)} of back squat (target: 75%+)`
                },
                {
                  hasDeficit: cjReceivingDeficit,
                  title: 'Receiving Position:',
                  description: `Power clean is ${safeRatio(profile.one_rms.power_clean, profile.one_rms.clean_only)} of clean (target: <88%)`
                },
                {
                  hasDeficit: cjJerkDeficit,
                  title: 'Jerk Performance:',
                  description: `Jerk is ${safeRatio(profile.one_rms.jerk_only, profile.one_rms.clean_only)} of clean (target: 90%+)`
                }
              ].sort((a, b) => (a.hasDeficit ? 1 : 0) - (b.hasDeficit ? 1 : 0))

              return (
                <View>
                  <View style={styles.technicalCard}>
                    <Text style={styles.technicalTitle}>
                      Snatch Technical Work
                    </Text>
                    <View style={styles.technicalItems}>
                      {snatchItems.map((item, index) => (
                        <View key={index} style={[styles.technicalItem, item.hasDeficit && styles.technicalItemError]}>
                          <Text style={styles.technicalIcon}>{item.hasDeficit ? '❌' : '✅'}</Text>
                          <Text style={styles.technicalItemText}>
                            {item.hasDeficit ? (
                              <>
                                <Text style={{ color: '#282B34', fontWeight: 'bold' }}>{item.title} </Text>
                                <Text style={{ color: '#282B34' }}>{item.description}</Text>
                              </>
                            ) : (
                              <>
                                <Text style={{ color: '#282B34', fontWeight: 'bold' }}>{item.title} </Text>
                                <Text>{item.description}</Text>
                              </>
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.technicalCard}>
                    <Text style={styles.technicalTitle}>
                      Clean & Jerk Technical Work
                    </Text>
                    <View style={styles.technicalItems}>
                      {cjItems.map((item, index) => (
                        <View key={index} style={[styles.technicalItem, item.hasDeficit && styles.technicalItemError]}>
                          <Text style={styles.technicalIcon}>{item.hasDeficit ? '❌' : '✅'}</Text>
                          <Text style={styles.technicalItemText}>
                            {item.hasDeficit ? (
                              <>
                                <Text style={{ color: '#282B34', fontWeight: 'bold' }}>{item.title} </Text>
                                <Text style={{ color: '#282B34' }}>{item.description}</Text>
                              </>
                            ) : (
                              <>
                                <Text style={{ color: '#282B34', fontWeight: 'bold' }}>{item.title} </Text>
                                <Text>{item.description}</Text>
                              </>
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )
            })()}
          </View>
        )}

        {/* Accessory Needs */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACCESSORY NEEDS</Text>
            <TouchableOpacity onPress={() => toggleCategory('accessory-needs')}>
              <Text style={styles.toggleText}>
                [{expandedCategories.includes('accessory-needs') ? '- Hide' : '+ View'}]
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>Targets for accessory work</Text>
          
          {expandedCategories.includes('accessory-needs') && (() => {
            const needsUpperBack = profile.one_rms.front_squat && profile.one_rms.back_squat ? 
              (profile.one_rms.front_squat / profile.one_rms.back_squat) < 0.85 : false
            
            const needsPosteriorChain = profile.one_rms.deadlift && profile.user_summary.body_weight ?
              (profile.one_rms.deadlift / profile.user_summary.body_weight) < 2.0 : false
            
            const benchBodyweightRatio = profile.one_rms.bench_press && profile.user_summary.body_weight ?
              profile.one_rms.bench_press / profile.user_summary.body_weight : 0
            const pushPressStrictRatio = profile.one_rms.push_press && profile.one_rms.strict_press ?
              profile.one_rms.push_press / profile.one_rms.strict_press : 0
            const needsUpperBodyPressing = benchBodyweightRatio < 0.9 || pushPressStrictRatio > 1.45
            
            const pullupBenchRatio = profile.one_rms.weighted_pullup && profile.one_rms.bench_press ?
              profile.one_rms.weighted_pullup / profile.one_rms.bench_press : 0
            const pullupBodyweightRatio = profile.one_rms.weighted_pullup && profile.user_summary.body_weight ?
              profile.one_rms.weighted_pullup / profile.user_summary.body_weight : 0
            const needsUpperBodyPulling = pullupBenchRatio < 0.4 || pullupBodyweightRatio < 0.33

            // Build text for Upper Body Pulling
            let upperBodyPullingText = ''
            if (needsUpperBodyPulling) {
              upperBodyPullingText = `Weighted pullup (${formatWeight(profile.one_rms.weighted_pullup)}) is ${Math.round(pullupBenchRatio * 100)}% of bench press and ${pullupBodyweightRatio.toFixed(2)}x bodyweight. Target: 40% of bench OR 0.33x bodyweight.`
            } else {
              upperBodyPullingText = `Weighted pullup is ${Math.round(pullupBenchRatio * 100)}% of bench press (target: 40%+) and ${pullupBodyweightRatio.toFixed(2)}x bodyweight (target: 0.33x+)`
            }

            // Build text for Upper Body Pressing
            let upperBodyPressingText = ''
            if (needsUpperBodyPressing) {
              if (benchBodyweightRatio < 0.9 && pushPressStrictRatio > 1.45) {
                upperBodyPressingText = `Bench press is ${benchBodyweightRatio.toFixed(1)}x bodyweight (target: 0.9x) and push press is ${Math.round(pushPressStrictRatio * 100)}% of strict press (target: <145%).`
              } else if (benchBodyweightRatio < 0.9) {
                upperBodyPressingText = `Bench press (${formatWeight(profile.one_rms.bench_press)}) is ${benchBodyweightRatio.toFixed(1)}x bodyweight. Target: 0.9x bodyweight.`
              } else {
                upperBodyPressingText = `Push press is ${Math.round(pushPressStrictRatio * 100)}% of strict press, indicating leg compensation. Target: <145%.`
              }
            } else {
              upperBodyPressingText = `Bench press is ${benchBodyweightRatio.toFixed(1)}x bodyweight (target: 0.9x+) and push press is ${Math.round(pushPressStrictRatio * 100)}% of strict press (target: <145%)`
            }

            // Build text for Upper Back
            const frontSquatRatio = profile.one_rms.front_squat && profile.one_rms.back_squat ?
              (profile.one_rms.front_squat / profile.one_rms.back_squat) : 0
            const upperBackText = needsUpperBack
              ? `Front squat (${formatWeight(profile.one_rms.front_squat)}) is ${Math.round(frontSquatRatio * 100)}% of back squat. Target: 85%+.`
              : `Front squat (${formatWeight(profile.one_rms.front_squat)}) is ${Math.round(frontSquatRatio * 100)}% of back squat (target: 85%+)`

            // Build text for Posterior Chain
            const deadliftBodyweightRatio = profile.one_rms.deadlift && profile.user_summary.body_weight ?
              (profile.one_rms.deadlift / profile.user_summary.body_weight) : 0
            const posteriorChainText = needsPosteriorChain
              ? `Deadlift (${formatWeight(profile.one_rms.deadlift)}) is ${deadliftBodyweightRatio.toFixed(1)}x bodyweight. Target: 2.0x bodyweight.`
              : `Deadlift (${formatWeight(profile.one_rms.deadlift)}) is ${deadliftBodyweightRatio.toFixed(1)}x bodyweight (target: 2.0x+)`

            // Create and sort accessory items (checkmarks first, then X's)
            const accessoryItems = [
              {
                hasDeficit: needsUpperBodyPulling,
                title: 'Upper Body Pulling:',
                description: upperBodyPullingText
              },
              {
                hasDeficit: needsUpperBodyPressing,
                title: 'Upper Body Pressing:',
                description: upperBodyPressingText
              },
              {
                hasDeficit: needsUpperBack,
                title: 'Upper Back:',
                description: upperBackText
              },
              {
                hasDeficit: needsPosteriorChain,
                title: 'Posterior Chain:',
                description: posteriorChainText
              }
            ].sort((a, b) => (a.hasDeficit ? 1 : 0) - (b.hasDeficit ? 1 : 0))

            return (
              <View style={styles.technicalCard}>
                <Text style={styles.technicalTitle}>
                  Accessory Needs
                </Text>
                <View style={styles.technicalItems}>
                  {accessoryItems.map((item, index) => (
                    <View key={index} style={[styles.technicalItem, item.hasDeficit && styles.technicalItemError]}>
                      <Text style={styles.technicalIcon}>{item.hasDeficit ? '❌' : '✅'}</Text>
                      <Text style={styles.technicalItemText}>
                        {item.hasDeficit ? (
                          <>
                            <Text style={{ color: '#FE5858', fontWeight: 'bold' }}>{item.title} </Text>
                            <Text style={{ color: '#282B34' }}>{item.description}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={{ fontWeight: 'bold' }}>{item.title} </Text>
                            <Text>{item.description}</Text>
                          </>
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })()}
        </View>

        {/* Conditioning Benchmarks */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CONDITIONING</Text>
            <TouchableOpacity onPress={() => toggleCategory('conditioning-benchmarks')}>
              <Text style={styles.toggleText}>
                [{expandedCategories.includes('conditioning-benchmarks') ? '- Hide' : '+ View'}]
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>Fundamental engine metrics</Text>
          
          {expandedCategories.includes('conditioning-benchmarks') && (
            <View>
              {/* Running */}
              <View style={styles.benchmarkSubsection}>
                <Text style={styles.benchmarkSubsectionTitle}>RUNNING</Text>
                {profile.benchmarks.mile_run && (
                  <View style={styles.benchmarkRow}>
                    <Text style={styles.benchmarkLabel}>Mile</Text>
                    {editingBenchmark === 'mile_run' ? (
                      <View style={styles.benchmarkEditingContainer}>
                        <TextInput
                          value={benchmarkValues['mile_run'] !== undefined ? benchmarkValues['mile_run'] : (profile.benchmarks.mile_run || '')}
                          onChangeText={(value) => setBenchmarkValues({...benchmarkValues, mile_run: value})}
                          onBlur={() => {
                            const value = benchmarkValues['mile_run'] || profile.benchmarks.mile_run || ''
                            saveBenchmark('mile_run', value)
                          }}
                          placeholder="MM:SS"
                          style={styles.benchmarkInput}
                          autoFocus
                          editable={!savingBenchmark}
                        />
                        {savingBenchmark && <Text style={styles.savingText}>Saving...</Text>}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingBenchmark('mile_run')
                        setBenchmarkValues({...benchmarkValues, mile_run: profile.benchmarks.mile_run || ''})
                      }}>
                        <Text style={styles.benchmarkValue}>{profile.benchmarks.mile_run}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {profile.benchmarks.five_k_run && (
                  <View style={styles.benchmarkRow}>
                    <Text style={styles.benchmarkLabel}>5K</Text>
                    {editingBenchmark === 'five_k_run' ? (
                      <View style={styles.benchmarkEditingContainer}>
                        <TextInput
                          value={benchmarkValues['five_k_run'] !== undefined ? benchmarkValues['five_k_run'] : (profile.benchmarks.five_k_run || '')}
                          onChangeText={(value) => setBenchmarkValues({...benchmarkValues, five_k_run: value})}
                          onBlur={() => {
                            const value = benchmarkValues['five_k_run'] || profile.benchmarks.five_k_run || ''
                            saveBenchmark('five_k_run', value)
                          }}
                          placeholder="MM:SS"
                          style={styles.benchmarkInput}
                          autoFocus
                          editable={!savingBenchmark}
                        />
                        {savingBenchmark && <Text style={styles.savingText}>Saving...</Text>}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingBenchmark('five_k_run')
                        setBenchmarkValues({...benchmarkValues, five_k_run: profile.benchmarks.five_k_run || ''})
                      }}>
                        <Text style={styles.benchmarkValue}>{profile.benchmarks.five_k_run}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {profile.benchmarks.ten_k_run && (
                  <View style={styles.benchmarkRow}>
                    <Text style={styles.benchmarkLabel}>10K</Text>
                    {editingBenchmark === 'ten_k_run' ? (
                      <View style={styles.benchmarkEditingContainer}>
                        <TextInput
                          value={benchmarkValues['ten_k_run'] !== undefined ? benchmarkValues['ten_k_run'] : (profile.benchmarks.ten_k_run || '')}
                          onChangeText={(value) => setBenchmarkValues({...benchmarkValues, ten_k_run: value})}
                          onBlur={() => {
                            const value = benchmarkValues['ten_k_run'] || profile.benchmarks.ten_k_run || ''
                            saveBenchmark('ten_k_run', value)
                          }}
                          placeholder="MM:SS"
                          style={styles.benchmarkInput}
                          autoFocus
                          editable={!savingBenchmark}
                        />
                        {savingBenchmark && <Text style={styles.savingText}>Saving...</Text>}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingBenchmark('ten_k_run')
                        setBenchmarkValues({...benchmarkValues, ten_k_run: profile.benchmarks.ten_k_run || ''})
                      }}>
                        <Text style={styles.benchmarkValue}>{profile.benchmarks.ten_k_run}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Rowing */}
              <View style={styles.benchmarkSubsection}>
                <Text style={styles.benchmarkSubsectionTitle}>ROWING</Text>
                {profile.benchmarks.one_k_row && (
                  <View style={styles.benchmarkRow}>
                    <Text style={styles.benchmarkLabel}>1K</Text>
                    {editingBenchmark === 'one_k_row' ? (
                      <View style={styles.benchmarkEditingContainer}>
                        <TextInput
                          value={benchmarkValues['one_k_row'] !== undefined ? benchmarkValues['one_k_row'] : (profile.benchmarks.one_k_row || '')}
                          onChangeText={(value) => setBenchmarkValues({...benchmarkValues, one_k_row: value})}
                          onBlur={() => {
                            const value = benchmarkValues['one_k_row'] || profile.benchmarks.one_k_row || ''
                            saveBenchmark('one_k_row', value)
                          }}
                          placeholder="MM:SS"
                          style={styles.benchmarkInput}
                          autoFocus
                          editable={!savingBenchmark}
                        />
                        {savingBenchmark && <Text style={styles.savingText}>Saving...</Text>}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingBenchmark('one_k_row')
                        setBenchmarkValues({...benchmarkValues, one_k_row: profile.benchmarks.one_k_row || ''})
                      }}>
                        <Text style={styles.benchmarkValue}>{profile.benchmarks.one_k_row}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {profile.benchmarks.two_k_row && (
                  <View style={styles.benchmarkRow}>
                    <Text style={styles.benchmarkLabel}>2K</Text>
                    {editingBenchmark === 'two_k_row' ? (
                      <View style={styles.benchmarkEditingContainer}>
                        <TextInput
                          value={benchmarkValues['two_k_row'] !== undefined ? benchmarkValues['two_k_row'] : (profile.benchmarks.two_k_row || '')}
                          onChangeText={(value) => setBenchmarkValues({...benchmarkValues, two_k_row: value})}
                          onBlur={() => {
                            const value = benchmarkValues['two_k_row'] || profile.benchmarks.two_k_row || ''
                            saveBenchmark('two_k_row', value)
                          }}
                          placeholder="MM:SS"
                          style={styles.benchmarkInput}
                          autoFocus
                          editable={!savingBenchmark}
                        />
                        {savingBenchmark && <Text style={styles.savingText}>Saving...</Text>}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingBenchmark('two_k_row')
                        setBenchmarkValues({...benchmarkValues, two_k_row: profile.benchmarks.two_k_row || ''})
                      }}>
                        <Text style={styles.benchmarkValue}>{profile.benchmarks.two_k_row}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {profile.benchmarks.five_k_row && (
                  <View style={styles.benchmarkRow}>
                    <Text style={styles.benchmarkLabel}>5K</Text>
                    {editingBenchmark === 'five_k_row' ? (
                      <View style={styles.benchmarkEditingContainer}>
                        <TextInput
                          value={benchmarkValues['five_k_row'] !== undefined ? benchmarkValues['five_k_row'] : (profile.benchmarks.five_k_row || '')}
                          onChangeText={(value) => setBenchmarkValues({...benchmarkValues, five_k_row: value})}
                          onBlur={() => {
                            const value = benchmarkValues['five_k_row'] || profile.benchmarks.five_k_row || ''
                            saveBenchmark('five_k_row', value)
                          }}
                          placeholder="MM:SS"
                          style={styles.benchmarkInput}
                          autoFocus
                          editable={!savingBenchmark}
                        />
                        {savingBenchmark && <Text style={styles.savingText}>Saving...</Text>}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingBenchmark('five_k_row')
                        setBenchmarkValues({...benchmarkValues, five_k_row: profile.benchmarks.five_k_row || ''})
                      }}>
                        <Text style={styles.benchmarkValue}>{profile.benchmarks.five_k_row}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Bike */}
              {profile.benchmarks.air_bike_10_min && (
                <View>
                  <Text style={styles.benchmarkSubsectionTitle}>BIKE</Text>
                  <View style={styles.benchmarkRow}>
                    <Text style={styles.benchmarkLabel}>10-Minute Air Bike</Text>
                    {editingBenchmark === 'air_bike_10_min' ? (
                      <View style={styles.benchmarkEditingContainer}>
                        <TextInput
                          value={benchmarkValues['air_bike_10_min'] !== undefined ? benchmarkValues['air_bike_10_min'] : (profile.benchmarks.air_bike_10_min || '')}
                          onChangeText={(value) => setBenchmarkValues({...benchmarkValues, air_bike_10_min: value})}
                          onBlur={() => {
                            const value = benchmarkValues['air_bike_10_min'] || profile.benchmarks.air_bike_10_min || ''
                            saveBenchmark('air_bike_10_min', value)
                          }}
                          keyboardType="numeric"
                          placeholder="185"
                          style={styles.benchmarkInput}
                          autoFocus
                          editable={!savingBenchmark}
                        />
                        <Text style={styles.unitText}>cal</Text>
                        {savingBenchmark && <Text style={styles.savingText}>Saving...</Text>}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => {
                        setEditingBenchmark('air_bike_10_min')
                        setBenchmarkValues({...benchmarkValues, air_bike_10_min: profile.benchmarks.air_bike_10_min || ''})
                      }}>
                        <Text style={styles.benchmarkValue}>{profile.benchmarks.air_bike_10_min} cal</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Skills Assessment */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SKILLS ASSESSMENT</Text>
            <TouchableOpacity onPress={() => toggleCategory('skills')}>
              <Text style={styles.toggleText}>
                [{expandedCategories.includes('skills') ? '- Hide' : '+ View'}]
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>
            {profile.skills_assessment.advanced_count} advanced • {profile.skills_assessment.total_skills_assessed} total assessed
          </Text>
          
          {expandedCategories.includes('skills') && (
            <View>
              {skillCategories.map((category) => (
                <View key={category.name} style={styles.skillCategoryCard}>
                  <View style={styles.skillCategoryHeader}>
                    <Text style={styles.skillCategoryTitle}>{category.name}</Text>
                    <Text style={styles.skillCategoryStats}>{getCategoryStats(category.skills)}</Text>
                  </View>
                  {category.skills.map((skill) => {
                    const level = getSkillLevel(skill)
                    return (
                      <View key={skill} style={styles.skillRow}>
                        <Text style={styles.skillName}>{getSkillDisplayName(skill)}</Text>
                        {renderSkillLevelIndicator(level)}
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Frequent Foods */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>FREQUENT FOODS</Text>
            <TouchableOpacity onPress={() => setShowFrequentFoods(true)}>
              <Text style={styles.toggleText}>[+ View]</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionDescription}>
            Manage your go-to meals, restaurants, and foods for quick logging ({frequentFoodsCount} saved)
          </Text>
        </View>

        {/* Sign Out Section */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F6FBFE',
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
    backgroundColor: '#F6FBFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  noProfileText: {
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  errorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FE5858',
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
    paddingTop: 48,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#282B34',
    fontWeight: '600',
  },
  bmiBmrContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 16,
  },
  bmiBmrText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  bmiBmrLabel: {
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 100,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C4E2EA',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  toggleText: {
    color: '#FE5858',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionDivider: {
    width: '100%',
    height: 2,
    backgroundColor: '#FE5858',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
  },
  ratioSubsection: {
    marginBottom: 16,
  },
  ratioSubsectionTitle: {
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
    fontSize: 16,
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  ratioLabel: {
    color: '#374151',
    fontSize: 16,
  },
  ratioValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratioIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ratioValue: {
    fontWeight: '500',
    color: '#282B34',
    fontSize: 16,
  },
  ratioStatus: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  technicalCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    padding: 16,
  },
  technicalTitle: {
    fontWeight: '500',
    color: '#282B34',
    marginBottom: 8,
    fontSize: 16,
  },
  technicalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  technicalItems: {
    gap: 8,
  },
  technicalItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  technicalItemError: {
    // Error state styling handled by text color
  },
  technicalIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  technicalItemText: {
    fontSize: 14,
    color: '#282B34', // Dark gray for checkmark items
    flex: 1,
  },
  technicalItemTextError: {
    color: '#FE5858', // Coral/red for deficit items
  },
  accessoryContainer: {
    gap: 12,
  },
  accessoryCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  accessoryCardNeeds: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  accessoryCardGood: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  accessoryCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  accessoryIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  accessoryTextContainer: {
    flex: 1,
  },
  accessoryTitle: {
    fontWeight: '500',
    color: '#282B34',
    marginBottom: 4,
    fontSize: 16,
  },
  accessoryText: {
    fontSize: 14,
    color: '#4B5563',
  },
  benchmarkSubsection: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    padding: 16,
  },
  benchmarkSubsectionTitle: {
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 8,
    fontSize: 16,
  },
  benchmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  benchmarkLabel: {
    color: '#374151',
    fontSize: 16,
  },
  benchmarkEditingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benchmarkInput: {
    width: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#FE5858',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
  },
  benchmarkValue: {
    fontWeight: '500',
    color: '#282B34',
    fontSize: 16,
  },
  skillCategoryCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    padding: 16,
  },
  skillCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skillCategoryTitle: {
    fontWeight: '600',
    color: '#282B34',
    fontSize: 16,
  },
  skillCategoryStats: {
    fontSize: 14,
    color: '#4B5563',
  },
  skillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  skillName: {
    color: '#374151',
    fontSize: 14,
  },
  skillLevel: {
    fontSize: 14,
    fontWeight: '500',
  },
  skillLevelAdvanced: {
    color: '#FE5858',
  },
  skillLevelIntermediate: {
    color: '#C4E2EA',
  },
  skillLevelBeginner: {
    color: '#4B5563',
  },
  skillLevelNone: {
    color: '#9CA3AF',
  },
  savingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  unitText: {
    fontSize: 14,
    color: '#4B5563',
  },
  // 1RM Lifts Section Styles
  oneRMLiftsContainer: {
    paddingTop: 16,
  },
  oneRMLiftGroup: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    padding: 16,
  },
  oneRMLiftGroupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  oneRMLiftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  oneRMLiftItem: {
    width: '48%',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  oneRMLiftLabel: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  oneRMLiftValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#282B34',
  },
  // Meal Templates Section
  loadingSection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptySection: {
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  templateRowInfo: {
    flex: 1,
  },
  templateRowName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  templateRowDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  templateRowUsage: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteTemplateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteTemplateText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  setupButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  setupButtonText: {
    fontSize: 14,
    color: '#282B34',
    fontWeight: '600',
  },
  intakeBanner: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 2,
  },
  intakeBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  intakeBannerText: {
    fontSize: 14,
    color: '#78350F',
    marginBottom: 12,
    lineHeight: 20,
  },
  intakeBannerButton: {
    alignSelf: 'flex-start',
  },
  signOutButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  subscriptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
  },
  subscriptionSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  frequentFoodsSection: {
    width: '100%',
  },
  frequentFoodsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  frequentFoodsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequentFoodsViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FE5858',
  },
})
