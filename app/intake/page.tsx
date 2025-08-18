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
}

interface StripeSessionData {
  email: string
  name: string
  sessionId: string
  isValid: boolean
}

const equipmentOptions = [
  'Air Bike', 'Axle Bar', 'Barbell', 'Bench', 'Squat Rack', 'Climbing Rope',
  'Dball', 'Dip Bar', 'Dumbbells', 'Plyo Box', 'GHD', 'HS Walk Obstacle',
  'High Rings', 'Low or Adjustable Rings', 'Jump Rope', 'Kettlebells',
  'Open Space', 'Parallettes', 'Pegboard', 'Pullup Bar or Rig',
  'Rowing Machine', 'Ski Erg', 'Bike Erg', 'Sandbag', 'Wall Ball',
  'Wall Space', 'Bodyweight Only'
]

const skillCategories = [
  {
    name: 'Basic CrossFit skills',
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

// Component that uses useSearchParams
function IntakeFormContent() {
  
const [currentSection, setCurrentSection] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmSubmission, setConfirmSubmission] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('')
  const [stripeSession, setStripeSession] = useState<StripeSessionData | null>(null)
  const [isNewPaidUser, setIsNewPaidUser] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const [formData, setFormData] = useState<IntakeFormData>({
    name: '',
    email: '',
    gender: '',
    units: '',
    bodyWeight: '',
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
    confirmPassword: ''
  })

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
      
      return {
        email: sessionData.customer_details?.email || '',
        name: sessionData.customer_details?.name || '',
        sessionId: sessionId,
        isValid: true
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
          .eq('id', user.id)
          .single()

        if (userData && !userError) {
          setFormData(prev => ({
            ...prev,
            name: userData.name || '',
            email: userData.email || user.email || '',
            gender: userData.gender || '',
            units: userData.units || '',
            bodyWeight: userData.body_weight?.toString() || '',
            conditioningBenchmarks: userData.conditioning_benchmarks || prev.conditioningBenchmarks
          }))
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
      setIsSubmitting(false)
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

    // Save equipment, skills, and 1RMs
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
    
    // Redirect to program page after successful submission
    setTimeout(() => {
      router.push('/program')
    }, 2000)
  }

  const handleExistingUserSubmission = async () => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    const supabase = createClient()
    
    // Update user record
    const { error: userError } = await supabase
      .from('users')
      .update({
        name: formData.name,
        email: formData.email,
        gender: formData.gender,
        body_weight: formData.bodyWeight ? parseFloat(formData.bodyWeight) : null,
        units: formData.units,
        ability_level: 'Beginner',
        conditioning_benchmarks: formData.conditioningBenchmarks,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (userError) {
      throw new Error(`User update failed: ${userError.message}`)
    }

    await saveUserData(user.id)

    setSubmitMessage('✅ Assessment completed successfully! Your personalized program will be generated shortly.')
    
    setTimeout(() => {
      router.push('/program')
    }, 2000)
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
      gender: formData.gender,
      units: formData.units,
      benchmarks: formData.conditioningBenchmarks  // <-- Use the correct property name
    })
  })

  if (!saveDataResponse.ok) {
    const errorData = await saveDataResponse.json()
    throw new Error(errorData.error || 'Failed to save intake data')
  }

  console.log('✅ Intake data saved successfully')
}


  const nextSection = () => setCurrentSection(prev => Math.min(prev + 1, 5))
  const prevSection = () => setCurrentSection(prev => Math.max(prev - 1, 1))

  const isValidSection = (section: number) => {
    switch (section) {
      case 1:
        return formData.name && formData.email && formData.gender && formData.units && formData.bodyWeight
      case 2:
        return true // Skills are optional with defaults
      case 3:
        if (formData.conditioningBenchmarks.enteredTimeTrial === 'Y') {
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
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {searchParams.get('session_id') ? 'Verifying your payment...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  // Show access denied for existing users without subscription
  if (!isNewPaidUser && (!user || subscriptionStatus !== 'active')) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You need an active subscription to access the intake form.
            </p>
            <button
              onClick={() => router.push('/pricing')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
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
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              CrossFit Training Assessment
            </h1>
            <p className="text-gray-600">
              Help us create your personalized training program
            </p>
            
            {isNewPaidUser ? (
              <p className="text-sm text-green-600 mt-2">
                ✅ Payment confirmed - Welcome {formData.name || stripeSession?.email}! Let's get started.
              </p>
            ) : (
              <p className="text-sm text-green-600 mt-2">
                ✅ Subscription active - Welcome {formData.name || user?.email}!
              </p>
            )}
            
            {/* Progress bar */}
            <div className="mt-6">

            <div className="flex justify-between text-sm text-gray-500 mb-2">
  <span>Section {currentSection} of 5</span>
  <span>{Math.round((currentSection / 5) * 100)}% Complete</span>
</div>
<div className="w-full bg-gray-200 rounded-full h-2">
  <div 
    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
    style={{ width: `${(currentSection / 5) * 100}%` }}
  />
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
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
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
                  <div className="space-y-2">
                    {['Male', 'Female', 'Prefer not to say'].map((option) => (
                      <label key={option} className="flex items-center">
                        <input
                          type="radio"
                          name="gender"
                          value={option}
                          checked={formData.gender === option}
                          onChange={(e) => updateFormData('gender', e.target.value)}
                          className="mr-2"
                          required
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Which unit system do you prefer? *
                  </label>
                  <div className="space-y-2">
                    {['Imperial (lbs)', 'Metric (kg)'].map((option) => (
                      <label key={option} className="flex items-center">
                        <input
                          type="radio"
                          name="units"
                          value={option}
                          checked={formData.units === option}
                          onChange={(e) => updateFormData('units', e.target.value)}
                          className="mr-2"
                          required
                        />
                        {option}
                      </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Select all equipment available for your training
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {equipmentOptions.map((equipment) => (
                      <label key={equipment} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.equipment.includes(equipment)}
                          onChange={() => toggleEquipment(equipment)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{equipment}</span>
                      </label>
                    ))}
                  </div>
                </div>

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
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>

              </div>
            )}

            {/* Section 2: Skills */}
            {currentSection === 2 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  Section 2: Skills
                </h2>
                <p className="text-gray-600 mb-6">
                  Please select your proficiency for each group of skills. We will use this to ensure your workouts have the correct stimulus.
                </p>

                {skillCategories.map((category) => (
                  <div key={category.name} className="border rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {category.name}
                    </h3>
                    
                    {category.skills.map((skill) => (
                      <div key={skill.name} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {skill.name}
                        </label>
                        <div className="space-y-1">
                          {category.levels.map((level) => (
                            <label key={level} className="flex items-center">
                              <input
                                type="radio"
                                name={`skill-${skill.index}`}
                                value={level}
                                checked={formData.skills[skill.index] === level}
                                onChange={(e) => updateSkill(skill.index, e.target.value)}
                                className="mr-2"
                              />
                              {level}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

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
    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Next
  </button>
</div>
              </div>
            )}

            {/* Section 3: Conditioning Benchmarks */}
            {currentSection === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  Section 3: Conditioning Benchmarks
                </h2>
                <p className="text-gray-600 mb-6">
                  Please enter your recent results for each of these common benchmarks. 
                  Enter times in MM:SS, e.g., 7:30. Leave blank if not recently performed.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      1 Mile Run time (MM:SS)
                    </label>
                    <input
                      type="text"
                      placeholder="7:30"
                      value={formData.conditioningBenchmarks.mileRun}
                      onChange={(e) => updateConditioning('mileRun', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      5K Run time (MM:SS)
                    </label>
                    <input
                      type="text"
                      placeholder="25:30"
                      value={formData.conditioningBenchmarks.fiveKRun}
                      onChange={(e) => updateConditioning('fiveKRun', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      10K Run time (MM:SS)
                    </label>
                    <input
                      type="text"
                      placeholder="52:15"
                      value={formData.conditioningBenchmarks.tenKRun}
                      onChange={(e) => updateConditioning('tenKRun', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      1K Row time (MM:SS)
                    </label>
                    <input
                      type="text"
                      placeholder="3:45"
                      value={formData.conditioningBenchmarks.oneKRow}
                      onChange={(e) => updateConditioning('oneKRow', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      2K Row time (MM:SS)
                    </label>
                    <input
                      type="text"
                      placeholder="7:20"
                      value={formData.conditioningBenchmarks.twoKRow}
                      onChange={(e) => updateConditioning('twoKRow', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      5K Row time (MM:SS)
                    </label>
                    <input
                      type="text"
                      placeholder="19:15"
                      value={formData.conditioningBenchmarks.fiveKRow}
                      onChange={(e) => updateConditioning('fiveKRow', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      10-Minute Air Bike Time Trial (calories)
                    </label>
                    <input
                      type="number"
                      placeholder="185"
                      value={formData.conditioningBenchmarks.airBike10MinCalories}
                      onChange={(e) => updateConditioning('airBike10MinCalories', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Did you enter a Time Trial Result?
                    </label>
                    <div className="space-y-2">
                      {['Y', 'N'].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="radio"
                            name="enteredTimeTrial"
                            value={option}
                            checked={formData.conditioningBenchmarks.enteredTimeTrial === option}
                            onChange={(e) => updateConditioning('enteredTimeTrial', e.target.value)}
                            className="mr-2"
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Conditional Air Bike Type Section */}
                {formData.conditioningBenchmarks.enteredTimeTrial === 'Y' && (
                  <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">
                      Air Bike Information
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        Which type of Air Bike did you use for your Time Trial?
                      </label>
                      <select
                        value={formData.conditioningBenchmarks.airBikeType}
                        onChange={(e) => updateConditioning('airBikeType', e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required={formData.conditioningBenchmarks.enteredTimeTrial === 'Y'}
                      >
                        <option value="">Select an air bike type</option>
                        {airBikeTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

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
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>

              </div>
            )}

            {/* Section 4: 1RM Lifts + Password Creation for New Users */}
            {currentSection === 4 && (
              <div className="space-y-6">

             <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Section 4: 1RM Lifts
             </h2>

                
                <p className="text-gray-600 mb-6">
                  Enter your recent 1-Rep Max for each lift in {formData.units === 'Metric (kg)' ? 'kilograms' : 'pounds'} 
                  (based on your unit preference in Section 1). Decimals may be used (e.g., 225.5). 
                  For Weighted Pullup, <strong>enter added weight only</strong> (e.g., 35).
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {oneRMLifts.map((lift, index) => (
                    <div key={lift}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {lift}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.oneRMs[index]}
                        onChange={(e) => updateOneRM(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={formData.units === 'Metric (kg)' ? 'e.g., 100.5' : 'e.g., 225.5'}
                      />
                    </div>
                  ))}
                </div>
          

            {/* Navigation buttons */}
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
  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
>
  Prepare to Generate Program
</button>            

            </div>
            </div>
		)}
		
{/* Section 5: Program Generation & Account Setup */}
{currentSection === 5 && (
  <div className="space-y-8">
    {/* Hero Header */}
    <div className="text-center">
      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        Ready to Generate Your Program?
      </h2>
      <p className="text-lg text-gray-600">
        You've provided all the data we need. Let's create your personalized CrossFit training program.
      </p>
    </div>

    {/* Program Summary Preview */}
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl p-6">
      <h3 className="text-xl font-semibold text-blue-900 mb-4 text-center">
        🎯 Your Program Will Include:
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-800">
        <div className="flex items-center space-x-2">
          <span className="text-green-600">✓</span>
          <span>Workouts optimized for your {formData.equipment.length} pieces of equipment</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-green-600">✓</span>
          <span>Skill progressions based on your current abilities</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-green-600">✓</span>
          <span>Strength programming using your 1RM data</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-green-600">✓</span>
          <span>Conditioning tailored to your benchmarks</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-green-600">✓</span>
          <span>12-week periodized training plan</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-green-600">✓</span>
          <span>Advanced analytics and progress tracking</span>
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
                  <div className={`flex items-center ${validation.isLongEnough ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-2">{validation.isLongEnough ? '✓' : '○'}</span>
                    8+ characters
                  </div>
                  <div className={`flex items-center ${validation.hasUppercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-2">{validation.hasUppercase ? '✓' : '○'}</span>
                    1+ uppercase
                  </div>
                  <div className={`flex items-center ${validation.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
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
                <p className="text-green-600 flex items-center">
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
    <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-8">
      <div className="text-center space-y-6">
        <h3 className="text-2xl font-bold text-gray-900">
          🚀 Launch Your Training Program
        </h3>
        
        <div className="space-y-4">
          <div className="bg-white/70 rounded-lg p-4 border border-green-200">
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={confirmSubmission}
                onChange={(e) => setConfirmSubmission(e.target.checked)}
                className="mt-1 rounded border-green-300"
              />
              <div className="text-left">
                <p className="font-medium text-gray-800">
                  ✨ Ready to Generate My Program
                </p>
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
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white text-xl font-bold py-4 px-8 rounded-xl hover:from-green-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSubmitting 
              ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isNewPaidUser ? 'Creating Account & Generating Program...' : 'Generating Your Updated Program...'}
                </span>
              ) 
              : (
                <span>
                  🎯 {isNewPaidUser ? 'Create Account & Generate My Program' : 'Generate My Updated Program'}
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

