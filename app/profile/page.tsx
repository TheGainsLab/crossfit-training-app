


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
  recommendations: Array<{
    priority: string
    category: string
    message: string
  }>
  generated_at: string
}

// Helper function to group lifts by category
const liftCategories = {
  olympic: {
    name: 'OLYMPIC LIFTS',
    lifts: ['snatch', 'clean_and_jerk']
  },
  olympic_variations: {
    name: 'OLYMPIC VARIATIONS',
    lifts: ['power_snatch', 'power_clean', 'clean_only', 'jerk_only']
  },
  strength: {
    name: 'STRENGTH LIFTS',
    lifts: ['back_squat', 'front_squat', 'overhead_squat', 'bench_press']
  },
  pulling: {
    name: 'PULLING',
    lifts: ['deadlift', 'weighted_pullup']
  },
  pressing: {
    name: 'PRESSING',
    lifts: ['push_press', 'strict_press']
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

// Define which lifts to show in collapsed view
const collapsedLifts = ['snatch', 'clean_and_jerk', 'back_squat', 'front_squat', 'bench_press']

// Define key performance ratios
const keyRatios = [
  'snatch_to_back_squat',
  'clean_jerk_to_back_squat',
  'back_squat_to_bodyweight',
  'deadlift_to_bodyweight',
  'bench_press_to_bodyweight'
]

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [showAllLifts, setShowAllLifts] = useState(false)
  const [showAllRatios, setShowAllRatios] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [userSkills, setUserSkills] = useState<{[key: string]: string}>({})

  // Load user skills directly from database
  useEffect(() => {
    const loadUserSkills = async () => {
      if (!user) return
      
      try {
        // Get user ID from users table
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (userData) {
          // Fetch skills directly
          const { data: skillsData } = await supabase
            .from('user_skills')
            .select('skill_name, skill_level')
            .eq('user_id', userData.id)

          if (skillsData) {
            const skillsMap: {[key: string]: string} = {}
            skillsData.forEach(skill => {
              // Extract the level category from the full description
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
    // First try to get from directly loaded skills
    if (userSkills[skillName]) {
      return userSkills[skillName]
    }
    // Fallback to profile data if available
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

  const formatLiftName = (liftKey: string) => {
    return liftKey.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const extractRatioValue = (ratioString: string) => {
    // Extract percentage or multiplier from ratio string
    const percentMatch = ratioString.match(/(\d+\.?\d*)%/)
    if (percentMatch) return percentMatch[1] + '%'
    
    const multiplierMatch = ratioString.match(/(\d+\.?\d*)x/)
    if (multiplierMatch) return multiplierMatch[1] + 'x'
    
    // For missing data
    if (ratioString.includes('Missing')) return 'N/A'
    
    return ratioString
  }

  const formatRatioName = (ratioKey: string) => {
    // Special formatting for certain ratios
    const nameMap: { [key: string]: string } = {
      'snatch_to_back_squat': 'Snatch to Back Squat',
      'clean_jerk_to_back_squat': 'C&J to Back Squat',
      'back_squat_to_bodyweight': 'Back Squat to Body Weight',
      'deadlift_to_bodyweight': 'Deadlift to Body Weight',
      'bench_press_to_bodyweight': 'Bench Press to Body Weight',
      'jerk_to_clean': 'Jerk to Clean',
      'power_clean_to_clean': 'Power Clean to Clean',
      'power_snatch_to_snatch': 'Power Snatch to Snatch',
      'snatch_to_clean_jerk': 'Snatch to C&J',
      'front_squat_to_back_squat': 'Front Squat to Back Squat'
    }
    
    return nameMap[ratioKey] || ratioKey.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
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

        {/* Enhanced Max Lifts Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">MAX LIFTS</h2>
          <div className="border-t-2 border-gray-900 mb-6"></div>
          
          {/* Always show Olympic and main Strength lifts */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">OLYMPIC LIFTS</h3>
              <div className="space-y-2">
                {liftCategories.olympic.lifts.map(liftKey => (
                  profile.one_rms[liftKey as keyof typeof profile.one_rms] !== null && (
                    <div key={liftKey} className="flex justify-between items-center">
                      <span className="text-gray-700">{formatLiftName(liftKey)}</span>
                      <span className="font-semibold">{formatWeight(profile.one_rms[liftKey as keyof typeof profile.one_rms])}</span>
                    </div>
                  )
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">STRENGTH LIFTS</h3>
              <div className="space-y-2">
                {['back_squat', 'front_squat', 'bench_press'].map(liftKey => (
                  profile.one_rms[liftKey as keyof typeof profile.one_rms] !== null && (
                    <div key={liftKey} className="flex justify-between items-center">
                      <span className="text-gray-700">{formatLiftName(liftKey)}</span>
                      <span className="font-semibold">{formatWeight(profile.one_rms[liftKey as keyof typeof profile.one_rms])}</span>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Expanded view - show all lifts */}
            {showAllLifts && (
              <>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">OLYMPIC VARIATIONS</h3>
                  <div className="space-y-2">
                    {liftCategories.olympic_variations.lifts.map(liftKey => (
                      profile.one_rms[liftKey as keyof typeof profile.one_rms] !== null && (
                        <div key={liftKey} className="flex justify-between items-center">
                          <span className="text-gray-700">{formatLiftName(liftKey)}</span>
                          <span className="font-semibold">{formatWeight(profile.one_rms[liftKey as keyof typeof profile.one_rms])}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>

                {/* Overhead Squat in Strength section when expanded */}
                {profile.one_rms.overhead_squat !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Overhead Squat</span>
                    <span className="font-semibold">{formatWeight(profile.one_rms.overhead_squat)}</span>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">PULLING</h3>
                  <div className="space-y-2">
                    {liftCategories.pulling.lifts.map(liftKey => (
                      profile.one_rms[liftKey as keyof typeof profile.one_rms] !== null && (
                        <div key={liftKey} className="flex justify-between items-center">
                          <span className="text-gray-700">{formatLiftName(liftKey)}</span>
                          <span className="font-semibold">{formatWeight(profile.one_rms[liftKey as keyof typeof profile.one_rms])}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">PRESSING</h3>
                  <div className="space-y-2">
                    {liftCategories.pressing.lifts.map(liftKey => (
                      profile.one_rms[liftKey as keyof typeof profile.one_rms] !== null && (
                        <div key={liftKey} className="flex justify-between items-center">
                          <span className="text-gray-700">{formatLiftName(liftKey)}</span>
                          <span className="font-semibold">{formatWeight(profile.one_rms[liftKey as keyof typeof profile.one_rms])}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowAllLifts(!showAllLifts)}
            className="mt-6 text-blue-600 hover:text-blue-800 font-medium"
          >
            [{showAllLifts ? '- Show fewer lifts' : '+ Show all 14 lifts'}]
          </button>
        </div>

        {/* Enhanced Strength Ratios */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">STRENGTH RATIO ANALYSIS</h2>
          <div className="border-t-2 border-gray-900 mb-6"></div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">KEY PERFORMANCE INDICATORS</h3>
              <div className="space-y-2">
                {/* Snatch / Back Squat */}
                {profile.one_rms.snatch && profile.one_rms.back_squat && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Snatch / Back Squat</span>
                    <span className="font-semibold">
                      {Math.round((profile.one_rms.snatch / profile.one_rms.back_squat) * 100)}%
                    </span>
                  </div>
                )}
                
                {/* C&J / Back Squat */}
                {profile.one_rms.clean_and_jerk && profile.one_rms.back_squat && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">C&J / Back Squat</span>
                    <span className="font-semibold">
                      {Math.round((profile.one_rms.clean_and_jerk / profile.one_rms.back_squat) * 100)}%
                    </span>
                  </div>
                )}
                
                {/* Back Squat / Body Weight */}
                {profile.one_rms.back_squat && profile.user_summary.body_weight && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Back Squat / Body Weight</span>
                    <span className="font-semibold">
                      {(profile.one_rms.back_squat / profile.user_summary.body_weight).toFixed(1)}x
                    </span>
                  </div>
                )}
                
                {/* Deadlift / Body Weight */}
                {profile.one_rms.deadlift && profile.user_summary.body_weight && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Deadlift / Body Weight</span>
                    <span className="font-semibold">
                      {(profile.one_rms.deadlift / profile.user_summary.body_weight).toFixed(1)}x
                    </span>
                  </div>
                )}
                
                {/* Bench Press / Body Weight */}
                {profile.one_rms.bench_press && profile.user_summary.body_weight && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Bench Press / Body Weight</span>
                    <span className="font-semibold">
                      {(profile.one_rms.bench_press / profile.user_summary.body_weight).toFixed(1)}x
                    </span>
                  </div>
                )}
              </div>
            </div>

            {showAllRatios && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 mt-6">ALL RATIOS</h3>
                <div className="space-y-2">
                  {/* Jerk / Clean */}
                  {profile.one_rms.jerk_only && profile.one_rms.clean_only && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Jerk / Clean</span>
                      <span className="font-semibold">
                        {Math.round((profile.one_rms.jerk_only / profile.one_rms.clean_only) * 100)}%
                      </span>
                    </div>
                  )}
                  
                  {/* Power Clean / Clean */}
                  {profile.one_rms.power_clean && profile.one_rms.clean_only && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Power Clean / Clean</span>
                      <span className="font-semibold">
                        {Math.round((profile.one_rms.power_clean / profile.one_rms.clean_only) * 100)}%
                      </span>
                    </div>
                  )}
                  
                  {/* Power Snatch / Snatch */}
                  {profile.one_rms.power_snatch && profile.one_rms.snatch && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Power Snatch / Snatch</span>
                      <span className="font-semibold">
                        {Math.round((profile.one_rms.power_snatch / profile.one_rms.snatch) * 100)}%
                      </span>
                    </div>
                  )}
                  
                  {/* Snatch / C&J */}
                  {profile.one_rms.snatch && profile.one_rms.clean_and_jerk && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Snatch / C&J</span>
                      <span className="font-semibold">
                        {Math.round((profile.one_rms.snatch / profile.one_rms.clean_and_jerk) * 100)}%
                      </span>
                    </div>
                  )}
                  
                  {/* Front Squat / Back Squat */}
                  {profile.one_rms.front_squat && profile.one_rms.back_squat && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Front Squat / Back Squat</span>
                      <span className="font-semibold">
                        {Math.round((profile.one_rms.front_squat / profile.one_rms.back_squat) * 100)}%
                      </span>
                    </div>
                  )}
                  
                  {/* Overhead Squat / Snatch */}
                  {profile.one_rms.overhead_squat && profile.one_rms.snatch && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Overhead Squat / Snatch</span>
                      <span className="font-semibold">
                        {Math.round((profile.one_rms.overhead_squat / profile.one_rms.snatch) * 100)}%
                      </span>
                    </div>
                  )}
                  
                  {/* Push Press / Strict Press */}
                  {profile.one_rms.push_press && profile.one_rms.strict_press && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Push Press / Strict Press</span>
                      <span className="font-semibold">
                        {Math.round((profile.one_rms.push_press / profile.one_rms.strict_press) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAllRatios(!showAllRatios)}
            className="mt-6 text-blue-600 hover:text-blue-800 font-medium"
          >
            [{showAllRatios ? '- Show fewer ratios' : '+ View all ratios'}]
          </button>
        </div>

{/* Enhanced Programming Focus Areas */}
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
                  <span className="font-medium">Why:</span> Your Snatch ({Math.round((profile.one_rms.snatch / profile.one_rms.back_squat) * 100)}%) 
                  or C&J ({Math.round((profile.one_rms.clean_and_jerk / profile.one_rms.back_squat) * 100)}%) 
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
                  ({(profile.one_rms.bench_press / profile.user_summary.body_weight).toFixed(1)}x) is below optimal. 
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
                  <span className="font-medium">Why:</span> Your Front Squat ({Math.round((profile.one_rms.front_squat / profile.one_rms.back_squat) * 100)}%) 
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
                  ({(profile.one_rms.deadlift / profile.user_summary.body_weight).toFixed(1)}x) needs improvement. 
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


