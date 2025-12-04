import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
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
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Engine Conditioning</Text>
            <Text style={styles.subtitle}>Day {engineData.dayNumber}</Text>
          </View>
          {isCompleted && <Text style={styles.checkmark}>✅</Text>}
        </View>

        <View style={styles.info}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type: </Text>
            <Text style={styles.infoValue}>{engineData.dayType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration: </Text>
            <Text style={styles.infoValue}>{engineData.duration} minutes</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleStartWorkout}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {isCompleted ? 'View Engine Workout' : 'Start Engine Workout'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 2,
    borderColor: '#DAE2EA',
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  checkmark: {
    color: '#FE5858',
    fontSize: 24,
  },
  info: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#282B34',
  },
  infoValue: {
    fontSize: 14,
    color: '#374151',
    textTransform: 'capitalize',
  },
  button: {
    width: '100%',
    backgroundColor: '#FE5858',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
})
