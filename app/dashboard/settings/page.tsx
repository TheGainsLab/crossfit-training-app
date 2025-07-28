'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface UserSettings {
  name: string
  email: string
  body_weight: number | null
  units: string
  gender: string
}

interface OneRM {
  exercise_name: string
  one_rm: number
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    email: '',
    body_weight: null,
    units: 'Imperial (lbs)',
    gender: ''
  })
  const [oneRMs, setOneRMs] = useState<OneRM[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const oneRMExercises = [
    'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean',
    'Clean (clean only)', 'Jerk (from rack or blocks, max Split or Power Jerk)',
    'Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift',
    'Bench Press', 'Push Press', 'Strict Press', 'Weighted Pullup (do not include body weight)'
  ]

  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, body_weight, units, gender')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        setLoading(false)
        return
      }

      setUserId(userData.id)
      setSettings({
        name: userData.name || '',
        email: userData.email || '',
        body_weight: userData.body_weight,
        units: userData.units || 'Imperial (lbs)',
        gender: userData.gender || ''
      })

      // Load 1RMs
      const { data: oneRMData, error: oneRMError } = await supabase
        .from('user_one_rms')
        .select('exercise_name, one_rm')
        .eq('user_id', userData.id)

      if (oneRMError) throw oneRMError

      // Create full list with all exercises
      const oneRMMap = new Map(oneRMData?.map(rm => [rm.exercise_name, rm.one_rm]) || [])
      const allOneRMs = oneRMExercises.map(exercise => ({
        exercise_name: exercise,
        one_rm: oneRMMap.get(exercise) || 0
      }))

      setOneRMs(allOneRMs)
      setLoading(false)
    } catch (err) {
      console.error('Error loading settings:', err)
      setError('Failed to load settings')
      setLoading(false)
    }
  }

  const handleSettingsChange = (field: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleOneRMChange = (exerciseName: string, value: string) => {
    setOneRMs(prev => 
      prev.map(rm => 
        rm.exercise_name === exerciseName 
          ? { ...rm, one_rm: parseFloat(value) || 0 }
          : rm
      )
    )
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage('')

    try {
      // Update user settings
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: settings.name,
          body_weight: settings.body_weight,
          units: settings.units,
          gender: settings.gender,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // Update 1RMs (only non-zero values)
      const validOneRMs = oneRMs.filter(rm => rm.one_rm > 0)
      
      for (const rm of validOneRMs) {
        const { error: rmError } = await supabase
          .from('user_one_rms')
          .upsert({
            user_id: userId,
            one_rm_index: oneRMExercises.indexOf(rm.exercise_name),
            exercise_name: rm.exercise_name,
            one_rm: rm.one_rm,
            recorded_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,one_rm_index'
          })

        if (rmError) throw rmError
      }

      setMessage('Settings saved successfully!')
      setSaving(false)

      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setMessage('Failed to save settings')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="mt-4 text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Settings
              </h1>
              <p className="text-gray-600">
                Update your profile and training data
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('success') 
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Basic Settings */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => handleSettingsChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={settings.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Body Weight
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.body_weight || ''}
                onChange={(e) => handleSettingsChange('body_weight', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={settings.units === 'Metric (kg)' ? 'e.g., 70.5' : 'e.g., 155.5'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Units
              </label>
              <select
                value={settings.units}
                onChange={(e) => handleSettingsChange('units', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Imperial (lbs)">Imperial (lbs)</option>
                <option value="Metric (kg)">Metric (kg)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                value={settings.gender}
                onChange={(e) => handleSettingsChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        {/* 1RM Settings */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            1 Rep Max Lifts
            <span className="text-sm font-normal text-gray-600 ml-2">
              (in {settings.units === 'Metric (kg)' ? 'kg' : 'lbs'})
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {oneRMs.map((rm) => (
              <div key={rm.exercise_name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {rm.exercise_name}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={rm.one_rm || ''}
                  onChange={(e) => handleOneRMChange(rm.exercise_name, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Link
            href="/profile"
            className="text-blue-600 hover:text-blue-700"
          >
            View Full Profile Analysis →
          </Link>
          
          <button
            onClick={saveSettings}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Note */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Updating your 1RMs or body weight may affect your training program. 
            Consider regenerating your program after significant changes.
          </p>
        </div>
      </div>
    </div>
  )
}
