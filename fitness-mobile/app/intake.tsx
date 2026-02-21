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
  Platform,
  Switch,
  KeyboardAvoidingView
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
  'Concept2 BikeErg', 'Other'
]

// Equipment categories (matching settings page)
const basicsEquipment = [
  'Barbell', 'Dumbbells', 'Kettlebells', 'Pullup Bar or Rig', 'High Rings', 'Low or Adjustable Rings',
  'Bench', 'Squat Rack', 'Open Space', 'Wall Space', 'Jump Rope', 'Wall Ball'
]

const machinesEquipment = ['Rowing Machine', 'Air Bike', 'Ski Erg', 'Bike Erg']

const lessCommonEquipment = ['GHD', 'Axle Bar', 'Climbing Rope', 'Pegboard', 'Parallettes', 'Dball', 'Dip Bar', 'Plyo Box', 'HS Walk Obstacle', 'Sandbag']

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
  const [hasExistingProgram, setHasExistingProgram] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isAppliedPower, setIsAppliedPower] = useState(false)
  const [isEngine, setIsEngine] = useState(false)
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

  // Update active sections and form arrays when sport changes
  useEffect(() => {
    if (sportId && SPORT_CONFIGS[sportId]) {
      const config = SPORT_CONFIGS[sportId]
      setActiveSections(config.sections)
      // Reset to first active section
      setCurrentSection(config.sections[0])
      // Update form arrays to match sport config (only if size doesn't match)
      const totalSkills = config.skillCategories.reduce((sum, cat) => sum + cat.skills.length, 0)
      
      setFormData(prev => {
        // Only reset if array size doesn't match (sport actually changed)
        const needsSkillsReset = prev.skills.length !== totalSkills
        const needsOneRMsReset = prev.oneRMs.length !== config.oneRMLifts.length
        
        if (!needsSkillsReset && !needsOneRMsReset) return prev
        
        return {
          ...prev,
          skills: needsSkillsReset ? new Array(totalSkills).fill("Don't have it") : prev.skills,
          oneRMs: needsOneRMsReset ? new Array(config.oneRMLifts.length).fill('') : prev.oneRMs
        }
      })
    }
  }, [sportId])

  // ============================================
  // POLL INTAKE STATUS WHEN GENERATING
  // ============================================
  const GENERATION_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

  useEffect(() => {
    if (intakeStatus === 'generating' && userId) {
      setIsGenerating(true)
      const startTime = Date.now()

      const pollInterval = setInterval(async () => {
        // Timeout: if generation has been running too long, let the user retry
        if (Date.now() - startTime > GENERATION_TIMEOUT_MS) {
          setIsGenerating(false)
          setIntakeStatus('timeout') // Prevent useEffect from restarting the poll loop
          clearInterval(pollInterval)
          Alert.alert(
            'Generation Timed Out',
            'Program generation is taking longer than expected. You can retry or contact support.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Retry', onPress: () => completeIntake() }
            ]
          )
          return
        }

        try {
          const supabase = createClient()
          const { data: userData } = await supabase
            .from('users')
            .select('intake_status, intake_error_message, subscription_tier')
            .eq('id', userId)
            .single()

          if (userData) {
            setIntakeStatus(userData.intake_status)

            if (userData.intake_status === 'complete') {
              setIsGenerating(false)
              clearInterval(pollInterval)
              // Route based on subscription tier
              const destination = userData.subscription_tier === 'BTN'
                ? '/btn/workouts'
                : '/(tabs)'

              Alert.alert(
                'Success!',
                userData.subscription_tier === 'BTN'
                  ? 'Your profile is ready! Time to generate some workouts.'
                  : 'Your program has been generated!',
                [{ text: 'OK', onPress: () => router.push(destination) }]
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

      // Check subscription tier to determine active sections
      const subscriptionTier = (userData as any).subscription_tier
      if (subscriptionTier === 'APPLIED_POWER') {
        setIsAppliedPower(true)
        setActiveSections([1, 4]) // Personal Info + 1RM Lifts only
      } else if (subscriptionTier === 'ENGINE') {
        setIsEngine(true)
        setActiveSections([1, 3]) // Personal Info + Conditioning only
      } else {
        setActiveSections([1, 2, 3, 4]) // All sections for Premium/BTN
      }

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
      
      // Check if user has existing program (for generating message)
      setHasExistingProgram(!!programData)

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
      // Auto-save after user has visited section 2+ (indicates they're actively filling out the form)
      if (userId && currentSection > 1) {
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
  // VALIDATION
  // ============================================
  const validateIntake = (): string | null => {
    if (!formData.name.trim()) return 'Name is required'
    if (!formData.email.trim()) return 'Email is required'
    if (!formData.gender) return 'Gender is required'
    if (!formData.units) return 'Units are required'
    if (!formData.bodyWeight.trim()) return 'Body weight is required'
    return null
  }

  // ============================================
  // COMPLETE INTAKE
  // ============================================
  const completeIntake = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found')
      return
    }

    // Validate required fields
    const validationError = validateIntake()
    if (validationError) {
      Alert.alert('Missing Information', validationError)
      return
    }

    setCompleting(true)
    try {
      const supabase = createClient()
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert('Error', 'Not authenticated')
        setCompleting(false)
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
      setCompleting(false) // Reset completing state after successful submission
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete intake')
      setCompleting(false)
    }
  }

  // ============================================
  // FORM HANDLERS
  // ============================================
  const handleEquipmentToggle = (equipment: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      equipment: checked
        ? [...prev.equipment, equipment]
        : prev.equipment.filter(e => e !== equipment)
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
    // For time fields (MM:SS format), validate during input
    const timeFields = ['mile_run', 'five_k_run', 'ten_k_run', 'one_k_row', 'two_k_row', 'five_k_row']
    if (timeFields.includes(field)) {
      // Allow empty, digits, and colon for MM:SS format
      // Prevent invalid characters
      if (value === '' || /^[\d:]*$/.test(value)) {
        setFormData(prev => ({
          ...prev,
          conditioningBenchmarks: {
            ...prev.conditioningBenchmarks,
            [field]: value
          }
        }))
      }
    } else {
      // Non-time fields - allow any value
      setFormData(prev => ({
        ...prev,
        conditioningBenchmarks: {
          ...prev.conditioningBenchmarks,
          [field]: value
        }
      }))
    }
  }

  const formatTimeOnBlur = (field: string, value: string) => {
    let formatted = value.trim()
    if (!formatted) {
      handleBenchmarkChange(field, '')
      return
    }

    if (formatted.includes(':')) {
      const parts = formatted.split(':')
      if (parts.length === 2) {
        let minutes = parseInt(parts[0] || '0')
        let seconds = parseInt(parts[1] || '0')
        
        // Enforce range: 00:00 to 59:59
        if (isNaN(minutes)) minutes = 0
        if (isNaN(seconds)) seconds = 0
        
        // Clamp minutes to 0-59
        minutes = Math.max(0, Math.min(59, minutes))
        // Clamp seconds to 0-59
        seconds = Math.max(0, Math.min(59, seconds))
        
        formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        handleBenchmarkChange(field, formatted)
      }
    } else if (/^\d+$/.test(formatted)) {
      // Handle numeric input (e.g., "615" becomes "06:15")
      if (formatted.length <= 2) {
        const num = parseInt(formatted) || 0
        const clamped = Math.max(0, Math.min(59, num))
        formatted = `${clamped.toString().padStart(2, '0')}:00`
      } else if (formatted.length <= 4) {
        const mins = parseInt(formatted.slice(0, 2)) || 0
        const secs = parseInt(formatted.slice(2)) || 0
        const clampedMins = Math.max(0, Math.min(59, mins))
        const clampedSecs = Math.max(0, Math.min(59, secs))
        formatted = `${clampedMins.toString().padStart(2, '0')}:${clampedSecs.toString().padStart(2, '0')}`
      } else {
        const mins = parseInt(formatted.slice(0, 2)) || 0
        const secs = parseInt(formatted.slice(2, 4)) || 0
        const clampedMins = Math.max(0, Math.min(59, mins))
        const clampedSecs = Math.max(0, Math.min(59, secs))
        formatted = `${clampedMins.toString().padStart(2, '0')}:${clampedSecs.toString().padStart(2, '0')}`
      }
      handleBenchmarkChange(field, formatted)
    } else {
      // Invalid format - clear it
      handleBenchmarkChange(field, '')
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
          <Text style={styles.generatingTitle}>
            {hasExistingProgram ? 'Updating Your Profile' : 'Generating Your Program'}
          </Text>
          <Text style={styles.generatingSubtitle}>
            {hasExistingProgram 
              ? 'This usually takes less than a minute. We\'re updating your profile with your latest information.'
              : 'This usually takes 3-5 minutes. Hang tight while we personalize everything for you.'}
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Athlete Intake</Text>

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
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Name *"
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Email *"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gender *</Text>
            <View style={styles.pickerRow}>
              {['Male', 'Female', 'Prefer not to say'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pickerOption,
                    formData.gender === option && styles.pickerOptionSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, gender: option as any }))}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    formData.gender === option && styles.pickerOptionTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Units *</Text>
              <View style={styles.pickerRow}>
              {['Imperial (lbs)', 'Metric (kg)'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pickerOption,
                    formData.units === option && styles.pickerOptionSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, units: option as any }))}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    formData.units === option && styles.pickerOptionTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Body Weight ({formData.units === 'Metric (kg)' ? 'kg' : 'lbs'}) *</Text>
              <TextInput
                style={styles.input}
                placeholder={`Body Weight (${formData.units === 'Metric (kg)' ? 'kg' : 'lbs'}) *`}
                value={formData.bodyWeight}
                onChangeText={(text) => setFormData(prev => ({ ...prev, bodyWeight: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Height ({formData.units === 'Metric (kg)' ? 'cm' : 'inches'})</Text>
              <TextInput
                style={styles.input}
                placeholder={`Height (${formData.units === 'Metric (kg)' ? 'cm' : 'inches'})`}
                value={formData.height}
                onChangeText={(text) => setFormData(prev => ({ ...prev, height: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                placeholder="Age"
                value={formData.age}
                onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.equipmentAvailableHeader}>Equipment Available</Text>
            
            {/* The Basics */}
            <View style={styles.equipmentSection}>
              <Text style={styles.equipmentCategoryTitle}>The Basics</Text>
              <View style={styles.equipmentGrid}>
                {basicsEquipment.map(eq => (
                  <View key={eq} style={styles.equipmentItem}>
                    <View style={styles.equipmentRow}>
                      <Switch
                        value={formData.equipment.includes(eq)}
                        onValueChange={(checked) => handleEquipmentToggle(eq, checked)}
                        trackColor={{ false: '#C4E2EA', true: '#FE5858' }}
                        thumbColor={formData.equipment.includes(eq) ? '#fff' : '#f4f3f4'}
                      />
                      <Text style={styles.equipmentLabel}>{eq}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* The Machines */}
            <View style={styles.equipmentSection}>
              <Text style={styles.equipmentCategoryTitle}>The Machines</Text>
              <View style={styles.equipmentGrid}>
                {machinesEquipment.map(eq => (
                  <View key={eq} style={styles.equipmentItem}>
                    <View style={styles.equipmentRow}>
                      <Switch
                        value={formData.equipment.includes(eq)}
                        onValueChange={(checked) => handleEquipmentToggle(eq, checked)}
                        trackColor={{ false: '#C4E2EA', true: '#FE5858' }}
                        thumbColor={formData.equipment.includes(eq) ? '#fff' : '#f4f3f4'}
                      />
                      <Text style={styles.equipmentLabel}>{eq}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Less Common Equipment */}
            <View style={styles.equipmentSection}>
              <Text style={styles.equipmentCategoryTitle}>Less Common Equipment</Text>
              <View style={styles.equipmentGrid}>
                {lessCommonEquipment.map(eq => (
                  <View key={eq} style={styles.equipmentItem}>
                    <View style={styles.equipmentRow}>
                      <Switch
                        value={formData.equipment.includes(eq)}
                        onValueChange={(checked) => handleEquipmentToggle(eq, checked)}
                        trackColor={{ false: '#C4E2EA', true: '#FE5858' }}
                        thumbColor={formData.equipment.includes(eq) ? '#fff' : '#f4f3f4'}
                      />
                      <Text style={styles.equipmentLabel}>{eq}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

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
                  {category.skills.map((skill) => {
                    const currentValue = formData.skills[skill.index]
                    const levels = category.levels
                    
                    return (
                      <View key={skill.name} style={styles.skillItem}>
                        <Text style={styles.skillName}>{skill.name}</Text>
                        <View style={styles.skillLevels}>
                          {/* First row: first two buttons side-by-side */}
                          <View style={styles.skillLevelRow}>
                            {levels.slice(0, 2).map((level) => {
                              const isSelected = currentValue === level
                              return (
                                <TouchableOpacity
                                  key={level}
                                  style={[
                                    styles.skillLevelButton,
                                    isSelected ? styles.skillLevelButtonSelected : styles.skillLevelButtonUnselected
                                  ]}
                                  onPress={() => handleSkillChange(skill.index, level)}
                                >
                                  <Text style={[
                                    styles.skillLevelText,
                                    isSelected ? styles.skillLevelTextSelected : styles.skillLevelTextUnselected
                                  ]}>
                                    {level}
                                  </Text>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                          {/* Second row: third button alone */}
                          {levels[2] && (
                            <View style={styles.skillLevelRow}>
                              <TouchableOpacity
                                style={[
                                  styles.skillLevelButton,
                                  currentValue === levels[2] ? styles.skillLevelButtonSelected : styles.skillLevelButtonUnselected
                                ]}
                                onPress={() => handleSkillChange(skill.index, levels[2])}
                              >
                                <Text style={[
                                  styles.skillLevelText,
                                  currentValue === levels[2] ? styles.skillLevelTextSelected : styles.skillLevelTextUnselected
                                ]}>
                                  {levels[2]}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          {/* Third row: fourth button alone */}
                          {levels[3] && (
                            <View style={styles.skillLevelRow}>
                              <TouchableOpacity
                                style={[
                                  styles.skillLevelButton,
                                  currentValue === levels[3] ? styles.skillLevelButtonSelected : styles.skillLevelButtonUnselected
                                ]}
                                onPress={() => handleSkillChange(skill.index, levels[3])}
                              >
                                <Text style={[
                                  styles.skillLevelText,
                                  currentValue === levels[3] ? styles.skillLevelTextSelected : styles.skillLevelTextUnselected
                                ]}>
                                  {levels[3]}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    )
                  })}
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

            <View style={styles.benchmarkGroup}>
              <View style={styles.benchmarkHeader}>
                <Text style={styles.benchmarkHeaderText}>Running Benchmarks</Text>
              </View>
              <View>
                <View style={styles.benchmarkInputGroup}>
                  <Text style={styles.benchmarkLabel}>1 Mile Run (MM:SS)</Text>
                  <TextInput
                    style={styles.benchmarkInput}
                    placeholder="1 Mile Run (MM:SS)"
                    value={formData.conditioningBenchmarks.mile_run}
                    onChangeText={(text) => handleBenchmarkChange('mile_run', text)}
                    onBlur={(e) => formatTimeOnBlur('mile_run', e.nativeEvent.text)}
                  />
                </View>
                <View style={styles.benchmarkInputGroup}>
                  <Text style={styles.benchmarkLabel}>5K Run (MM:SS)</Text>
                  <TextInput
                    style={styles.benchmarkInput}
                    placeholder="5K Run (MM:SS)"
                    value={formData.conditioningBenchmarks.five_k_run}
                    onChangeText={(text) => handleBenchmarkChange('five_k_run', text)}
                    onBlur={(e) => formatTimeOnBlur('five_k_run', e.nativeEvent.text)}
                  />
                </View>
                <View style={styles.benchmarkInputGroup}>
                  <Text style={styles.benchmarkLabel}>10K Run (MM:SS)</Text>
                  <TextInput
                    style={styles.benchmarkInput}
                    placeholder="10K Run (MM:SS)"
                    value={formData.conditioningBenchmarks.ten_k_run}
                    onChangeText={(text) => handleBenchmarkChange('ten_k_run', text)}
                    onBlur={(e) => formatTimeOnBlur('ten_k_run', e.nativeEvent.text)}
                  />
                </View>
              </View>
            </View>

            <View style={styles.benchmarkGroup}>
              <View style={styles.benchmarkHeader}>
                <Text style={styles.benchmarkHeaderText}>Rowing Benchmarks</Text>
              </View>
              <View>
                <View style={styles.benchmarkInputGroup}>
                  <Text style={styles.benchmarkLabel}>1K Row (MM:SS)</Text>
                  <TextInput
                    style={styles.benchmarkInput}
                    placeholder="1K Row (MM:SS)"
                    value={formData.conditioningBenchmarks.one_k_row}
                    onChangeText={(text) => handleBenchmarkChange('one_k_row', text)}
                    onBlur={(e) => formatTimeOnBlur('one_k_row', e.nativeEvent.text)}
                  />
                </View>
                <View style={styles.benchmarkInputGroup}>
                  <Text style={styles.benchmarkLabel}>2K Row (MM:SS)</Text>
                  <TextInput
                    style={styles.benchmarkInput}
                    placeholder="2K Row (MM:SS)"
                    value={formData.conditioningBenchmarks.two_k_row}
                    onChangeText={(text) => handleBenchmarkChange('two_k_row', text)}
                    onBlur={(e) => formatTimeOnBlur('two_k_row', e.nativeEvent.text)}
                  />
                </View>
                <View style={styles.benchmarkInputGroup}>
                  <Text style={styles.benchmarkLabel}>5K Row (MM:SS)</Text>
                  <TextInput
                    style={styles.benchmarkInput}
                    placeholder="5K Row (MM:SS)"
                    value={formData.conditioningBenchmarks.five_k_row}
                    onChangeText={(text) => handleBenchmarkChange('five_k_row', text)}
                    onBlur={(e) => formatTimeOnBlur('five_k_row', e.nativeEvent.text)}
                  />
                </View>
              </View>
            </View>

            <View style={styles.benchmarkGroup}>
              <View style={styles.benchmarkHeader}>
                <Text style={styles.benchmarkHeaderText}>Bike Benchmarks</Text>
              </View>
              <View>
                <View style={styles.benchmarkInputGroup}>
                  <Text style={styles.benchmarkLabel}>10-Minute Air Bike (calories)</Text>
                  <TextInput
                    style={styles.benchmarkInput}
                    placeholder="10-Minute Air Bike (calories)"
                    value={formData.conditioningBenchmarks.ten_min_air_bike}
                    onChangeText={(text) => handleBenchmarkChange('ten_min_air_bike', text)}
                    keyboardType="number-pad"
                  />
                </View>
                {formData.conditioningBenchmarks.ten_min_air_bike && (
                  <View style={styles.benchmarkInputGroup}>
                    <Text style={styles.benchmarkLabel}>Air Bike Type</Text>
                    <View style={styles.pickerRow}>
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
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* Section 4: 1RM Lifts */}
        {currentSection === 4 && activeSections.includes(4) && (
          <Card style={styles.sectionCard}>
            <SectionHeader title="Section 4: 1RM Lifts" />
            <Text style={styles.sectionDescription}>
              Enter your 1-Rep Max.
              For Weighted Pullup, enter added weight only.
            </Text>

            <View style={styles.liftGroup}>
              <Text style={styles.liftGroupTitle}>Snatch</Text>
              {['Snatch', 'Power Snatch'].map((ex) => {
                const index = currentSportConfig.oneRMLifts.indexOf(ex)
                return (
                  <View key={ex} style={styles.liftInputGroup}>
                    <Text style={styles.liftLabel}>{ex}</Text>
                    <TextInput
                      style={styles.liftInput}
                      placeholder=""
                      value={formData.oneRMs[index]}
                      onChangeText={(text) => handleOneRMChange(index, text)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )
              })}
            </View>

            <View style={styles.liftGroup}>
              <Text style={styles.liftGroupTitle}>Clean and Jerk</Text>
              {['Clean and Jerk', 'Power Clean', 'Clean (clean only)', 'Jerk (from rack or blocks, max Split or Power Jerk)'].map((ex) => {
                const index = currentSportConfig.oneRMLifts.indexOf(ex)
                return (
                  <View key={ex} style={styles.liftInputGroup}>
                    <Text style={styles.liftLabel}>{ex}</Text>
                    <TextInput
                      style={styles.liftInput}
                      placeholder=""
                      value={formData.oneRMs[index]}
                      onChangeText={(text) => handleOneRMChange(index, text)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )
              })}
            </View>

            <View style={styles.liftGroup}>
              <Text style={styles.liftGroupTitle}>Squats</Text>
              {['Back Squat', 'Front Squat', 'Overhead Squat'].map((ex) => {
                const index = currentSportConfig.oneRMLifts.indexOf(ex)
                return (
                  <View key={ex} style={styles.liftInputGroup}>
                    <Text style={styles.liftLabel}>{ex}</Text>
                    <TextInput
                      style={styles.liftInput}
                      placeholder=""
                      value={formData.oneRMs[index]}
                      onChangeText={(text) => handleOneRMChange(index, text)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )
              })}
            </View>

            <View style={styles.liftGroup}>
              <Text style={styles.liftGroupTitle}>Pulling</Text>
              {['Weighted Pullup (do not include body weight)', 'Deadlift'].map((ex) => {
                const index = currentSportConfig.oneRMLifts.indexOf(ex)
                return (
                  <View key={ex} style={styles.liftInputGroup}>
                    <Text style={styles.liftLabel}>{ex}</Text>
                    <TextInput
                      style={styles.liftInput}
                      placeholder=""
                      value={formData.oneRMs[index]}
                      onChangeText={(text) => handleOneRMChange(index, text)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )
              })}
            </View>

            <View style={styles.liftGroup}>
              <Text style={styles.liftGroupTitle}>Presses</Text>
              {['Bench Press', 'Push Press', 'Strict Press'].map((ex) => {
                const index = currentSportConfig.oneRMLifts.indexOf(ex)
                return (
                  <View key={ex} style={styles.liftInputGroup}>
                    <Text style={styles.liftLabel}>{ex}</Text>
                    <TextInput
                      style={styles.liftInput}
                      placeholder=""
                      value={formData.oneRMs[index]}
                      onChangeText={(text) => handleOneRMChange(index, text)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )
              })}
            </View>
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
    </KeyboardAvoidingView>
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
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    width: '100%'
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8
  },
  equipmentAvailableHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    marginTop: 24,
    marginBottom: 12
  },
  equipmentSection: {
    marginBottom: 24,
  },
  equipmentCategoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  equipmentItem: {
    width: '50%',
    marginBottom: 12,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    flex: 1,
    flexWrap: 'wrap',
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
    borderColor: '#282B34',
    borderRadius: 8,
    padding: 16,
  },
  skillCategoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
    textAlign: 'center',
  },
  skillItem: {
    marginBottom: 16,
  },
  skillName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  skillLevels: {
    flexDirection: 'column',
    gap: 8,
  },
  skillLevelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skillLevelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  skillLevelButtonSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  skillLevelButtonUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  skillLevelText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  skillLevelTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  skillLevelTextUnselected: {
    color: '#374151',
  },
  benchmarkGroup: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    padding: 16,
  },
  benchmarkHeader: {
    marginBottom: 12,
  },
  benchmarkHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
  },
  benchmarkInputGroup: {
    marginBottom: 16,
  },
  benchmarkLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  benchmarkInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    width: '100%'
  },
  benchmarkInputWithMargin: {
    marginBottom: 16,
  },
  pickerContainer: {
    marginTop: 8
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minWidth: 100
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
  liftGroup: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    padding: 16,
  },
  liftGroupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
    textAlign: 'center',
  },
  liftInputGroup: {
    marginBottom: 16,
  },
  liftLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  liftInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    width: '100%'
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
