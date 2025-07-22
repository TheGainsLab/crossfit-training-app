'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface ProfileData {
  user_summary: {
    name: string
    email: string
    gender: string
    units: string
    body_weight: number | null
    equipment: string[]
    ability_level: string
    sport_id: number
  }
  one_rms: {
    snatch: number | null
    power_snatch: number | null
    clean_and_jerk: number | null
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
    ten_min_air_bike: string | null
  }
  skills_assessment: {
    dont_have: string[]
    beginner: string[]
    intermediate: string[]
    advanced: string[]
    advanced_count: number
    total_skills_assessed: number
  }
  ratio_analysis: {
    [key: string]: string
  }
  technical_focus: {
    snatch_technical_count: number
    clean_jerk_technical_count: number
    back_squat_focus: string
    front_squat_focus: string
    press_focus: string
  }
  lift_levels: {
    snatch_level: string
    clean_jerk_level: string
    back_squat_level: string
    press_level: string
  }
  accessory_needs: {
    needs_upper_back: boolean
    needs_leg_strength: boolean
    needs_posterior_chain: boolean
    needs_upper_body_pressing: boolean
    needs_upper_body_pulling: boolean
    needs_core: boolean
  }
  missing_data: string[]
  recommendations: Array<{
    priority: string
    category: string
    message: string
  }>
  generated_at: string
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      setUser(user)

      // Get user ID from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        setLoading(false)
        return
      }

      // Fetch the latest profile for this user
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (profileError || !profileData) {
        setError('No profile found. Please complete the intake assessment.')
        setLoading(false)
        return
      }

      // The profile_data column contains the full profile
      setProfile(profileData.profile_data)
      setLoading(false)
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('Failed to load profile')
      setLoading(false)
    }
  }

  const formatWeight = (weight: number | null) => {
    if (!weight) return 'Not recorded'
    return `${weight} ${profile?.user_summary.units.includes('kg') ? 'kg' : 'lbs'}`
  }

  const getRatioColor = (message: string) => {
    if (message.includes('Low')) return 'text-red-600'
    if (message.includes('High')) return 'text-yellow-600'
    if (message.includes('Balanced')) return 'text-green-600'
    if (message.includes('Missing')) return 'text-gray-500'
    return 'text-gray-700'
  }

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'bg-red-100 text-red-800'
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error}</p>
            <a 
              href="/intake" 
              className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Go to Assessment
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Profile Data</h2>
            <p className="text-yellow-700">Profile data not found. Please contact support.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Athlete Profile & Analysis
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Generated: {new Date(profile.generated_at).toLocaleDateString()}</span>
            <span>•</span>
            <span>Ability Level: <span className="font-semibold text-gray-900">{profile.user_summary.ability_level}</span></span>
            <span>•</span>
            <span>Advanced Skills: <span className="font-semibold text-gray-900">{profile.skills_assessment.advanced_count}/{profile.skills_assessment.total_skills_assessed}</span></span>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-semibold">{profile.user_summary.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Body Weight</p>
              <p className="font-semibold">{formatWeight(profile.user_summary.body_weight)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gender</p>
              <p className="font-semibold">{profile.user_summary.gender}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Equipment Available</p>
              <p className="font-semibold">{profile.user_summary.equipment.length} items</p>
            </div>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Key Performance Indicators</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <p className="text-2xl font-bold text-blue-600">{profile.lift_levels.snatch_level}</p>
              <p className="text-sm text-gray-600">Snatch Level</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <p className="text-2xl font-bold text-blue-600">{profile.lift_levels.clean_jerk_level}</p>
              <p className="text-sm text-gray-600">Clean & Jerk Level</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <p className="text-2xl font-bold text-blue-600">{profile.lift_levels.back_squat_level}</p>
              <p className="text-sm text-gray-600">Back Squat Level</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <p className="text-2xl font-bold text-blue-600">{profile.lift_levels.press_level}</p>
              <p className="text-sm text-gray-600">Press Level</p>
            </div>
          </div>
        </div>

        {/* Strength Ratios */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Strength Ratio Analysis</h2>
          <div className="space-y-3">
            {Object.entries(profile.ratio_analysis).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">{key.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}</span>
                <span className={`font-medium ${getRatioColor(value)}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Identified Needs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Programming Focus Areas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Accessory Needs</h3>
              <div className="space-y-2">
                {Object.entries(profile.accessory_needs).map(([key, value]) => (
                  <div key={key} className="flex items-center">
                    <span className={`w-4 h-4 rounded-full mr-2 ${value ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <span className="text-gray-700">
                      {key.replace('needs_', '').split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Technical Focus</h3>
              <div className="space-y-2 text-gray-700">
                <p>Snatch: {profile.technical_focus.snatch_technical_count} exercises/day</p>
                <p>Clean & Jerk: {profile.technical_focus.clean_jerk_technical_count} exercises/day</p>
                <p>Back Squat Focus: {profile.technical_focus.back_squat_focus}</p>
                <p>Front Squat Focus: {profile.technical_focus.front_squat_focus}</p>
                <p>Press Focus: {profile.technical_focus.press_focus}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 1RMs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">One Rep Maxes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(profile.one_rms).map(([lift, weight]) => (
              <div key={lift} className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">{lift.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}</p>
                <p className="font-semibold">{formatWeight(weight)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {profile.recommendations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recommendations</h2>
            <div className="space-y-3">
              {profile.recommendations.map((rec, index) => (
                <div key={index} className={`p-4 rounded-lg ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-start">
                    <span className="font-semibold mr-2 capitalize">{rec.priority}:</span>
                    <p>{rec.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Data */}
        {profile.missing_data.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Missing Data</h3>
            <p className="text-yellow-700 mb-2">
              Adding this information will improve your program accuracy:
            </p>
            <ul className="list-disc list-inside text-yellow-700">
              {profile.missing_data.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
