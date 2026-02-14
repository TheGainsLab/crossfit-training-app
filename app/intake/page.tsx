'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const basicsEquipment = [
  'Barbell', 'Dumbbells', 'Kettlebells', 'Pullup Bar or Rig', 'High Rings',
  'Low or Adjustable Rings', 'Bench', 'Squat Rack', 'Open Space', 'Wall Space',
  'Jump Rope', 'Wall Ball'
]
const machinesEquipment = ['Rowing Machine', 'Air Bike', 'Ski Erg', 'Bike Erg']
const lessCommonEquipment = [
  'GHD', 'Axle Bar', 'Climbing Rope', 'Pegboard', 'Parallettes', 'Dball',
  'Dip Bar', 'Plyo Box', 'HS Walk Obstacle', 'Sandbag'
]

export default function IntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <IntakePageContent />
    </Suspense>
  )
}

function IntakePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<{
    email: string; name: string; productType: string
  } | null>(null)

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'Male' | 'Female' | 'Prefer not to say' | ''>('')
  const [units, setUnits] = useState<'Imperial (lbs)' | 'Metric (kg)'>('Imperial (lbs)')
  const [bodyWeight, setBodyWeight] = useState('')
  const [equipment, setEquipment] = useState<string[]>([])

  // Verify checkout session on mount
  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    const verifySession = async () => {
      try {
        const response = await fetch(`/api/verify-checkout-session?session_id=${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setSessionInfo(data)
          setEmail(data.email || '')
          setName(data.name || '')
        } else {
          setError('Could not verify your checkout session. Please try signing in.')
        }
      } catch {
        setError('Could not verify your checkout session. Please try signing in.')
      } finally {
        setLoading(false)
      }
    }

    verifySession()
  }, [sessionId])

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) { setError('Email is required'); return }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (!name.trim()) { setError('Name is required'); return }
    if (!gender) { setError('Please select your gender'); return }
    if (!bodyWeight.trim()) { setError('Body weight is required'); return }

    setStep(2)
  }

  const handleEquipmentToggle = (item: string) => {
    setEquipment(prev =>
      prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
    )
  }

  const handleComplete = async () => {
    setSubmitting(true)
    setError('')

    try {
      const productType = sessionInfo?.productType || 'premium'

      // Step 1: Create user account
      const createResponse = await fetch('/api/create-user-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          productType,
          sessionId,
          userData: { name, gender, bodyWeight, units }
        })
      })

      const createData = await createResponse.json()

      if (!createResponse.ok) {
        throw new Error(createData.error || 'Account creation failed')
      }

      // Step 2: Auto-sign in
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        throw new Error(`Sign in failed: ${signInError.message}`)
      }

      // Step 3: Save intake data (equipment, basic info)
      const saveResponse = await fetch('/api/save-intake-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: createData.user.userId,
          equipment,
          bodyWeight,
          gender,
          units,
          skills: new Array(26).fill("Don't have it"),
          oneRMs: new Array(14).fill(''),
          benchmarks: {}
        })
      })

      if (!saveResponse.ok) {
        console.warn('Intake data save had issues, but account was created')
      }

      // Step 4: Redirect based on product type
      const destination = productType === 'btn' ? '/btn'
        : productType === 'engine' ? '/engine'
        : '/dashboard'

      router.push(destination)
    } catch (err: any) {
      console.error('Intake completion error:', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto" />
          <p className="mt-4 text-gray-600">Verifying your purchase...</p>
        </div>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Welcome Back</h1>
          <p className="text-gray-600 mb-6">
            If you already have an account, please sign in. If you just completed a purchase,
            check your email for the confirmation link.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span className={step >= 1 ? 'text-[#FE5858] font-semibold' : ''}>1. Create Account</span>
            <span className={step >= 2 ? 'text-[#FE5858] font-semibold' : ''}>2. Equipment</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#FE5858] h-2 rounded-full transition-all"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Step 1: Account Creation */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h1 className="text-2xl font-bold mb-2">Create Your Account</h1>
            <p className="text-gray-600 mb-6">Set up your account to start training.</p>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-[#FE5858] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-[#FE5858] focus:outline-none"
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-[#FE5858] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-[#FE5858] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <div className="flex gap-2">
                  {(['Male', 'Female', 'Prefer not to say'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGender(option)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        gender === option
                          ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
                <div className="flex gap-2">
                  {(['Imperial (lbs)', 'Metric (kg)'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setUnits(option)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        units === option
                          ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body Weight ({units === 'Metric (kg)' ? 'kg' : 'lbs'})
                </label>
                <input
                  type="number"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-[#FE5858] focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors"
              >
                Next: Select Equipment
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Equipment Selection */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h1 className="text-2xl font-bold mb-2">Select Your Equipment</h1>
            <p className="text-gray-600 mb-6">
              Choose the equipment you have access to. This ensures workouts match your setup.
            </p>

            <div className="space-y-6">
              {/* The Basics */}
              <div>
                <h3 className="text-lg font-semibold mb-3">The Basics</h3>
                <div className="grid grid-cols-2 gap-2">
                  {basicsEquipment.map(item => (
                    <label
                      key={item}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        equipment.includes(item)
                          ? 'border-[#FE5858] bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={equipment.includes(item)}
                        onChange={() => handleEquipmentToggle(item)}
                        className="accent-[#FE5858]"
                      />
                      <span className="text-sm">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Machines */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Machines</h3>
                <div className="grid grid-cols-2 gap-2">
                  {machinesEquipment.map(item => (
                    <label
                      key={item}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        equipment.includes(item)
                          ? 'border-[#FE5858] bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={equipment.includes(item)}
                        onChange={() => handleEquipmentToggle(item)}
                        className="accent-[#FE5858]"
                      />
                      <span className="text-sm">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Less Common */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Less Common</h3>
                <div className="grid grid-cols-2 gap-2">
                  {lessCommonEquipment.map(item => (
                    <label
                      key={item}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        equipment.includes(item)
                          ? 'border-[#FE5858] bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={equipment.includes(item)}
                        onChange={() => handleEquipmentToggle(item)}
                        className="accent-[#FE5858]"
                      />
                      <span className="text-sm">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center">
                {equipment.length} item{equipment.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(1)}
                disabled={submitting}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={submitting}
                className="flex-1 py-3 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Setting up...
                  </span>
                ) : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
