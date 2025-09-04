'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface UserSettings {
  name: string
  email: string
  body_weight: number | null
  units: string
  gender: string
  conditioning_benchmarks: any
}

interface OneRM {
  exercise_name: string
  one_rm: number
}

interface UserSkill {
  skill_name: string
  skill_level: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    email: '',
    body_weight: null,
    units: 'Imperial (lbs)',
    gender: '',
    conditioning_benchmarks: {}
  })
  const [oneRMs, setOneRMs] = useState<OneRM[]>([])
  const [equipment, setEquipment] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const oneRMExercises = [
    'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean',
    'Clean (clean only)', 'Jerk (from rack or blocks, max Split or Power Jerk)',
    'Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift',
    'Bench Press', 'Push Press', 'Strict Press', 'Weighted Pullup (do not include body weight)'
  ]

  const availableEquipment = [
    'Barbell', 'Dumbbells', 'Kettlebells', 'Pull-up Bar', 'Rings',
    'Rowing Machine', 'Bike', 'Assault Bike', 'Box/Platform',
    'Medicine Ball', 'Wall Ball', 'Jump Rope', 'Resistance Bands',
    'TRX/Suspension Trainer', 'Parallette Bars', 'GHD Machine',
    'Plyo Box', 'Slam Ball', 'Battle Ropes', 'Sled', 'Tire',
    'Atlas Stone/Heavy Object', 'Sandbag', 'Farmers Walk Handles',
    'Yoke/Safety Squat Bar', 'Log Bar', 'Axle Bar'
  ]

  const skillCategories = [
    {
      name: 'Basic CrossFit skills',
      skills: ['Double Unders', 'Wall Balls']
    },
    {
      name: 'Upper Body Pulling',
      skills: [
        'Toes to Bar',
        'Pull-ups (kipping or butterfly)',
        'Chest to Bar Pull-ups',
        'Strict Pull-ups'
      ]
    },
    {
      name: 'Upper Body Pressing',
      skills: [
        'Push-ups',
        'Ring Dips',
        'Strict Ring Dips',
        'Strict Handstand Push-ups',
        'Wall Facing Handstand Push-ups',
        'Deficit Handstand Push-ups (4")'
      ]
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
      skills: [
        'Legless Rope Climbs',
        'Pegboard Ascent',
        'Handstand Walk (10m or 25\')',
        'Seated Legless Rope Climbs',
        'Strict Ring Muscle Ups',
        'Handstand Walk Obstacle Crossings'
      ]
    }
  ]

  const skillLevels = [
    'Unable to perform',
    'Beginner (1-5)',
    'Intermediate (6-10)',
    'Advanced (11-15)',
    'Expert (More than 15)'
  ]

  const conditioningBenchmarks = [
    { name: 'Fran', description: '21-15-9 Thrusters (95/65) and Pull-ups' },
    { name: 'Grace', description: '30 Clean and Jerks for time (135/95)' },
    { name: 'Helen', description: '3 rounds: 400m run, 21 KB swings (53/35), 12 pull-ups' },
    { name: 'Cindy', description: '20min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats' },
    { name: 'Annie', description: '50-40-30-20-10 Double-unders and Sit-ups' }
  ]

  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    try {
      const supabase = createClient()
      
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
        .select('id, name, email, body_weight, units, gender, conditioning_benchmarks')
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
        gender: userData.gender || '',
        conditioning_benchmarks: userData.conditioning_benchmarks || {}
      })

      // Load 1RMs
      const { data: oneRMData, error: oneRMError } = await supabase
        .from('user_one_rms')
        .select('exercise_name, one_rm')
        .eq('user_id', userData.id)

      if (oneRMError) throw oneRMError

      const oneRMMap = new Map(oneRMData?.map(rm => [rm.exercise_name, rm.one_rm]) || [])
      const allOneRMs = oneRMExercises.map(exercise => ({
        exercise_name: exercise,
        one_rm: oneRMMap.get(exercise) || 0
      }))
      setOneRMs(allOneRMs)

      // Load equipment
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('user_equipment')
        .select('equipment_name')
        .eq('user_id', userData.id)

      if (equipmentError) throw equipmentError
      setEquipment(equipmentData?.map(eq => eq.equipment_name) || [])

      // Load skills
      const { data: skillsData, error: skillsError } = await supabase
        .from('user_skills')
        .select('skill_name, skill_level')
        .eq('user_id', userData.id)
        .order('skill_index')

      if (skillsError) throw skillsError

      // Create skills array matching the order of skill categories
      const allSkills: string[] = []
      skillCategories.forEach(category => {
        category.skills.forEach(skillName => {
          const userSkill = skillsData?.find(s => s.skill_name === skillName)
          allSkills.push(userSkill?.skill_level || 'Unable to perform')
        })
      })
      setSkills(allSkills)

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

  const handleEquipmentChange = (equipmentName: string, checked: boolean) => {
    if (checked) {
      setEquipment(prev => [...prev, equipmentName])
    } else {
      setEquipment(prev => prev.filter(eq => eq !== equipmentName))
    }
  }

  const handleSkillChange = (index: number, value: string) => {
    setSkills(prev => {
      const newSkills = [...prev]
      newSkills[index] = value
      return newSkills
    })
  }

  const handleBenchmarkChange = (benchmarkName: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      conditioning_benchmarks: {
        ...prev.conditioning_benchmarks,
        [benchmarkName]: value
      }
    }))
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage('')

    try {
      const supabase = createClient()
      
      // Update user settings
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: settings.name,
          body_weight: settings.body_weight,
          units: settings.units,
          gender: settings.gender,
          conditioning_benchmarks: settings.conditioning_benchmarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // Update equipment
      await supabase.from('user_equipment').delete().eq('user_id', userId)
      if (equipment.length > 0) {
        const equipmentRecords: any[] = equipment.map(equipmentName => ({
          user_id: userId,
          equipment_name: equipmentName
        }))
        const { error: equipmentError } = await supabase
          .from('user_equipment')
          .insert(equipmentRecords)
        if (equipmentError) throw equipmentError
      }

      // Update skills
      await supabase.from('user_skills').delete().eq('user_id', userId)
      let skillIndex = 0
      const skillRecords: any[] = []
      
      skillCategories.forEach(category => {
        category.skills.forEach(skillName => {
          const skillLevel = skills[skillIndex]
          if (skillLevel && skillLevel !== 'Unable to perform') {
            skillRecords.push({
              user_id: userId,
              skill_index: skillIndex,
              skill_name: skillName,
              skill_level: skillLevel
            })
          }
          skillIndex++
        })
      })

      if (skillRecords.length > 0) {
        const { error: skillsError } = await supabase
          .from('user_skills')
          .insert(skillRecords)
        if (skillsError) throw skillsError
      }

      // Update 1RMs
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
                Training Settings
              </h1>
              <p className="text-gray-600">
                Update your profile and training data to improve program generation
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

        {/* Equipment */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Available Equipment</h2>
          <p className="text-gray-600 mb-4">Select all equipment you have access to:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availableEquipment.map((eq) => (
              <label key={eq} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={equipment.includes(eq)}
                  onChange={(e) => handleEquipmentChange(eq, e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{eq}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Skill Levels</h2>
          <p className="text-gray-600 mb-6">Rate your current skill level for each movement:</p>
          
          {skillCategories.map((category, categoryIndex) => {
            let currentIndex = 0
            for (let i = 0; i < categoryIndex; i++) {
              currentIndex += skillCategories[i].skills.length
            }
            
            return (
              <div key={category.name} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">{category.name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {category.skills.map((skill, skillIndex) => {
                    const globalIndex = currentIndex + skillIndex
                    return (
                      <div key={skill}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {skill}
                        </label>
                        <select
                          value={skills[globalIndex] || 'Unable to perform'}
                          onChange={(e) => handleSkillChange(globalIndex, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {skillLevels.map(level => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
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

        {/* Conditioning Benchmarks */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Conditioning Benchmarks</h2>
          <p className="text-gray-600 mb-4">Enter your best times/scores (optional):</p>
          <div className="space-y-4">
            {conditioningBenchmarks.map((benchmark) => (
              <div key={benchmark.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {benchmark.name}
                </label>
                <p className="text-xs text-gray-500 mb-2">{benchmark.description}</p>
                <input
                  type="text"
                  value={settings.conditioning_benchmarks[benchmark.name] || ''}
                  onChange={(e) => handleBenchmarkChange(benchmark.name, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 3:15, 42 reps, etc."
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mb-6">
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
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>

        {/* Note */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Program Updates:</strong> Changes to your equipment, skills, or strength levels 
            will be automatically used when generating your next monthly/quarterly program. 
            You don't need to regenerate anything manually.
          </p>
        </div>
      </div>
    </div>
  )
}
