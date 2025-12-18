import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import {
  fetchProgramSummaries,
  ProgramSummary,
  WeekSummary,
  DaySummary,
} from '@/lib/api/programs'
import { Card } from '@/components/ui/Card'

export default function ProgramPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadPrograms()
    }
  }, [userId])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/signin')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        setUserId(userData.id)
      }
    } catch (error) {
      console.error('Error loading user:', error)
      setError('Failed to load user data')
      setLoading(false)
    }
  }

  const loadPrograms = async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)
      const summaries = await fetchProgramSummaries(userId)
      setPrograms(summaries)
    } catch (err: any) {
      console.error('Error loading programs:', err)
      setError(err.message || 'Failed to load program overview')
    } finally {
      setLoading(false)
    }
  }

  const toggleMonth = (monthIndex: number) => {
    setExpandedMonths((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(monthIndex)) {
        newSet.delete(monthIndex)
      } else {
        newSet.add(monthIndex)
      }
      return newSet
    })
  }

  const handleDayPress = (programId: number, week: number, day: number) => {
    router.push(`/workout/${programId}/week/${week}/day/${day}`)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333333" />
        <Text style={styles.loadingText}>
          Loading your training programs...
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.errorButton}
          >
            <Text style={styles.errorButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color="#F8FBFE" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {programs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No training programs found. Generate a program to get started!
            </Text>
          </Card>
        ) : (
          <View style={styles.programsList}>
            {programs.map((program) => {
              const isExpanded = expandedMonths.has(program.monthIndex)
              return (
                <Card key={program.id} style={styles.programCard}>
                  <TouchableOpacity
                    onPress={() => toggleMonth(program.monthIndex)}
                    style={styles.programHeader}
                    activeOpacity={0.7}
                  >
                    <View style={styles.programHeaderLeft}>
                      <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                      <Text style={styles.programTitle}>
                        Month {program.monthIndex}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.programDate}>
                    Generated{' '}
                    {new Date(program.generatedAt).toLocaleDateString()}
                  </Text>

                  {isExpanded && (
                    <View style={styles.weeksContainer}>
                      {program.weeks.map((week) => (
                        <WeekCard
                          key={week.week}
                          week={week}
                          programId={program.id}
                          onDayPress={handleDayPress}
                        />
                      ))}
                    </View>
                  )}
                </Card>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// Week Card Component
function WeekCard({
  week,
  programId,
  onDayPress,
}: {
  week: WeekSummary
  programId: number
  onDayPress: (programId: number, week: number, day: number) => void
}) {
  return (
    <Card style={styles.weekCard}>
      <Text style={styles.weekTitle}>Week {week.week}</Text>

      <View style={styles.daysContainer}>
        {week.days.map((day) => (
          <DayCard
            key={day.day}
            day={day}
            programId={programId}
            week={week.week}
            onPress={onDayPress}
          />
        ))}
      </View>
    </Card>
  )
}

// Day Card Component
function DayCard({
  day,
  programId,
  week,
  onPress,
}: {
  day: DaySummary
  programId: number
  week: number
  onPress: (programId: number, week: number, day: number) => void
}) {
  const isComplete = day.totalExercises > 0 && day.completed >= day.totalExercises
  const isInProgress = day.completed > 0 && day.completed < day.totalExercises

  return (
    <TouchableOpacity
      onPress={() => onPress(programId, week, day.day)}
      activeOpacity={0.7}
      style={[
        styles.dayCard,
        isComplete ? styles.dayCardComplete : isInProgress ? styles.dayCardInProgress : styles.dayCardNotStarted
      ]}
    >
      <View style={styles.dayCardContent}>
        <Text style={styles.dayName}>{day.dayName}</Text>
        {/* Status indicator */}
        {isComplete && (
          <View style={styles.statusIndicatorComplete}>
            <Text style={styles.statusIndicatorText}>✓</Text>
          </View>
        )}
        {isInProgress && (
          <View style={styles.statusIndicatorProgress} />
        )}
        {!isComplete && !isInProgress && (
          <View style={styles.statusIndicatorNotStarted} />
        )}
      </View>
      <Text style={styles.dayProgress}>
        {day.completed}/{day.totalExercises}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#4B5563',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorContent: {
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    marginBottom: 16,
    fontSize: 16,
  },
  errorButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    paddingVertical: 16,
    paddingTop: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE5858',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#282B34',
  },
  backButtonText: {
    color: '#F8FBFE',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#4B5563',
    textAlign: 'center',
    fontSize: 16,
  },
  programsList: {
    gap: 16,
  },
  programCard: {
    padding: 20,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  programHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandIcon: {
    fontSize: 20,
    color: '#FE5858',
  },
  programTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  programDate: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
    marginLeft: 32,
  },
  weeksContainer: {
    gap: 16,
  },
  weekCard: {
    padding: 16,
    marginBottom: 16,
    borderColor: '#FE5858',
    borderWidth: 2,
  },
  weekTitle: {
    fontWeight: '700',
    color: '#FE5858',
    fontSize: 18,
    marginBottom: 16,
  },
  daysContainer: {
    gap: 8,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  dayCardComplete: {
    borderColor: '#10B981',
  },
  dayCardInProgress: {
    borderColor: '#F59E0B',
  },
  dayCardNotStarted: {
    borderColor: '#E5E7EB',
  },
  dayCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    flex: 1,
  },
  statusIndicatorComplete: {
    height: 24,
    width: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#10B981',
  },
  statusIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  statusIndicatorProgress: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
  },
  statusIndicatorNotStarted: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  dayProgress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
})
