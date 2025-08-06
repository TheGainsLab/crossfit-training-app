'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  generated_at: string
}

// Type guard for lift keys
type LiftKey = keyof ProfileData['one_rms']

// Helper function to group lifts by category with proper typing
const liftCategories = {
  olympic: {
    name: 'OLYMPIC LIFTS',
    lifts: ['snatch', 'clean_and_jerk'] as const
  },
  olympic_variations: {
    name: 'OLYMPIC VARIATIONS',
    lifts: ['power_snatch', 'power_clean', 'clean_only', 'jerk_only'] as const
  },
  strength: {
    name: 'STRENGTH LIFTS',
    lifts: ['back_squat', 'front_squat', 'overhead_squat', 'bench_press'] as const
  },
  pulling: {
    name: 'PULLING',
    lifts: ['deadlift', 'weighted_pullup'] as const
  },
  pressing: {
    name: 'PRESSING',
    lifts: ['push_press', 'strict_press'] as const
  }
}

// Define skill categories
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
    skills: ['Push-ups', 'Ring Dips', 'Strict Ring Dips', 'Strict Handstand Push-ups', 
             'Wall Facing Handstand Push-ups', 'Deficit Handstand Push-ups (4")']
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
    skills: ['Legless Rope Climbs', 'Pegboard Ascent', 'Handstand Walk (10m or 25\')', 
             'Seated Legless Rope Climbs', 'Strict Ring Muscle Ups', 'Handstand Walk Obstacle Crossings']
  }
]

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [showAllLifts, setShowAllLifts] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [userSkills, setUserSkills] = useState<{[key: string]: string}>({})

  // CRITICAL: Safe calculation helper to prevent null/undefined errors
  const safeRatio = (numerator: number | null, denominator: number | null, asPercent = true): string => {
    if (!numerator || !denominator || denominator === 0) return 'N/A'
    const ratio = numerator / denominator
    return asPercent ? `${Math.round(ratio * 100)}%` : ratio.toFixed(1) + 'x'
  }

  // Helper to get ratio status and target info
  const getRatioStatus = (numerator: number | null, denominator: number | null, target: number) => {
    if (!numerator || !denominator || denominator === 0) return { status: 'unknown', ratio: 'N/A' }
    const ratio = numerator / denominator
    const percentage = Math.round(ratio * 100)
    return {
      status: percentage >= target ? 'good' : 'needs_work',
      ratio: `${percentage}%`,
      target: `${target}%`
    }
  }

  // Helper to get bodyweight ratio status
  const getBodyweightRatioStatus = (lift: number | null, bodyweight: number | null, maleTarget: number, femaleTarget: number, gender: string) => {
    if (!lift || !bodyweight || bodyweight === 0) return { status: 'unknown', ratio: 'N/A' }
    const ratio = lift / bodyweight
    const target = gender === 'Male' ? maleTarget : femaleTarget
    return {
      status: ratio >= target ? 'good' : ratio >= (target * 0.8) ? 'okay' : 'needs_work',
      ratio: `${ratio.toFixed(1)}x`,
      target: `${target}x`
    }
  }

  // Load user skills directly from database
  useEffect(() => {
    const loadUserSkills = async () => {
      if (!user) return
    
        const supabase = createClient() // Add this line  
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (userData) {
          const { data: skillsData } = await supabase
            .from('user_skills')
            .select('skill_name, skill_level')
            .eq('user_id', userData.id)

          if (skillsData) {
            const skillsMap: {[key: string]: string} = {}
            skillsData.forEach(skill => {
              let level = 'Don\'t Have'
              if (skill.skill_level.includes('Advanced')) level = 'Advanced'
              else if (skill.skill_level.includes('Intermediate')) level = 'Intermediate'
              else if (skill.skill_level.includes('Beginner')) level = 'Beginner'
              
              skillsMap[skill.skill_name] = level
            })
            setUserSkills(skillsMap)
          }
        }
      } catch (error) {
        console.error('Error loading skills:', error)
      }
    }

    loadUserSkills()
  }, [user])

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(name => name !== categoryName)
        : [...prev, categoryName]
    )
  }

  const getSkillLevel = (skillName: string) => {
    if (userSkills[skillName]) {
      return userSkills[skillName]
    }
    if (profile?.skills_assessment.advanced.includes(skillName)) return 'Advanced'
    if (profile?.skills_assessment.intermediate.includes(skillName)) return 'Intermediate'
    if (profile?.skills_assessment.beginner.includes(skillName)) return 'Beginner'
    return 'Don\'t Have'
  }

  const getSkillIcon = (level: string) => {
    switch(level) {
      case 'Advanced': return '●'
      case 'Intermediate': return '◑'
      case 'Beginner': return '◐'
      default: return '○'
    }
  }

  const getSkillColor = (level: string) => {
    switch(level) {
      case 'Advanced': return 'text-green-600'
      case 'Intermediate': return 'text-blue-600'
      case 'Beginner': return 'text-yellow-600'
      default: return 'text-gray-400'
    }
  }

  const getCategoryStats = (skills: string[]) => {
    const completed = skills.filter(skill => {
      const level = getSkillLevel(skill)
      return level === 'Advanced' || level === 'Intermediate'
    }).length
    return `${completed}/${skills.length}`
  }

  useEffect(() => {
    loadProfile()
  }, [])

const loadProfile = async () => {
  try {
    const supabase = createClient() // Add this line
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()  

    if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      setUser(user)

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

  const formatLiftName = (liftKey: string) => {
    return liftKey.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Loading state
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

  // Error state
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

  // No profile state
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

// Main render
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Consolidated Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Athlete Profile & Analysis
          </h1>
          <div className="text-lg text-gray-800 font-semibold">
            {profile.user_summary.name} • {formatWeight(profile.user_summary.body_weight)}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Generated: {new Date(profile.generated_at).toLocaleDateString()}
          </div>
        </div>

        {/* New Strength Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">STRENGTH SNAPSHOT</h2>
          <div className="border-t-2 border-gray-900 mb-6"></div>
          
          {/* Olympic Lift Performance */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Olympic Lift Performance</h3>
            <div className="space-y-2">
              {(() => {
                const snatchStatus = getRatioStatus(profile.one_rms.snatch, profile.one_rms.back_squat, 60)
                const cjStatus = getRatioStatus(profile.one_rms.clean_and_jerk, profile.one_rms.back_squat, 75)
                
                return (
                  <>
                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                      snatchStatus.status === 'good' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-center">
                        <span className={`mr-3 text-lg ${
                          snatchStatus.status === 'good' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {snatchStatus.status === 'good' ? '✅' : '❌'}
                        </span>
                        <span className="text-gray-700">
                          Snatch: {formatWeight(profile.one_rms.snatch)} ({snatchStatus.ratio} of squat)
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${
                        snatchStatus.status === 'good' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Target: {snatchStatus.target}
                      </span>
                    </div>
                    
                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                      cjStatus.status === 'good' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-center">
                        <span className={`mr-3 text-lg ${
                          cjStatus.status === 'good' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {cjStatus.status === 'good' ? '✅' : '❌'}
                        </span>
                        <span className="text-gray-700">
                          C&J: {formatWeight(profile.one_rms.clean_and_jerk)} ({cjStatus.ratio} of squat)
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${
                        cjStatus.status === 'good' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Target: {cjStatus.target}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Foundation Strength */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Foundation Strength</h3>
            <div className="space-y-2">
              {(() => {
                const backSquatStatus = getBodyweightRatioStatus(profile.one_rms.back_squat, profile.user_summary.body_weight, 2.0, 1.5, profile.user_summary.gender)
                const deadliftStatus = getBodyweightRatioStatus(profile.one_rms.deadlift, profile.user_summary.body_weight, 2.5, 2.0, profile.user_summary.gender)
                const benchStatus = getBodyweightRatioStatus(profile.one_rms.bench_press, profile.user_summary.body_weight, 1.5, 1.0, profile.user_summary.gender)
                
                return (
                  <>
                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                      backSquatStatus.status === 'good' ? 'bg-green-50' : 
                      backSquatStatus.status === 'okay' ? 'bg-yellow-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-center">
                        <span className={`mr-3 text-lg ${
                          backSquatStatus.status === 'good' ? 'text-green-500' : 
                          backSquatStatus.status === 'okay' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {backSquatStatus.status === 'good' ? '✅' : backSquatStatus.status === 'okay' ? '⚠️' : '❌'}
                        </span>
                        <span className="text-gray-700">Back Squat: {formatWeight(profile.one_rms.back_squat)}</span>
                      </div>
                      <span className={`text-sm font-medium ${
                        backSquatStatus.status === 'good' ? 'text-green-600' : 
                        backSquatStatus.status === 'okay' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {backSquatStatus.ratio} bodyweight
                      </span>
                    </div>
                    
                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                      deadliftStatus.status === 'good' ? 'bg-green-50' : 
                      deadliftStatus.status === 'okay' ? 'bg-yellow-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-center">
                        <span className={`mr-3 text-lg ${
                          deadliftStatus.status === 'good' ? 'text-green-500' : 
                          deadliftStatus.status === 'okay' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {deadliftStatus.status === 'good' ? '✅' : deadliftStatus.status === 'okay' ? '⚠️' : '❌'}
                        </span>
                        <span className="text-gray-700">Deadlift: {formatWeight(profile.one_rms.deadlift)}</span>
                      </div>
                      <span className={`text-sm font-medium ${
                        deadliftStatus.status === 'good' ? 'text-green-600' : 
                        deadliftStatus.status === 'okay' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {deadliftStatus.ratio} bodyweight
                      </span>
                    </div>
                    
                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                      benchStatus.status === 'good' ? 'bg-green-50' : 
                      benchStatus.status === 'okay' ? 'bg-yellow-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-center">
                        <span className={`mr-3 text-lg ${
                          benchStatus.status === 'good' ? 'text-green-500' : 
                          benchStatus.status === 'okay' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {benchStatus.status === 'good' ? '✅' : benchStatus.status === 'okay' ? '⚠️' : '❌'}
                        </span>
                        <span className="text-gray-700">Bench Press: {formatWeight(profile.one_rms.bench_press)}</span>
                      </div>
                      <span className={`text-sm font-medium ${
                        benchStatus.status === 'good' ? 'text-green-600' : 
                        benchStatus.status === 'okay' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {benchStatus.ratio} bodyweight
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Expandable Details */}
          {showAllLifts && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-800 mb-4">Complete Lift & Ratio Details</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* All Max Lifts Column */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">ALL MAX LIFTS</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(profile.one_rms).map(([liftKey, value]) => {
                      if (value === null || ['snatch', 'clean_and_jerk', 'back_squat', 'deadlift', 'bench_press'].includes(liftKey)) return null
                      return (
                        <div key={liftKey} className="flex justify-between">
                          <span className="text-gray-600">{formatLiftName(liftKey)}</span>
                          <span className="font-medium">{formatWeight(value)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* All Ratios Column */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">ALL RATIOS</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Front Squat / Back Squat</span>
                      <span className="font-medium">{safeRatio(profile.one_rms.front_squat, profile.one_rms.back_squat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Power Snatch / Snatch</span>
                      <span className="font-medium">{safeRatio(profile.one_rms.power_snatch, profile.one_rms.snatch)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Power Clean / Clean</span>
                      <span className="font-medium">{safeRatio(profile.one_rms.power_clean, profile.one_rms.clean_only)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Jerk / Clean</span>
                      <span className="font-medium">{safeRatio(profile.one_rms.jerk_only, profile.one_rms.clean_only)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Snatch / C&J</span>
                      <span className="font-medium">{safeRatio(profile.one_rms.snatch, profile.one_rms.clean_and_jerk)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overhead Squat / Snatch</span>
                      <span className="font-medium">{safeRatio(profile.one_rms.overhead_squat, profile.one_rms.snatch)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Push Press / Strict Press</span>
                      <span className="font-medium">{safeRatio(profile.one_rms.push_press, profile.one_rms.strict_press)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setShowAllLifts(!showAllLifts)}
            className="mt-6 text-blue-600 hover:text-blue-800 font-medium"
          >
            [{showAllLifts ? '- Hide Complete Details' : '+ View Complete Lift & Ratio Details'}]
          </button>
        </div>

{/* Enhanced Conditioning Benchmarks */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">CONDITIONING BENCHMARKS</h2>
          <div className="border-t-2 border-gray-900 mb-6"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Running Column */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">RUNNING</h3>
              <div className="space-y-2">
                {profile.benchmarks.mile_run && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Mile</span>
                    <span className="font-semibold">{profile.benchmarks.mile_run}</span>
                  </div>
                )}
                {profile.benchmarks.five_k_run && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">5K</span>
                    <span className="font-semibold">{profile.benchmarks.five_k_run}</span>
                  </div>
                )}
                {profile.benchmarks.ten_k_run && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">10K</span>
                    <span className="font-semibold">{profile.benchmarks.ten_k_run}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rowing Column */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">ROWING</h3>
              <div className="space-y-2">
                {profile.benchmarks.one_k_row && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">1K</span>
                    <span className="font-semibold">{profile.benchmarks.one_k_row}</span>
                  </div>
                )}
                {profile.benchmarks.two_k_row && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">2K</span>
                    <span className="font-semibold">{profile.benchmarks.two_k_row}</span>
                  </div>
                )}
                {profile.benchmarks.five_k_row && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">5K</span>
                    <span className="font-semibold">{profile.benchmarks.five_k_row}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bike Column */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">BIKE</h3>
              <div className="space-y-2">
                {profile.benchmarks.air_bike_10_min && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">10min</span>
                    <span className="font-semibold">{profile.benchmarks.air_bike_10_min}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Programming Focus Areas - KEPT AS IS FOR NOW */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Programming Focus Areas</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accessory Needs with Explanations */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-4">Accessory Needs</h3>
              <div className="space-y-3">
                {/* Upper Body Pulling */}
                <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_upper_body_pulling ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-start">
                    <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_upper_body_pulling ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Upper Body Pulling</div>
                      {profile.accessory_needs.needs_upper_body_pulling ? (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Why:</span> Your Snatch ({safeRatio(profile.one_rms.snatch, profile.one_rms.back_squat)}) 
                          or C&J ({safeRatio(profile.one_rms.clean_and_jerk, profile.one_rms.back_squat)}) 
                          to Back Squat ratio is low. Stronger pulling will help you get the bar higher.
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-1">✓ Well developed</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upper Body Pressing */}
                <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_upper_body_pressing ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-start">
                    <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_upper_body_pressing ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Upper Body Pressing</div>
                      {profile.accessory_needs.needs_upper_body_pressing ? (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Why:</span> Your Bench Press to Body Weight ratio 
                          ({safeRatio(profile.one_rms.bench_press, profile.user_summary.body_weight, false)}) is below optimal. 
                          Target: {profile.user_summary.gender === 'Male' ? '1.5x' : '1.0x'} bodyweight.
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-1">✓ Sufficient strength</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Core */}
                <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_core ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-start">
                    <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_core ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Core</div>
                      {profile.accessory_needs.needs_core ? (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Why:</span> Your Front Squat ({safeRatio(profile.one_rms.front_squat, profile.one_rms.back_squat)}) 
                          or OHS ratios indicate core stability needs work. Target: FS = 85-90% of BS.
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-1">✓ Strong foundation</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upper Back */}
                <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_upper_back ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-start">
                    <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_upper_back ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Upper Back</div>
                      {profile.accessory_needs.needs_upper_back ? (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Why:</span> Low Front Squat or Overhead Squat performance suggests 
                          upper back strength/mobility limitations.
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-1">✓ Well developed</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Leg Strength */}
                <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_leg_strength ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-start">
                    <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_leg_strength ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Leg Strength</div>
                      {profile.accessory_needs.needs_leg_strength ? (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Why:</span> Your Push Press to Strict Press ratio suggests 
                          insufficient leg drive. You should push press 30-40% more than strict press.
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-1">✓ Sufficient for current level</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Posterior Chain */}
                <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_posterior_chain ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-start">
                    <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_posterior_chain ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Posterior Chain</div>
                      {profile.accessory_needs.needs_posterior_chain ? (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Why:</span> Your Deadlift to Body Weight ratio 
                          ({safeRatio(profile.one_rms.deadlift, profile.user_summary.body_weight, false)}) needs improvement. 
                          Target: {profile.user_summary.gender === 'Male' ? '2.5x' : '2.0x'} bodyweight.
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-1">✓ Balanced development</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>


{/* Technical Focus */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-4">Technical Focus</h3>
              <div className="space-y-3 text-gray-700">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Snatch: {profile.technical_focus.snatch_technical_count} exercises/day</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Based on your {profile.lift_levels.snatch_level} snatch level
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Clean & Jerk: {profile.technical_focus.clean_jerk_technical_count} exercises/day</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Based on your {profile.lift_levels.clean_jerk_level} C&J level
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Back Squat Focus: {profile.technical_focus.back_squat_focus}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Programming emphasis based on your squat ratios
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Front Squat Focus: {profile.technical_focus.front_squat_focus}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {profile.technical_focus.front_squat_focus === 'overhead_complex' ? 
                      'Combining with overhead work to improve positions' : 
                      'Targeted work for your needs'}
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Press Focus: {profile.technical_focus.press_focus}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {profile.technical_focus.press_focus === 'stability_unilateral' ? 
                      'Single-arm work to address imbalances' : 
                      'Focused on your specific needs'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">How we use this:</span> Your program automatically includes extra work 
              in the red areas while maintaining your strengths in the green areas. This ensures balanced development 
              and addresses your specific weaknesses.
            </p>
          </div>
        </div>

        {/* Movement Skills Repository */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">MOVEMENT SKILLS</h2>
          <div className="border-t-2 border-gray-900 mb-4"></div>
          
          {/* Skills Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>
                Skills Mastered: {
                  Object.values(userSkills).filter(level => level === 'Advanced').length
                }/{Object.keys(userSkills).length || 26}
              </span>
              <span>
                {Math.round((Object.values(userSkills).filter(level => level === 'Advanced').length / 
                  (Object.keys(userSkills).length || 26)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(Object.values(userSkills).filter(level => level === 'Advanced').length / 
                    (Object.keys(userSkills).length || 26)) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Skills Categories */}
          <div className="space-y-3">
            {skillCategories.map((category) => {
              const isExpanded = expandedCategories.includes(category.name)
              const categoryStats = getCategoryStats(category.skills)
              
              return (
                <div key={category.name} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.name)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <span className="mr-2 text-gray-600">{isExpanded ? '▼' : '▶'}</span>
                      <h3 className="font-semibold text-gray-800">{category.name}</h3>
                    </div>
                    <span className="text-sm text-gray-600">({categoryStats})</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-4 space-y-2">
                      {category.skills.map(skill => {
                        const level = getSkillLevel(skill)
                        const icon = getSkillIcon(level)
                        const color = getSkillColor(level)
                        
                        return (
                          <div key={skill} className="flex justify-between items-center py-1">
                            <div className="flex items-center">
                              <span className={`mr-3 text-lg ${color}`}>{icon}</span>
                              <span className="text-gray-700">{skill}</span>
                            </div>
                            <span className={`text-sm ${color}`}>{level}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

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
