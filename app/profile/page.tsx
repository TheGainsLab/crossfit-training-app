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
  thresholds: {
    beginner: number
    intermediate: number
    advanced: number
    elite: number
  }
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
<span className="font-semibold text-charcoal">{lift}:</span>
<span className="font-semibold text-charcoal">{weight}</span>
</div>
  
{/* Status badge removed - let progress bar tell the story */}     
 </div>
      
      <div className="relative">
        {/* Progress Bar Background */}

<div className="w-full bg-slate-blue rounded-full h-3">
<div
  className="h-3 rounded-full transition-all duration-300 bg-slate-blue"
  style={{ width: `${percentage}%` }}
/>
</div>

{/* Current Value Marker - matching Raw Strength style */}
<div 
  className="absolute -top-8 transform -translate-x-1/2"
  style={{ left: `${percentage}%` }}
>
<div className="bg-coral text-white px-2 py-1 rounded text-xs font-medium">
  {Math.round(current * 100)}%
</div>
<div className="w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-coral mx-auto"></div>

</div>
        
        {/* Target Line */}
        <div className="absolute top-0 right-0 transform translate-x-2">
          <div className="w-0.5 h-3 bg-charcoal"></div>
          <div className="text-xs text-charcoal mt-1 -translate-x-1/2">
            Target: {Math.round(target * 100)}{unit}
          </div>
        </div>
      </div>
    </div>
  )
}

// Foundation Strength Progress Bar Component
const FoundationProgress = ({ lift, weight, ratio, thresholds }: FoundationProgressProps) => {
  // Convert ratio to number if it's a string
  const numericRatio = typeof ratio === 'string' ? parseFloat(ratio) : ratio
  
  const levels = [
    { name: 'Beginner', value: thresholds.beginner, color: 'bg-gray-300' },
    { name: 'Intermediate', value: thresholds.intermediate, color: 'bg-slate-blue' },
    { name: 'Advanced', value: thresholds.advanced, color: 'bg-coral' },
    { name: 'Elite', value: thresholds.elite, color: 'bg-charcoal' }
  ]
  
  // Calculate current level
  let currentLevel = 'Beginner'
  if (numericRatio >= 2.5) currentLevel = 'Elite'
  else if (numericRatio >= 2.0) currentLevel = 'Advanced'
  else if (numericRatio >= 1.5) currentLevel = 'Intermediate'
  
  // Calculate position percentage (0-100% across the full bar)
  const maxValue = thresholds.elite
  const position = Math.min((numericRatio / maxValue) * 100, 100)
  
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-3">          
<span className="font-semibold text-charcoal">{lift}:</span>
<span className="font-semibold text-charcoal">{weight}</span>
{/* Bodyweight ratio removed - shown visually in progress bar */}
        </div>
{/* Level badge removed - let progress bar tell the story */}     
 </div>
      
      {/* Progress Bar with Level Markers */}
      <div className="relative">
        {/* Background Bar */}
        <div className="w-full bg-slate-blue rounded-full h-4 relative overflow-hidden">
          {/* Level Sections */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-gray-300 border-r border-white"></div>
            <div className="flex-1 bg-slate-blue/50 border-r border-white"></div>
            <div className="flex-1 bg-coral/20 border-r border-white"></div>
            <div className="flex-1 bg-charcoal/20"></div>
          </div>
          
{/* Progress Fill */}
<div 
  className="absolute top-0 left-0 h-4 rounded-full transition-all duration-500 bg-slate-blue"
  style={{ width: `${position}%` }}
/>
          
          {/* Current Position Marker */}
          <div 
            className="absolute top-0 w-0.5 h-4 bg-charcoal"
            style={{ left: `${position}%` }}
          />
        </div>
        
        {/* Level Labels (gender-specific thresholds) */}
        <div className="flex justify-between mt-2 text-xs text-charcoal">
          <div className="flex flex-col items-start">
            <span>{levels[0].value}</span>
            <span className="font-medium">Beginner</span>
          </div>
          <div className="flex flex-col items-center">
            <span>{levels[1].value}</span>
            <span className="font-medium">Intermediate</span>
          </div>
          <div className="flex flex-col items-center">
            <span>{levels[2].value}</span>
            <span className="font-medium">Advanced</span>
          </div>
          <div className="flex flex-col items-end">
            <span>{levels[3].value}</span>
            <span className="font-medium">Elite</span>
          </div>
        </div>
        
        {/* Current Value Marker */}
        <div 
          className="absolute -top-8 transform -translate-x-1/2"
          style={{ left: `${position}%` }}
        >
<div className="bg-coral text-white px-2 py-1 rounded text-xs font-medium">
  {numericRatio}
</div>
<div className="w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-coral mx-auto"></div>
       
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
      case 'Advanced': return 'text-coral'
      case 'Intermediate': return 'text-slate-blue'
      case 'Beginner': return 'text-orange-600'
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
      <div className="min-h-screen bg-ice-blue flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral mx-auto"></div>
          <p className="mt-4 text-charcoal">Loading your profile...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-ice-blue py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error}</p>
            <a 
              href="/intake" 
              className="inline-block mt-4 bg-coral text-white px-6 py-2 rounded-md hover:bg-coral"
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
      <div className="min-h-screen bg-ice-blue py-8">
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
    <div className="min-h-screen bg-ice-blue py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Consolidated Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-charcoal mb-2">
            Athlete Profile & Analysis
          </h1>
<div className="text-lg text-charcoal font-semibold">
  {profile.user_summary.name}
</div>         
          <div className="text-sm text-gray-600 mt-1">
            Generated: {new Date(profile.generated_at).toLocaleDateString()}
          </div>
        </div>

        {/* New Strength Section */}
        <div className="space-y-6">
          {/* Olympic Lift Performance Card */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-blue p-6">
            <div className="mb-6">
             
<h2 className="text-xl font-bold text-charcoal mb-2">OLYMPIC LIFTS</h2>
              
<div className="w-full h-0.5 bg-coral"></div>
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
          <div className="bg-white rounded-xl shadow-lg border border-slate-blue p-6">
            <div className="mb-6">              
<h2 className="text-xl font-bold text-charcoal mb-2">RAW STRENGTH</h2>
<div className="w-full h-0.5 bg-coral"></div>
              <p className="text-sm text-gray-600 mt-2">Progression levels relative to bodyweight ({formatWeight(profile.user_summary.body_weight)})</p>
            </div>
            
            <FoundationProgress 
              lift="Back Squat"
              weight={formatWeight(profile.one_rms.back_squat)}
              ratio={profile.one_rms.back_squat && profile.user_summary.body_weight ? parseFloat((profile.one_rms.back_squat / profile.user_summary.body_weight).toFixed(1)) : 0}
              thresholds={profile.user_summary.gender === 'Female' ? {
                beginner: 0.9,
                intermediate: 1.2,
                advanced: 1.5,
                elite: 1.9
              } : {
                beginner: 1.0,
                intermediate: 1.4,
                advanced: 1.8,
                elite: 2.4
              }}
            />
            
            <FoundationProgress 
              lift="Deadlift"
              weight={formatWeight(profile.one_rms.deadlift)}
              ratio={profile.one_rms.deadlift && profile.user_summary.body_weight ? parseFloat((profile.one_rms.deadlift / profile.user_summary.body_weight).toFixed(1)) : 0}
              thresholds={profile.user_summary.gender === 'Female' ? {
                beginner: 1.1,
                intermediate: 1.3,
                advanced: 1.7,
                elite: 2.1
              } : {
                beginner: 1.3,
                intermediate: 1.6,
                advanced: 2.2,
                elite: 2.7
              }}
            />
            
            <FoundationProgress 
              lift="Bench Press"
              weight={formatWeight(profile.one_rms.bench_press)}
              ratio={profile.one_rms.bench_press && profile.user_summary.body_weight ? parseFloat((profile.one_rms.bench_press / profile.user_summary.body_weight).toFixed(1)) : 0}
              thresholds={profile.user_summary.gender === 'Female' ? {
                beginner: 0.6,
                intermediate: 0.8,
                advanced: 1.0,
                elite: 1.3
              } : {
                beginner: 0.8,
                intermediate: 1.1,
                advanced: 1.4,
                elite: 1.7
              }}
            />

            {/* Expandable Details */}
            {showAllLifts && (
              <div className="border-t border-slate-blue pt-6 mt-6">
                <h3 className="font-semibold text-charcoal mb-6">Complete Lift & Ratio Details</h3>
                
                {/* ALL MAX LIFTS Section */}
                <div className="mb-8">
                  <h4 className="font-medium text-charcoal mb-4 text-lg">ALL MAX LIFTS</h4>
                  
                  {/* Olympic Variations */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Olympic Variations</h5>
                    <div className="space-y-2">
                      {profile.one_rms.jerk_only && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Jerk Only</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.jerk_only)}</span>
                        </div>
                      )}
                      {profile.one_rms.clean_only && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Clean Only</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.clean_only)}</span>
                        </div>
                      )}
                      {profile.one_rms.power_clean && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Power Clean</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.power_clean)}</span>
                        </div>
                      )}
                      {profile.one_rms.power_snatch && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Power Snatch</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.power_snatch)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Squatting */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Squatting</h5>
                    <div className="space-y-2">
                      {profile.one_rms.front_squat && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Front Squat</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.front_squat)}</span>
                        </div>
                      )}
                      {profile.one_rms.overhead_squat && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Overhead Squat</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.overhead_squat)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pressing */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Pressing</h5>
                    <div className="space-y-2">
                      {profile.one_rms.push_press && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Push Press</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.push_press)}</span>
                        </div>
                      )}
                      {profile.one_rms.strict_press && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Strict Press</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.strict_press)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pulling */}
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Pulling</h5>
                    <div className="space-y-2">
                      {profile.one_rms.weighted_pullup && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-700">Weighted Pullup</span>
                          <span className="font-medium text-charcoal">{formatWeight(profile.one_rms.weighted_pullup)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ALL RATIOS Section */}
                <div>
                  <h4 className="font-medium text-charcoal mb-4 text-lg">ALL RATIOS</h4>
                  
                  {/* Olympic Lift Efficiency */}
                  <div className="mb-6 bg-ice-blue rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Olympic Lift Efficiency</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Power Snatch / Snatch</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-coral"></span>
                          <span className="font-medium text-charcoal">{safeRatio(profile.one_rms.power_snatch, profile.one_rms.snatch)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Power Clean / Clean</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-coral"></span>
                          <span className="font-medium text-charcoal">{safeRatio(profile.one_rms.power_clean, profile.one_rms.clean_only)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Jerk / Clean</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-coral"></span>
                          <span className="font-medium text-charcoal">{safeRatio(profile.one_rms.jerk_only, profile.one_rms.clean_only)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Snatch / C&J</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                          <span className="font-medium text-charcoal">{safeRatio(profile.one_rms.snatch, profile.one_rms.clean_and_jerk)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Strength Balance */}
                  <div className="bg-ice-blue rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Strength Balance</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Front Squat / Back Squat</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                          <span className="font-medium text-charcoal">{safeRatio(profile.one_rms.front_squat, profile.one_rms.back_squat)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Overhead Squat / Snatch</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-red-400"></span>
                          <span className="font-medium text-charcoal">{safeRatio(profile.one_rms.overhead_squat, profile.one_rms.snatch)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Push Press / Strict Press</span>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-red-400"></span>
                          <span className="font-medium text-charcoal">{safeRatio(profile.one_rms.push_press, profile.one_rms.strict_press)}</span>
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
              className="mt-6 text-coral hover:text-coral font-medium"
            >
              [{showAllLifts ? '- Hide Complete Details' : '+ View Complete Lift & Ratio Details'}]
            </button>
          </div>
        </div>

        {/* Enhanced Conditioning Benchmarks */}
        <div className="bg-white rounded-lg shadow border border-slate-blue p-6">
          <h2 className="text-xl font-bold text-charcoal mb-4">CONDITIONING BENCHMARKS</h2>
          <div className="border-t-2 border-charcoal mb-6"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Running Column */}
            <div>
              <h3 className="font-semibold text-charcoal mb-3">RUNNING</h3>
              <div className="space-y-2">
                {profile.benchmarks.mile_run && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Mile</span>
                    <span className="font-semibold text-charcoal">{profile.benchmarks.mile_run}</span>
                  </div>
                )}
                {profile.benchmarks.five_k_run && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">5K</span>
                    <span className="font-semibold text-charcoal">{profile.benchmarks.five_k_run}</span>
                  </div>
                )}
                {profile.benchmarks.ten_k_run && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">10K</span>
                    <span className="font-semibold text-charcoal">{profile.benchmarks.ten_k_run}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rowing Column */}
            <div>
              <h3 className="font-semibold text-charcoal mb-3">ROWING</h3>
              <div className="space-y-2">
                {profile.benchmarks.one_k_row && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">1K</span>
                    <span className="font-semibold text-charcoal">{profile.benchmarks.one_k_row}</span>
                  </div>
                )}
                {profile.benchmarks.two_k_row && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">2K</span>
                    <span className="font-semibold text-charcoal">{profile.benchmarks.two_k_row}</span>
                  </div>
                )}
                {profile.benchmarks.five_k_row && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">5K</span>
                    <span className="font-semibold text-charcoal">{profile.benchmarks.five_k_row}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bike Column */}
            <div>
              <h3 className="font-semibold text-charcoal mb-3">BIKE</h3>
              <div className="space-y-2">
                {profile.benchmarks.air_bike_10_min && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">10min</span>
                    <span className="font-semibold text-charcoal">{profile.benchmarks.air_bike_10_min}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Programming Focus Areas */}
        <div className="bg-white rounded-lg shadow border border-slate-blue p-6">
          <h2 className="text-xl font-bold text-charcoal mb-6">Programming Focus Areas</h2>
          
          {/* Accessory Needs Section */}
          <div className="mb-8">
            <h3 className="font-semibold text-charcoal mb-4">Accessory Needs</h3>
            
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
                  {/* Summary View */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsUpperBodyPulling ? 'bg-red-500' : 'bg-coral'}`}></span>
                        <span className="text-gray-700">Upper Body Pulling</span>
                      </div>
                      <span className={`text-sm font-medium ${needsUpperBodyPulling ? 'text-red-600' : 'text-coral'}`}>
                        {needsUpperBodyPulling ? 'Target' : 'Maintain'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsUpperBodyPressing ? 'bg-red-500' : 'bg-coral'}`}></span>
                        <span className="text-gray-700">Upper Body Pressing</span>
                      </div>
                      <span className={`text-sm font-medium ${needsUpperBodyPressing ? 'text-red-600' : 'text-coral'}`}>
                        {needsUpperBodyPressing ? 'Target' : 'Maintain'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsUpperBack ? 'bg-red-500' : 'bg-coral'}`}></span>
                        <span className="text-gray-700">Upper Back</span>
                      </div>
                      <span className={`text-sm font-medium ${needsUpperBack ? 'text-red-600' : 'text-coral'}`}>
                        {needsUpperBack ? 'Target' : 'Maintain'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsPosteriorChain ? 'bg-red-500' : 'bg-coral'}`}></span>
                        <span className="text-gray-700">Posterior Chain</span>
                      </div>
                      <span className={`text-sm font-medium ${needsPosteriorChain ? 'text-red-600' : 'text-coral'}`}>
                        {needsPosteriorChain ? 'Target' : 'Maintain'}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <button
                    onClick={() => setExpandedCategories(prev => 
                      prev.includes('accessory-details') 
                        ? prev.filter(name => name !== 'accessory-details')
                        : [...prev, 'accessory-details']
                    )}
                    className="text-coral hover:text-coral text-sm font-medium"
                  >
                    [{expandedCategories.includes('accessory-details') ? '- Hide Details' : '+ View Details'}]
                  </button>

                  {/* Detailed View */}
                  {expandedCategories.includes('accessory-details') && (
                    <div className="mt-4 space-y-3">
                      {/* Upper Body Pulling */}
                      <div className={`p-3 rounded-lg ${needsUpperBodyPulling ? 'bg-red-50 border border-red-200' : 'bg-coral/5 border border-coral/20'}`}>
                        <div className="flex items-start">
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsUpperBodyPulling ? 'bg-red-500' : 'bg-coral'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Upper Body Pulling - {needsUpperBodyPulling ? 'Target' : 'Maintain'}</div>
                            {needsUpperBodyPulling ? (
                              <div className="text-sm text-gray-600">
                                <div className="mb-1">
                                  <span className="font-medium">Why:</span> Weighted pullup ({formatWeight(profile.one_rms.weighted_pullup)}) is {Math.round(pullupBenchRatio * 100)}% of bench press and {pullupBodyweightRatio.toFixed(2)}x bodyweight.
                                </div>
                                <div>Target: 40% of bench OR 0.33x bodyweight.</div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">
                                <div>Weighted pullup is {Math.round(pullupBenchRatio * 100)}% of bench press (target: 40%+)</div>
                                <div>Weighted pullup is {pullupBodyweightRatio.toFixed(2)}x bodyweight (target: 0.33x+)</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Upper Body Pressing */}
                      <div className={`p-3 rounded-lg ${needsUpperBodyPressing ? 'bg-red-50 border border-red-200' : 'bg-coral/5 border border-coral/20'}`}>
                        <div className="flex items-start">
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsUpperBodyPressing ? 'bg-red-500' : 'bg-coral'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Upper Body Pressing - {needsUpperBodyPressing ? 'Target' : 'Maintain'}</div>
                            {needsUpperBodyPressing ? (
                              <div className="text-sm text-gray-600">
                                <div className="mb-1">
                                  <span className="font-medium">Why:</span> {benchBodyweightRatio < 0.9 && pushPressStrictRatio > 1.5 ? (
                                    <>Bench press is {benchBodyweightRatio.toFixed(1)}x bodyweight (target: 0.9x) and push press is {Math.round(pushPressStrictRatio * 100)}% of strict press (target: &lt;150%).</>
                                  ) : benchBodyweightRatio < 0.9 ? (
                                    <>Bench press ({formatWeight(profile.one_rms.bench_press)}) is {benchBodyweightRatio.toFixed(1)}x bodyweight. Target: 0.9x bodyweight.</>
                                  ) : (
                                    <>Push press is {Math.round(pushPressStrictRatio * 100)}% of strict press, indicating leg compensation. Target: &lt;150%.</>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">
                                <div>Bench press is {benchBodyweightRatio.toFixed(1)}x bodyweight (target: 0.9x+)</div>
                                <div>Push press is {Math.round(pushPressStrictRatio * 100)}% of strict press (target: &lt;150%)</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Upper Back */}
                      <div className={`p-3 rounded-lg ${needsUpperBack ? 'bg-red-50 border border-red-200' : 'bg-coral/5 border border-coral/20'}`}>
                        <div className="flex items-start">
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsUpperBack ? 'bg-red-500' : 'bg-coral'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Upper Back - {needsUpperBack ? 'Target' : 'Maintain'}</div>
                            {needsUpperBack ? (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Why:</span> Front squat ({formatWeight(profile.one_rms.front_squat)}) is {Math.round((profile.one_rms.front_squat! / profile.one_rms.back_squat!) * 100)}% of back squat. Target: 85%+.
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">
                                Front squat ({formatWeight(profile.one_rms.front_squat)}) is {Math.round((profile.one_rms.front_squat! / profile.one_rms.back_squat!) * 100)}% of back squat (target: 85%+)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Posterior Chain */}
                      <div className={`p-3 rounded-lg ${needsPosteriorChain ? 'bg-red-50 border border-red-200' : 'bg-coral/5 border border-coral/20'}`}>
                        <div className="flex items-start">
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsPosteriorChain ? 'bg-red-500' : 'bg-coral'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Posterior Chain - {needsPosteriorChain ? 'Target' : 'Maintain'}</div>
                            {needsPosteriorChain ? (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Why:</span> Deadlift ({formatWeight(profile.one_rms.deadlift)}) is {(profile.one_rms.deadlift! / profile.user_summary.body_weight!).toFixed(1)}x bodyweight. Target: 2.0x bodyweight.
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">
                                Deadlift ({formatWeight(profile.one_rms.deadlift)}) is {(profile.one_rms.deadlift! / profile.user_summary.body_weight!).toFixed(1)}x bodyweight (target: 2.0x+)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Technical Focus Section */}
          <div>
            <h3 className="font-semibold text-charcoal mb-4">Technical Focus</h3>
            
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

              // Count deficits
              const snatchDeficits = [snatchStrengthDeficit, snatchReceivingDeficit, snatchOverheadDeficit].filter(Boolean).length
              const snatchStrong = 3 - snatchDeficits
              const cjDeficits = [cjStrengthDeficit, cjReceivingDeficit, cjJerkDeficit].filter(Boolean).length
              const cjStrong = 3 - cjDeficits

              return (
                <>
                  {/* Summary View */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium text-charcoal">Snatch Technical Work: {profile.technical_focus.snatch_technical_count} exercises/day</div>
                          <div className="text-sm text-gray-600">
                            {snatchDeficits} area{snatchDeficits !== 1 ? 's' : ''} need work, {snatchStrong} area{snatchStrong !== 1 ? 's' : ''} strong
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium text-charcoal">Clean & Jerk Technical Work: {profile.technical_focus.clean_jerk_technical_count} exercises/day</div>
                          <div className="text-sm text-gray-600">
                            {cjDeficits} area{cjDeficits !== 1 ? 's' : ''} need work, {cjStrong} area{cjStrong !== 1 ? 's' : ''} strong
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <button
                    onClick={() => setExpandedCategories(prev => 
                      prev.includes('technical-details') 
                        ? prev.filter(name => name !== 'technical-details')
                        : [...prev, 'technical-details']
                    )}
                    className="text-coral hover:text-coral text-sm font-medium"
                  >
                    [{expandedCategories.includes('technical-details') ? '- Hide Details' : '+ View Details'}]
                  </button>

                  {/* Detailed View */}
                  {expandedCategories.includes('technical-details') && (
                    <div className="mt-4 space-y-4">
                      {/* Snatch Technical Work */}
                      <div className="border border-slate-blue rounded-lg p-4">
                        <div className="font-medium text-charcoal mb-3">
                          🎯 Snatch Technical Work: {profile.technical_focus.snatch_technical_count} exercises/day
                        </div>
                        <div className="space-y-2">
                          <div className={`flex items-center text-sm ${snatchStrengthDeficit ? 'text-red-600' : 'text-coral'}`}>
                            <span className="mr-2">{snatchStrengthDeficit ? '❌' : '✅'}</span>
                            <span>
                              Strength Deficit: Snatch ({formatWeight(profile.one_rms.snatch)}) is {safeRatio(profile.one_rms.snatch, profile.one_rms.back_squat)} of back squat (target: 62%+)
                            </span>
                          </div>
                          
                          <div className={`flex items-center text-sm ${snatchReceivingDeficit ? 'text-red-600' : 'text-coral'}`}>
                            <span className="mr-2">{snatchReceivingDeficit ? '❌' : '✅'}</span>
                            <span>
                              Receiving Position: Power snatch is {safeRatio(profile.one_rms.power_snatch, profile.one_rms.snatch)} of snatch (target: &lt;88%)
                            </span>
                          </div>
                          
                          <div className={`flex items-center text-sm ${snatchOverheadDeficit ? 'text-red-600' : 'text-coral'}`}>
                            <span className="mr-2">{snatchOverheadDeficit ? '❌' : '✅'}</span>
                            <span>
                              Overhead Stability: Overhead squat is {safeRatio(profile.one_rms.overhead_squat, profile.one_rms.back_squat)} of back squat (target: 65%+)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Clean & Jerk Technical Work */}
                      <div className="border border-slate-blue rounded-lg p-4">
                        <div className="font-medium text-charcoal mb-3">
                          🎯 Clean & Jerk Technical Work: {profile.technical_focus.clean_jerk_technical_count} exercises/day
                        </div>
                        <div className="space-y-2">
                          <div className={`flex items-center text-sm ${cjStrengthDeficit ? 'text-red-600' : 'text-coral'}`}>
                            <span className="mr-2">{cjStrengthDeficit ? '❌' : '✅'}</span>
                            <span>
                              Overall Strength: C&J ({formatWeight(profile.one_rms.clean_and_jerk)}) is {safeRatio(profile.one_rms.clean_and_jerk, profile.one_rms.back_squat)} of back squat (target: 74%+)
                            </span>
                          </div>
                          
                          <div className={`flex items-center text-sm ${cjReceivingDeficit ? 'text-red-600' : 'text-coral'}`}>
                            <span className="mr-2">{cjReceivingDeficit ? '❌' : '✅'}</span>
                            <span>
                              Receiving Position: Power clean is {safeRatio(profile.one_rms.power_clean, profile.one_rms.clean_only)} of clean (target: &lt;88%)
                            </span>
                          </div>
                          
                          <div className={`flex items-center text-sm ${cjJerkDeficit ? 'text-red-600' : 'text-coral'}`}>
                            <span className="mr-2">{cjJerkDeficit ? '❌' : '✅'}</span>
                            <span>
                              Jerk Performance: Jerk is {safeRatio(profile.one_rms.jerk_only, profile.one_rms.clean_only)} of clean (target: 90%+)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>

        {/* Movement Skills Repository */}
        <div className="bg-white rounded-lg shadow border border-slate-blue p-6">
          <h2 className="text-xl font-bold text-charcoal mb-4">MOVEMENT SKILLS</h2>
          <div className="border-t-2 border-charcoal mb-4"></div>
          
          {/* Skills Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-charcoal mb-2">
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
            <div className="w-full bg-slate-blue rounded-full h-2">
              <div 
                className="bg-coral h-2 rounded-full transition-all duration-300"
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
                  <div key={levelName} className="border border-slate-blue rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(levelName)}
                      className="w-full px-4 py-3 bg-ice-blue hover:bg-slate-blue/10 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <span className="mr-2 text-charcoal">{isExpanded ? '▼' : '▶'}</span>
                        <h3 className="font-semibold text-charcoal">{displayName.toUpperCase()}</h3>
                      </div>
                      <span className="text-sm text-charcoal">({skills.length})</span>
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
