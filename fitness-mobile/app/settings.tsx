import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  StyleSheet
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'

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

const oneRMExercises = [
  'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean',
  'Clean (clean only)', 'Jerk (from rack or blocks, max Split or Power Jerk)',
  'Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift',
  'Bench Press', 'Push Press', 'Strict Press', 'Weighted Pullup (do not include body weight)'
]

const basicsEquipment = [
  'Barbell', 'Dumbbells', 'Kettlebells', 'Pullup Bar or Rig', 'High Rings', 'Low or Adjustable Rings',
  'Bench', 'Squat Rack', 'Open Space', 'Wall Space', 'Jump Rope', 'Wall Ball'
]

const machinesEquipment = ['Rowing Machine', 'Air Bike', 'Ski Erg', 'Bike Erg']
const lessCommonEquipment = ['GHD', 'Axle Bar', 'Climbing Rope', 'Pegboard', 'Parallettes', 'Dball', 'Dip Bar', 'Plyo Box', 'HS Walk Obstacle', 'Sandbag']

const airBikeTypes = [
  'Assault Bike', 'Rogue Echo Bike', 'Schwinn Airdyne',
  'Concept2 BikeErg', 'Other'
]

const unitsOptions = ['Imperial (lbs)', 'Metric (kg)']
const genderOptions = ['Male', 'Female', 'Prefer not to say']

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

export default function SettingsPage() {
  const router = useRouter()
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

  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

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
      const { data: oneRMData } = await supabase
        .from('user_one_rms')
        .select('exercise_name, one_rm')
        .eq('user_id', userData.id)

      const oneRMMap = new Map(
        (oneRMData || []).map((rm: { exercise_name: string; one_rm: number }) => [rm.exercise_name, Number(rm.one_rm) || 0])
      )
      const allOneRMs: OneRM[] = oneRMExercises.map((exercise: string) => ({
        exercise_name: exercise,
        one_rm: Number(oneRMMap.get(exercise) ?? 0)
      }))
      setOneRMs(allOneRMs)

      // Load equipment
      const { data: equipmentData } = await supabase
        .from('user_equipment')
        .select('equipment_name')
        .eq('user_id', userData.id)

      const rawEquip = (equipmentData?.map((eq: { equipment_name: string | null }) => eq.equipment_name) || []) as (string | null)[]
      const normalized = new Set<string>()
      rawEquip.forEach((name: string | null) => {
        if (!name) return
        const n = name.trim()
        if (n === 'Assault Bike') normalized.add('Air Bike')
        else if (n === 'Bike') normalized.add('Bike Erg')
        else if (n === 'Pull-up Bar' || n === 'Pull up Bar' || n === 'Pullup Bar') normalized.add('Pullup Bar or Rig')
        else if (n === 'Rings') { normalized.add('High Rings'); normalized.add('Low or Adjustable Rings') }
        else if (n === 'Parallette Bars') normalized.add('Parallettes')
        else normalized.add(n)
      })
      setEquipment(Array.from(normalized))

      // Load skills
      const { data: skillsData } = await supabase
        .from('user_skills')
        .select('skill_name, skill_level')
        .eq('user_id', userData.id)
        .order('skill_index')

      const allSkills: string[] = []
      skillCategories.forEach((category) => {
        category.skills.forEach((skillName) => {
          const userSkill = skillsData?.find((s: { skill_name: string; skill_level: string }) => s.skill_name === skillName)
          allSkills.push(userSkill?.skill_level || "Don't have it")
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
        const equipmentRecords = equipment.map(equipmentName => ({
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
          if (skillLevel && skillLevel !== "Don't have it" && skillLevel !== 'Unable to perform') {
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
      Alert.alert('Success', 'Settings saved successfully!')
      setSaving(false)
    } catch (err) {
      console.error('Error saving settings:', err)
      setMessage('Failed to save settings')
      Alert.alert('Error', 'Failed to save settings. Please try again.')
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    console.log('Sign out button pressed') // Debug log
    try {
      console.log('Attempting sign out...') // Debug log
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        Alert.alert('Error', 'Failed to sign out. Please try again.')
        return
      }
      console.log('Sign out successful, navigating...') // Debug log
      router.replace('/auth/signin')
    } catch (err) {
      console.error('Sign out exception:', err)
      Alert.alert('Error', 'Failed to sign out. Please try again.')
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.errorButton}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Update your athlete profile</Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
          >
            Done
          </Button>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Success Message */}
        {message && (
          <Card style={[
            styles.messageCard,
            message.includes('success') ? styles.messageCardSuccess : styles.messageCardError
          ]}>
            <Text style={[
              styles.messageText,
              message.includes('success') ? styles.messageTextSuccess : styles.messageTextError
            ]}>
              {message}
            </Text>
          </Card>
        )}

        {/* Basic Information */}
        <Card style={styles.sectionCard}>
          <SectionHeader title="Basic Information" />
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={settings.name}
              onChangeText={(value) => handleSettingsChange('name', value)}
              style={styles.input}
              placeholder="Your name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={settings.email}
              editable={false}
              style={[styles.input, styles.inputDisabled]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Body Weight ({settings.units === 'Metric (kg)' ? 'kg' : 'lbs'})
            </Text>
            <TextInput
              value={settings.body_weight?.toString() || ''}
              onChangeText={(value) => handleSettingsChange('body_weight', value ? parseFloat(value) : null)}
              keyboardType="numeric"
              style={styles.input}
              placeholder={settings.units === 'Metric (kg)' ? 'e.g., 70.5' : 'e.g., 155.5'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Units</Text>
            <View style={styles.pickerRow}>
              {unitsOptions.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.pickerOption,
                    settings.units === unit && styles.pickerOptionSelected
                  ]}
                  onPress={() => handleSettingsChange('units', unit)}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    settings.units === unit && styles.pickerOptionTextSelected
                  ]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.pickerRow}>
              {genderOptions.map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.pickerOption,
                    settings.gender === gender && styles.pickerOptionSelected
                  ]}
                  onPress={() => handleSettingsChange('gender', gender)}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    settings.gender === gender && styles.pickerOptionTextSelected
                  ]}>
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Equipment */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Equipment</Text>
          
          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentCategoryTitle}>The Basics</Text>
            <View style={styles.equipmentGrid}>
              {basicsEquipment.map(eq => (
                <View key={eq} style={styles.equipmentItem}>
                  <View style={styles.equipmentRow}>
                    <Switch
                      value={equipment.includes(eq)}
                      onValueChange={(checked) => handleEquipmentChange(eq, checked)}
                      trackColor={{ false: '#DAE2EA', true: '#FE5858' }}
                      thumbColor={equipment.includes(eq) ? '#fff' : '#f4f3f4'}
                    />
                    <Text style={styles.equipmentLabel}>{eq}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentCategoryTitle}>The Machines</Text>
            <View style={styles.equipmentGrid}>
              {machinesEquipment.map(eq => (
                <View key={eq} style={styles.equipmentItem}>
                  <View style={styles.equipmentRow}>
                    <Switch
                      value={equipment.includes(eq)}
                      onValueChange={(checked) => handleEquipmentChange(eq, checked)}
                      trackColor={{ false: '#DAE2EA', true: '#FE5858' }}
                      thumbColor={equipment.includes(eq) ? '#fff' : '#f4f3f4'}
                    />
                    <Text style={styles.equipmentLabel}>{eq}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentCategoryTitle}>Less Common Equipment</Text>
            <View style={styles.equipmentGrid}>
              {lessCommonEquipment.map(eq => (
                <View key={eq} style={styles.equipmentItem}>
                  <View style={styles.equipmentRow}>
                    <Switch
                      value={equipment.includes(eq)}
                      onValueChange={(checked) => handleEquipmentChange(eq, checked)}
                      trackColor={{ false: '#DAE2EA', true: '#FE5858' }}
                      thumbColor={equipment.includes(eq) ? '#fff' : '#f4f3f4'}
                    />
                    <Text style={styles.equipmentLabel}>{eq}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* Skills */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Skills</Text>
          {skillCategories.map((category, categoryIndex) => {
            let currentIndex = 0
            for (let i = 0; i < categoryIndex; i++) {
              currentIndex += skillCategories[i].skills.length
            }
            return (
              <View key={category.name} style={styles.skillCategory}>
                <Text style={styles.skillCategoryTitle}>{category.name}</Text>
                {category.skills.map((skill, skillIndex) => {
                  const globalIndex = currentIndex + skillIndex
                  const levels = category.levels
                  const currentValue = skills[globalIndex] || "Don't have it"
                  return (
                    <View key={skill} style={styles.skillItem}>
                      <Text style={styles.skillName}>{skill}</Text>
                      <View style={styles.skillLevels}>
                        {/* First row: first two buttons side-by-side */}
                        <View style={styles.skillLevelRow}>
                          {levels.slice(0, 2).map((level) => {
                            const isSelected = currentValue === level
                            return (
                              <TouchableOpacity
                                key={level}
                                onPress={() => handleSkillChange(globalIndex, level)}
                                style={[
                                  styles.skillLevelButton,
                                  isSelected ? styles.skillLevelButtonSelected : styles.skillLevelButtonUnselected
                                ]}
                              >
                                <Text style={[
                                  styles.skillLevelText,
                                  isSelected ? styles.skillLevelTextSelected : styles.skillLevelTextUnselected
                                ]}>
                                  {level}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                        {/* Second row: third button alone */}
                        {levels[2] && (
                          <View style={styles.skillLevelRow}>
                            <TouchableOpacity
                              onPress={() => handleSkillChange(globalIndex, levels[2])}
                              style={[
                                styles.skillLevelButton,
                                currentValue === levels[2] ? styles.skillLevelButtonSelected : styles.skillLevelButtonUnselected
                              ]}
                            >
                              <Text style={[
                                styles.skillLevelText,
                                currentValue === levels[2] ? styles.skillLevelTextSelected : styles.skillLevelTextUnselected
                              ]}>
                                {levels[2]}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {/* Third row: fourth button alone */}
                        {levels[3] && (
                          <View style={styles.skillLevelRow}>
                            <TouchableOpacity
                              onPress={() => handleSkillChange(globalIndex, levels[3])}
                              style={[
                                styles.skillLevelButton,
                                currentValue === levels[3] ? styles.skillLevelButtonSelected : styles.skillLevelButtonUnselected
                              ]}
                            >
                              <Text style={[
                                styles.skillLevelText,
                                currentValue === levels[3] ? styles.skillLevelTextSelected : styles.skillLevelTextUnselected
                              ]}>
                                {levels[3]}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </Card>

        {/* Section 3: Conditioning Benchmarks */}
        <Card style={styles.sectionCard}>
          <SectionHeader 
            title="Section 3: Conditioning Benchmarks"
            subtitle="Enter times in MM:SS format (e.g., 7:30). Leave blank if not recently performed."
          />
          
          {/* Running Benchmarks */}
          <View style={styles.benchmarkGroup}>
            <View style={styles.benchmarkHeader}>
              <Text style={styles.benchmarkHeaderText}>Running Benchmarks</Text>
            </View>
            <View>
              <View style={styles.benchmarkInputGroup}>
                <Text style={styles.benchmarkLabel}>1 Mile Run (MM:SS)</Text>
                <TextInput
                  value={settings.conditioning_benchmarks?.mile_run || ''}
                  onChangeText={(value) => handleBenchmarkChange('mile_run', value)}
                  placeholder="MM:SS"
                  style={styles.benchmarkInput}
                />
              </View>
              <View style={styles.benchmarkInputGroup}>
                <Text style={styles.benchmarkLabel}>5K Run (MM:SS)</Text>
                <TextInput
                  value={settings.conditioning_benchmarks?.five_k_run || ''}
                  onChangeText={(value) => handleBenchmarkChange('five_k_run', value)}
                  placeholder="MM:SS"
                  style={styles.benchmarkInput}
                />
              </View>
              <View style={styles.benchmarkInputGroup}>
                <Text style={styles.benchmarkLabel}>10K Run (MM:SS)</Text>
                <TextInput
                  value={settings.conditioning_benchmarks?.ten_k_run || ''}
                  onChangeText={(value) => handleBenchmarkChange('ten_k_run', value)}
                  placeholder="MM:SS"
                  style={styles.benchmarkInput}
                />
              </View>
            </View>
          </View>

          {/* Rowing Benchmarks */}
          <View style={styles.benchmarkGroup}>
            <View style={styles.benchmarkHeader}>
              <Text style={styles.benchmarkHeaderText}>Rowing Benchmarks</Text>
            </View>
            <View>
              <View style={styles.benchmarkInputGroup}>
                <Text style={styles.benchmarkLabel}>1K Row (MM:SS)</Text>
                <TextInput
                  value={settings.conditioning_benchmarks?.one_k_row || ''}
                  onChangeText={(value) => handleBenchmarkChange('one_k_row', value)}
                  placeholder="MM:SS"
                  style={styles.benchmarkInput}
                />
              </View>
              <View style={styles.benchmarkInputGroup}>
                <Text style={styles.benchmarkLabel}>2K Row (MM:SS)</Text>
                <TextInput
                  value={settings.conditioning_benchmarks?.two_k_row || ''}
                  onChangeText={(value) => handleBenchmarkChange('two_k_row', value)}
                  placeholder="MM:SS"
                  style={styles.benchmarkInput}
                />
              </View>
              <View style={styles.benchmarkInputGroup}>
                <Text style={styles.benchmarkLabel}>5K Row (MM:SS)</Text>
                <TextInput
                  value={settings.conditioning_benchmarks?.five_k_row || ''}
                  onChangeText={(value) => handleBenchmarkChange('five_k_row', value)}
                  placeholder="MM:SS"
                  style={styles.benchmarkInput}
                />
              </View>
            </View>
          </View>

          {/* Bike Benchmarks */}
          <View style={styles.benchmarkGroup}>
            <View style={styles.benchmarkHeader}>
              <Text style={styles.benchmarkHeaderText}>Bike Benchmarks</Text>
            </View>
            <View>
              <Text style={styles.benchmarkLabel}>10-Minute Air Bike (calories)</Text>
              <TextInput
                value={settings.conditioning_benchmarks?.ten_min_air_bike || ''}
                onChangeText={(value) => handleBenchmarkChange('ten_min_air_bike', value)}
                keyboardType="numeric"
                placeholder="185"
                style={[styles.benchmarkInput, styles.benchmarkInputWithMargin]}
              />
              {settings.conditioning_benchmarks?.ten_min_air_bike?.trim() && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.benchmarkLabel}>Air Bike Type</Text>
                  <View style={styles.pickerRow}>
                    {airBikeTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.pickerOption,
                          settings.conditioning_benchmarks?.air_bike_type === type && styles.pickerOptionSelected
                        ]}
                        onPress={() => handleBenchmarkChange('air_bike_type', type)}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          settings.conditioning_benchmarks?.air_bike_type === type && styles.pickerOptionTextSelected
                        ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* 1RM Lifts */}
        <Card style={styles.sectionCard}>
          <SectionHeader title="1RM Lifts" />
          
          <View style={styles.liftGroup}>
            <Text style={styles.liftGroupTitle}>Snatch</Text>
            {['Snatch', 'Power Snatch'].map((ex) => (
              <View key={ex} style={styles.liftInputGroup}>
                <Text style={styles.liftLabel}>{ex}</Text>
                <TextInput
                  value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()}
                  onChangeText={(value) => handleOneRMChange(ex, value)}
                  keyboardType="numeric"
                  style={styles.liftInput}
                  placeholder="0"
                />
              </View>
            ))}
          </View>

          <View style={styles.liftGroup}>
            <Text style={styles.liftGroupTitle}>Clean and Jerk</Text>
            {['Clean and Jerk', 'Power Clean', 'Clean (clean only)', 'Jerk (from rack or blocks, max Split or Power Jerk)'].map((ex) => (
              <View key={ex} style={styles.liftInputGroup}>
                <Text style={styles.liftLabel}>{ex}</Text>
                <TextInput
                  value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()}
                  onChangeText={(value) => handleOneRMChange(ex, value)}
                  keyboardType="numeric"
                  style={styles.liftInput}
                  placeholder="0"
                />
              </View>
            ))}
          </View>

          <View style={styles.liftGroup}>
            <Text style={styles.liftGroupTitle}>Squats</Text>
            {['Back Squat', 'Front Squat', 'Overhead Squat'].map((ex) => (
              <View key={ex} style={styles.liftInputGroup}>
                <Text style={styles.liftLabel}>{ex}</Text>
                <TextInput
                  value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()}
                  onChangeText={(value) => handleOneRMChange(ex, value)}
                  keyboardType="numeric"
                  style={styles.liftInput}
                  placeholder="0"
                />
              </View>
            ))}
          </View>

          <View style={styles.liftGroup}>
            <Text style={styles.liftGroupTitle}>Pulling</Text>
            {['Weighted Pullup (do not include body weight)', 'Deadlift'].map((ex) => (
              <View key={ex} style={styles.liftInputGroup}>
                <Text style={styles.liftLabel}>{ex}</Text>
                <TextInput
                  value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()}
                  onChangeText={(value) => handleOneRMChange(ex, value)}
                  keyboardType="numeric"
                  style={styles.liftInput}
                  placeholder="0"
                />
              </View>
            ))}
          </View>

          <View style={styles.liftGroup}>
            <Text style={styles.liftGroupTitle}>Presses</Text>
            {['Bench Press', 'Push Press', 'Strict Press'].map((ex) => (
              <View key={ex} style={styles.liftInputGroup}>
                <Text style={styles.liftLabel}>{ex}</Text>
                <TextInput
                  value={(oneRMs.find(r => r.exercise_name === ex)?.one_rm || 0).toString()}
                  onChangeText={(value) => handleOneRMChange(ex, value)}
                  keyboardType="numeric"
                  style={styles.liftInput}
                  placeholder="0"
                />
              </View>
            ))}
          </View>
        </Card>

        {/* Save Button */}
        <Button
          variant="primary"
          size="lg"
          onPress={saveSettings}
          disabled={saving}
          loading={saving}
          style={styles.saveButton}
        >
          Save All Changes
        </Button>

        {/* Sign Out Section */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#282B34',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  errorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FE5858',
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#4B5563',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  messageCard: {
    marginBottom: 16,
    padding: 16,
  },
  messageCardSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  messageCardError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  messageText: {
    fontWeight: '600',
  },
  messageTextSuccess: {
    color: '#166534',
  },
  messageTextError: {
    color: '#991B1B',
  },
  sectionCard: {
    padding: 20,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
  },
  picker: {
    backgroundColor: '#FFFFFF',
  },
  pickerContainer: {
    marginTop: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minWidth: 100,
  },
  pickerOptionSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 16,
  },
  equipmentSection: {
    marginBottom: 24,
  },
  equipmentCategoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  equipmentItem: {
    width: '50%',
    marginBottom: 12,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  skillCategory: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DAE2EA',
    borderRadius: 8,
    padding: 16,
  },
  skillCategoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  skillItem: {
    marginBottom: 16,
  },
  skillName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  skillLevels: {
    flexDirection: 'column',
    gap: 8,
  },
  skillLevelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skillLevelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  skillLevelButtonSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  skillLevelButtonUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  skillLevelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  skillLevelTextSelected: {
    color: '#FFFFFF',
  },
  skillLevelTextUnselected: {
    color: '#374151',
  },
  benchmarkGroup: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DAE2EA',
    borderRadius: 8,
    padding: 16,
  },
  benchmarkHeader: {
    backgroundColor: '#DAE2EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  benchmarkHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    textAlign: 'center',
  },
  benchmarkInputGroup: {
    marginBottom: 12,
  },
  benchmarkLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  benchmarkInput: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  benchmarkInputWithMargin: {
    marginBottom: 12,
  },
  liftGroup: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DAE2EA',
    borderRadius: 8,
    padding: 16,
  },
  liftGroupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  liftInputGroup: {
    marginBottom: 12,
  },
  liftLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  liftInput: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  saveButton: {
    width: '100%',
    marginBottom: 24,
  },
  signOutButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
