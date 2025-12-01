'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

// Form data structure that matches your database schema
interface IntakeFormData {
  // Section 1: Personal Information
  name: string
  email: string
  gender: 'Male' | 'Female' | 'Prefer not to say' | ''
  units: 'Imperial (lbs)' | 'Metric (kg)' | ''
  bodyWeight: string
  height: string
  age: string
  equipment: string[]
  
  // Section 2: Skills (26 skills, 0-25 index)
  skills: string[] // Array of 26 skill levels
  
  // Section 3: Conditioning Benchmarks
  conditioningBenchmarks: {
    mileRun: string
    fiveKRun: string
    tenKRun: string
    oneKRow: string
    twoKRow: string
    fiveKRow: string
    airBike10MinCalories: string
    enteredTimeTrial: 'Y' | 'N' | ''
    airBikeType: string
  }
  
  // Section 4: 1RM Lifts (14 lifts, 0-13 index)
  oneRMs: string[] // Array of 14 1RM values
  
  // New: Password fields for new users
  password: string
  confirmPassword: string

  // New: Preferences
  preferences?: {
    threeMonthGoals: string
    monthlyPrimaryGoal: string
    preferredMetconExercises: string[]
    avoidedExercises: string[]
    trainingDaysPerWeek?: number
    primaryStrengthLifts?: string[]
    emphasizedStrengthLifts?: string[]
    selectedGoals?: string[]
    metconTimeFocus?: string[]
  }
}

interface StripeSessionData {
  email: string
  name: string
  sessionId: string
  isValid: boolean
  productType?: 'premium' | 'applied_power' | 'btn' | 'engine'
}

const equipmentOptions = [
  'Air Bike', 'Axle Bar', 'Barbell', 'Bench', 'Squat Rack', 'Climbing Rope',
  'Dball', 'Dip Bar', 'Dumbbells', 'Plyo Box', 'GHD', 'HS Walk Obstacle',
  'High Rings', 'Low or Adjustable Rings', 'Jump Rope', 'Kettlebells',
  'Open Space', 'Parallettes', 'Pegboard', 'Pullup Bar or Rig',
  'Rowing Machine', 'Ski Erg', 'Bike Erg', 'Sandbag', 'Wall Ball',
  'Wall Space'
]

const skillCategories = [
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
]

const oneRMLifts = [
  'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (clean only)',
  'Jerk (from rack or blocks, max Split or Power Jerk)', 'Back Squat', 'Front Squat',
  'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press', 'Strict Press',
  'Weighted Pullup (do not include body weight)'
]

const airBikeTypes = [
  'Assault Bike', 'Rogue Echo Bike', 'Schwinn Airdyne', 
  'Concept2 BikeErg', 'Other', 'Did not use Air Bike'
]

// Equipment Category Card Component
interface EquipmentCategoryCardProps {
  title: string
  description: string
  icon: string
  equipment: string[]
  formData: IntakeFormData
  toggleEquipment: (equipment: string) => void
  colorClass: string
  onSetEquipment: (list: string[]) => void
}

function EquipmentCategoryCard({ title, description, icon, equipment, formData, toggleEquipment, colorClass, onSetEquipment }: EquipmentCategoryCardProps) {
  const selectedCount = equipment.filter(item => formData.equipment.includes(item)).length
  
  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors">
      <div className={`${colorClass} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: '#FE5858', color: '#ffffff' }}>
              {selectedCount}/{equipment.length}
            </span>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                className="px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  const merged = Array.from(new Set([...(formData.equipment || []), ...equipment]))
                  onSetEquipment(merged)
                }}
              >
                Select All
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  const filtered = (formData.equipment || []).filter(item => !equipment.includes(item))
                  onSetEquipment(filtered)
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {equipment.map((item) => (
            <label key={item} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
              <input
                type="checkbox"
                checked={formData.equipment.includes(item)}
                onChange={() => toggleEquipment(item)}
                className="rounded border-gray-300 h-5 w-5 accent-[#DAE2EA]"
              />
              <span className="text-sm text-gray-700">{item}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// Component that uses useSearchParams
function IntakeFormContent() {
  
const [currentSection, setCurrentSection] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [genProgress, setGenProgress] = useState<number>(0)
  const [confirmSubmission, setConfirmSubmission] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('')
  const [stripeSession, setStripeSession] = useState<StripeSessionData | null>(null)
  const [isNewPaidUser, setIsNewPaidUser] = useState(false)
  const [productType, setProductType] = useState<'premium' | 'applied_power' | 'btn' | 'engine'>('premium')
  const router = useRouter()
  const searchParams = useSearchParams()

  const sectionTitles = ['Personal Info', 'Skills', 'Conditioning', '1RM Lifts', 'Generate']
  
  // Define which sections are active based on product type
  // Applied Power: Skip Skills (2) and Conditioning (3)
  // Engine: Skip Skills (2) and 1RM Lifts (4) - only Personal Info, Conditioning, Generate
  const activeSections = productType === 'applied_power' 
    ? [true, false, false, true, true]  // Sections 1, 4, 5 only
    : productType === 'engine'
    ? [true, false, true, false, true]   // Sections 1, 3, 5 only
    : [true, true, true, true, true]      // All sections
  
  // Calculate active section count for progress display
  const activeSectionCount = activeSections.filter(Boolean).length
  const primaryBtn = 'px-6 py-2 bg-[#FE5858] text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
  const secondaryBtn = 'px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'

  // Ensure each section loads at the top of the page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [currentSection])

  // Simulated generation progress while submitting
  useEffect(() => {
    if (!isSubmitting) return
    setGenProgress(0)
    const interval = setInterval(() => {
      setGenProgress(prev => {
        const next = Math.min(prev + 0.75, 90) // ease up to 90%
        return next
      })
    }, 500)
    return () => clearInterval(interval)
  }, [isSubmitting])

  // Helper: split MM:SS string into minutes/seconds numbers
  const getTimeParts = (val?: string) => {
    const str = (val || '').trim()
    if (!str || !str.includes(':')) return { m: '', s: '' }
    const [m, s] = str.split(':')
    return { m: m || '', s: s || '' }
  }

  // Helper: render a MM:SS time input (two boxes with a fixed colon)
  const TimeInput = ({ label, field } : { label: string, field: keyof IntakeFormData['conditioningBenchmarks'] }) => {
    const { m, s } = getTimeParts(formData.conditioningBenchmarks[field] as string)
    const updateMinutes = (minStr: string) => {
      const min = (minStr || '').replace(/[^0-9]/g, '')
      // Only pad seconds if there's already a seconds value, otherwise leave it empty
      const sec = (s || '').replace(/[^0-9]/g, '')
      const paddedSec = sec ? String(Math.max(0, Math.min(59, parseInt(sec || '0')))).padStart(2, '0') : ''
      const newVal = min ? `${parseInt(min)}:${paddedSec}` : ''
      updateFormData('conditioningBenchmarks', { ...formData.conditioningBenchmarks, [field]: newVal })
    }
    const updateSeconds = (secStr: string) => {
      const min = (m || '0').replace(/[^0-9]/g, '')
      const sec = (secStr || '').replace(/[^0-9]/g, '')
      // Only pad if there's a value, don't force "00" when empty
      const secNum = sec ? String(Math.max(0, Math.min(59, parseInt(sec || '0')))).padStart(2, '0') : ''
      const newVal = min ? `${parseInt(min)}:${secNum || '00'}` : secNum ? `0:${secNum}` : ''
      updateFormData('conditioningBenchmarks', { ...formData.conditioningBenchmarks, [field]: newVal })
    }
    return (
      <div>
        <label className="block text-sm text-gray-700 mb-2">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            min={0}
            value={m}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => updateMinutes(e.target.value)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FE5858]"
            placeholder="MM"
          />
          <span className="text-gray-700">:</span>
          <input
            type="text"
            min={0}
            max={59}
            value={s}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => updateSeconds(e.target.value)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FE5858]"
            placeholder="SS"
          />
        </div>
      </div>
    )
  }

  const [formData, setFormData] = useState<IntakeFormData>({
    name: '',
    email: '',
    gender: '',
    units: '',
    bodyWeight: '',
    height: '',
    age: '',
    equipment: [],
    skills: new Array(26).fill("Don't have it"),
    conditioningBenchmarks: {
      mileRun: '',
      fiveKRun: '',
      tenKRun: '',
      oneKRow: '',
      twoKRow: '',
      fiveKRow: '',
      airBike10MinCalories: '',
      enteredTimeTrial: '',
      airBikeType: ''
    },
    oneRMs: new Array(14).fill(''),
    password: '',
    confirmPassword: '',
    preferences: {
      threeMonthGoals: '',
      monthlyPrimaryGoal: '',
      preferredMetconExercises: [],
      avoidedExercises: []
    }
  })

  const [availableExercises, setAvailableExercises] = useState<string[]>([])
  const [availableStrengthLifts, setAvailableStrengthLifts] = useState<string[]>([])

  // Verify Stripe session
  const verifyStripeSession = async (sessionId: string): Promise<StripeSessionData | null> => {
    try {
      console.log('🔍 Verifying Stripe session:', sessionId)
      
      // Call Stripe API to verify session
      const response = await fetch(`/api/verify-stripe-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (!response.ok) {
        console.error('❌ Failed to verify Stripe session')
        return null
      }

      const sessionData = await response.json()
      console.log('✅ Stripe session verified:', sessionData)
      
      // Determine product type from price ID by querying the database
      const priceId = sessionData.line_items?.data?.[0]?.price?.id
      let productType: 'premium' | 'applied_power' | 'btn' | 'engine' = 'premium'
      
      if (priceId) {
        try {
          const productTypeResponse = await fetch(`/api/get-product-type`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceId })
          })
          
          if (productTypeResponse.ok) {
            const productTypeData = await productTypeResponse.json()
            productType = productTypeData.productType as 'premium' | 'applied_power' | 'btn' | 'engine'
            console.log('📦 Product type detected from database:', productType, 'from price:', priceId)
          } else {
            console.warn('⚠️ Failed to get product type from database, defaulting to premium')
          }
        } catch (error) {
          console.error('❌ Error getting product type:', error)
          // Default to premium on error
        }
      }
      
      return {
        email: sessionData.customer_details?.email || '',
        name: sessionData.customer_details?.name || '',
        sessionId: sessionId,
        isValid: true,
        productType: productType
      }
    } catch (error) {
      console.error('❌ Error verifying Stripe session:', error)
      return null
    }
  }

  // Check authentication and session on mount
  useEffect(() => {
    const checkUserAndSession = async () => {
      try {
        const supabase = createClient()
        const sessionId = searchParams.get('session_id')
        
        if (sessionId) {
          // New paid user flow - verify Stripe session
          console.log('🔔 New paid user with session ID:', sessionId)
          
          const sessionData = await verifyStripeSession(sessionId)
          if (sessionData) {
            setStripeSession(sessionData)
            setIsNewPaidUser(true)
            if (sessionData.productType) {
              setProductType(sessionData.productType)
              console.log('🎯 Product type set to:', sessionData.productType)
            }
            setFormData(prev => ({
              ...prev,
              email: sessionData.email,
              name: sessionData.name
            }))
            setLoading(false)
            return
          } else {
            setSubmitMessage('❌ Invalid session. Please contact support or try purchasing again.')
            setLoading(false)
            return
          }
        }

        // Existing user flow - check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          router.push('/auth/signin')
          return
        }

      setUser(user)

// First find the database user by auth_id
const { data: dbUser, error: dbUserError } = await supabase
  .from('users')
  .select('id')
  .eq('auth_id', user.id)
  .single()

if (dbUserError || !dbUser) {
  console.error('Error finding database user:', dbUserError)
  setSubmitMessage('❌ Error: Unable to find user account')
  setLoading(false)
  return
}

// Get user's subscription status using database user_id
const { data: subscription, error: subError } = await supabase
  .from('subscriptions')
  .select('status')
  .eq('user_id', dbUser.id)
  .single()

if (subError) {
  console.error('Error fetching subscription:', subError)
  setSubmitMessage('❌ Error: Unable to verify subscription status')
  setLoading(false)
  return
}

if (!subscription || subscription.status !== 'active') {
  setSubmitMessage('❌ Access Denied: Active subscription required to access the intake form')
  setLoading(false)
  return
}

setSubscriptionStatus(subscription.status)

        // Pre-populate form with existing user data if available
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', dbUser.id)
          .single()

        if (userData && !userError) {
          // Load basic user info
          let loadedData: Partial<IntakeFormData> = {
            name: userData.name || '',
            email: userData.email || user.email || '',
            gender: userData.gender || '',
            units: userData.units || '',
            bodyWeight: userData.body_weight?.toString() || '',
            height: userData.height?.toString() || '',
            age: userData.age?.toString() || '',
            conditioningBenchmarks: userData.conditioning_benchmarks || {
              mileRun: '', fiveKRun: '', tenKRun: '',
              oneKRow: '', twoKRow: '', fiveKRow: '',
              airBike10MinCalories: '', enteredTimeTrial: '', airBikeType: ''
            }
          }
          
          console.log('🏃 Conditioning benchmarks from DB:', userData.conditioning_benchmarks)

          // Load equipment
          const { data: equipmentData, error: equipmentError } = await supabase
            .from('user_equipment')
            .select('equipment_name')
            .eq('user_id', dbUser.id)

          console.log('📦 Equipment data:', equipmentData?.length, 'items', equipmentError ? `Error: ${equipmentError.message}` : '')
          
          if (equipmentData && equipmentData.length > 0) {
            loadedData.equipment = equipmentData.map((e: any) => e.equipment_name)
            console.log('✅ Loaded equipment:', loadedData.equipment)
          }

          // Load skills
          const { data: skillsData, error: skillsError } = await supabase
            .from('user_skills')
            .select('skill_name, skill_level')
            .eq('user_id', dbUser.id)

          console.log('🎯 Skills data:', skillsData?.length, 'items', skillsError ? `Error: ${skillsError.message}` : '')

          if (skillsData && skillsData.length > 0) {
            // Initialize skills array with 26 individual strings (not using fill)
            const skillsArray: string[] = []
            for (let i = 0; i < 26; i++) {
              skillsArray.push("Don't have it")
            }
            
            // Map skill names to indices and populate
            skillsData.forEach((skill: any) => {
              // Find the index for this skill name across all categories
              for (const category of skillCategories) {
                const skillDef = category.skills.find((s: any) => s.name === skill.skill_name)
                if (skillDef) {
                  skillsArray[skillDef.index] = skill.skill_level
                  break
                }
              }
            })
            
            loadedData.skills = skillsArray
            console.log('✅ Loaded skills:', skillsArray.filter(s => s !== "Don't have it").length, 'non-default')
          }

          // Load 1RMs
          const { data: oneRMsData, error: oneRMsError } = await supabase
            .from('user_one_rms')
            .select('exercise_name, one_rm')
            .eq('user_id', dbUser.id)

          console.log('💪 1RMs data:', oneRMsData?.length, 'items', oneRMsError ? `Error: ${oneRMsError.message}` : '')

          if (oneRMsData && oneRMsData.length > 0) {
            // Initialize 1RMs array with 14 individual empty strings
            const oneRMsArray: string[] = []
            for (let i = 0; i < 14; i++) {
              oneRMsArray.push('')
            }
            
            // Map exercise names to indices
            const oneRMMapping: { [key: string]: number } = {
              'Snatch': 0,
              'Power Snatch': 1,
              'Clean and Jerk': 2,
              'Power Clean': 3,
              'Clean (clean only)': 4,
              'Jerk (from rack or blocks, max Split or Power Jerk)': 5,
              'Back Squat': 6,
              'Front Squat': 7,
              'Overhead Squat': 8,
              'Deadlift': 9,
              'Bench Press': 10,
              'Push Press': 11,
              'Strict Press': 12,
              'Weighted Pullup (do not include body weight)': 13
            }
            
            oneRMsData.forEach((rm: any) => {
              const index = oneRMMapping[rm.exercise_name]
              if (index !== undefined) {
                oneRMsArray[index] = rm.one_rm.toString()
              }
            })
            
            loadedData.oneRMs = oneRMsArray
            console.log('✅ Loaded 1RMs:', oneRMsArray.filter(rm => rm !== '').length, 'non-empty')
          }

          // Load preferences
          const { data: prefsData, error: prefsError } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', dbUser.id)
            .single()

          console.log('⚙️ Preferences data:', prefsData ? 'found' : 'not found', prefsError ? `Error: ${prefsError.message}` : '')

          if (prefsData) {
            loadedData.preferences = {
              threeMonthGoals: prefsData.three_month_goals || '',
              monthlyPrimaryGoal: prefsData.monthly_primary_goal || '',
              preferredMetconExercises: prefsData.preferred_metcon_exercises || [],
              avoidedExercises: prefsData.avoided_exercises || [],
              trainingDaysPerWeek: prefsData.training_days_per_week,
              primaryStrengthLifts: prefsData.primary_strength_lifts || [],
              emphasizedStrengthLifts: prefsData.emphasized_strength_lifts || [],
              selectedGoals: prefsData.selected_goals || [],
              metconTimeFocus: prefsData.metcon_time_focus || []
            }
            console.log('✅ Loaded preferences')
          }

          // Apply all loaded data to form
          console.log('🔄 Applying loaded data to form:', {
            hasEquipment: !!loadedData.equipment,
            equipmentCount: loadedData.equipment?.length,
            hasSkills: !!loadedData.skills,
            skillsCount: loadedData.skills?.length,
            hasOneRMs: !!loadedData.oneRMs,
            oneRMsCount: loadedData.oneRMs?.length,
            hasPreferences: !!loadedData.preferences
          })
          
          setFormData(prev => {
            const updated = {
              ...prev,
              ...loadedData
            }
            console.log('✅ Form data updated! New state:', {
              equipment: updated.equipment?.length,
              skills: updated.skills?.filter((s: string) => s !== "Don't have it").length,
              oneRMs: updated.oneRMs?.filter((rm: string) => rm !== '').length
            })
            console.log('🔍 DETAILED equipment:', updated.equipment)
            console.log('🔍 DETAILED skills (first 5):', updated.skills?.slice(0, 5))
            console.log('🔍 DETAILED oneRMs (all):', updated.oneRMs)
            return updated
          })
          
          // Mark data as loaded so form can render with values
          setDataLoaded(true)
        }

        setLoading(false)
      } catch (error) {
        console.error('Error checking user status:', error)
        setSubmitMessage('❌ Error: Unable to verify user status')
        setLoading(false)
      }
    }

    checkUserAndSession()
  }, [router, searchParams])

  // Load exercise catalog for preferences multi-selects (client-side via Supabase)
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('exercises')
          .select('name')
          .eq('can_be_metcons', true)
          .order('name', { ascending: true })
        if (!error) {
          const list: string[] = (data || []).map((row: any) => row.name).filter(Boolean)
          setAvailableExercises(list)
        }
        const { data: strengthData } = await supabase
          .from('exercises')
          .select('name')
          .eq('can_be_strength', true)
          .order('name', { ascending: true })
        setAvailableStrengthLifts((strengthData || []).map((r: any) => r.name).filter(Boolean))
      } catch (e) {
        // Keep empty list on failure
      }
    }
    loadExercises()
  }, [])

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateSkill = (index: number, value: string) => {
    const newSkills = [...formData.skills]
    newSkills[index] = value
    setFormData(prev => ({ ...prev, skills: newSkills }))
  }

  const updateOneRM = (index: number, value: string) => {
    const newOneRMs = [...formData.oneRMs]
    newOneRMs[index] = value
    setFormData(prev => ({ ...prev, oneRMs: newOneRMs }))
  }

  const updateConditioning = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      conditioningBenchmarks: {
        ...prev.conditioningBenchmarks,
        [field]: value
      }
    }))
  }

  const toggleEquipment = (equipment: string) => {
    const newEquipment = formData.equipment.includes(equipment)
      ? formData.equipment.filter(e => e !== equipment)
      : [...formData.equipment, equipment]
    updateFormData('equipment', newEquipment)
  }

  const updatePreferences = (field: keyof NonNullable<IntakeFormData['preferences']>, value: any) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...(prev.preferences || { threeMonthGoals: '', monthlyPrimaryGoal: '', preferredMetconExercises: [], avoidedExercises: [] }),
        [field]: value
      }
    }))
  }

  const togglePreferredExercise = (name: string) => {
    const prev = formData.preferences?.preferredMetconExercises || []
    const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    updatePreferences('preferredMetconExercises', next)
  }

  const toggleAvoidedExercise = (name: string) => {
    const prev = formData.preferences?.avoidedExercises || []
    const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    updatePreferences('avoidedExercises', next)
  }

  const togglePrimaryStrengthLift = (name: string) => {
    const prev = formData.preferences?.primaryStrengthLifts || []
    const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    updatePreferences('primaryStrengthLifts', next)
  }

  const toggleEmphasizedStrengthLift = (name: string) => {
    const prev = formData.preferences?.emphasizedStrengthLifts || []
    // limit to 2 emphasized
    let next: string[]
    if (prev.includes(name)) {
      next = prev.filter(n => n !== name)
    } else {
      next = prev.length >= 2 ? prev : [...prev, name]
    }
    updatePreferences('emphasizedStrengthLifts', next)
  }

  const validatePassword = (password: string) => {
    const hasUppercase = /[A-Z]/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    const isLongEnough = password.length >= 8
    
    return {
      isValid: hasUppercase && hasSpecialChar && isLongEnough,
      hasUppercase,
      hasSpecialChar,
      isLongEnough
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
      
      if (currentSection < 4 && isValidSection(currentSection)) {
        nextSection()
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitMessage('')

    try {
      if (isNewPaidUser) {
        // New paid user flow - create account and save data
        await handleNewPaidUserSubmission()
      } else {
        // Existing user flow - update existing user
        await handleExistingUserSubmission()
      }
    } catch (error) {
      console.error('Submission error:', error)
      setSubmitMessage(`❌ Error: ${error instanceof Error ? error.message : 'Something went wrong'}`)
    } finally {
      // allow overlay to show completion briefly
      setTimeout(() => setIsSubmitting(false), 500)
    }
  }

  const handleNewPaidUserSubmission = async () => {
    if (!stripeSession) {
      throw new Error('No valid session found')
    }

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      throw new Error('Passwords do not match')
    }

    const passwordValidation = validatePassword(formData.password)
    if (!passwordValidation.isValid) {
      throw new Error('Password does not meet requirements')
    }

    console.log('🔧 Creating new user account...')

    // Call our server-side account creation API
    const createAccountResponse = await fetch('/api/create-user-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
        productType: productType, // Pass product type to set correct subscription tier
        sessionId: stripeSession?.sessionId, // Pass session ID to create subscription record
        userData: {
          name: formData.name,
          gender: formData.gender,
          bodyWeight: formData.bodyWeight,
          units: formData.units,
          conditioningBenchmarks: formData.conditioningBenchmarks
        }
      })
    })

    if (!createAccountResponse.ok) {
      const errorData = await createAccountResponse.json()
      throw new Error(errorData.error || 'Account creation failed')
    }

    const accountData = await createAccountResponse.json()
    console.log('✅ Account created successfully:', accountData.user.id)

    // Save equipment, skills, preferences, and 1RMs (use numeric users.id from API response)
    await saveUserData(accountData.user.userId)

    // Sign in the user with the newly created account
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password
    })

    if (signInError) {
      console.error('❌ Auto-signin failed:', signInError)
      // Don't throw error here - account was created successfully
      setSubmitMessage('✅ Account created successfully! Please sign in to access your program.')
      setTimeout(() => {
        router.push('/auth/signin')
      }, 2000)
      return
    }

    console.log('✅ User automatically signed in')
    setSubmitMessage('✅ Account created successfully! Your personalized program will be generated shortly.')

    // Resolve numeric users.id from auth_id and save intake data immediately
    try {
      const { data: authInfo } = await supabase.auth.getUser()
      const authId = authInfo?.user?.id
      if (authId) {
        const { data: me } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', authId)
          .single()
        if (me?.id) {
          await saveUserData(me.id)
          setGenProgress(100)
        }
      }
    } catch (_) {}

    // Redirect based on subscription type
    setTimeout(async () => {
      try {
        // Check user's subscription tier
        const { data: authInfo } = await supabase.auth.getUser()
        const authId = authInfo?.user?.id
        if (authId) {
          const { data: userInfo } = await supabase
            .from('users')
            .select('subscription_tier')
            .eq('auth_id', authId)
            .single()
          
          // Redirect based on subscription tier
          if (userInfo?.subscription_tier === 'BTN') {
            router.push('/btn?refreshed=true')
          } else if (userInfo?.subscription_tier === 'ENGINE') {
            router.push('/engine')
          } else if (userInfo?.subscription_tier === 'APPLIED_POWER') {
            router.push('/dashboard')
          } else {
            router.push('/dashboard')
          }
        } else {
          router.push('/dashboard')
        }
      } catch (_) {
        router.push('/dashboard')
      }
    }, 2000)
  }

  const handleExistingUserSubmission = async () => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    const supabase = createClient()
    
    // First, get the numeric user ID from auth_id
    const { data: dbUser, error: dbUserError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (dbUserError || !dbUser) {
      console.error('Error finding database user:', dbUserError)
      throw new Error('Unable to find user account')
    }

    console.log(`💾 Saving profile for user ${dbUser.id}`)
    
    // Update user record using numeric ID
    const { error: userError } = await supabase
      .from('users')
      .update({
        name: formData.name,
        email: formData.email,
        gender: formData.gender,
        body_weight: formData.bodyWeight ? parseFloat(formData.bodyWeight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        age: formData.age ? parseInt(formData.age) : null,
        units: formData.units,
        ability_level: 'Beginner',
        conditioning_benchmarks: formData.conditioningBenchmarks,
        updated_at: new Date().toISOString()
      })
      .eq('id', dbUser.id)

    if (userError) {
      console.error('User update error:', userError)
      throw new Error(`User update failed: ${userError.message}`)
    }

    // Save equipment, skills, 1RMs, preferences using numeric ID
    await saveUserData(dbUser.id)
    setGenProgress(100)

    console.log('✅ Profile saved successfully!')
    setSubmitMessage('✅ Profile updated successfully!')
    
    // Simple redirect to profile page after saving
    setTimeout(() => {
      router.push('/profile')
    }, 1500)
  }

const saveUserData = async (userId: number) => {
  // Call server-side API to save intake data
  const saveDataResponse = await fetch('/api/save-intake-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      equipment: formData.equipment,
      skills: formData.skills,
      oneRMs: formData.oneRMs,
      bodyWeight: formData.bodyWeight,
      height: formData.height,
      age: formData.age,
      gender: formData.gender,
      units: formData.units,
      benchmarks: formData.conditioningBenchmarks,  // <-- Use the correct property name
      preferences: formData.preferences
    })
  })

  if (!saveDataResponse.ok) {
    const errorData = await saveDataResponse.json()
    throw new Error(errorData.error || 'Failed to save intake data')
  }

  console.log('✅ Intake data saved successfully')
}


  const nextSection = () => {
    setCurrentSection(prev => {
      let next = prev + 1
      
      // For existing users, cap at section 4 (don't show section 5)
      const maxSection = isNewPaidUser ? 5 : 4
      
      // Skip inactive sections
      while (next <= maxSection && !activeSections[next - 1]) {
        next++
      }
      return Math.min(next, maxSection)
    })
  }
  
  const prevSection = () => {
    setCurrentSection(prev => {
      let next = prev - 1
      // Skip inactive sections
      while (next >= 1 && !activeSections[next - 1]) {
        next--
      }
      return Math.max(next, 1)
    })
  }

  // Handler for "Save Profile" button (existing users only)
  const handleQuickSave = async () => {
    if (!user || isNewPaidUser) return
    
    setIsSubmitting(true)
    setSubmitMessage('')

    try {
      await handleExistingUserSubmission()
    } catch (error) {
      console.error('Quick save error:', error)
      setSubmitMessage(`❌ Error: ${error instanceof Error ? error.message : 'Something went wrong'}`)
      setTimeout(() => setIsSubmitting(false), 500)
    }
  }

  const handleCancel = () => {
    if (confirm('Are you sure you want to discard all changes?')) {
      router.push('/profile')
    }
  }

  const isValidSection = (section: number) => {
    switch (section) {
      case 1:
        const basicInfoValid = formData.name && formData.email && formData.gender && formData.units && formData.bodyWeight
        // For Engine users, also require at least one cardio machine
        if (productType === 'engine') {
          const cardioMachines = ['Rowing Machine', 'Air Bike', 'Ski Erg', 'Bike Erg']
          const hasCardioMachine = formData.equipment.some(eq => cardioMachines.includes(eq))
          return basicInfoValid && hasCardioMachine
        }
        return basicInfoValid
      case 2:
        return true // Skills are optional with defaults
      case 3:
        if (
          formData.conditioningBenchmarks.airBike10MinCalories &&
          formData.conditioningBenchmarks.airBike10MinCalories.trim() !== ''
        ) {
          return formData.conditioningBenchmarks.airBikeType !== ''
        }
        return true

     case 4:
        return true // 1RMs are optional - just data collection
      case 5:
        if (isNewPaidUser) {
          // For new users, validate password requirements
          const passwordValidation = validatePassword(formData.password)
          return passwordValidation.isValid && formData.password === formData.confirmPassword
        }
        return true // Existing users just need confirmation

      default:
        return true
    }
  }

  // Show loading state
  if (loading || (!isNewPaidUser && !dataLoaded)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {searchParams.get('session_id') ? 'Verifying your payment...' : 'Loading your profile...'}
          </p>
        </div>
      </div>
    )
  }

  // Show access denied for existing users without subscription
  if (!isNewPaidUser && (!user || subscriptionStatus !== 'active')) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You need an active subscription to access the intake form.
            </p>
            <button
              onClick={() => router.push('/pricing')}
              className="bg-[#FE5858] text-white px-6 py-3 rounded-lg hover:opacity-90"
            >
              View Pricing Plans
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {isSubmitting && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl shadow-lg p-6 w-11/12 max-w-md text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{isNewPaidUser ? 'Generating your program…' : 'Saving changes…'}</h3>
                <p className="text-gray-600 mb-4">{isNewPaidUser ? 'This takes about 60 seconds. Hang tight while we personalize everything for you.' : 'Updating your profile information...'}</p>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-300"
                    style={{ width: `${genProgress}%`, backgroundColor: '#FE5858' }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">{Math.floor(genProgress)}%</p>
              </div>
            </div>
          )}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Athlete Intake
            </h1>
            
            {/* Progress bar */}
            <div className="mt-6">

            <div className="flex justify-between text-sm text-gray-500 mb-2">
  <span>Section {currentSection} of {activeSectionCount}</span>
  <span>{Math.round((currentSection / activeSectionCount) * 100)}% Complete</span>
</div>
<div className="w-full bg-gray-200 rounded-full h-2">
  <div 
    className="h-2 rounded-full transition-all duration-300"
    style={{ width: `${(currentSection / activeSectionCount) * 100}%`, backgroundColor: '#FE5858' }}
  />
</div>

            {/* Stepper with section titles - horizontally scrollable on mobile */}
            <div className="mt-3 -mx-1 overflow-x-auto">
              <ul className="flex gap-2 px-1 whitespace-nowrap text-xs">
                {sectionTitles.map((title, index) => {
                  const stepNumber = index + 1
                  const isCompleted = stepNumber < currentSection
                  const isActive = stepNumber === currentSection
                  const isSectionActive = activeSections[index]
                  
                  return (
                    <li
                      key={title}
                      className={`text-center px-3 py-1 rounded-full border ${
                        !isSectionActive
                          ? 'text-gray-300 border-gray-200 line-through opacity-50'  // Grayed out for inactive
                          : isActive
                          ? 'bg-[#FE5858]/10 text-[#FE5858] border-[#FE5858]/30 font-medium'
                          : isCompleted
                            ? 'bg-[#DAE2EA] text-gray-700 border-[#DAE2EA]'
                            : 'text-gray-500 border-gray-200'
                      }`}
                    >
                      {isCompleted ? '✓ ' : `${stepNumber}. `}{title}
                    </li>
                  )
                })}
              </ul>
            </div>

            </div>
          </div>

          {/* Success/Error Message */}
          {submitMessage && (
            <div className={`mb-6 p-4 rounded-lg ${
              submitMessage.startsWith('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {submitMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>

            {/* Section 1: Personal Information */}
            {currentSection === 1 && (
              <div className="space-y-6 bg-white rounded-lg p-4">
                <h2 className="text-2xl font-semibold text-gray-900 text-center mb-6">
                  Section 1: Personal Information
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What is your name? *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)}
                    disabled={isNewPaidUser}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isNewPaidUser ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    required
                  />
                  {isNewPaidUser && (
                    <p className="text-sm text-gray-500 mt-1">
                      Email from your payment - cannot be changed
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose your gender *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Male', 'Female', 'Prefer not to say'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateFormData('gender', option)}
                        className={`px-3 py-2 rounded-lg border text-sm ${formData.gender === option ? 'bg-[#FE5858] text-white border-[#FE5858]' : 'bg-white text-gray-700 border-gray-300'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Which unit system do you prefer? *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Metric (kg)', 'Imperial (lbs)'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateFormData('units', option)}
                        className={`px-3 py-2 rounded-lg border text-sm ${formData.units === option ? 'bg-[#FE5858] text-white border-[#FE5858]' : 'bg-white text-gray-700 border-gray-300'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your body weight in your preferred unit *
                  </label>
                  <p className="text-sm text-gray-500 mb-2">
                    We use this to calculate strength and weightlifting targets
                  </p>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.bodyWeight}
                    onChange={(e) => updateFormData('bodyWeight', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={formData.units === 'Metric (kg)' ? 'e.g., 70.5' : 'e.g., 155.5'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your height
                  </label>
                  <p className="text-sm text-gray-500 mb-2">
                    Required for BMI and BMR calculations (calorie estimation)
                  </p>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.height}
                    onChange={(e) => updateFormData('height', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={formData.units === 'Metric (kg)' ? 'e.g., 175 (cm)' : 'e.g., 70 (inches)'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your age
                  </label>
                  <p className="text-sm text-gray-500 mb-2">
                    Required for accurate BMR calculation (calorie estimation)
                  </p>
                  <input
                    type="number"
                    step="1"
                    min="13"
                    max="100"
                    value={formData.age}
                    onChange={(e) => updateFormData('age', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 30"
                  />
                </div>

               <div>
  <label className="block text-sm font-medium text-gray-700 mb-6">
    {productType === 'engine' 
      ? 'Select your cardio machine(s) *' 
      : 'Select all equipment available for your training'}
  </label>
  
  {/* Equipment Category Cards */}
  <div className="space-y-6">
    {productType === 'engine' ? (
      // Engine users: Only show cardio machines
      <EquipmentCategoryCard
        title="Cardio Machines"
        description="Select the cardio machine(s) you have access to"
        icon="🏋️"
        equipment={[
          'Rowing Machine',
          'Air Bike',
          'Ski Erg',
          'Bike Erg'
        ]}
        formData={formData}
        toggleEquipment={toggleEquipment}
        colorClass="bg-[#DAE2EA]"
        onSetEquipment={(list) => updateFormData('equipment', list)}
      />
    ) : (
      // Other users: Show all equipment categories
      <>
        <EquipmentCategoryCard
          title="The Basics"
          description=""
          icon="💪"
          equipment={[
            'Barbell',
            'Dumbbells', 
            'Kettlebells',
            'Pullup Bar or Rig',
            'High Rings',
            'Low or Adjustable Rings',
            'Bench',
            'Squat Rack',
            'Open Space',
            'Wall Space',
            'Jump Rope',
            'Wall Ball'
          ]}
          formData={formData}
          toggleEquipment={toggleEquipment}
          colorClass="bg-[#DAE2EA]"
          onSetEquipment={(list) => updateFormData('equipment', list)}
        />

        <EquipmentCategoryCard
          title="The Machines"
          description="Cardio and specialty training machines"
          icon="🏋️"
          equipment={[
            'Rowing Machine',
            'Air Bike',
            'Ski Erg',
            'Bike Erg'
          ]}
          formData={formData}
          toggleEquipment={toggleEquipment}
          colorClass="bg-[#DAE2EA]"
          onSetEquipment={(list) => updateFormData('equipment', list)}
        />

        <EquipmentCategoryCard
          title="Less Common Equipment"
          description=""
          icon="🎯"
          equipment={[
            'GHD',
            'Axle Bar',
            'Climbing Rope',
            'Pegboard',
            'Parallettes',
            'Dball',
            'Dip Bar',
            'Plyo Box',
            'HS Walk Obstacle',
            'Sandbag'
          ]}
          formData={formData}
          toggleEquipment={toggleEquipment}
          colorClass="bg-[#DAE2EA]"
          onSetEquipment={(list) => updateFormData('equipment', list)}
        />
      </>
    )}
  </div>

  {/* Equipment Summary */}
  <div className="mt-6 p-4 bg-gray-100 rounded-lg text-center">
    <div className="text-sm text-gray-600">
      <strong>{formData.equipment.length}</strong> items selected
      {productType === 'engine' 
        ? ' (cardio machines)' 
        : ` out of ${equipmentOptions.length} total`}
    </div>
  </div>
</div>

                {/* ADD NAVIGATION BUTTONS HERE */}
                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={prevSection}
                    disabled={currentSection <= 1}
                    className="px-6 py-2 rounded-md text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#DAE2EA' }}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={nextSection}
                    disabled={!isValidSection(currentSection)}
                    className="px-6 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#FE5858' }}
                  >
                    Next
                  </button>
                </div>

                {/* Save Profile button for existing users */}
                {!isNewPaidUser && (
                  <div className="mt-4 text-center">
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="px-8 py-3 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickSave}
                        disabled={isSubmitting || !isValidSection(currentSection)}
                        className="px-8 py-3 font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
                      >
                        Save Profile
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Save changes and return to your profile</p>
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Skills */}
            {currentSection === 2 && (
              <div className="space-y-8 bg-white rounded-lg p-4">
                <h2 className="text-2xl font-semibold text-gray-900 text-center mb-6">
                  Section 2: Skills
                </h2>
                <p className="text-gray-600 mb-6">
                  Please choose the range into which your maximum unbroken set falls.
                </p>

                {skillCategories.map((category, idx) => (
                  <div key={category.name} className="border rounded-lg overflow-hidden">
                    <div className="p-4 text-left" style={{ backgroundColor: '#DAE2EA' }}>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {category.name}
                      </h3>
                    </div>
                    <div className="p-6">
                    
                    {category.skills.map((skill) => (
                      <div key={skill.name} className="mb-6 text-center">
                        <label className="block text-base font-bold text-gray-800 mb-2">
                          {skill.name}
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {category.levels.map((level) => {
                            // Derive a short label (rep range) if present in parentheses
                            const short = level.includes('(') ? level.substring(level.indexOf('(') + 1, level.indexOf(')')) : level
                            
                            // Normalize for comparison: extract just the level name (e.g., "Intermediate" from "Intermediate (26-50)")
                            const levelName = level.split(' (')[0]
                            const currentValue = formData.skills[skill.index]
                            const currentValueName = currentValue?.split(' (')[0]
                            const selected = currentValueName === levelName
                            
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => updateSkill(skill.index, level)}
                                className={`px-2 py-2 rounded-md text-xs border ${selected ? 'bg-[#FE5858] text-white border-[#FE5858]' : 'bg-white text-gray-700 border-gray-300'}`}
                              >
                                {short}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                ))}

{/* ADD NAVIGATION BUTTONS HERE */}
<div className="flex justify-between mt-8">
  <button
    type="button"
    onClick={prevSection}
    disabled={currentSection <= 1}
    className="px-6 py-2 rounded-md text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ backgroundColor: '#DAE2EA' }}
  >
    Previous
  </button>

  <button
    type="button"
    onClick={nextSection}
    disabled={!isValidSection(currentSection)}
    className="px-6 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ backgroundColor: '#FE5858' }}
  >
    Next
  </button>
</div>

                {/* Save Profile button for existing users */}
                {!isNewPaidUser && (
                  <div className="mt-4 text-center">
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="px-8 py-3 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickSave}
                        disabled={isSubmitting || !isValidSection(currentSection)}
                        className="px-8 py-3 font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
                      >
                        Save Profile
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Save changes and return to your profile</p>
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Conditioning Benchmarks */}
            {currentSection === 3 && (
              <div className="space-y-6 bg-white rounded-lg p-4">
                <h2 className="text-2xl font-semibold text-gray-900 text-center mb-6">
                  Section 3: Conditioning Benchmarks
                </h2>
                <p className="text-gray-600 mb-6">
                  Please enter your recent results for each of these common benchmarks. 
                  Enter times in MM:SS, e.g., 7:30. Leave blank if not recently performed.
                </p>
                <div className="space-y-6">
                  {/* Running Benchmarks */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                      <h3 className="text-lg font-semibold text-gray-900">Running Benchmarks</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <TimeInput label="1 Mile Run (MM:SS)" field="mileRun" />
                      <TimeInput label="5K Run (MM:SS)" field="fiveKRun" />
                      <TimeInput label="10K Run (MM:SS)" field="tenKRun" />
                    </div>
                  </div>

                  {/* Rowing Benchmarks */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                      <h3 className="text-lg font-semibold text-gray-900">Rowing Benchmarks</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <TimeInput label="1K Row (MM:SS)" field="oneKRow" />
                      <TimeInput label="2K Row (MM:SS)" field="twoKRow" />
                      <TimeInput label="5K Row (MM:SS)" field="fiveKRow" />
                    </div>
                  </div>

                  {/* Bike Benchmarks */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                      <h3 className="text-lg font-semibold text-gray-900">Bike Benchmarks</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">10-Minute Air Bike (calories)</label>
                        <div className="grid grid-cols-1 gap-2">
                          <input type="number" placeholder="185" value={formData.conditioningBenchmarks.airBike10MinCalories} onChange={(e) => updateConditioning('airBike10MinCalories', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          {formData.conditioningBenchmarks.airBike10MinCalories?.trim() && (
                            <select value={formData.conditioningBenchmarks.airBikeType} onChange={(e) => updateConditioning('airBikeType', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" required>
                              <option value="">Select an Air Bike Type</option>
                              {airBikeTypes.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* second dropdown removed */}

       {/* ADD NAVIGATION BUTTONS HERE */}
                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={prevSection}
                    disabled={currentSection <= 1}
                    className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={nextSection}
                    disabled={!isValidSection(currentSection)}
                    className="px-6 py-2 bg-[#FE5858] text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>

                {/* Save Profile button for existing users */}
                {!isNewPaidUser && (
                  <div className="mt-4 text-center">
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="px-8 py-3 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickSave}
                        disabled={isSubmitting || !isValidSection(currentSection)}
                        className="px-8 py-3 font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
                      >
                        Save Profile
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Save changes and return to your profile</p>
                  </div>
                )}
              </div>
            )}

            {/* Section 4: 1RM Lifts + Password Creation for New Users */}
            {currentSection === 4 && (
              <div className="space-y-6 bg-white rounded-lg p-4">

             <h2 className="text-2xl font-semibold text-gray-900 text-center mb-6">
            Section 4: 1RM Lifts
             </h2>

                <p className="text-gray-600 mb-6">
                  Enter your recent 1-Rep Max for each lift in {formData.units === 'Metric (kg)' ? 'kilograms' : 'pounds'} 
                  (based on your unit preference in Section 1). Decimals may be used (e.g., 225.5). 
                  For Weighted Pullup, <strong>enter added weight only</strong> (e.g., 35).
                </p>

                {/* Snatch Group */}
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                    <h3 className="text-lg font-semibold text-gray-900">Snatch</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['Snatch', 'Power Snatch'].map((lift) => {
                      const index = oneRMLifts.indexOf(lift)
                      return (
                        <div key={lift}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{lift}</label>
                          <input type="number" step="0.5" value={formData.oneRMs[index]} onChange={(e) => updateOneRM(index, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={formData.units === 'Metric (kg)' ? 'e.g., 100.5' : 'e.g., 225.5'} />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Clean and Jerk Group */}
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                    <h3 className="text-lg font-semibold text-gray-900">Clean and Jerk</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['Clean and Jerk', 'Power Clean', 'Clean (clean only)', 'Jerk (from rack or blocks, max Split or Power Jerk)'].map((lift) => {
                      const index = oneRMLifts.indexOf(lift)
                      return (
                        <div key={lift}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{lift}</label>
                          <input type="number" step="0.5" value={formData.oneRMs[index]} onChange={(e) => updateOneRM(index, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={formData.units === 'Metric (kg)' ? 'e.g., 100.5' : 'e.g., 225.5'} />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Squats Group */}
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                    <h3 className="text-lg font-semibold text-gray-900">Squats</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Back Squat', 'Front Squat', 'Overhead Squat'].map((lift) => {
                      const index = oneRMLifts.indexOf(lift)
                      return (
                        <div key={lift}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{lift}</label>
                          <input type="number" step="0.5" value={formData.oneRMs[index]} onChange={(e) => updateOneRM(index, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={formData.units === 'Metric (kg)' ? 'e.g., 100.5' : 'e.g., 225.5'} />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Pulling Group */}
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                    <h3 className="text-lg font-semibold text-gray-900">Pulling</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['Weighted Pullup (do not include body weight)', 'Deadlift'].map((lift) => {
                      const index = oneRMLifts.indexOf(lift)
                      return (
                        <div key={lift}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{lift}</label>
                          <input type="number" step="0.5" value={formData.oneRMs[index]} onChange={(e) => updateOneRM(index, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={formData.units === 'Metric (kg)' ? 'e.g., 100.5' : 'e.g., 225.5'} />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Presses Group */}
                <div className="border rounded-lg overflow-hidden mb-4">
                  <div className="p-4 text-center" style={{ backgroundColor: '#DAE2EA' }}>
                    <h3 className="text-lg font-semibold text-gray-900">Presses</h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Bench Press', 'Push Press', 'Strict Press'].map((lift) => {
                      const index = oneRMLifts.indexOf(lift)
                      return (
                        <div key={lift}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{lift}</label>
                          <input type="number" step="0.5" value={formData.oneRMs[index]} onChange={(e) => updateOneRM(index, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={formData.units === 'Metric (kg)' ? 'e.g., 100.5' : 'e.g., 225.5'} />
                        </div>
                      )
                    })}
                  </div>
                </div>
          

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={prevSection}
                disabled={currentSection <= 1}                
                className="px-6 py-2 rounded-md text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#DAE2EA' }}
              >
                Previous
              </button>

<button
  type="button"
  onClick={nextSection}
  disabled={!isValidSection(currentSection)}
  className="px-6 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
  style={{ backgroundColor: '#FE5858' }}
>
  {isNewPaidUser ? 'Next' : 'Done'}
</button>            

            </div>

                {/* Save Profile button for existing users */}
                {!isNewPaidUser && (
                  <div className="mt-4 text-center">
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="px-8 py-3 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickSave}
                        disabled={isSubmitting || !isValidSection(currentSection)}
                        className="px-8 py-3 font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
                      >
                        Save Profile
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Save changes and return to your profile</p>
                  </div>
                )}
            </div>
		)}
		
{/* Section 5: Preferences - REMOVED PER USER REQUEST */}
{currentSection === 999 && (
  <div className="space-y-6">
    <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Section 5: Preferences</h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Quick goal buttons (select up to 3) */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select up to 3 focus areas</label>
        <div className="flex flex-wrap gap-2">
          {['Olympic Lifts','General Strength','Gymnastics','Other Skills','Aerobic Capacity','Glycolytic Power (1-5 mins)','Other'].map(opt => {
            const selected = !!formData.preferences?.selectedGoals?.includes(opt)
            const canAdd = (formData.preferences?.selectedGoals?.length || 0) < 3
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = formData.preferences?.selectedGoals || []
                  if (selected) {
                    updatePreferences('selectedGoals', current.filter(o => o !== opt))
                  } else if (canAdd) {
                    updatePreferences('selectedGoals', [...current, opt])
                  }
                }}
                className={`px-3 py-1 rounded-full border text-sm ${selected ? 'bg-[#FE5858] text-white border-[#FE5858]' : 'bg-white text-gray-800 border-gray-300'}`}
              >
                {opt}
              </button>
            )
          })}
        </div>
        <div className="text-xs text-gray-500 mt-1">Choose up to three goals. You can refine with the text box below.</div>
      </div>
      {/* 3-Month Goals removed per request */}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">What’s your top priority for this month?</label>
        <input
          type="text"
          value={formData.preferences?.monthlyPrimaryGoal || ''}
          onChange={(e) => updatePreferences('monthlyPrimaryGoal', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FE5858]"
          placeholder="Describe your top priority (e.g., improve aerobic base)"
          maxLength={100}
        />
        <div className="mt-1 text-xs text-gray-500">{(formData.preferences?.monthlyPrimaryGoal?.length || 0)}/100</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Training Days per Week</label>
        <select
          value={formData.preferences?.trainingDaysPerWeek || 5}
          onChange={(e) => updatePreferences('trainingDaysPerWeek', parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {[3,4,5,6].map(n => (
            <option key={n} value={n}>{n} days/week</option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        {/* MetCon time range focus removed for new users to avoid early bias */}
      </div>

      {/* Lift focus/emphasis removed per request (handled via weekly preview later) */}

      
    </div>

    <div className="flex justify-between mt-8">
      <button
        type="button"
        onClick={prevSection}
        className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
      >
        Previous
      </button>
      <button
        type="button"
        onClick={nextSection}
        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Prepare to Generate Program
      </button>
    </div>
  </div>
)}

{/* Section 5: Program Generation & Account Setup - ONLY FOR NEW USERS */}
{currentSection === 5 && isNewPaidUser && (
  <div className="space-y-8">
    {/* Intro copy (no header) */}
    <div className="text-center">
      <p className="text-lg text-gray-900 font-medium">
        You’ve provided your data, time to create your AI-Powered personalized program!
      </p>
    </div>

    {/* Program Summary Preview */}
    <div className="rounded-xl p-6 border-2" style={{ backgroundColor: '#DAE2EA', borderColor: '#FE5858' }}>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ color: '#282B34' }}>
        <div className="flex items-center space-x-2">
          <span style={{ color: '#FE5858' }}>✓</span>
          <span><strong>Strength, Precise</strong>: Powered by your 1RM data.</span>
        </div>
        <div className="flex items-center space-x-2">
          <span style={{ color: '#FE5858' }}>✓</span>
          <span><strong>Skills, Mastered</strong>: A path based on your current proficiency.</span>
        </div>
        <div className="flex items-center space-x-2">
          <span style={{ color: '#FE5858' }}>✓</span>
          <span><strong>Conditioning, Personalized</strong>: Tailored to your benchmark times.</span>
        </div>
        <div className="flex items-center space-x-2">
          <span style={{ color: '#FE5858' }}>✓</span>
          <span><strong>Adaptive & Intelligent</strong>: Your results power real-time adjustments.</span>
        </div>
      </div>
    </div>

    {/* Password Creation for New Users */}
    {isNewPaidUser && (
      <div className="bg-white border-2 border-blue-200 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          🔐 Create Your Account Password
        </h3>
        <p className="text-gray-600 mb-6">
          Set a secure password to access your training program and return to update your data anytime.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => updateFormData('password', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => updateFormData('confirmPassword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Password Requirements */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800 mb-2">Password Requirements:</p>
            {(() => {
              const validation = validatePassword(formData.password)
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div className={`flex items-center`} style={{ color: validation.isLongEnough ? '#FE5858' : '#6B7280' }}>
                    <span className="mr-2">{validation.isLongEnough ? '✓' : '○'}</span>
                    8+ characters
                  </div>
                  <div className={`flex items-center`} style={{ color: validation.hasUppercase ? '#FE5858' : '#6B7280' }}>
                    <span className="mr-2">{validation.hasUppercase ? '✓' : '○'}</span>
                    1+ uppercase
                  </div>
                  <div className={`flex items-center`} style={{ color: validation.hasSpecialChar ? '#FE5858' : '#6B7280' }}>
                    <span className="mr-2">{validation.hasSpecialChar ? '✓' : '○'}</span>
                    1+ special char
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Password Match Check */}
          {formData.confirmPassword && (
            <div className="text-sm">
              {formData.password === formData.confirmPassword ? (
                <p className="flex items-center" style={{ color: '#FE5858' }}>
                  <span className="mr-2">✓</span>
                  Passwords match
                </p>
              ) : (
                <p className="text-red-600 flex items-center">
                  <span className="mr-2">✗</span>
                  Passwords do not match
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )}

    {/* Final Confirmation & Launch */}
    <div className="border-2 rounded-xl p-8" style={{ backgroundColor: '#F8FBFE', borderColor: '#FE5858' }}>
      <div className="text-center space-y-6">
        <h3 className="text-2xl font-bold text-gray-900">
          Launch Your Training Program
        </h3>
        
        <div className="space-y-4">
          <div className="rounded-lg p-4 border" style={{ backgroundColor: '#DAE2EA', borderColor: '#FE5858' }}>
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={confirmSubmission}
                onChange={(e) => setConfirmSubmission(e.target.checked)}
                className="mt-1 rounded border-green-300"
              />
              <div className="text-left">
                <p className="text-sm text-gray-600">
                  I have reviewed my information and am ready to create my personalized training program.
                  {isNewPaidUser 
                    ? ' This will create my account and generate my 12-week CrossFit program.'
                    : ' This will update and regenerate my personalized program.'
                  }
                </p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isValidSection(currentSection) || !confirmSubmission}
            className="w-full text-white text-xl font-bold py-4 px-8 rounded-xl transform hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ backgroundColor: '#FE5858' }}
          >
            {isSubmitting 
              ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isNewPaidUser ? 'Creating Account & Generating Program...' : 'Saving Changes...'}
                </span>
              ) 
              : (
                <span>
                  {isNewPaidUser ? 'Create Account & Generate My Program' : 'Save Changes'}
                </span>
              )
            }
          </button>
          
          <p className="text-sm text-gray-500">
            Your program will be ready in just a few moments
          </p>
        </div>
      </div>
    </div>

    {/* Navigation buttons for final section */}
    <div className="flex justify-between mt-8">
      <button
        type="button"
        onClick={prevSection}
        disabled={currentSection <= 1}
        className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
    </div>
  </div>
)}

          </form>
        </div>
      </div>
    </div>
  )
}


// Main component with Suspense wrapper
export default function IntakeForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <IntakeFormContent />
    </Suspense>
  )
}
