import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'

interface Program {
  id: number
  user_id: number
  generated_at: string
  weeks_generated: number[]
}

interface WorkoutDay {
  programId: number
  week: number
  day: number
  dayName: string
  isDeload: boolean
  completionPercentage: number
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [currentWeek, setCurrentWeek] = useState<WorkoutDay[]>([])
  const [userName, setUserName] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/signin')
        return
      }

      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, subscription_tier')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        Alert.alert('Error', 'User data not found')
        return
      }

      setUserName(userData.email?.split('@')[0] || 'User')
      setSubscriptionTier(userData.subscription_tier || 'Premium')

      // Get programs
      const { data: programsData } = await supabase
        .from('programs')
        .select('id, user_id, generated_at, weeks_generated')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })

      if (programsData && programsData.length > 0) {
        setPrograms(programsData)

        // Get the most recent program and week
        const latestProgram = programsData[0]
        const latestWeek = Math.max(...latestProgram.weeks_generated)

        // Load workout data for the current week
        await loadWeekWorkouts(latestProgram.id, latestWeek, userData.id)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      Alert.alert('Error', 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadWeekWorkouts = async (programId: number, week: number, userId: number) => {
    try {
      const supabase = createClient()

      // Fetch workout summaries for each day
      const workouts: WorkoutDay[] = []

      for (let day = 1; day <= 5; day++) {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/workouts/${programId}/week/${week}/day/${day}`
        )

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.workout) {
            const totalExercises = data.workout.blocks.reduce(
              (sum: number, block: any) => sum + (block.exercises?.length || 0),
              0
            )

            const completedExercises = data.completions?.length || 0
            const completionPercentage = totalExercises > 0
              ? Math.round((completedExercises / totalExercises) * 100)
              : 0

            workouts.push({
              programId,
              week,
              day,
              dayName: data.workout.dayName || `Day ${day}`,
              isDeload: data.workout.isDeload || false,
              completionPercentage
            })
          }
        }
      }

      setCurrentWeek(workouts)
    } catch (error) {
      console.error('Error loading week workouts:', error)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadDashboard()
  }

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.replace('/auth/signin')
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View className="flex-1 bg-ice-blue items-center justify-center">
        <ActivityIndicator size="large" color="#FE5858" />
        <Text className="text-charcoal mt-4">Loading dashboard...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-ice-blue">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-6 pt-12 pb-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-charcoal">
              Welcome, {userName}
            </Text>
            <Text className="text-sm text-gray-600">{subscriptionTier} Plan</Text>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            className="px-4 py-2 rounded-lg border border-gray-300"
          >
            <Text className="text-charcoal text-sm">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6 py-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {currentWeek.length === 0 ? (
          <View className="bg-white rounded-lg p-8 border border-slate-blue">
            <Text className="text-xl font-semibold text-charcoal text-center mb-2">
              No Workouts Found
            </Text>
            <Text className="text-gray-600 text-center">
              Please generate your program on the web app
            </Text>
          </View>
        ) : (
          <>
            {/* Current Week Header */}
            <View className="mb-4">
              <Text className="text-xl font-bold text-charcoal mb-2">
                Week {currentWeek[0]?.week} {currentWeek[0]?.isDeload ? '(Deload)' : ''}
              </Text>
              <Text className="text-sm text-gray-600">
                Tap a workout to view details and log your training
              </Text>
            </View>

            {/* Workout Days */}
            <View className="space-y-3">
              {currentWeek.map((workout) => (
                <TouchableOpacity
                  key={workout.day}
                  onPress={() =>
                    router.push(
                      `/workout/${workout.programId}/week/${workout.week}/day/${workout.day}`
                    )
                  }
                  className="bg-white rounded-lg p-5 border-2 border-slate-blue shadow-sm"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text className="text-lg font-bold text-charcoal">
                        Day {workout.day}
                      </Text>
                      <Text className="text-sm text-gray-600">{workout.dayName}</Text>
                    </View>
                    <View className="flex-row items-center">
                      {workout.completionPercentage === 100 ? (
                        <View className="bg-green-100 px-3 py-1 rounded-full">
                          <Text className="text-green-800 font-semibold text-xs">
                            ✓ Complete
                          </Text>
                        </View>
                      ) : workout.completionPercentage > 0 ? (
                        <View className="bg-yellow-100 px-3 py-1 rounded-full">
                          <Text className="text-yellow-800 font-semibold text-xs">
                            {workout.completionPercentage}% Done
                          </Text>
                        </View>
                      ) : (
                        <View className="bg-slate-blue px-3 py-1 rounded-full">
                          <Text className="text-charcoal font-semibold text-xs">
                            Not Started
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View className="w-full bg-slate-blue rounded-full h-2">
                    <View
                      className="h-2 rounded-full bg-coral"
                      style={{ width: `${workout.completionPercentage}%` }}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Week Summary */}
            <View className="bg-white rounded-lg p-5 border border-slate-blue mt-6">
              <Text className="text-lg font-bold text-charcoal mb-3">
                Week Progress
              </Text>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-2xl font-bold text-coral">
                    {currentWeek.filter(w => w.completionPercentage === 100).length}
                  </Text>
                  <Text className="text-sm text-gray-600">Completed</Text>
                </View>
                <View>
                  <Text className="text-2xl font-bold text-yellow-600">
                    {currentWeek.filter(w => w.completionPercentage > 0 && w.completionPercentage < 100).length}
                  </Text>
                  <Text className="text-sm text-gray-600">In Progress</Text>
                </View>
                <View>
                  <Text className="text-2xl font-bold text-gray-400">
                    {currentWeek.filter(w => w.completionPercentage === 0).length}
                  </Text>
                  <Text className="text-sm text-gray-600">Not Started</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View className="mt-6 space-y-3">
              <TouchableOpacity
                className="bg-coral py-4 rounded-lg"
                onPress={() => {
                  const nextIncomplete = currentWeek.find(w => w.completionPercentage < 100)
                  if (nextIncomplete) {
                    router.push(
                      `/workout/${nextIncomplete.programId}/week/${nextIncomplete.week}/day/${nextIncomplete.day}`
                    )
                  }
                }}
              >
                <Text className="text-white text-center font-semibold text-base">
                  Continue Training →
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
