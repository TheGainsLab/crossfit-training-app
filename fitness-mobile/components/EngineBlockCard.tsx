import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
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

  // Helper function to format dayType for display (convert snake_case to Title Case)
  const getWorkoutTypeDisplayName = (dayType: string): string => {
    const typeMap: Record<string, string> = {
      'time_trial': 'Time Trial',
      'endurance': 'Endurance',
      'anaerobic': 'Anaerobic',
      'max_aerobic_power': 'Max Aerobic Power',
      'interval': 'Interval',
      'polarized': 'Polarized',
      'threshold': 'Threshold',
      'tempo': 'Tempo',
      'recovery': 'Recovery',
      'flux': 'Flux',
      'flux_stages': 'Flux Stages',
      'devour': 'Devour',
      'towers': 'Towers',
      'afterburner': 'Afterburner',
      'synthesis': 'Synthesis',
      'hybrid_anaerobic': 'Hybrid Anaerobic',
      'hybrid_aerobic': 'Hybrid Aerobic',
      'ascending': 'Ascending',
      'descending': 'Descending',
      'ascending_devour': 'Ascending Devour',
      'descending_devour': 'Descending Devour',
      'infinity': 'Infinity',
      'atomic': 'Atomic',
      'rocket_races_a': 'Rocket Races A',
      'rocket_races_b': 'Rocket Races B'
    }
    return typeMap[dayType] || dayType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Conditioning'
  }

  useFocusEffect(
    React.useCallback(() => {
      const checkCompletion = async () => {
        console.log('🔍 ENGINE CHECK - dayNumber:', engineDayNumber)
        
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

          console.log('🔍 ENGINE CHECK - Querying for user_id:', (userData as any).id, 'program_day_number:', engineDayNumber)

          // Check workout_sessions for completion
          const { data: session } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', (userData as any).id)
            .eq('program_day_number', engineDayNumber)
            .eq('completed', true)
            .limit(1)
            .maybeSingle()

          console.log('🔍 ENGINE CHECK - Result:', session ? 'FOUND ✅' : 'NOT FOUND ❌', 'Session:', session)

          setIsCompleted(!!session)
        } catch (error) {
          console.error('Error checking Engine completion:', error)
        }
      }

      if (engineDayNumber) {
        checkCompletion()
      }
    }, [engineDayNumber])
  )

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
            <Text style={styles.title}>{getWorkoutTypeDisplayName(engineData.dayType)}</Text>
            <Text style={styles.subtitle}>Day {engineData.dayNumber}</Text>
          </View>
          {isCompleted && <Text style={styles.checkmark}>✅</Text>}
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
