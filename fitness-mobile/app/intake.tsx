import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'

// ============================================
// SPORT CONFIGURATION (Extensible for future sports)
// ============================================
const SPORT_CONFIGS: Record<number, {
  name: string
  sections: number[]
  equipmentOptions: string[]
  skillCategories: Array<{
    name: string
    skills: Array<{ name: string; index: number }>
    levels: string[]
  }>
  oneRMLifts: string[]
}> = {
  1: { // CrossFit
    name: 'CrossFit',
    sections: [1, 2, 3, 4], // Personal Info, Skills, Conditioning, 1RMs
    equipmentOptions: [
      'Air Bike', 'Axle Bar', 'Barbell', 'Bench', 'Squat Rack', 'Climbing Rope',
      'Dball', 'Dip Bar', 'Dumbbells', 'Plyo Box', 'GHD', 'HS Walk Obstacle',
      'High Rings', 'Low or Adjustable Rings', 'Jump Rope', 'Kettlebells',
      'Open Space', 'Parallettes', 'Pegboard', 'Pullup Bar or Rig',
      'Rowing Machine', 'Ski Erg', 'Bike Erg', 'Sandbag', 'Wall Ball',
      'Wall Space'
    ],
    skillCategories: [
      {
        name: 'Basic Skills',
        skills: [
          { name: 'Double Unders', index: 0 },
          { name: 'Wall Balls', index: 1 }
        ],
        levels: ["Don't have it", "Beginner (1-25)", "Intermediate (26-50)", "Advanced (More than 50)"]
      },
      {
        name: 'Upper Body Pulling',
        skills: [
          { name: 'Toes to Bar', index: 2 },
          { name: 'Pull-ups (kipping or butterfly)', index: 3 },
          { name: 'Chest to Bar Pull-ups', index: 4 },
          { name: 'Strict Pull-ups', index: 5 }
        ],
        levels: ["Don't have it", "Beginner (1-7)", "Intermediate (8-15)", "Advanced (More than 15)"]
      },
      {
        name: 'Upper Body Pressing',
        skills: [
          { name: 'Push-ups', index: 6 },
          { name: 'Ring Dips', index: 7 },
          { name: 'Strict Ring Dips', index: 8 },
          { name: 'Strict Handstand Push-ups', index: 9 },
          { name: 'Wall Facing Handstand Push-ups', index: 10 },
          { name: 'Deficit Handstand Push-ups (4")', index: 11 }
        ],
        levels: ["Don't have it", "Beginner (1-10)", "Intermediate (11-20)", "Advanced (More than 20)"]
      },
      {
        name: 'Additional Common Skills',
        skills: [
          { name: 'Alternating Pistols', index: 12 },
          { name: 'GHD Sit-ups', index: 13 },
          { name: 'Wall Walks', index: 14 }
        ],
        levels: ["Don't have it", "Beginner (1-10)", "Intermediate (11-20)", "Advanced (More than 20)"]
      },
      {
        name: 'Advanced Upper Body Pulling',
        skills: [
          { name: 'Ring Muscle Ups', index: 15 },
          { name: 'Bar Muscle Ups', index: 16 },
          { name: 'Rope Climbs', index: 17 }
        ],
        levels: ["Don't have it", "Beginner (1-5)", "Intermediate (6-10)", "Advanced (More than 10)"]
      },
      {
        name: 'Holds',
        skills: [
          { name: 'Wall Facing Handstand Hold', index: 18 },
          { name: 'Freestanding Handstand Hold', index: 19 }
        ],
        levels: ["Don't have it", "Beginner (1-30s)", "Intermediate (30s-60s)", "Advanced (More than 60s)"]
      },
      {
        name: 'Advanced Gymnastics',
        skills: [
          { name: 'Legless Rope Climbs', index: 20 },
          { name: 'Pegboard Ascent', index: 21 },
          { name: 'Handstand Walk (10m or 25\')', index: 22 },
          { name: 'Seated Legless Rope Climbs', index: 23 },
          { name: 'Strict Ring Muscle Ups', index: 24 },
          { name: 'Handstand Walk Obstacle Crossings', index: 25 }
        ],
        levels: ["Don't have it", "Beginner (1-2)", "Intermediate (3-5)", "Advanced (More than 5)"]
      }
    ],
    oneRMLifts: [
      'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (clean only)',
      'Jerk (from rack or blocks, max Split or Power Jerk)', 'Back Squat', 'Front Squat',
      'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press', 'Strict Press',
      'Weighted Pullup (do not include body weight)'
    ]
  }
  // Future: Add other sports here
  // 2: { // Baseball
  //   name: 'Baseball',
  //   sections: [1, 5, 6],
  //   equipmentOptions: [...],
  //   skillCategories: [...],
  //   oneRMLifts: [...]
  // }
}

const airBikeTypes = [
  'Assault Bike', 'Rogue Echo Bike', 'Schwinn Airdyne',
  'Concept2 BikeErg', 'Other', 'Did not use Air Bike'
]

// ============================================
// INTERFACES
// ============================================
interface IntakeFormData {
  name: string
  email: string
  gender: 'Male' | 'Female' | 'Prefer not to say' | ''
  units: 'Imperial (lbs)' | 'Metric (kg)' | ''
  bodyWeight: string
  height: string
  age: string
  equipment: string[]
  skills: string[]
  conditioningBenchmarks: {
    mile_run: string
    five_k_run: string
    ten_k_run: string
    one_k_row: string
    two_k_row: string
    five_k_row: string
    ten_min_air_bike: string
    entered_time_trial: 'Y' | 'N' | ''
    air_bike_type: string
  }
  oneRMs: string[]
  preferences?: {
    threeMonthGoals?: string
    monthlyPrimaryGoal?: string
    preferredMetconExercises?: string[]
    avoidedExercises?: string[]
    trainingDaysPerWeek?: number
    primaryStrengthLifts?: string[]
    emphasizedStrengthLifts?: string[]
  }
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function IntakePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentSection, setCurrentSection] = useState(1)
  const [sportId, setSportId] = useState<number>(1) // Default to CrossFit
  const [activeSections, setActiveSections] = useState<number[]>([1, 2, 3, 4])
  const [draftSaving, setDraftSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [intakeStatus, setIntakeStatus] = useState<string | null>(null) // 'draft' | 'generating' | 'complete' | 'failed'
  const [isGenerating, setIsGenerating] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const currentSportConfig = SPORT_CONFIGS[sportId] || SPORT_CONFIGS[1] // Fallback to CrossFit

  const [formData, setFormData] = useState<IntakeFormData>({
    name: '',
    email: '',
    gender: '',
    units: 'Imperial (lbs)',
    bodyWeight: '',
    height: '',
    age: '',
    equipment: [],
    skills: new Array(26).fill("Don't have it"), // CrossFit has 26 skills
    conditioningBenchmarks: {
      mile_run: '',
      five_k_run: '',
      ten_k_run: '',
      one_k_row: '',
      two_k_row: '',
      five_k_row: '',
      ten_min_air_bike: '',
      entered_time_trial: '',
      air_bike_type: ''
    },
    oneRMs: new Array(14).fill(''), // CrossFit has 14 lifts
    preferences: {}
  })

  // ============================================
  // LOAD USER DATA & SPORT_ID
  // ============================================
  useEffect(() => {
    loadUserData()
  }, [])

  // Update active sections when sport changes
  useEffect(() => {
    if (sportId && SPORT_CONFIGS[sportId]) {
      setActiveSections(SPORT_CONFIGS[sportId].sections)
      // Reset to first active section
      setCurrentSection(SPORT_CONFIGS[sportId].sections[0])
    }
  }, [sportId])

  // ============================================
  // POLL INTAKE STATUS WHEN GENERATING
  // ============================================
  useEffect(() => {
    if (intakeStatus === 'generating' && userId) {
      setIsGenerating(true)
      const pollInterval = setInterval(async () => {
        try {
          const supabase = createClient()
          const { data: userData } = await supabase
            .from('users')
            .select('intake_status, intake_error_message')
            .eq('id', userId)
            .single()

          if (userData) {
            setIntakeStatus(userData.intake_status)

            if (userData.intake_status === 'complete') {
              setIsGenerating(false)
              clearInterval(pollInterval)
              Alert.alert(
                'Success!',
                'Your program has been generated!',
                [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
              )
            } else if (userData.intake_status === 'failed') {
              setIsGenerating(false)
              clearInterval(pollInterval)
              Alert.alert(
                'Generation Failed',
                userData.intake_error_message || 'Program generation failed. Please try again.',
                [
                  { text: 'OK', style: 'default' },
                  { text: 'Retry', onPress: () => completeIntake() }
                ]
              )
            }
          }
        } catch (err) {
          console.error('Error polling intake status:', err)
        }
      }, 2500) // Poll every 2.5 seconds

      return () => clearInterval(pollInterval)
    }
  }, [intakeStatus, userId])

  // ============================================
  // LOAD USER DATA
  // ============================================
  const loadUserData = async () => {
    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Load user with sport_id (if it exists on users table) or default to 1
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, body_weight, height, age, units, gender, conditioning_benchmarks, intake_status')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        setLoading(false)
        return
      }

      setUserId(userData.id)
      setIntakeStatus(userData.intake_status || 'draft')

      // Get sport_id from user's most recent program, or default to 1
      const { data: programData } = await supabase
        .from('programs')
        .select('sport_id')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const userSportId = programData?.sport_id || 1
      setSportId(userSportId)

      // Load existing data
      setFormData(prev => ({
        ...prev,
        name: userData.name || '',
        email: userData.email || '',
        gender: userData.gender || '',
        units: userData.units || 'Imperial (lbs)',
        bodyWeight: userData.body_weight?.toString() || '',
        height: userData.height?.toString() || '',
        age: userData.age?.toString() || '',
        conditioningBenchmarks: userData.conditioning_benchmarks || prev.conditioningBenchmarks
      }))

      // Load equipment
      const { data: equipmentData } = await supabase
        .from('user_equipment')
        .select('equipment_name')
        .eq('user_id', userData.id)

      if (equipmentData && equipmentData.length > 0) {
        setFormData(prev => ({
          ...prev,
          equipment: equipmentData.map((e: any) => e.equipment_name)
        }))
      }

      // Load skills
      const { data: skillsData } = await supabase
        .from('user_skills')
        .select('skill_name, skill_level')
        .eq('user_id', userData.id)

      if (skillsData && skillsData.length > 0) {
        const skillsArray: string[] = new Array(26).fill("Don't have it")
        skillsData.forEach((skill: any) => {
          for (const category of currentSportConfig.skillCategories) {
            const skillDef = category.skills.find((s: any) => s.name === skill.skill_name)
            if (skillDef) {
              skillsArray[skillDef.index] = skill.skill_level
              break
            }
          }
        })
        setFormData(prev => ({ ...prev, skills: skillsArray }))
      }

      // Load 1RMs
      const { data: oneRMsData } = await supabase
        .from('user_one_rms')
        .select('exercise_name, one_rm')
        .eq('user_id', userData.id)

      if (oneRMsData && oneRMsData.length > 0) {
        const oneRMsArray: string[] = new Array(14).fill('')
        const oneRMMapping: { [key: string]: number } = {
          'Snatch': 0, 'Power Snatch': 1, 'Clean and Jerk': 2, 'Power Clean': 3,
          'Clean (clean only)': 4, 'Jerk (from rack or blocks, max Split or Power Jerk)': 5,
          'Back Squat': 6, 'Front Squat': 7, 'Overhead Squat': 8, 'Deadlift': 9,
          'Bench Press': 10, 'Push Press': 11, 'Strict Press': 12,
          'Weighted Pullup (do not include body weight)': 13
        }
        oneRMsData.forEach((rm: any) => {
          const index = oneRMMapping[rm.exercise_name]
          if (index !== undefined) {
            oneRMsArray[index] = rm.one_rm.toString()
          }
        })
        setFormData(prev => ({ ...prev, oneRMs: oneRMsArray }))
      }

      // Load preferences
      const { data: prefsData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userData.id)
        .single()

      if (prefsData) {
        setFormData(prev => ({
          ...prev,
          preferences: {
            threeMonthGoals: prefsData.three_month_goals || '',
            monthlyPrimaryGoal: prefsData.monthly_primary_goal || '',
            preferredMetconExercises: prefsData.preferred_metcon_exercises || [],
            avoidedExercises: prefsData.avoided_exercises || [],
            trainingDaysPerWeek: prefsData.training_days_per_week,
            primaryStrengthLifts: prefsData.primary_strength_lifts || [],
            emphasizedStrengthLifts: prefsData.emphasized_strength_lifts || []
          }
        }))
      }

      // Load draft if exists
      const { data: draftData } = await supabase
        .from('intake_drafts')
        .select('draft_data')
        .eq('user_id', userData.id)
        .single()

      if (draftData?.draft_data) {
        const draft = draftData.draft_data as any
        setFormData(prev => ({
          ...prev,
          equipment: draft.equipment || prev.equipment,
          skills: draft.skills || prev.skills,
          oneRMs: draft.oneRMs || prev.oneRMs,
          bodyWeight: draft.bodyWeight || prev.bodyWeight,
          height: draft.height || prev.height,
          age: draft.age || prev.age,
          gender: draft.gender || prev.gender,
          units: draft.units || prev.units,
          conditioningBenchmarks: draft.benchmarks || prev.conditioningBenchmarks,
          preferences: draft.preferences || prev.preferences
        }))
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading user data:', err)
      setError('Failed to load user data')
      setLoading(false)
    }
  }

  // ============================================
  // DRAFT AUTO-SAVE (Debounced)
  // ============================================
  const saveDraft = async () => {
    if (!userId) return

    setDraftSaving(true)
    try {
      const supabase = createClient()
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.error('No session for draft save')
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/save-intake-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mode: 'draft',
          userId: userId,
          equipment: formData.equipment,
          skills: formData.skills,
          oneRMs: formData.oneRMs,
          bodyWeight: formData.bodyWeight,
          height: formData.height,
          age: formData.age,
          gender: formData.gender,
          units: formData.units,
          benchmarks: formData.conditioningBenchmarks,
          preferences: formData.preferences
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Draft save error:', errorData)
      }
    } catch (err) {
      console.error('Error saving draft:', err)
    } finally {
      setDraftSaving(false)
    }
  }

  // Auto-save draft after changes (debounced)
  useEffect(() => {
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current)
    }

    draftSaveTimeoutRef.current = setTimeout(() => {
      if (userId && currentSection > 1) { // Don't auto-save on first section
        saveDraft()
      }
    }, 2000) // 2 second debounce

    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current)
      }
    }
  }, [formData, userId, currentSection])

  // ============================================
  // COMPLETE INTAKE
  // ============================================
  const completeIntake = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found')
      return
    }

    setCompleting(true)
    try {
      const supabase = createClient()
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert('Error', 'Not authenticated')
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/save-intake-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mode: 'complete',
          userId: userId,
          equipment: formData.equipment,
          skills: formData.skills,
          oneRMs: formData.oneRMs,
          bodyWeight: formData.bodyWeight,
          height: formData.height,
          age: formData.age,
          gender: formData.gender,
          units: formData.units,
          benchmarks: formData.conditioningBenchmarks,
          preferences: formData.preferences
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to complete intake')
      }

      const result = await response.json()
      setIntakeStatus('generating')
      setIsGenerating(true)
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete intake')
      setCompleting(false)
    }
  }

  // ============================================
  // FORM HANDLERS
  // ============================================
  const handleEquipmentToggle = (equipment: string) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.includes(equipment)
        ? prev.equipment.filter(e => e !== equipment)
        : [...prev.equipment, equipment]
    }))
  }

  const handleSkillChange = (index: number, value: string) => {
    const newSkills = [...formData.skills]
    newSkills[index] = value
    setFormData(prev => ({ ...prev, skills: newSkills }))
  }

  const handleOneRMChange = (index: number, value: string) => {
    const newOneRMs = [...formData.oneRMs]
    newOneRMs[index] = value
    setFormData(prev => ({ ...prev, oneRMs: newOneRMs }))
  }

  const handleBenchmarkChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      conditioningBenchmarks: {
        ...prev.conditioningBenchmarks,
        [field]: value
      }
    }))
  }

  const formatTimeOnBlur = (field: string, value: string) => {
    let formatted = value.trim()
    if (!formatted) return

    if (formatted.includes(':')) {
      const parts = formatted.split(':')
      if (parts.length === 2) {
        const minutes = parts[0] || '0'
        const seconds = parts[1].padStart(2, '0').slice(0, 2) || '00'
        const secNum = parseInt(seconds)
        if (!isNaN(secNum) && secNum > 59) {
          formatted = `${minutes}:59`
        } else {
          formatted = `${minutes}:${seconds}`
        }
        handleBenchmarkChange(field, formatted)
      }
    } else if (/^\d+$/.test(formatted)) {
      if (formatted.length <= 2) {
        formatted = `${formatted}:00`
      } else if (formatted.length <= 4) {
        formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`
      } else {
        formatted = `${formatted.slice(0, 2)}:${formatted.slice(2, 4)}`
      }
      handleBenchmarkChange(field, formatted)
    }
  }

  const nextSection = () => {
    const currentIndex = activeSections.indexOf(currentSection)
    if (currentIndex < activeSections.length - 1) {
      setCurrentSection(activeSections[currentIndex + 1])
    }
  }

  const prevSection = () => {
    const currentIndex = activeSections.indexOf(currentSection)
    if (currentIndex > 0) {
      setCurrentSection(activeSections[currentIndex - 1])
    }
  }

  // ============================================
  // RENDER GENERATING SCREEN
  // ============================================
  if (isGenerating) {
    return (
      <View style={styles.container}>
        <View style={styles.generatingContainer}>
          <ActivityIndicator size="large" color="#FE5858" />
          <Text style={styles.generatingTitle}>Generating Your Program</Text>
          <Text style={styles.generatingSubtitle}>
            This takes about 60 seconds. Hang tight while we personalize everything for you.
          </Text>
          {draftSaving && (
            <Text style={styles.savingText}>Saving draft...</Text>
          )}
        </View>
      </View>
    )
  }

  // ============================================
  // RENDER LOADING
  // ============================================
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FE5858" />
          <Text style={styles.loadingText}>Loading your intake form...</Text>
        </View>
      </View>
    )
  }

  // ============================================
  // RENDER ERROR
  // ============================================
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button onPress={() => router.back()} variant="primary">
            Go Back
          </Button>
        </View>
      </View>
    )
  }

  // ============================================
  // RENDER SECTIONS
  // ============================================
  const sectionTitles = ['Personal Info', 'Skills', 'Conditioning', '1RM Lifts']
  const currentSectionIndex = activeSections.indexOf(currentSection)
  const progress = ((currentSectionIndex + 1) / activeSections.length) * 100

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Athlete Intake</Text>
          <Text style={styles.subtitle}>{currentSportConfig.name}</Text>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              Section {currentSectionIndex + 1} of {activeSections.length} ({Math.round(progress)}%)
            </Text>
          </View>
        </View>

        {/* Section 1: Personal Information */}
        {currentSection === 1 && (
          <Card style={styles.sectionCard}>
            <SectionHeader title="Section 1: Personal Information" />
            
            <TextInput
              style={styles.input}
              placeholder="Name *"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Email *"
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Gender *</Text>
            <View style={styles.buttonRow}>
              {['Male', 'Female', 'Prefer not to say'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    formData.gender === option && styles.optionButtonSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, gender: option as any }))}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.gender === option && styles.optionButtonTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Units *</Text>
            <View style={styles.buttonRow}>
              {['Imperial (lbs)', 'Metric (kg)'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    formData.units === option && styles.optionButtonSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, units: option as any }))}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.units === option && styles.optionButtonTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder={`Body Weight (${formData.units === 'Metric (kg)' ? 'kg' : 'lbs'}) *`}
              value={formData.bodyWeight}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bodyWeight: text }))}
              keyboardType="decimal-pad"
            />

            <TextInput
              style={styles.input}
              placeholder={`Height (${formData.units === 'Metric (kg)' ? 'cm' : 'inches'})`}
              value={formData.height}
              onChangeText={(text) => setFormData(prev => ({ ...prev, height: text }))}
              keyboardType="decimal-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Age"
              value={formData.age}
              onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Equipment Available</Text>
            <ScrollView style={styles.equipmentScroll} nestedScrollEnabled>
              {currentSportConfig.equipmentOptions.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.equipmentItem,
                    formData.equipment.includes(item) && styles.equipmentItemSelected
                  ]}
                  onPress={() => handleEquipmentToggle(item)}
                >
                  <Text style={[
                    styles.equipmentText,
                    formData.equipment.includes(item) && styles.equipmentTextSelected
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.equipmentCount}>
              {formData.equipment.length} items selected
            </Text>
          </Card>
        )}

        {/* Section 2: Skills */}
        {currentSection === 2 && activeSections.includes(2) && (
          <Card style={styles.sectionCard}>
            <SectionHeader title="Section 2: Skills" />
            <Text style={styles.sectionDescription}>
              Please choose the range into which your maximum unbroken set falls.
            </Text>

            <ScrollView style={styles.skillsScroll} nestedScrollEnabled>
              {currentSportConfig.skillCategories.map((category) => (
                <View key={category.name} style={styles.skillCategory}>
                  <Text style={styles.skillCategoryTitle}>{category.name}</Text>
                  {category.skills.map((skill) => (
                    <View key={skill.name} style={styles.skillItem}>
                      <Text style={styles.skillName}>{skill.name}</Text>
                      <View style={styles.skillLevels}>
                        {category.levels.map((level) => {
                          const levelName = level.split(' (')[0]
                          const currentValue = formData.skills[skill.index]
                          const currentValueName = currentValue?.split(' (')[0]
                          const selected = currentValueName === levelName
                          const short = level.includes('(') ? level.substring(level.indexOf('(') + 1, level.indexOf(')')) : level

                          return (
                            <TouchableOpacity
                              key={level}
                              style={[
                                styles.skillLevelButton,
                                selected && styles.skillLevelButtonSelected
                              ]}
                              onPress={() => handleSkillChange(skill.index, level)}
                            >
                              <Text style={[
                                styles.skillLevelText,
                                selected && styles.skillLevelTextSelected
                              ]}>
                                {short}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Section 3: Conditioning Benchmarks */}
        {currentSection === 3 && activeSections.includes(3) && (
          <Card style={styles.sectionCard}>
            <SectionHeader title="Section 3: Conditioning Benchmarks" />
            <Text style={styles.sectionDescription}>
              Enter times in MM:SS format. Leave blank if not recently performed.
            </Text>

            <Text style={styles.benchmarkGroupTitle}>Running</Text>
            <TextInput
              style={styles.input}
              placeholder="1 Mile Run (MM:SS)"
              value={formData.conditioningBenchmarks.mile_run}
              onChangeText={(text) => handleBenchmarkChange('mile_run', text)}
              onBlur={(e) => formatTimeOnBlur('mile_run', e.nativeEvent.text)}
            />
            <TextInput
              style={styles.input}
              placeholder="5K Run (MM:SS)"
              value={formData.conditioningBenchmarks.five_k_run}
              onChangeText={(text) => handleBenchmarkChange('five_k_run', text)}
              onBlur={(e) => formatTimeOnBlur('five_k_run', e.nativeEvent.text)}
            />
            <TextInput
              style={styles.input}
              placeholder="10K Run (MM:SS)"
              value={formData.conditioningBenchmarks.ten_k_run}
              onChangeText={(text) => handleBenchmarkChange('ten_k_run', text)}
              onBlur={(e) => formatTimeOnBlur('ten_k_run', e.nativeEvent.text)}
            />

            <Text style={styles.benchmarkGroupTitle}>Rowing</Text>
            <TextInput
              style={styles.input}
              placeholder="1K Row (MM:SS)"
              value={formData.conditioningBenchmarks.one_k_row}
              onChangeText={(text) => handleBenchmarkChange('one_k_row', text)}
              onBlur={(e) => formatTimeOnBlur('one_k_row', e.nativeEvent.text)}
            />
            <TextInput
              style={styles.input}
              placeholder="2K Row (MM:SS)"
              value={formData.conditioningBenchmarks.two_k_row}
              onChangeText={(text) => handleBenchmarkChange('two_k_row', text)}
              onBlur={(e) => formatTimeOnBlur('two_k_row', e.nativeEvent.text)}
            />
            <TextInput
              style={styles.input}
              placeholder="5K Row (MM:SS)"
              value={formData.conditioningBenchmarks.five_k_row}
              onChangeText={(text) => handleBenchmarkChange('five_k_row', text)}
              onBlur={(e) => formatTimeOnBlur('five_k_row', e.nativeEvent.text)}
            />

            <Text style={styles.benchmarkGroupTitle}>Air Bike</Text>
            <TextInput
              style={styles.input}
              placeholder="10-Minute Air Bike (calories)"
              value={formData.conditioningBenchmarks.ten_min_air_bike}
              onChangeText={(text) => handleBenchmarkChange('ten_min_air_bike', text)}
              keyboardType="number-pad"
            />
            {formData.conditioningBenchmarks.ten_min_air_bike && (
              <View style={styles.pickerContainer}>
                <Text style={styles.label}>Air Bike Type</Text>
                <ScrollView style={styles.pickerScroll}>
                  {airBikeTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pickerOption,
                        formData.conditioningBenchmarks.air_bike_type === type && styles.pickerOptionSelected
                      ]}
                      onPress={() => handleBenchmarkChange('air_bike_type', type)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        formData.conditioningBenchmarks.air_bike_type === type && styles.pickerOptionTextSelected
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </Card>
        )}

        {/* Section 4: 1RM Lifts */}
        {currentSection === 4 && activeSections.includes(4) && (
          <Card style={styles.sectionCard}>
            <SectionHeader title="Section 4: 1RM Lifts" />
            <Text style={styles.sectionDescription}>
              Enter your 1-Rep Max in {formData.units === 'Metric (kg)' ? 'kilograms' : 'pounds'}.
              For Weighted Pullup, enter added weight only.
            </Text>

            <ScrollView style={styles.oneRMScroll} nestedScrollEnabled>
              {currentSportConfig.oneRMLifts.map((lift, index) => (
                <View key={lift} style={styles.oneRMItem}>
                  <Text style={styles.oneRMLabel}>{lift}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={formData.units === 'Metric (kg)' ? 'e.g., 100.5' : 'e.g., 225.5'}
                    value={formData.oneRMs[index]}
                    onChangeText={(text) => handleOneRMChange(index, text)}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          <Button
            onPress={prevSection}
            disabled={currentSectionIndex === 0}
            variant="secondary"
            style={styles.navButton}
          >
            Previous
          </Button>

          {currentSectionIndex < activeSections.length - 1 ? (
            <Button
              onPress={nextSection}
              variant="primary"
              style={styles.navButton}
            >
              Next
            </Button>
          ) : (
            <Button
              onPress={completeIntake}
              disabled={completing}
              variant="primary"
              loading={completing}
              style={styles.navButton}
            >
              Complete Intake & Generate Program
            </Button>
          )}
        </View>

        {draftSaving && (
          <Text style={styles.draftSavingText}>Saving draft...</Text>
        )}
      </ScrollView>
    </View>
  )
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  },
  header: {
    marginBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16
  },
  progressContainer: {
    marginTop: 16
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FE5858',
    borderRadius: 4
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center'
  },
  sectionCard: {
    padding: 20,
    marginBottom: 16
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minWidth: 100
  },
  optionButtonSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858'
  },
  optionButtonText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center'
  },
  optionButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  equipmentScroll: {
    maxHeight: 200,
    marginBottom: 8
  },
  equipmentItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginBottom: 8
  },
  equipmentItemSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858'
  },
  equipmentText: {
    fontSize: 14,
    color: '#374151'
  },
  equipmentTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  equipmentCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8
  },
  skillsScroll: {
    maxHeight: 500
  },
  skillCategory: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#FFFFFF'
  },
  skillCategoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 16,
    backgroundColor: '#DAE2EA',
    padding: 12,
    borderRadius: 8
  },
  skillItem: {
    marginBottom: 16
  },
  skillName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center'
  },
  skillLevels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center'
  },
  skillLevelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minWidth: 70
  },
  skillLevelButtonSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858'
  },
  skillLevelText: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center'
  },
  skillLevelTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  benchmarkGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: '#DAE2EA',
    padding: 12,
    borderRadius: 8
  },
  pickerContainer: {
    marginTop: 8
  },
  pickerScroll: {
    maxHeight: 150
  },
  pickerOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginBottom: 8
  },
  pickerOptionSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858'
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#374151'
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  oneRMScroll: {
    maxHeight: 500
  },
  oneRMItem: {
    marginBottom: 16
  },
  oneRMLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12
  },
  navButton: {
    flex: 1
  },
  draftSavingText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 24,
    textAlign: 'center'
  },
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  generatingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginTop: 24,
    marginBottom: 8
  },
  generatingSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24
  },
  savingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 16
  }
})
