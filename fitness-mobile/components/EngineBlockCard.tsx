import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'

interface EngineBlockCardProps {
  engineData?: {
    workoutId: string
    dayNumber: number
    dayType: string
    duration: number
    blockCount: number
    blockParams: {
      block1: any
      block2: any
      block3: any
      block4: any
    }
  }
  engineDayNumber: number
}

export default function EngineBlockCard({
  engineData,
  engineDayNumber
}: EngineBlockCardProps) {
  const router = useRouter()
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    const checkCompletion = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (!userData) return

        // Check workout_sessions for completion
        const { data: session } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('user_id', userData.id)
          .eq('program_day_number', engineDayNumber)
          .eq('completed', true)
          .limit(1)
          .maybeSingle()

        setIsCompleted(!!session)
      } catch (error) {
        console.error('Error checking Engine completion:', error)
      }
    }

    if (engineDayNumber) {
      checkCompletion()
    }
  }, [engineDayNumber])

  if (!engineData) return null

  const handleStartWorkout = () => {
    // Navigate to Engine UI with the specific day number
    router.push(`/engine?day=${engineDayNumber}`)
  }

  return (
    <View className="bg-white rounded-xl shadow-sm border-2 border-slate-blue mb-4">
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xl font-bold text-charcoal">Engine Conditioning</Text>
            <Text className="text-sm text-gray-600">Day {engineData.dayNumber}</Text>
          </View>
          {isCompleted && <Text className="text-coral text-2xl">✅</Text>}
        </View>

        <View className="mb-4">
          <View className="flex-row items-center mb-3">
            <Text className="text-sm font-medium text-charcoal">Type: </Text>
            <Text className="text-sm text-gray-700 capitalize">{engineData.dayType}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-sm font-medium text-charcoal">Duration: </Text>
            <Text className="text-sm text-gray-700">{engineData.duration} minutes</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleStartWorkout}
          className="w-full bg-coral py-3 px-6 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">
            {isCompleted ? 'View Engine Workout' : 'Start Engine Workout'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
