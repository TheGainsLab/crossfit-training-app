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
  // Position marker relative to target: if current exceeds target, position at 100% (end of bar)
  // Otherwise, position at (current / target) * 100% of the bar
  // Example: 30% current with 60% target = 30/60 = 50% of bar
  // Example: 62% current with 60% target = min(62/60, 1) = 100% of bar (at end)
  const position = Math.min((current / target), 1) * 100
  
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
  style={{ width: `${position}%` }}
/>
</div>

{/* Current Value Marker - matching Raw Strength style */}
<div 
  className="absolute -top-8 transform -translate-x-1/2"
  style={{ left: `${position}%` }}
>
<div className="bg-coral text-white px-2 py-1 rounded text-xs font-medium">
  {Math.round(current * 100)}%
</div>
<div className="w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-coral mx-auto"></div>

</div>
        
      </div>

      {/* Show target value at right end of the bar without label text */}
      <div className="flex justify-between mt-1 text-xs text-charcoal">
        <span></span>
        <span>{Math.round(target * 100)}{unit}</span>
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
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [userSkills, setUserSkills] = useState<{[key: string]: string}>({})
  const [height, setHeight] = useState<number | null>(null)
  const [age, setAge] = useState<number | null>(null)
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
  const [editingBenchmark, setEditingBenchmark] = useState<string | null>(null)
  const [benchmarkValues, setBenchmarkValues] = useState<{[key: string]: string}>({})
  const [savingBenchmark, setSavingBenchmark] = useState(false)
  const [editingLift, setEditingLift] = useState<string | null>(null)
  const [liftValues, setLiftValues] = useState<{[key: string]: string}>({})
  const [savingLift, setSavingLift] = useState(false)

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

  // Helper to get ratio status with range-based color coding
  const getRatioStatusWithRange = (numerator: number | null, denominator: number | null, minRange: number, maxRange: number): { color: string, status: string | null, value: string } => {
    if (!numerator || !denominator || denominator === 0) {
      return { color: 'bg-gray-400', status: null, value: 'N/A' }
    }
    const ratio = numerator / denominator
    const value = `${Math.round(ratio * 100)}%`
    
    if (ratio >= minRange && ratio <= maxRange) {
      return { color: 'bg-green-500', status: null, value }
    } else if (ratio > maxRange) {
      return { color: 'bg-red-500', status: 'high', value }
    } else {
      return { color: 'bg-red-500', status: 'low', value }
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

  // Helper function for time formatting
  const formatTimeOnBlur = (value: string) => {
    let formatted = value.trim()
    if (!formatted) return ''
    
    if (formatted.includes(':')) {
      const parts = formatted.split(':')
      if (parts.length === 2) {
        const minutes = parts[0] || '0'
        const seconds = parts[1].padStart(2, '0').slice(0, 2) || '00'
        const secNum = parseInt(seconds)
        if (!isNaN(secNum) && secNum > 59) {
          formatted = `${minutes}:59`
        } else {
          formatted = `${minutes}:${seconds}`
        }
      }
    } else if (/^\d+$/.test(formatted)) {
      if (formatted.length <= 2) {
        formatted = `${formatted}:00`
      } else if (formatted.length <= 4) {
        formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`
      } else {
        formatted = `${formatted.slice(0, 2)}:${formatted.slice(2, 4)}`
      }
    }
    return formatted
  }

  // Save benchmark function
  const saveBenchmark = async (field: string, value: string) => {
    if (!user) return
    
    setSavingBenchmark(true)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) throw new Error('User not found')

      // Get current benchmarks
      const { data: currentUser } = await supabase
        .from('users')
        .select('conditioning_benchmarks')
        .eq('id', userData.id)
        .single()

      const currentBenchmarks = currentUser?.conditioning_benchmarks || {}
      
      // Map profile field names to database field names
      const dbFieldMap: {[key: string]: string} = {
        'mile_run': 'mile_run',
        'five_k_run': 'five_k_run',
        'ten_k_run': 'ten_k_run',
        'one_k_row': 'one_k_row',
        'two_k_row': 'two_k_row',
        'five_k_row': 'five_k_row',
        'air_bike_10_min': 'ten_min_air_bike'
      }
      
      const dbField = dbFieldMap[field] || field
      const updatedBenchmarks = {
        ...currentBenchmarks,
        [dbField]: value || null
      }

      // Update database directly - DO NOT call save-intake-data
      // That route is for full form submissions and will delete oneRMs/equipment/skills if not provided
      const { error } = await supabase
        .from('users')
        .update({
          conditioning_benchmarks: updatedBenchmarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id)

      if (error) throw error

      // Update local state immediately - no need to reload or call destructive route
      if (profile) {
        setProfile({
          ...profile,
          benchmarks: {
            ...profile.benchmarks,
            [field]: value || null
          }
        })
      }
      
      setEditingBenchmark(null)
    } catch (error) {
      console.error('Error saving benchmark:', error)
      alert('Failed to save benchmark. Please try again.')
    } finally {
      setSavingBenchmark(false)
    }
  }

  // Save oneRM function
  const saveLift = async (field: string, value: string) => {
    if (!user) return
    
    setSavingLift(true)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) throw new Error('User not found')

      // Map profile field names to database structure
      const liftMap: {[key: string]: {index: number, name: string}} = {
        'snatch': { index: 0, name: 'Snatch' },
        'power_snatch': { index: 1, name: 'Power Snatch' },
        'clean_and_jerk': { index: 2, name: 'Clean and Jerk' },
        'power_clean': { index: 3, name: 'Power Clean' },
        'clean_only': { index: 4, name: 'Clean (clean only)' },
        'jerk_only': { index: 5, name: 'Jerk (from rack or blocks, max Split or Power Jerk)' },
        'back_squat': { index: 6, name: 'Back Squat' },
        'front_squat': { index: 7, name: 'Front Squat' },
        'overhead_squat': { index: 8, name: 'Overhead Squat' },
        'deadlift': { index: 9, name: 'Deadlift' },
        'bench_press': { index: 10, name: 'Bench Press' },
        'push_press': { index: 11, name: 'Push Press' },
        'strict_press': { index: 12, name: 'Strict Press' },
        'weighted_pullup': { index: 13, name: 'Weighted Pullup (do not include body weight)' }
      }

      const liftInfo = liftMap[field]
      if (!liftInfo) throw new Error('Invalid lift field')

      const weightValue = value.trim() ? parseFloat(value.trim()) : null
      
      // Use delete-then-insert (no unique constraint exists on user_id,one_rm_index)
      if (weightValue && !isNaN(weightValue) && weightValue > 0) {
        // Delete existing record first (if any)
        await supabase
          .from('user_one_rms')
          .delete()
          .eq('user_id', userData.id)
          .eq('one_rm_index', liftInfo.index)

        // Then insert the new value
        const { error } = await supabase
          .from('user_one_rms')
          .insert({
            user_id: userData.id,
            one_rm_index: liftInfo.index,
            exercise_name: liftInfo.name,
            one_rm: weightValue,
            recorded_at: new Date().toISOString()
          })

        if (error) throw error
      } else {
        // Delete if value is empty or 0
        const { error } = await supabase
          .from('user_one_rms')
          .delete()
          .eq('user_id', userData.id)
          .eq('one_rm_index', liftInfo.index)

        if (error) throw error
      }

      // Update local state immediately
      if (profile) {
        setProfile({
          ...profile,
          one_rms: {
            ...profile.one_rms,
            [field]: weightValue
          }
        })
      }
      
      setEditingLift(null)
    } catch (error) {
      console.error('Error saving lift:', error)
      alert('Failed to save lift. Please try again.')
    } finally {
      setSavingLift(false)
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
            skillsData.forEach((skill: { skill_name: string; skill_level: string }) => {
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
        .select('id, height, age, subscription_tier')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        setLoading(false)
        return
      }

      setHeight(userData.height)
      setAge(userData.age)
      setSubscriptionTier(userData.subscription_tier)

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

  // Calculate BMI
  const calculateBMI = (): number | null => {
    if (!profile?.user_summary.body_weight || !height) return null
    const weight = profile.user_summary.body_weight
    const isMetric = profile.user_summary.units.includes('kg')
    
    // Convert to metric if needed
    const weightKg = isMetric ? weight : weight * 0.453592
    const heightM = isMetric ? height / 100 : height * 0.0254
    
    if (heightM === 0) return null
    return parseFloat((weightKg / (heightM * heightM)).toFixed(1))
  }

  // Calculate BMR using Mifflin-St Jeor equation
  const calculateBMR = (): number | null => {
    if (!profile?.user_summary.body_weight || !height || !age) return null
    const weight = profile.user_summary.body_weight
    const isMetric = profile.user_summary.units.includes('kg')
    const gender = profile.user_summary.gender
    
    // Convert to metric
    const weightKg = isMetric ? weight : weight * 0.453592
    const heightCm = isMetric ? height : height * 2.54
    
    // Mifflin-St Jeor: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) + s
    // s = +5 for males, -161 for females
    const s = gender === 'Male' ? 5 : -161
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s
    
    return Math.round(bmr)
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

  // Mobile-optimized editable benchmark component
  const EditableBenchmark = ({ field, label, value, isTime = true }: { field: string, label: string, value: string | null, isTime?: boolean }) => {
    if (!value) return null
    
    const isEditing = editingBenchmark === field
    const displayValue = benchmarkValues[field] !== undefined ? benchmarkValues[field] : (value || '')
    
    return (
      <div className="flex justify-between items-center py-2 -mx-2 px-2 rounded-lg active:bg-gray-50 touch-manipulation">
        <span className="text-gray-700 text-base">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type={isTime ? "text" : "number"}
              inputMode={isTime ? "numeric" : "numeric"}
              value={displayValue}
              onChange={(e) => setBenchmarkValues({...benchmarkValues, [field]: e.target.value})}
              onBlur={(e) => {
                const formatted = isTime ? formatTimeOnBlur(e.target.value) : e.target.value.trim()
                setBenchmarkValues({...benchmarkValues, [field]: formatted})
                saveBenchmark(field, formatted)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
                if (e.key === 'Escape') {
                  setEditingBenchmark(null)
                  setBenchmarkValues({...benchmarkValues, [field]: value || ''})
                }
              }}
              autoFocus
              className="w-24 sm:w-20 px-3 py-2 border-2 border-coral rounded-md text-base font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-coral"
              disabled={savingBenchmark}
              placeholder={isTime ? "MM:SS" : ""}
              style={{ fontSize: '16px' }} // Prevents zoom on iOS
            />
            {savingBenchmark && (
              <span className="text-sm text-gray-500">Saving...</span>
            )}
          </div>
        ) : (
          <span 
            className="font-semibold text-charcoal text-base cursor-pointer hover:text-coral active:text-coral transition-colors min-h-[44px] flex items-center justify-end"
            onClick={() => {
              setEditingBenchmark(field)
              setBenchmarkValues({...benchmarkValues, [field]: value || ''})
            }}
            style={{ minWidth: '44px' }} // Minimum touch target size
          >
            {value}
          </span>
        )}
      </div>
    )
  }

  // Mobile-optimized editable lift component
  const EditableLift = ({ field, label, value }: { field: string, label: string, value: number | null }) => {
    const isEditing = editingLift === field
    const displayValue = liftValues[field] !== undefined ? liftValues[field] : (value ? value.toString() : '')
    
    return (
      <div className="flex justify-between items-center py-2 -mx-2 px-2 rounded-lg active:bg-gray-50 touch-manipulation">
        <span className="text-gray-700 text-base">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={displayValue}
              onChange={(e) => setLiftValues({...liftValues, [field]: e.target.value})}
              onBlur={(e) => {
                const trimmed = e.target.value.trim()
                setLiftValues({...liftValues, [field]: trimmed})
                saveLift(field, trimmed)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
                if (e.key === 'Escape') {
                  setEditingLift(null)
                  setLiftValues({...liftValues, [field]: value ? value.toString() : ''})
                }
              }}
              autoFocus
              className="w-24 sm:w-20 px-3 py-2 border-2 border-coral rounded-md text-base font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-coral"
              disabled={savingLift}
              placeholder="0"
              style={{ fontSize: '16px' }} // Prevents zoom on iOS
            />
            <span className="text-sm text-gray-500">{profile?.user_summary.units.includes('kg') ? 'kg' : 'lbs'}</span>
            {savingLift && (
              <span className="text-sm text-gray-500">Saving...</span>
            )}
          </div>
        ) : (
          <span 
            className="font-semibold text-charcoal text-base cursor-pointer hover:text-coral active:text-coral transition-colors min-h-[44px] flex items-center justify-end"
            onClick={() => {
              setEditingLift(field)
              setLiftValues({...liftValues, [field]: value ? value.toString() : ''})
            }}
            style={{ minWidth: '44px' }} // Minimum touch target size
          >
            {value ? formatWeight(value) : 'Not recorded'}
          </span>
        )}
      </div>
    )
  }

// Main render
  return (
    <div className="min-h-screen bg-ice-blue py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Consolidated Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between">
            <div className="flex-1 mb-3 md:mb-0">
              <h1 className="text-xl md:text-3xl font-bold text-charcoal mb-1 md:mb-2">
                Athlete Profile
              </h1>
              <div className="text-sm md:text-base text-charcoal font-semibold mb-2">
                {profile.user_summary.name} • {new Date(profile.generated_at).toLocaleDateString()}
              </div>
              {(calculateBMI() !== null || calculateBMR() !== null) && (
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  {calculateBMI() !== null && (
                    <div>
                      <span className="font-semibold">BMI:</span> {calculateBMI()}
                    </div>
                  )}
                  {calculateBMR() !== null && (
                    <div>
                      <span className="font-semibold">BMR:</span> {calculateBMR()} kcal/day
                    </div>
                  )}
                </div>
              )}
            </div>
            <a
              href="/intake"
              className="flex-shrink-0 inline-flex items-center justify-center px-4 py-2 bg-coral text-white rounded-lg font-medium hover:opacity-90 transition-colors w-full md:w-auto"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </a>
          </div>
        </div>

        {/* New Strength Section */}
        <div className="space-y-6">
          {/* Olympic Lift Performance Card */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-blue p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-charcoal">OLYMPIC LIFTS</h2>
                <button
                  onClick={() => toggleCategory('olympic-lifts')}
                  className="text-coral hover:text-coral text-sm font-medium"
                >
                  [{expandedCategories.includes('olympic-lifts') ? '- Hide' : '+ View'}]
                </button>
              </div>
              <div className="w-full h-0.5 bg-coral"></div>
              <p className="text-sm text-gray-600 mt-2">Key Olympic lifting ratios</p>
            </div>
            
            {expandedCategories.includes('olympic-lifts') && (
              <>
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
              </>
            )}
          </div>
          
          {/* Card 1: Foundation Strength */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-blue p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-charcoal">FOUNDATION STRENGTH</h2>
                <button
                  onClick={() => toggleCategory('foundation-strength')}
                  className="text-coral hover:text-coral text-sm font-medium"
                >
                  [{expandedCategories.includes('foundation-strength') ? '- Hide' : '+ View'}]
                </button>
              </div>
              <div className="w-full h-0.5 bg-coral"></div>
              <p className="text-sm text-gray-600 mt-2">Primary strength to weight ratios</p>
            </div>
            
            {expandedCategories.includes('foundation-strength') && (
              <>
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
              </>
            )}
          </div>

          {/* Card 2: All Max Lifts */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-blue p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-charcoal">MAX LIFTS</h2>
                <button
                  onClick={() => toggleCategory('max-lifts')}
                  className="text-coral hover:text-coral text-sm font-medium"
                >
                  [{expandedCategories.includes('max-lifts') ? '- Hide' : '+ View'}]
                </button>
              </div>
              <div className="w-full h-0.5 bg-coral"></div>
              <p className="text-sm text-gray-600 mt-2">View and edit all of your 1RMs in one place.</p>
            </div>
            
            {expandedCategories.includes('max-lifts') && (
              <>
            {/* Olympic Lifts */}
            <div className="mb-6">
              <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Olympic Lifts</h5>
              <div className="space-y-1">
                <EditableLift field="snatch" label="Snatch" value={profile.one_rms.snatch} />
                <EditableLift field="clean_and_jerk" label="Clean and Jerk" value={profile.one_rms.clean_and_jerk} />
                <EditableLift field="power_snatch" label="Power Snatch" value={profile.one_rms.power_snatch} />
                <EditableLift field="power_clean" label="Power Clean" value={profile.one_rms.power_clean} />
                <EditableLift field="clean_only" label="Clean Only" value={profile.one_rms.clean_only} />
                <EditableLift field="jerk_only" label="Jerk Only" value={profile.one_rms.jerk_only} />
              </div>
            </div>

            {/* Squatting */}
            <div className="mb-6">
              <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Squatting</h5>
              <div className="space-y-1">
                <EditableLift field="back_squat" label="Back Squat" value={profile.one_rms.back_squat} />
                <EditableLift field="front_squat" label="Front Squat" value={profile.one_rms.front_squat} />
                <EditableLift field="overhead_squat" label="Overhead Squat" value={profile.one_rms.overhead_squat} />
              </div>
            </div>

            {/* Pressing */}
            <div className="mb-6">
              <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Pressing</h5>
              <div className="space-y-1">
                <EditableLift field="bench_press" label="Bench Press" value={profile.one_rms.bench_press} />
                <EditableLift field="push_press" label="Push Press" value={profile.one_rms.push_press} />
                <EditableLift field="strict_press" label="Strict Press" value={profile.one_rms.strict_press} />
              </div>
            </div>

            {/* Pulling */}
            <div className="mb-6">
              <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide border-b border-slate-blue pb-1">Pulling</h5>
              <div className="space-y-1">
                <EditableLift field="deadlift" label="Deadlift" value={profile.one_rms.deadlift} />
                <EditableLift field="weighted_pullup" label="Weighted Pullup" value={profile.one_rms.weighted_pullup} />
              </div>
            </div>
              </>
            )}
          </div>

          {/* Card 3: Strength Ratios */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-blue p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-charcoal">STRENGTH RATIOS</h2>
                <button
                  onClick={() => toggleCategory('strength-ratios')}
                  className="text-coral hover:text-coral text-sm font-medium"
                >
                  [{expandedCategories.includes('strength-ratios') ? '- Hide' : '+ View'}]
                </button>
              </div>
              <div className="w-full h-0.5 bg-coral"></div>
              <p className="text-sm text-gray-600 mt-2">Balance and efficiency among your key lifts.</p>
            </div>
            
            {expandedCategories.includes('strength-ratios') && (
              <>
            {/* Olympic Lift Efficiency */}
            <div className="mb-6 bg-ice-blue rounded-lg p-4">
              <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Olympic Lift Efficiency</h5>
              <div className="space-y-2">
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.power_snatch, profile.one_rms.snatch, 0.74, 0.80)
                  return (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-700">Power Snatch to Snatch</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-medium text-charcoal">{status.value}</span>
                        {status.status && <span className="text-red-600 text-sm font-medium">{status.status}</span>}
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.power_clean, profile.one_rms.clean_only, 0.79, 0.85)
                  return (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-700">Power Clean to Clean</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-medium text-charcoal">{status.value}</span>
                        {status.status && <span className="text-red-600 text-sm font-medium">{status.status}</span>}
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.jerk_only, profile.one_rms.clean_only, 0.975, 1.075)
                  return (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-700">Jerk to Clean</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-medium text-charcoal">{status.value}</span>
                        {status.status && <span className="text-red-600 text-sm font-medium">{status.status}</span>}
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.snatch, profile.one_rms.clean_and_jerk, 0.775, 0.825)
                  return (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-700">Snatch to Clean and Jerk</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-medium text-charcoal">{status.value}</span>
                        {status.status && <span className="text-red-600 text-sm font-medium">{status.status}</span>}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Strength Balance */}
            <div className="bg-ice-blue rounded-lg p-4">
              <h5 className="text-sm font-semibold text-charcoal mb-3 uppercase tracking-wide">Strength Balance</h5>
              <div className="space-y-2">
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.front_squat, profile.one_rms.back_squat, 0.8, 0.875)
                  return (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-700">Front Squat to Back Squat</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-medium text-charcoal">{status.value}</span>
                        {status.status && <span className="text-red-600 text-sm font-medium">{status.status}</span>}
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.overhead_squat, profile.one_rms.snatch, 1.05, 1.2)
                  return (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-700">Overhead Squat to Snatch</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-medium text-charcoal">{status.value}</span>
                        {status.status && <span className="text-red-600 text-sm font-medium">{status.status}</span>}
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const status = getRatioStatusWithRange(profile.one_rms.push_press, profile.one_rms.strict_press, 1.25, 1.45)
                  return (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-700">Push Press to Strict Press</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                        <span className="font-medium text-charcoal">{status.value}</span>
                        {status.status && <span className="text-red-600 text-sm font-medium">{status.status}</span>}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
              </>
            )}
          </div>
        </div>

        {/* Enhanced Conditioning Benchmarks */}
        <div className="bg-white rounded-lg shadow border border-slate-blue p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-charcoal">CONDITIONING BENCHMARKS</h2>
            <button
              onClick={() => toggleCategory('conditioning-benchmarks')}
              className="text-coral hover:text-coral text-sm font-medium"
            >
              [{expandedCategories.includes('conditioning-benchmarks') ? '- Hide' : '+ View'}]
            </button>
          </div>
          <div className="w-full h-0.5 bg-coral"></div>
          <p className="text-sm text-gray-600 mt-2">Fundamental engine metrics across times and modalities.</p>
          <div className="mb-6"></div>
          
          {expandedCategories.includes('conditioning-benchmarks') && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Running Column */}
            <div>
              <h3 className="font-semibold text-charcoal mb-3">RUNNING</h3>
              <div className="space-y-1">
                <EditableBenchmark 
                  field="mile_run" 
                  label="Mile" 
                  value={profile.benchmarks.mile_run} 
                  isTime={true}
                />
                <EditableBenchmark 
                  field="five_k_run" 
                  label="5K" 
                  value={profile.benchmarks.five_k_run} 
                  isTime={true}
                />
                <EditableBenchmark 
                  field="ten_k_run" 
                  label="10K" 
                  value={profile.benchmarks.ten_k_run} 
                  isTime={true}
                />
              </div>
            </div>

            {/* Rowing Column */}
            <div>
              <h3 className="font-semibold text-charcoal mb-3">ROWING</h3>
              <div className="space-y-1">
                <EditableBenchmark 
                  field="one_k_row" 
                  label="1K" 
                  value={profile.benchmarks.one_k_row} 
                  isTime={true}
                />
                <EditableBenchmark 
                  field="two_k_row" 
                  label="2K" 
                  value={profile.benchmarks.two_k_row} 
                  isTime={true}
                />
                <EditableBenchmark 
                  field="five_k_row" 
                  label="5K" 
                  value={profile.benchmarks.five_k_row} 
                  isTime={true}
                />
              </div>
            </div>

            {/* Bike Column */}
            <div>
              <h3 className="font-semibold text-charcoal mb-3">BIKE</h3>
              <div className="space-y-1">
                <EditableBenchmark 
                  field="air_bike_10_min" 
                  label="10min" 
                  value={profile.benchmarks.air_bike_10_min} 
                  isTime={false}
                />
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Programming Focus Areas */}
        <div className="bg-white rounded-lg shadow border border-slate-blue p-6">
          <h2 className="text-xl font-bold text-charcoal mb-2">FOCUS AREAS</h2>
          <div className="w-full h-0.5 bg-coral"></div>
          <p className="text-sm text-gray-600 mt-2">Targets for technical improvements and accessory work.</p>
          <div className="mb-6"></div>
          
          {/* Accessory Needs Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-charcoal">Accessory Needs</h3>
              <button
                onClick={() => setExpandedCategories(prev => 
                  prev.includes('accessory-needs') 
                    ? prev.filter(name => name !== 'accessory-needs')
                    : [...prev, 'accessory-needs']
                )}
                className="text-coral hover:text-coral text-sm font-medium"
              >
                [{expandedCategories.includes('accessory-needs') ? '- Hide' : '+ View'}]
              </button>
            </div>
            
            {expandedCategories.includes('accessory-needs') && (() => {
              // Calculate actual accessory needs using real logic
              const needsUpperBack = profile.one_rms.front_squat && profile.one_rms.back_squat ? 
                (profile.one_rms.front_squat / profile.one_rms.back_squat) < 0.85 : false
              
              const needsPosteriorChain = profile.one_rms.deadlift && profile.user_summary.body_weight ?
                (profile.one_rms.deadlift / profile.user_summary.body_weight) < 2.0 : false
              
              const benchBodyweightRatio = profile.one_rms.bench_press && profile.user_summary.body_weight ?
                profile.one_rms.bench_press / profile.user_summary.body_weight : 0
              const pushPressStrictRatio = profile.one_rms.push_press && profile.one_rms.strict_press ?
                profile.one_rms.push_press / profile.one_rms.strict_press : 0
              const needsUpperBodyPressing = benchBodyweightRatio < 0.9 || pushPressStrictRatio > 1.45
              
              const pullupBenchRatio = profile.one_rms.weighted_pullup && profile.one_rms.bench_press ?
                profile.one_rms.weighted_pullup / profile.one_rms.bench_press : 0
              const pullupBodyweightRatio = profile.one_rms.weighted_pullup && profile.user_summary.body_weight ?
                profile.one_rms.weighted_pullup / profile.user_summary.body_weight : 0
              const needsUpperBodyPulling = pullupBenchRatio < 0.4 || pullupBodyweightRatio < 0.33

              return (
                <>
                  {/* Summary View */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsUpperBodyPulling ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-gray-700">Upper Body Pulling</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsUpperBodyPressing ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-gray-700">Upper Body Pressing</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsUpperBack ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-gray-700">Upper Back</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center py-2">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${needsPosteriorChain ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-gray-700">Posterior Chain</span>
                      </div>
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
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsUpperBodyPulling ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Upper Body Pulling</div>
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
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsUpperBodyPressing ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Upper Body Pressing</div>
                            {needsUpperBodyPressing ? (
                              <div className="text-sm text-gray-600">
                                <div className="mb-1">
                                  <span className="font-medium">Why:</span> {benchBodyweightRatio < 0.9 && pushPressStrictRatio > 1.45 ? (
                                    <>Bench press is {benchBodyweightRatio.toFixed(1)}x bodyweight (target: 0.9x) and push press is {Math.round(pushPressStrictRatio * 100)}% of strict press (target: &lt;145%).</>
                                  ) : benchBodyweightRatio < 0.9 ? (
                                    <>Bench press ({formatWeight(profile.one_rms.bench_press)}) is {benchBodyweightRatio.toFixed(1)}x bodyweight. Target: 0.9x bodyweight.</>
                                  ) : (
                                    <>Push press is {Math.round(pushPressStrictRatio * 100)}% of strict press, indicating leg compensation. Target: &lt;145%.</>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">
                                <div>Bench press is {benchBodyweightRatio.toFixed(1)}x bodyweight (target: 0.9x+)</div>
                                <div>Push press is {Math.round(pushPressStrictRatio * 100)}% of strict press (target: &lt;145%)</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Upper Back */}
                      <div className={`p-3 rounded-lg ${needsUpperBack ? 'bg-red-50 border border-red-200' : 'bg-coral/5 border border-coral/20'}`}>
                        <div className="flex items-start">
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsUpperBack ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Upper Back</div>
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
                          <span className={`w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0 ${needsPosteriorChain ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-charcoal mb-1">Posterior Chain</div>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-charcoal">Technical Focus</h3>
              <button
                onClick={() => setExpandedCategories(prev => 
                  prev.includes('technical-focus') 
                    ? prev.filter(name => name !== 'technical-focus')
                    : [...prev, 'technical-focus']
                )}
                className="text-coral hover:text-coral text-sm font-medium"
              >
                [{expandedCategories.includes('technical-focus') ? '- Hide' : '+ View'}]
              </button>
            </div>
            
            {expandedCategories.includes('technical-focus') && (() => {
              // Calculate snatch deficits using actual logic
              const snatchStrengthDeficit = profile.one_rms.snatch && profile.one_rms.back_squat ? 
                (profile.one_rms.snatch / profile.one_rms.back_squat) < 0.60 : true
              
              const snatchReceivingDeficit = profile.one_rms.power_snatch && profile.one_rms.snatch ?
                (profile.one_rms.power_snatch / profile.one_rms.snatch) > 0.88 : true
              
              const snatchOverheadDeficit = profile.one_rms.overhead_squat && profile.one_rms.snatch ?
                (profile.one_rms.overhead_squat / profile.one_rms.snatch) < 1.1 : true

              // Calculate C&J deficits using actual logic
              const cjStrengthDeficit = profile.one_rms.clean_and_jerk && profile.one_rms.back_squat ?
                (profile.one_rms.clean_and_jerk / profile.one_rms.back_squat) < 0.75 : true
                
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
                              Strength Deficit: Snatch ({formatWeight(profile.one_rms.snatch)}) is {safeRatio(profile.one_rms.snatch, profile.one_rms.back_squat)} of back squat (target: 60%+)
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
                              Overhead Stability: Overhead squat is {safeRatio(profile.one_rms.overhead_squat, profile.one_rms.snatch)} of snatch (target: 110%+)
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
                              Overall Strength: C&J ({formatWeight(profile.one_rms.clean_and_jerk)}) is {safeRatio(profile.one_rms.clean_and_jerk, profile.one_rms.back_squat)} of back squat (target: 75%+)
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

        {/* Skills Repository */}
        <div className="bg-white rounded-lg shadow border border-slate-blue p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-charcoal">SKILLS</h2>
            <button
              onClick={() => toggleCategory('movement-skills')}
              className="text-coral hover:text-coral text-sm font-medium"
            >
              [{expandedCategories.includes('movement-skills') ? '- Hide' : '+ View'}]
            </button>
          </div>
          <div className="w-full h-0.5 bg-coral"></div>
          <p className="text-sm text-gray-600 mt-2">Your skill level at 26 key movements.</p>
          <div className="mb-4"></div>
          
          {expandedCategories.includes('movement-skills') && (
          <>
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
                      className="w-full px-4 py-3 transition-colors flex items-center justify-between"
                      style={{ backgroundColor: '#DAE2EA' }}
                    >
                      <div className="flex items-center">
                        <span className="mr-2 text-charcoal">{isExpanded ? '▼' : '▶'}</span>
                        <h3 className="font-semibold" style={{ color: isExpanded ? '#FFFFFF' : '#282B34' }}>{displayName.toUpperCase()}</h3>
                      </div>
                      <span className="text-sm text-charcoal">({skills.length})</span>
                    </button>
                    
                    {isExpanded && (
                      <div className="p-4 space-y-2">
                        {skills.map(skill => (
                          <div key={skill.name} className="flex justify-between items-center py-1">
                            <div className="flex items-center">
                              <div>
                                <span className="font-bold" style={{ color: '#282B34' }}>{skill.name}</span>
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
          </>
          )}
        </div>

        {/* Missing Data - Filter based on subscription tier */}
        {(() => {
          // Filter missing data based on subscription tier
          const applicableMissingData = subscriptionTier === 'ENGINE'
            ? profile.missing_data.filter(item => {
                // For Engine users, only show missing conditioning benchmarks
                // Filter out all 1RM and skills items
                return !item.includes('1RM') && 
                       !item.includes('Snatch') && 
                       !item.includes('Clean') && 
                       !item.includes('Jerk') && 
                       !item.includes('Squat') && 
                       !item.includes('Deadlift') && 
                       !item.includes('Bench Press') && 
                       !item.includes('Press') && 
                       !item.includes('Pullup') &&
                       !item.includes('Double Unders') &&
                       !item.includes('Wall Balls') &&
                       !item.includes('Toes to Bar') &&
                       !item.includes('Pull-ups') &&
                       !item.includes('Push-ups') &&
                       !item.includes('Ring Dips') &&
                       !item.includes('Handstand') &&
                       !item.includes('Pistols') &&
                       !item.includes('GHD') &&
                       !item.includes('Wall Walks') &&
                       !item.includes('Muscle Ups') &&
                       !item.includes('Rope Climbs') &&
                       !item.includes('Pegboard')
              })
            : subscriptionTier === 'APPLIED_POWER'
            ? profile.missing_data.filter(item => {
                // For Applied Power, filter out Skills and MetCon benchmarks
                return !item.includes('Double Unders') &&
                       !item.includes('Wall Balls') &&
                       !item.includes('Toes to Bar') &&
                       !item.includes('Pull-ups') &&
                       !item.includes('Push-ups') &&
                       !item.includes('Ring Dips') &&
                       !item.includes('Handstand') &&
                       !item.includes('Pistols') &&
                       !item.includes('GHD') &&
                       !item.includes('Wall Walks') &&
                       !item.includes('Muscle Ups') &&
                       !item.includes('Rope Climbs') &&
                       !item.includes('Pegboard') &&
                       !item.includes('Mile Run') &&
                       !item.includes('5K Run') &&
                       !item.includes('10K Run') &&
                       !item.includes('Air Bike')
              })
            : profile.missing_data // Premium users see all missing data

          return applicableMissingData.length > 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-800 mb-2">Missing Data</h3>
              <p className="text-yellow-700 mb-2">
                {subscriptionTier === 'ENGINE' 
                  ? 'Adding this information will improve your Engine program accuracy:'
                  : 'Adding this information will improve your program accuracy:'}
              </p>
              <ul className="list-disc list-inside text-yellow-700">
                {applicableMissingData.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null
        })()}
      </div>
    </div>
  )
}
