import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import engineDatabaseService from '@/lib/engine/databaseService'
import { getUserCurrentProgram, type EngineProgram } from '@/lib/api/enginePrograms'

interface DashboardProps {
  onDayClick: (dayNumber: number, dayType?: string) => void
  onAnalyticsClick: () => void
  showTrainingView?: boolean
  onTrainingViewShown?: () => void
  initialMonth?: number
  onBackToWeekView?: () => void
}

type InternalView = 'main' | 'months' | 'month-days'

export default function Dashboard({
  onDayClick,
  onAnalyticsClick,
  showTrainingView = false,
  onTrainingViewShown,
  initialMonth,
  onBackToWeekView
}: DashboardProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || 1)
  const [workouts, setWorkouts] = useState<any[]>([])
  const [completedSessions, setCompletedSessions] = useState<any[]>([])
  const [programVersion, setProgramVersion] = useState<string | null>(null)
  const [currentProgram, setCurrentProgram] = useState<EngineProgram | null>(null)
  const [internalView, setInternalView] = useState<InternalView>('main')

  // Helper functions - defined before being used
  const getDaysPerMonth = () => {
    if (!currentProgram) return 20
    
    // For shorter programs (High Rocks, VO2Maximizer), calculate days per month
    const totalDays = currentProgram.total_days
    const daysPerWeek = currentProgram.frequency_per_week
    
    // Calculate approximate days per month (4 weeks)
    return daysPerWeek * 4
  }

  const getDaysPerWeek = () => {
    return currentProgram?.frequency_per_week || 5
  }

  // Memoize totalMonths calculation
  const totalMonths = useMemo(() => {
    if (!currentProgram) return 36
    return Math.ceil(currentProgram.total_days / getDaysPerMonth())
  }, [currentProgram])

  const loadProgramVersion = useCallback(async () => {
    if (!engineDatabaseService.isConnected()) return null

    try {
      const programId = await engineDatabaseService.loadProgramVersion()
      const finalProgramId = programId || 'main_5day'
      setProgramVersion(finalProgramId)
      
      // Fetch program details
      const userId = engineDatabaseService.getUserId()
      if (userId) {
        const { program } = await getUserCurrentProgram(parseInt(userId))
        if (program) {
          setCurrentProgram(program)
        }
      }
      
      return finalProgramId
    } catch (error) {
      console.error('Error loading program version:', error)
      const defaultProgramId = 'main_5day'
      setProgramVersion(defaultProgramId)
      return defaultProgramId
    }
  }, [])

  const loadUserDataAndSessions = useCallback(async () => {
    if (!engineDatabaseService.isConnected()) return

    setLoading(true)
    try {
      const programId = await engineDatabaseService.loadProgramVersion()
      const userProgramId = programId || 'main_5day'
      setProgramVersion(prev => prev || userProgramId)

      // Load program metadata
      const userId = engineDatabaseService.getUserId()
      if (userId) {
        const { program } = await getUserCurrentProgram(parseInt(userId))
        if (program) {
          setCurrentProgram(program)
        }
      }

      const [progress, workoutsData] = await Promise.all([
        engineDatabaseService.loadUserProgress(),
        engineDatabaseService.getWorkoutsForProgram(userProgramId)
      ])

      if (progress.user) {
        setUser(progress.user)
      }

      // Filter sessions for current program
      const allSessions = progress.completedSessions || []
      const filteredSessions = allSessions.filter((session: any) => {
        const sessionProgramVersion = session.program_version || '5-day'
        // Derive expected program version from current program (backward compatible)
        const expectedProgramVersion = currentProgram?.frequency_per_week === 3 ? '3-day' : '5-day'
        // Include sessions that match or have no version set (backward compatibility)
        return !session.program_version || sessionProgramVersion === expectedProgramVersion
      })

      setCompletedSessions(filteredSessions)
      setWorkouts(workoutsData || [])
    } catch (error) {
      console.error('Failed to load user data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (engineDatabaseService.isConnected()) {
      loadUserDataAndSessions()
      loadProgramVersion()
    }
  }, [loadUserDataAndSessions, loadProgramVersion])

  useEffect(() => {
    if (showTrainingView && internalView === 'main') {
      setInternalView('months')
      onTrainingViewShown?.()
    }
  }, [showTrainingView, internalView, onTrainingViewShown])

  const getDayStatus = (workout: any) => {
    if (!workout) return 'upcoming'

    const dayNumber = workout.program_day_number || workout.day_number

    const isCompleted = completedSessions.some((session: any) =>
      session.program_day_number === dayNumber ||
      session.day_number === dayNumber
    )

    return isCompleted ? 'completed' : 'upcoming'
  }

  const getMonthAccess = (monthNumber: number) => {
    const daysPerMonth = getDaysPerMonth()

    if (!user) {
      return monthNumber === 1
    }

    // Check engine_months_unlocked (correct field name from database)
    if (user.engine_months_unlocked >= 36) {
      return true
    }

    // For inactive/trial users, only allow first month
    if (user.subscription_status === 'INACTIVE' || user.subscription_status === 'trial') {
      return monthNumber === 1
    }

    // For active users, allow based on current day progression or months unlocked
    if (user.subscription_status === 'ACTIVE' || user.subscription_status === 'active') {
      const maxMonth = Math.ceil((user.engine_current_day || 1) / daysPerMonth)
      return monthNumber <= Math.max(maxMonth, user.engine_months_unlocked || 1)
    }

    return monthNumber === 1
  }

  const getMonthCompletionRatio = (monthNumber: number) => {
    const daysPerMonth = getDaysPerMonth()
    const startDay = (monthNumber - 1) * daysPerMonth + 1
    const endDay = monthNumber * daysPerMonth

    const completedDays = completedSessions.filter(session => {
      const dayNumber = session.program_day_number || session.program_day || session.day_number || session.workout_day
      return dayNumber >= startDay && dayNumber <= endDay
    }).length

    return `${completedDays}/${daysPerMonth}`
  }

  const handleDayClick = (workout: any) => {
    if (!workout) return

    const status = getDayStatus(workout)
    if (status === 'locked') return

    const daysPerMonth = getDaysPerMonth()
    const dayNum = workout.program_day_number || workout.day_number
    const isTimeTrialDay = dayNum % daysPerMonth === 1
    const dayType = workout.day_type || (isTimeTrialDay ? 'time_trial' : undefined)

    onDayClick(dayNum, dayType)
  }

  const handleMonthClick = (monthNum: number) => {
    if (!getMonthAccess(monthNum)) return
    setSelectedMonth(monthNum)
    setInternalView('month-days')
  }

  const getWorkoutTypeDisplayName = (dayType: string): string => {
    const typeMap: Record<string, string> = {
      'endurance': 'Endurance',
      'time_trial': 'Time Trial',
      'threshold': 'Threshold',
      'tempo': 'Tempo',
      'recovery': 'Recovery',
      'anaerobic': 'Anaerobic',
      'interval': 'Interval',
      'polarized': 'Polarized',
      'max_aerobic_power': 'Max Aerobic Power',
      'flux': 'Flux',
      'flux_stages': 'Flux Stages',
      'devour': 'Devour',
      'towers': 'Towers',
      'atomic': 'Atomic',
      'infinity': 'Infinity',
      'ascending': 'Ascending',
      'descending': 'Descending',
      'ascending_devour': 'Ascending Devour',
      'descending_devour': 'Descending Devour',
      'afterburner': 'Afterburner',
      'synthesis': 'Synthesis',
      'hybrid_anaerobic': 'Hybrid Anaerobic',
      'hybrid_aerobic': 'Hybrid Aerobic',
      'rocket_races_a': 'Rocket Races A',
      'rocket_races_b': 'Rocket Races B'
    }
    
    // If in typeMap, return it
    if (typeMap[dayType]) {
      return typeMap[dayType]
    }
    
    // Otherwise, format by replacing underscores with spaces and capitalizing words
    if (dayType) {
      return dayType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
    
    return 'Conditioning'
  }

  const renderDayCard = (workout: any) => {
    if (!workout) return null

    const status = getDayStatus(workout)
    const dayNumber = workout.program_day_number || workout.day_number
    
    // Set background color based on completion status
    const backgroundColor = status === 'completed' ? '#C4E2EA' : '#FFFFFF'

    return (
      <TouchableOpacity
        key={workout.id || dayNumber}
        style={[styles.dayCard, { backgroundColor }]}
        onPress={() => handleDayClick(workout)}
        disabled={status === 'locked'}
      >
        <View style={styles.dayCardContent}>
          <Text style={styles.dayNumber}>
            Day {dayNumber}
          </Text>
          <Text style={styles.dayType} numberOfLines={1}>
            {getWorkoutTypeDisplayName(workout.day_type || '')}
          </Text>
        </View>
        {status === 'completed' && (
          <Text style={styles.completedBadge}>Completed</Text>
        )}
        {status === 'locked' && (
          <Ionicons name="lock-closed" size={16} color="#282B34" />
        )}
      </TouchableOpacity>
    )
  }

  const renderMainView = () => (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ENGINE PROGRAM</Text>
        <Text style={styles.subtitle}>
          {currentProgram?.display_name || 'Engine 5-Day'}
        </Text>
      </View>

      {/* Progress Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedSessions.length}</Text>
          <Text style={styles.statLabel}>Days Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {currentProgram 
              ? Math.round((completedSessions.length / currentProgram.total_days) * 100)
              : 0}%
          </Text>
          <Text style={styles.statLabel}>Progress</Text>
        </View>
      </View>

      {/* Training Program Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Training Program</Text>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => setInternalView('months')}
          >
            <Text style={styles.viewButtonText}>View Months</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionDescription}>
          {currentProgram 
            ? `${currentProgram.description || currentProgram.display_name} • ${currentProgram.frequency_per_week} days/week`
            : 'Select a month to view your training days.'}
        </Text>
      </View>

      {/* Analytics Button */}
      <TouchableOpacity
        style={styles.analyticsButton}
        onPress={onAnalyticsClick}
      >
        <Text style={styles.analyticsButtonText}>View Analytics</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  const renderMonthsView = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (onBackToWeekView) {
              onBackToWeekView()
            } else {
              setInternalView('main')
            }
          }}
        >
          <Ionicons name="arrow-back" size={16} color="#F6FBFE" style={{ marginRight: 6 }} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select a Month</Text>
      </View>

      <View style={styles.monthsGrid}>
        {Array.from({ length: totalMonths }, (_, i) => {
          const monthNum = i + 1
          const hasAccess = getMonthAccess(monthNum)

          if (!hasAccess) return null

          return (
            <TouchableOpacity
              key={monthNum}
              style={styles.monthCard}
              onPress={() => handleMonthClick(monthNum)}
            >
              <Text style={styles.monthTitle}>Month {monthNum}</Text>
              <Text style={styles.monthCompletion}>
                {getMonthCompletionRatio(monthNum)} completed
              </Text>
            </TouchableOpacity>
          )
        }).filter(Boolean)}
      </View>
    </ScrollView>
  )

  const renderMonthDaysView = () => {
    const daysPerMonth = getDaysPerMonth()
    const numWeeks = Math.ceil(daysPerMonth / getDaysPerWeek())

    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setInternalView('months')}
          >
            <Ionicons name="arrow-back" size={16} color="#F6FBFE" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            Month {selectedMonth} - Days {(selectedMonth - 1) * daysPerMonth + 1} to {selectedMonth * daysPerMonth}
          </Text>
        </View>

        <View style={styles.weeksContainer}>
          {Array.from({ length: numWeeks }, (_, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              <Text style={styles.weekLabel}>Week {weekIndex + 1}</Text>
              <View style={styles.daysRow}>
                {Array.from({ length: getDaysPerWeek() }, (_, dayIndex) => {
                  const dayInMonth = weekIndex * getDaysPerWeek() + dayIndex + 1
                  if (dayInMonth > daysPerMonth) return null

                  const globalDayNumber = (selectedMonth - 1) * daysPerMonth + dayInMonth
                  const workout = workouts.find(w =>
                    (w.program_day_number || w.day_number) === globalDayNumber
                  )

                  return (
                    <View key={dayIndex} style={styles.dayWrapper}>
                      {renderDayCard(workout || { day_number: globalDayNumber })}
                    </View>
                  )
                }).filter(Boolean)}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading program...</Text>
      </View>
    )
  }

  if (internalView === 'months') {
    return renderMonthsView()
  }

  if (internalView === 'month-days') {
    return renderMonthDaysView()
  }

  return renderMainView()
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FE5858',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  viewButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  analyticsButton: {
    backgroundColor: '#FE5858',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  analyticsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#FE5858',
    borderWidth: 1,
    borderColor: '#282B34',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#F6FBFE',
    fontWeight: '600',
  },
  monthsGrid: {
    flexDirection: 'column',
    padding: 20,
    gap: 12,
  },
  monthCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#282B34',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  monthCompletion: {
    fontSize: 12,
    color: '#6b7280',
  },
  weeksContainer: {
    padding: 20,
  },
  weekRow: {
    marginBottom: 20,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: 'column',
    gap: 8,
  },
  dayWrapper: {
    width: '100%',
  },
  dayCard: {
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FE5858',
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  dayCardContent: {
    flex: 1,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#282B34',
  },
  dayType: {
    fontSize: 13,
    color: '#6b7280',
  },
  completedBadge: {
    marginTop: 4,
    fontSize: 10,
    color: '#282B34',
    fontWeight: '600',
  },
})
