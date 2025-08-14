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

interface OlympicProgressProps {
  lift: string
  weight: string
  current: number
  target: number
  unit?: string
}

interface FoundationProgressProps {
  lift: string
  weight: string
  ratio: number
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

// Olympic Lift Progress Bar Component
const OlympicProgress = ({ lift, weight, current, target, unit = "%" }: OlympicProgressProps) => {
  const percentage = Math.min((current / target) * 100, 100)
  const isClose = current >= target * 0.9
  const isBalanced = current >= target
  
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-3">
          <span className="font-medium text-gray-900">{lift}:</span>
          <span className="text-lg font-semibold text-gray-800">{weight}</span>
          <span className="text-sm text-gray-600">({Math.round(current * 100)}{unit} of squat)</span>
        </div>
        <div className={`text-sm font-medium px-3 py-1 rounded-full ${
          isBalanced ? 'bg-green-100 text-green-700' : 
          isClose ? 'bg-amber-100 text-amber-700' : 
          'bg-blue-100 text-blue-700'
        }`}>
          {isBalanced ? 'Balanced' : isClose ? 'Nearly Balanced' : 'Developing'}
        </div>
      </div>
      
      <div className="relative">
        {/* Progress Bar Background */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${
              isBalanced ? 'bg-gradient-to-r from-green-400 to-green-500' :
              isClose ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
              'bg-gradient-to-r from-blue-400 to-blue-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Target Line */}
        <div className="absolute top-0 right-0 transform translate-x-2">
          <div className="w-0.5 h-3 bg-gray-600"></div>
          <div className="text-xs text-gray-600 mt-1 -translate-x-1/2">
            Target: {Math.round(target * 100)}{unit}
          </div>
        </div>
      </div>
    </div>
  )
}

// Foundation Strength Progress Bar Component
const FoundationProgress = ({ lift, weight, ratio }: FoundationProgressProps) => {
  // Convert ratio to number if it's a string
  const numericRatio = typeof ratio === 'string' ? parseFloat(ratio) : ratio
  
  const levels = [
    { name: 'Beginner', value: 1.0, color: 'bg-gray-300' },
    { name: 'Intermediate', value: 1.5, color: 'bg-blue-400' },
    { name: 'Advanced', value: 2.0, color: 'bg-green-400' },
    { name: 'Elite', value: 2.5, color: 'bg-purple-400' }
  ]
  
  // Calculate current level
  let currentLevel = 'Beginner'
  if (numericRatio >= 2.5) currentLevel = 'Elite'
  else if (numericRatio >= 2.0) currentLevel = 'Advanced'
  else if (numericRatio >= 1.5) currentLevel = 'Intermediate'
  
  // Calculate position percentage (0-100% across the full bar)
  const maxValue = 2.5
  const position = Math.min((numericRatio / maxValue) * 100, 100)
  
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-3">
          <span className="font-medium text-gray-900">{lift}:</span>
          <span className="text-lg font-semibold text-gray-800">{weight}</span>
          <span className="text-sm text-gray-600">({numericRatio}x bodyweight)</span>
        </div>
        <div className={`text-sm font-medium px-3 py-1 rounded-full ${
          currentLevel === 'Elite' ? 'bg-purple-100 text-purple-700' :
          currentLevel === 'Advanced' ? 'bg-green-100 text-green-700' :
          currentLevel === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {currentLevel}
        </div>
      </div>
      
      {/* Progress Bar with Level Markers */}
      <div className="relative">
        {/* Background Bar */}
        <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
          {/* Level Sections */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-gray-300 border-r border-white"></div>
            <div className="flex-1 bg-blue-200 border-r border-white"></div>
            <div className="flex-1 bg-green-200 border-r border-white"></div>
            <div className="flex-1 bg-purple-200"></div>
          </div>
          
          {/* Progress Fill */}
          <div 
            className={`absolute top-0 left-0 h-4 rounded-full transition-all duration-500 ${
              currentLevel === 'Elite' ? 'bg-gradient-to-r from-purple-400 to-purple-500' :
              currentLevel === 'Advanced' ? 'bg-gradient-to-r from-green-400 to-green-500' :
              currentLevel === 'Intermediate' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
              'bg-gradient-to-r from-gray-400 to-gray-500'
            }`}
            style={{ width: `${position}%` }}
          />
          
          {/* Current Position Marker */}
          <div 
            className="absolute top-0 w-0.5 h-4 bg-gray-800"
            style={{ left: `${position}%` }}
          />
        </div>
        
        {/* Level Labels */}
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <div className="flex flex-col items-start">
            <span>1.0</span>
            <span className="font-medium">Beginner</span>
          </div>
          <div className="flex flex-col items-center">
            <span>1.5</span>
            <span className="font-medium">Intermediate</span>
          </div>
          <div className="flex flex-col items-center">
            <span>2.0</span>
            <span className="font-medium">Advanced</span>
          </div>
          <div className="flex flex-col items-end">
            <span>2.5</span>
            <span className="font-medium">Elite</span>
          </div>
        </div>
        
        {/* Current Value Marker */}
        <div 
          className="absolute -top-8 transform -translate-x-1/2"
          style={{ left: `${position}%` }}
        >
          <div className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
            {numericRatio}
          </div>
          <div className="w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-800 mx-auto"></div>
        </div>
      </div>
    </div>
  )
}

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
        <div className="space-y-6">
          {/* Olympic Lift Performance Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">OLYMPIC LIFT PERFORMANCE</h2>
              <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 to-green-500"></div>
              <p className="text-sm text-gray-600 mt-2">Balance assessment vs back squat strength</p>
            </div>
            
            <OlympicProgress 
              lift="Snatch"
              weight={formatWeight(profile.one_rms.snatch)}
              current={profile.one_rms.snatch && profile.one_rms.back_squat ? profile.one_rms.snatch / profile.one_rms.back_squat : 0}
              target={0.60}
            />
            
            <OlympicProgress 
              lift="Clean & Jerk"
              weight={formatWeight(profile.one_rms.clean_and_jerk)}
              current={profile.one_rms.clean_and_jerk && profile.one_rms.back_squat ? profile.one_rms.clean_and_jerk / profile.one_rms.back_squat : 0}
              target={0.75}
            />
          </div>
          
          {/* Foundation Strength Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">FOUNDATION STRENGTH</h2>
              <div className="w-full h-0.5 bg-gradient-to-r from-gray-400 via-blue-400 via-green-400 to-purple-400"></div>
              <p className="text-sm text-gray-600 mt-2">Progression levels relative to bodyweight ({formatWeight(profile.user_summary.body_weight)})</p>
            </div>
            
            <FoundationProgress 
              lift="Back Squat"
              weight={formatWeight(profile.one_rms.back_squat)}
              ratio={profile.one_rms.back_squat && profile.user_summary.body_weight ? parseFloat((profile.one_rms.back_squat / profile.user_summary.body_weight).toFixed(1)) : 0}
            />
            
            <FoundationProgress 
              lift="Deadlift"
              weight={formatWeight(profile.one_rms.deadlift)}
              ratio={profile.one_rms.deadlift && profile.user_summary.body_weight ? parseFloat((profile.one_rms.deadlift / profile.user_summary.body_weight).toFixed(1)) : 0}
            />
            
            <FoundationProgress 
              lift="Bench Press"
              weight={formatWeight(profile.one_rms.bench_press)}
              ratio={profile.one_rms.bench_press && profile.user_summary.body_weight ? parseFloat((profile.one_rms.bench_press / profile.user_summary.body_weight).toFixed(1)) : 0}
            />

            {/* Expandable Details */}
            {showAllLifts && (
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="font-semibold text-gray-800 mb-6">Complete Lift & Ratio Details</h3>
                
                {/* ALL MAX LIFTS Section */}
                <div className="mb-8">
                  <h4 className="font-medium text-gray-700 mb-4 text-lg">ALL MAX LIFTS</h4>
                  
                  {/* Olympic Variations */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Olympic Variations</h5>
                    <div className="space-y-2">
                      {profile.one_rms.jerk_only && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Jerk Only</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.jerk_only)}</span>
                        </div>
                      )}
                      {profile.one_rms.clean_only && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Clean Only</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.clean_only)}</span>
                        </div>
                      )}
                      {profile.one_rms.power_clean && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Power Clean</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.power_clean)}</span>
                        </div>
                      )}
                      {profile.one_rms.power_snatch && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Power Snatch</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.power_snatch)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Squatting */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Squatting</h5>
                    <div className="space-y-2">
                      {profile.one_rms.front_squat && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Front Squat</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.front_squat)}</span>
                        </div>
                      )}
                      {profile.one_rms.overhead_squat && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Overhead Squat</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.overhead_squat)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pressing */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Pressing</h5>
                    <div className="space-y-2">
                      {profile.one_rms.push_press && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Push Press</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.push_press)}</span>
                        </div>
                      )}
                      {profile.one_rms.strict_press && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Strict Press</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.strict_press)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pulling */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Pulling</h5>
                    <div className="space-y-2">
                      {profile.one_rms.weighted_pullup && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Weighted Pullup</span>
                          <span className="font-medium text-gray-900">{formatWeight(profile.one_rms.weighted_pullup)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ALL RATIOS Section */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-4 text-lg">ALL RATIOS</h4>
                  
                  {/* Olympic Lift Efficiency */}
                  <div className="mb-6 bg-gray-50 rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Olympic Lift Efficiency</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Power Snatch / Snatch</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-green-400"></span>
                          <span className="font-medium text-gray-900">{safeRatio(profile.one_rms.power_snatch, profile.one_rms.snatch)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Power Clean / Clean</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-green-400"></span>
                          <span className="font-medium text-gray-900">{safeRatio(profile.one_rms.power_clean, profile.one_rms.clean_only)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Jerk / Clean</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-green-400"></span>
                          <span className="font-medium text-gray-900">{safeRatio(profile.one_rms.jerk_only, profile.one_rms.clean_only)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Snatch / C&J</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                          <span className="font-medium text-gray-900">{safeRatio(profile.one_rms.snatch, profile.one_rms.clean_and_jerk)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Strength Balance */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Strength Balance</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Front Squat / Back Squat</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                          <span className="font-medium text-gray-900">{safeRatio(profile.one_rms.front_squat, profile.one_rms.back_squat)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Overhead Squat / Snatch</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-red-400"></span>
                          <span className="font-medium text-gray-900">{safeRatio(profile.one_rms.overhead_squat, profile.one_rms.snatch)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Push Press / Strict Press</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-red-400"></span>
                          <span className="font-medium text-gray-900">{safeRatio(profile.one_rms.push_press, profile.one_rms.strict_press)}</span>
                        </div>
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
                {(() => {
                  // Calculate actual accessory needs using real logic
                  const needsUpperBack = profile.one_rms.front_squat && profile.one_rms.back_squat ? 
                    (profile.one_rms.front_squat / profile.one_rms.back_squat) < 0.85 : false
                  
                  const needsPosteriorChain = profile.one_rms.deadlift && profile.user_summary.body_weight ?
                    (profile.one_rms.deadlift / profile.user_summary.body_weight) < 2.0 : false
                  
                  const benchBodyweightRatio = profile.one_rms.bench_press && profile.user_summary.body_weight ?
                    profile.one_rms.bench_press / profile.user_summary.body_weight : 0
                  const pushPressStrictRatio = profile.one_rms.push_press && profile.one_rms.strict_press ?
                    profile.one_rms.push_press / profile.one_rms.strict_press : 0
                  const needsUpperBodyPressing = benchBodyweightRatio < 0.9 || pushPressStrictRatio > 1.5
                  
                  const pullupBenchRatio = profile.one_rms.weighted_pullup && profile.one_rms.bench_press ?
                    profile.one_rms.weighted_pullup / profile.one_rms.bench_press : 0
                  const pullupBodyweightRatio = profile.one_rms.weighted_pullup && profile.user_summary.body_weight ?
                    profile.one_rms.weighted_pullup / profile.user_summary.body_weight : 0
                  const needsUpperBodyPulling = pullupBenchRatio < 0.4 || pullupBodyweightRatio < 0.33

                  return (
                    <>
                      {/* Upper Body Pulling */}
                      <div className={`p-3 rounded-lg ${needsUpperBodyPulling ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                        <div className="flex items-start">
                          <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${needsUpperBodyPulling ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">Upper Body Pulling</div>
                            {needsUpperBodyPulling ? (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Why:</span> 
                                {pullupBenchRatio < 0.4 && pullupBodyweightRatio < 0.33 ? (
                                  <>Weighted pullup ({formatWeight(profile.one_rms.weighted_pullup)}) is {Math.round(pullupBenchRatio * 100)}% of bench press and {pullupBodyweightRatio.toFixed(2)}x bodyweight. Target: 40% of bench OR 0.33x bodyweight.</>
                                ) : pullupBenchRatio < 0.4 ? (
                                  <>Weighted pullup ({formatWeight(profile.one_rms.weighted_pullup)}) is only {Math.round(pullupBenchRatio * 100)}% of bench press. Target: 40%.</>
                                ) : (
                                  <>Weighted pullup ({formatWeight(profile.one_rms.weighted_pullup)}) is only {pullupBodyweightRatio.toFixed(2)}x bodyweight. Target: 0.33x.</>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">✓ Strong pulling:</span> Weighted pullup ({formatWeight(profile.one_rms.weighted_pullup)}) is {Math.round(pullupBenchRatio * 100)}% of bench press and {pullupBodyweightRatio.toFixed(2)}x bodyweight (targets: 40%+ and 0.33x+).
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Upper Body Pressing */}
                      <div className={`p-3 rounded-lg ${needsUpperBodyPressing ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                        <div className="flex items-start">
                          <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${needsUpperBodyPressing ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">Upper Body Pressing</div>
                            {needsUpperBodyPressing ? (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Why:</span> 
                                {benchBodyweightRatio < 0.9 && pushPressStrictRatio > 1.5 ? (
                                  <>Bench press is {benchBodyweightRatio.toFixed(1)}x bodyweight (target: 0.9x) and push press is {Math.round(pushPressStrictRatio * 100)}% of strict press (target: &lt;150%).</>
                                ) : benchBodyweightRatio < 0.9 ? (
                                  <>Bench press ({formatWeight(profile.one_rms.bench_press)}) is {benchBodyweightRatio.toFixed(1)}x bodyweight. Target: 0.9x bodyweight.</>
                                ) : (
                                  <>Push press is {Math.round(pushPressStrictRatio * 100)}% of strict press, indicating leg compensation. Target: &lt;150%.</>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">✓ Sufficient strength:</span> Bench press is {benchBodyweightRatio.toFixed(1)}x bodyweight and push press is {Math.round(pushPressStrictRatio * 100)}% of strict press (targets: 0.9x+ and &lt;150%).
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Upper Back */}
                      <div className={`p-3 rounded-lg ${needsUpperBack ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                        <div className="flex items-start">
                          <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${needsUpperBack ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">Upper Back</div>
                            {needsUpperBack ? (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Why:</span> Front squat ({formatWeight(profile.one_rms.front_squat)}) is {Math.round((profile.one_rms.front_squat! / profile.one_rms.back_squat!) * 100)}% of back squat. Target: 85%+.
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">✓ Well developed:</span> Front squat ({formatWeight(profile.one_rms.front_squat)}) is {Math.round((profile.one_rms.front_squat! / profile.one_rms.back_squat!) * 100)}% of back squat (target: 85%+).
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Posterior Chain */}
                      <div className={`p-3 rounded-lg ${needsPosteriorChain ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                        <div className="flex items-start">
                          <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${needsPosteriorChain ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">Posterior Chain</div>
                            {needsPosteriorChain ? (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Why:</span> Deadlift ({formatWeight(profile.one_rms.deadlift)}) is {(profile.one_rms.deadlift! / profile.user_summary.body_weight!).toFixed(1)}x bodyweight. Target: 2.0x bodyweight.
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">✓ Balanced development:</span> Deadlift ({formatWeight(profile.one_rms.deadlift)}) is {(profile.one_rms.deadlift! / profile.user_summary.body_weight!).toFixed(1)}x bodyweight (target: 2.0x+).
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

{/* Technical Focus */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-4">Technical Focus</h3>
              <div className="space-y-4">
                {(() => {
                  // Calculate snatch deficits using actual logic
                  const snatchStrengthDeficit = profile.one_rms.snatch && profile.one_rms.back_squat ? 
                    (profile.one_rms.snatch / profile.one_rms.back_squat) < 0.62 : true
                  
                  const snatchReceivingDeficit = profile.one_rms.power_snatch && profile.one_rms.snatch ?
                    (profile.one_rms.power_snatch / profile.one_rms.snatch) > 0.88 : true
                  
                  const snatchOverheadDeficit = profile.one_rms.overhead_squat && profile.one_rms.back_squat ?
                    (profile.one_rms.overhead_squat / profile.one_rms.back_squat) < 0.65 : true

                  // Calculate C&J deficits using actual logic
                  const cjStrengthDeficit = profile.one_rms.clean_and_jerk && profile.one_rms.back_squat ?
                    (profile.one_rms.clean_and_jerk / profile.one_rms.back_squat) < 0.74 : true
                    
                  const cjReceivingDeficit = profile.one_rms.power_clean && profile.one_rms.clean_only ?
                    (profile.one_rms.power_clean / profile.one_rms.clean_only) > 0.88 : true
                    
                  const cjJerkDeficit = profile.one_rms.jerk_only && profile.one_rms.clean_only ?
                    (profile.one_rms.jerk_only / profile.one_rms.clean_only) < 0.9 : true

                  return (
                    <>
                      {/* Snatch Technical Work */}
                      <div className="border rounded-lg p-4">
                        <div className="font-medium text-gray-900 mb-3">
                          Snatch Technical Work: {profile.technical_focus.snatch_technical_count} exercises/day
                        </div>
                        <div className="space-y-2">
                          {/* Strength Deficit */}
                          <div className={`flex items-center text-sm ${snatchStrengthDeficit ? 'text-red-600' : 'text-green-600'}`}>
                            <span className="mr-2">{snatchStrengthDeficit ? '❌' : '✅'}</span>
                            <span>
                              {snatchStrengthDeficit ? 'Strength Deficit: ' : 'Strength: '}
                              Snatch ({formatWeight(profile.one_rms.snatch)}) is {safeRatio(profile.one_rms.snatch, profile.one_rms.back_squat)} of back squat (target: 62%+)
                            </span>
                          </div>
                          
                          {/* Receiving Position */}
                          <div className={`flex items-center text-sm ${snatchReceivingDeficit ? 'text-red-600' : 'text-green-600'}`}>
                            <span className="mr-2">{snatchReceivingDeficit ? '❌' : '✅'}</span>
                            <span>
                              {snatchReceivingDeficit ? 'Receiving Position: ' : 'Receiving Position: '}
                              Power snatch is {safeRatio(profile.one_rms.power_snatch, profile.one_rms.snatch)} of snatch (target: &lt;88%)
                            </span>
                          </div>
                          
                          {/* Overhead Stability */}
                          <div className={`flex items-center text-sm ${snatchOverheadDeficit ? 'text-red-600' : 'text-green-600'}`}>
                            <span className="mr-2">{snatchOverheadDeficit ? '❌' : '✅'}</span>
                            <span>
                              {snatchOverheadDeficit ? 'Overhead Stability: ' : 'Overhead Stability: '}
                              Overhead squat is {safeRatio(profile.one_rms.overhead_squat, profile.one_rms.back_squat)} of back squat (target: 65%+)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Clean & Jerk Technical Work */}
                      <div className="border rounded-lg p-4">
                        <div className="font-medium text-gray-900 mb-3">
                          Clean & Jerk Technical Work: {profile.technical_focus.clean_jerk_technical_count} exercises/day
                        </div>
                        <div className="space-y-2">
                          {/* Overall Strength */}
                          <div className={`flex items-center text-sm ${cjStrengthDeficit ? 'text-red-600' : 'text-green-600'}`}>
                            <span className="mr-2">{cjStrengthDeficit ? '❌' : '✅'}</span>
                            <span>
                              {cjStrengthDeficit ? 'Overall Strength: ' : 'Overall Strength: '}
                              C&J ({formatWeight(profile.one_rms.clean_and_jerk)}) is {safeRatio(profile.one_rms.clean_and_jerk, profile.one_rms.back_squat)} of back squat (target: 74%+)
                            </span>
                          </div>
                          
                          {/* Receiving Position */}
                          <div className={`flex items-center text-sm ${cjReceivingDeficit ? 'text-red-600' : 'text-green-600'}`}>
                            <span className="mr-2">{cjReceivingDeficit ? '❌' : '✅'}</span>
                            <span>
                              {cjReceivingDeficit ? 'Receiving Position: ' : 'Receiving Position: '}
                              Power clean is {safeRatio(profile.one_rms.power_clean, profile.one_rms.clean_only)} of clean (target: &lt;88%)
                            </span>
                          </div>
                          
                          {/* Jerk Performance */}
                          <div className={`flex items-center text-sm ${cjJerkDeficit ? 'text-red-600' : 'text-green-600'}`}>
                            <span className="mr-2">{cjJerkDeficit ? '❌' : '✅'}</span>
                            <span>
                              {cjJerkDeficit ? 'Jerk Weakness: ' : 'Jerk Performance: '}
                              Jerk is {safeRatio(profile.one_rms.jerk_only, profile.one_rms.clean_only)} of clean (target: 90%+)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Other Training Days Note */}
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-900">
                          <span className="font-semibold">Other training days:</span> Back squat, front squat, and press days use rotating exercise selections based on movement patterns and your equipment availability.
                        </p>
                      </div>
                    </>
                  )
                })()}
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

          {/* Skills Grouped by Proficiency */}
          <div className="space-y-3">
            {(() => {
              // Get all skills from all categories
              const allSkills = skillCategories.flatMap(category => 
                category.skills.map(skill => ({
                  name: skill,
                  category: category.name,
                  level: getSkillLevel(skill),
                  icon: getSkillIcon(getSkillLevel(skill)),
                  color: getSkillColor(getSkillLevel(skill))
                }))
              )

              // Group skills by proficiency level
              const skillsByLevel = {
                'Advanced': allSkills.filter(skill => skill.level === 'Advanced'),
                'Intermediate': allSkills.filter(skill => skill.level === 'Intermediate'),
                'Beginner': allSkills.filter(skill => skill.level === 'Beginner'),
                'Skills to Develop': allSkills.filter(skill => skill.level === "Don't Have")
              }

              return Object.entries(skillsByLevel).map(([levelName, skills]) => {
                if (skills.length === 0) return null
                
                const isExpanded = expandedCategories.includes(levelName)
                const displayName = levelName === "Don't Have" ? "Skills to Develop" : levelName
                
                return (
                  <div key={levelName} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(levelName)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <span className="mr-2 text-gray-600">{isExpanded ? '▼' : '▶'}</span>
                        <h3 className="font-semibold text-gray-800">{displayName.toUpperCase()}</h3>
                      </div>
                      <span className="text-sm text-gray-600">({skills.length})</span>
                    </button>
                    
                    {isExpanded && (
                      <div className="p-4 space-y-2">
                        {skills.map(skill => (
                          <div key={skill.name} className="flex justify-between items-center py-1">
                            <div className="flex items-center">
                              <span className={`mr-3 text-lg ${skill.color}`}>{skill.icon}</span>
                              <div>
                                <span className="text-gray-700">{skill.name}</span>
                                <span className="text-gray-500 text-sm ml-2">({skill.category})</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }).filter(Boolean)
            })()}
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
