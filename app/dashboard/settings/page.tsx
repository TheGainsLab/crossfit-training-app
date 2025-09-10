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
  // Preferences
  const [threeMonthGoals, setThreeMonthGoals] = useState<string>('')
  const [monthlyPrimaryGoal, setMonthlyPrimaryGoal] = useState<string>('')
  const [preferredMetconExercises, setPreferredMetconExercises] = useState<string[]>([])
  const [avoidedExercises, setAvoidedExercises] = useState<string[]>([])
  const [availableExercisesList, setAvailableExercisesList] = useState<string[]>([])

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
      name: 'Basic Skills',
      skills: ['Double Unders', 'Wall Balls'],
      levels: ["Don't have it", 'Beginner (1-25)', 'Intermediate (26-50)', 'Advanced (More than 50)']
    },
    {
      name: 'Upper Body Pulling',
      skills: ['Toes to Bar', 'Pull-ups (kipping or butterfly)', 'Chest to Bar Pull-ups', 'Strict Pull-ups'],
      levels: ["Don't have it", 'Beginner (1-7)', 'Intermediate (8-15)', 'Advanced (More than 15)']
    },
    {
      name: 'Upper Body Pressing',
      skills: ['Push-ups', 'Ring Dips', 'Strict Ring Dips', 'Strict Handstand Push-ups', 'Wall Facing Handstand Push-ups', 'Deficit Handstand Push-ups (4")'],
      levels: ["Don't have it", 'Beginner (1-10)', 'Intermediate (11-20)', 'Advanced (More than 20)']
    },
    {
      name: 'Additional Common Skills',
      skills: ['Alternating Pistols', 'GHD Sit-ups', 'Wall Walks'],
      levels: ["Don't have it", 'Beginner (1-10)', 'Intermediate (11-20)', 'Advanced (More than 20)']
    },
    {
      name: 'Advanced Upper Body Pulling',
      skills: ['Ring Muscle Ups', 'Bar Muscle Ups', 'Rope Climbs'],
      levels: ["Don't have it", 'Beginner (1-5)', 'Intermediate (6-10)', 'Advanced (More than 10)']
    },
    {
      name: 'Holds',
      skills: ['Wall Facing Handstand Hold', 'Freestanding Handstand Hold'],
      levels: ["Don't have it", 'Beginner (1-30s)', 'Intermediate (30s-60s)', 'Advanced (More than 60s)']
    },
    {
      name: 'Advanced Gymnastics',
      skills: ['Legless Rope Climbs', 'Pegboard Ascent', 'Handstand Walk (10m or 25\')', 'Seated Legless Rope Climbs', 'Strict Ring Muscle Ups', 'Handstand Walk Obstacle Crossings'],
      levels: ["Don't have it", 'Beginner (1-2)', 'Intermediate (3-5)', 'Advanced (More than 5)']
    }
  ]

  const airBikeTypes = ['Assault Bike', 'Rogue Echo Bike', 'Schwinn Airdyne', 'Concept2 BikeErg', 'Other', 'Did not use Air Bike']

  const skillLevelsFallback = ["Don't have it", 'Beginner', 'Intermediate', 'Advanced']

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

      // Load preferences
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('three_month_goals, monthly_primary_goal, preferred_metcon_exercises, avoided_exercises')
        .eq('user_id', userData.id)
        .single()
      setThreeMonthGoals(prefs?.three_month_goals || '')
      setMonthlyPrimaryGoal(prefs?.monthly_primary_goal || '')
      setPreferredMetconExercises(prefs?.preferred_metcon_exercises || [])
      setAvoidedExercises(prefs?.avoided_exercises || [])

      // Load exercises for preferences
      const { data: exData } = await supabase
        .from('exercises')
        .select('name')
        .eq('can_be_metcons', true)
        .order('name', { ascending: true })
      setAvailableExercisesList((exData || []).map((r: any) => r.name).filter(Boolean))

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

      // Upsert preferences
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          three_month_goals: threeMonthGoals || null,
          monthly_primary_goal: monthlyPrimaryGoal || null,
          preferred_metcon_exercises: preferredMetconExercises || [],
          avoided_exercises: avoidedExercises || []
        }, { onConflict: 'user_id' })
      if (prefsError) throw prefsError

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
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Athlete Settings</h1>
          <p className="text-gray-600">This updates the same data used in your Athlete Intake</p>
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
          <div className="p-4 mb-4 rounded" style={{ backgroundColor: '#DAE2EA' }}>
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
          </div>
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

        {/* Equipment (intake-like categories) */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Section 1: Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Body Weight</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Units</label>
              <select
                value={settings.units}
                onChange={(e) => handleSettingsChange('units', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Imperial (lbs)">Imperial (lbs)</option>
                <option value="Metric (kg)">Metric (kg)</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
                <h3 className="text-lg font-semibold">The Basics</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {['Barbell','Dumbbells','Kettlebells','Pull-up Bar','Rings','Bench','Squat Rack','Open Space','Wall Space','Jump Rope','Wall Ball'].map(eq => (
                    <label key={eq} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={equipment.includes(eq)}
                        onChange={(e) => handleEquipmentChange(eq, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                      />
                      <span className="text-sm text-gray-700">{eq}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                <h3 className="text-lg font-semibold">The Machines</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {['Rowing Machine','Assault Bike','Bike','Ski Erg','Bike Erg'].map(eq => (
                    <label key={eq} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={equipment.includes(eq)}
                        onChange={(e) => handleEquipmentChange(eq, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                      />
                      <span className="text-sm text-gray-700">{eq}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4">
                <h3 className="text-lg font-semibold">Less Common Equipment</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {['GHD','Axle Bar','Climbing Rope','Pegboard','Parallette Bars','Dball','Dip Bar','Plyo Box','HS Walk Obstacle','Sandbag'].map(eq => (
                    <label key={eq} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={equipment.includes(eq)}
                        onChange={(e) => handleEquipmentChange(eq, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                      />
                      <span className="text-sm text-gray-700">{eq}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-4">
                <h3 className="text-lg font-semibold">Minimal Setup</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {['Bodyweight Only'].map(eq => (
                    <label key={eq} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={equipment.includes(eq)}
                        onChange={(e) => handleEquipmentChange(eq, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                      />
                      <span className="text-sm text-gray-700">{eq}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skills (intake-like) */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Section 2: Skills</h2>
          {skillCategories.map((category, categoryIndex) => {
            let currentIndex = 0
            for (let i = 0; i < categoryIndex; i++) {
              currentIndex += skillCategories[i].skills.length
            }
            const colors = ['from-green-600 to-green-700','from-blue-600 to-blue-700','from-purple-600 to-purple-700','from-orange-600 to-orange-700']
            const gradient = colors[categoryIndex % colors.length]
            return (
              <div key={category.name} className="border rounded-lg overflow-hidden mb-6">
                <div className="p-4 text-left" style={{ backgroundColor: '#DAE2EA' }}>
                  <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                </div>
                <div className="p-6">
                  {category.skills.map((skill, skillIndex) => {
                    const globalIndex = currentIndex + skillIndex
                    const levels = category.levels || skillLevelsFallback
                    return (
                      <div key={skill} className="mb-6 text-center">
                        <label className="block text-base font-bold text-gray-800 mb-2">{skill}</label>
                        <div className="space-y-1 text-left flex flex-col items-start sm:flex-row sm:flex-wrap gap-2">
                          {levels.map(level => (
                            <label key={level} className="flex items-center mr-4">
                              <input
                                type="radio"
                                name={`skill-${globalIndex}`}
                                value={level}
                                checked={(skills[globalIndex] || '') === level}
                                onChange={(e) => handleSkillChange(globalIndex, e.target.value)}
                                className="mr-2 h-5 w-5"
                              />
                              {level}
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* 1RM Settings (grouped like intake) */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="p-4 mb-4 rounded" style={{ backgroundColor: '#DAE2EA' }}>
            <h2 className="text-xl font-bold text-gray-900">1RM Lifts</h2>
          </div>
          <div className="space-y-6">
            <div className="border rounded-lg overflow-hidden">
              <div className="p-3" style={{ backgroundColor: '#DAE2EA' }}><h3 className="font-semibold text-gray-900">Snatch</h3></div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Snatch','Power Snatch'].map((ex) => (
                  <div key={ex}>
                    <label className="block text-sm text-gray-700 mb-2">{ex}</label>
                    <input type="number" step="0.5" value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()} onChange={(e) => handleOneRMChange(ex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="p-3" style={{ backgroundColor: '#DAE2EA' }}><h3 className="font-semibold text-gray-900">Clean and Jerk</h3></div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Clean and Jerk', 'Power Clean', 'Clean (clean only)', 'Jerk (from rack or blocks, max Split or Power Jerk)'].map((ex) => (
                  <div key={ex}>
                    <label className="block text-sm text-gray-700 mb-2">{ex}</label>
                    <input type="number" step="0.5" value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()} onChange={(e) => handleOneRMChange(ex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="p-3" style={{ backgroundColor: '#DAE2EA' }}><h3 className="font-semibold text-gray-900">Squats</h3></div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Back Squat','Front Squat','Overhead Squat'].map((ex) => (
                  <div key={ex}>
                    <label className="block text-sm text-gray-700 mb-2">{ex}</label>
                    <input type="number" step="0.5" value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()} onChange={(e) => handleOneRMChange(ex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="p-3" style={{ backgroundColor: '#DAE2EA' }}><h3 className="font-semibold text-gray-900">Pulling</h3></div>
              <div className="p-4 grid grid-cols-1 gap-4">
                {['Weighted Pullup (do not include body weight)'].map((ex) => (
                  <div key={ex}>
                    <label className="block text-sm text-gray-700 mb-2">{ex}</label>
                    <input type="number" step="0.5" value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()} onChange={(e) => handleOneRMChange(ex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="p-3" style={{ backgroundColor: '#DAE2EA' }}><h3 className="font-semibold text-gray-900">Presses</h3></div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Bench Press','Push Press','Strict Press'].map((ex) => (
                  <div key={ex}>
                    <label className="block text-sm text-gray-700 mb-2">{ex}</label>
                    <input type="number" step="0.5" value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()} onChange={(e) => handleOneRMChange(ex, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="p-4 mb-4 rounded" style={{ backgroundColor: '#DAE2EA' }}>
            <h2 className="text-xl font-bold text-gray-900">Preferences</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">3-Month Goals <span className="text-gray-500">(limit 250 characters)</span></label>
              <textarea value={threeMonthGoals} onChange={(e) => setThreeMonthGoals(e.target.value)} rows={4} maxLength={250} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Describe your goals for the next 3 months..." />
              <div className="mt-1 text-xs text-gray-500">{threeMonthGoals.length}/250</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Primary Goal <span className="text-gray-500">(limit 100 characters)</span></label>
              <input type="text" value={monthlyPrimaryGoal} onChange={(e) => setMonthlyPrimaryGoal(e.target.value)} maxLength={100} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Improve aerobic base, Pull-up strength, etc." />
              <div className="mt-1 text-xs text-gray-500">{monthlyPrimaryGoal.length}/100</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred MetCon Exercises</label>
              <div className="h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                {availableExercisesList.map((name) => (
                  <label key={`pref-${name}`} className="flex items-center space-x-2 p-1 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" checked={preferredMetconExercises.includes(name)} onChange={() => setPreferredMetconExercises(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])} />
                    <span className="text-sm text-gray-700">{name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Exercises to Avoid</label>
              <div className="h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                {availableExercisesList.map((name) => (
                  <label key={`avoid-${name}`} className="flex items-center space-x-2 p-1 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" checked={avoidedExercises.includes(name)} onChange={() => setAvoidedExercises(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])} />
                    <span className="text-sm text-gray-700">{name}</span>
                  </label>
                ))}
              </div>
            </div>
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
