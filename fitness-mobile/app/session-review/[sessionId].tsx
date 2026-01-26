import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { fetchSessionData, Exercise, SessionData } from '@/lib/api/session'
import { Card } from '@/components/ui/Card'
import { BlockHeader } from '@/components/ui/BlockHeader'
import { Button } from '@/components/ui/Button'

export default function SessionReviewPage() {
  const router = useRouter()
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId) {
      loadSessionData()
    }
  }, [sessionId])

  const loadSessionData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchSessionData(sessionId!)
      if (data) {
        setSessionData(data)
      } else {
        setError('Session not found')
      }
    } catch (err: any) {
      console.error('Error loading session data:', err)
      setError(err.message || 'Failed to load session data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getPerformanceTierColor = (tier: string) => {
    switch (tier) {
      case 'Advanced':
        return { backgroundColor: '#D1FAE5', color: '#065F46' }
      case 'Good':
        return { backgroundColor: '#DBEAFE', color: '#1E40AF' }
      case 'Average':
        return { backgroundColor: '#FEF3C7', color: '#92400E' }
      default:
        return { backgroundColor: '#F3F4F6', color: '#374151' }
    }
  }

  const renderExerciseRow = (exercise: Exercise, index: number) => {
    const sets = exercise.sets || '-'
    const reps = exercise.reps || '-'
    const weightTime =
      exercise.weight_time && String(exercise.weight_time) !== 'NaN'
        ? exercise.weight_time
        : (exercise.exercise_name.toLowerCase().includes('push-ups') ||
          exercise.exercise_name.toLowerCase().includes('air squats') ||
          exercise.exercise_name.toLowerCase().includes('pull-ups')
            ? 'BW'
            : '-')
    const rpe = exercise.rpe || '-'
    const quality = exercise.quality_grade || '-'

    return (
      <View
        key={exercise.id || index}
        style={styles.exerciseRow}
      >
        <View style={styles.exerciseNameContainer}>
          <Text style={styles.exerciseName}>
            {exercise.exercise_name}
          </Text>
        </View>
        <View style={styles.columnContainer}>
          <Text style={styles.columnText}>{sets}</Text>
        </View>
        <View style={styles.columnContainer}>
          <Text style={styles.columnText}>{reps}</Text>
        </View>
        <View style={styles.weightTimeContainer}>
          <Text style={styles.weightTimeText}>{weightTime}</Text>
        </View>
        <View style={styles.rpeContainer}>
          <Text style={styles.columnText}>{rpe}</Text>
        </View>
        <View style={styles.qualityContainer}>
          {quality !== '-' ? (
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>{quality}</Text>
            </View>
          ) : (
            <Text style={styles.qualityDash}>-</Text>
          )}
        </View>
      </View>
    )
  }

  const renderStandardBlock = (blockName: string, exercises: Exercise[]) => {
    return (
      <Card key={blockName} style={styles.blockCard}>
        {/* Block Header */}
        <BlockHeader title={blockName} count={exercises.length} />

        {/* Exercise List */}
        <View style={styles.blockContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Header Row */}
              <View style={styles.headerRow}>
                <View style={styles.headerColumn}>
                  <Text style={styles.headerText}>
                    Exercise
                  </Text>
                </View>
                <View style={styles.headerColumnSmall}>
                  <Text style={styles.headerText}>Sets</Text>
                </View>
                <View style={styles.headerColumnSmall}>
                  <Text style={styles.headerText}>Reps</Text>
                </View>
                <View style={styles.headerColumnMedium}>
                  <Text style={styles.headerText}>
                    Wt/Time
                  </Text>
                </View>
                <View style={styles.headerColumnRPE}>
                  <Text style={styles.headerText}>RPE</Text>
                </View>
                <View style={styles.headerColumnQuality}>
                  <Text style={styles.headerText}>Quality</Text>
                </View>
              </View>

              {/* Exercise Rows */}
              {exercises.map((exercise, index) =>
                renderExerciseRow(exercise, index)
              )}
            </View>
          </ScrollView>
        </View>
      </Card>
    )
  }

  const renderMetconBlock = () => {
    if (!sessionData?.hasMetcons) {
      return null
    }

    const metconExercises = sessionData.exercises['METCONS'] || []

    // If we have detailed MetCon data, render the rich panel
    if (sessionData.metconData) {
      const { metconData } = sessionData
      const tierColors = getPerformanceTierColor(metconData.performance_tier || '')
      return (
        <Card style={styles.blockCard}>
          {/* MetCon Header */}
          <BlockHeader title="METCONS" count={metconExercises.length} />

          <View style={styles.metconContent}>
            {/* Workout Title & Format */}
            <View style={styles.metconTitleContainer}>
              <Text style={styles.metconTitle}>
                {metconData.metcon.workout_id}
              </Text>
              <Text style={styles.metconFormat}>
                {metconData.metcon.format}
              </Text>
            </View>

            {/* Score & Percentile */}
            <View style={styles.metconScoreSection}>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>
                  Your Score
                </Text>
                <Text style={styles.scoreValue}>
                  {metconData.user_score}
                </Text>
              </View>

              {/* Percentile Display */}
              <View style={styles.percentileSection}>
                <View style={styles.percentileHeader}>
                  <Text style={styles.percentileLabel}>
                    Percentile
                  </Text>
                  <Text style={styles.percentileValue}>
                    {metconData.percentile}%
                  </Text>
                </View>
                <View style={styles.sliderContainer}>
                  {/* Slider track */}
                  <View style={styles.sliderTrack}>
                    {/* Slider fill */}
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${parseFloat(metconData.percentile)}%` }
                      ]}
                    />
                    {/* User position indicator */}
                    <View
                      style={[
                        styles.sliderIndicator,
                        { left: `${parseFloat(metconData.percentile)}%` }
                      ]}
                    >
                      <View style={styles.sliderDot} />
                    </View>
                  </View>
                  {/* Slider labels */}
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelText}>1%</Text>
                    <Text style={styles.sliderLabelText}>50%</Text>
                    <Text style={styles.sliderLabelText}>99%</Text>
                  </View>
                </View>
              </View>

              {/* Performance Tier */}
              {metconData.performance_tier ? (
                <View style={styles.tierContainer}>
                  <View
                    style={[
                      styles.tierBadge,
                      { backgroundColor: tierColors.backgroundColor }
                    ]}
                  >
                    <Text style={[styles.tierText, { color: tierColors.color }]}>
                      {metconData.performance_tier}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Exercise Breakdown */}
            {metconExercises.length > 0 ? (
              <View style={styles.metconExerciseBreakdown}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View>
                    {/* Header Row */}
                    <View style={styles.headerRow}>
                      <View style={styles.headerColumn}>
                        <Text style={styles.headerText}>
                          Exercise
                        </Text>
                      </View>
                      <View style={styles.headerColumnSmall}>
                        <Text style={styles.headerText}>
                          Sets
                        </Text>
                      </View>
                      <View style={styles.headerColumnSmall}>
                        <Text style={styles.headerText}>
                          Reps
                        </Text>
                      </View>
                      <View style={styles.headerColumnMedium}>
                        <Text style={styles.headerText}>
                          Wt/Time
                        </Text>
                      </View>
                      <View style={styles.headerColumnRPE}>
                        <Text style={styles.headerText}>
                          RPE
                        </Text>
                      </View>
                      <View style={styles.headerColumnQuality}>
                        <Text style={styles.headerText}>
                          Quality
                        </Text>
                      </View>
                    </View>

                    {/* Exercise Rows */}
                    {metconExercises.map((exercise, index) =>
                      renderExerciseRow(exercise, index)
                    )}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </Card>
      )
    }

    // Fallback: show a standard block
    if (metconExercises.length > 0) {
      return renderStandardBlock('METCONS', metconExercises)
    }

    return null
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333333" />
        <Text style={styles.loadingText}>Loading session details...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>
            Error Loading Session
          </Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.errorButton}
          >
            <Text style={styles.errorButtonText}>Back to Progress</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (!sessionData) {
    return null
  }

  const { sessionInfo, exercises } = sessionData

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>
              Week {sessionInfo.week} Day {sessionInfo.day}
            </Text>
            <Text style={styles.headerDate}>{formatDate(sessionInfo.date)}</Text>
            <Text style={styles.headerMeta}>
              {sessionInfo.totalExercises} exercises • {sessionInfo.blocks.length}{' '}
              blocks
            </Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
          >
            ← Back
          </Button>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Render MetCons first if they exist */}
        {sessionData.hasMetcons ? renderMetconBlock() : null}

        {/* Render other training blocks */}
        {Object.entries(exercises)
          .filter(([blockName]) => blockName !== 'METCONS')
          .sort(([a], [b]) => {
            // Sort blocks in a logical order
            const order = [
              'SKILLS',
              'TECHNICAL WORK',
              'STRENGTH AND POWER',
              'ACCESSORIES',
            ]
            return order.indexOf(a) - order.indexOf(b)
          })
          .map(([blockName, blockExercises]) =>
            renderStandardBlock(blockName, blockExercises)
          )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDFBFE',
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
    maxWidth: 400,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#4B5563',
    marginBottom: 16,
    textAlign: 'center',
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
    justifyContent: 'space-between',
    marginBottom: 12,
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
  headerDate: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  blockCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  blockContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  headerColumn: {
    minWidth: 180,
    marginRight: 8,
  },
  headerColumnSmall: {
    minWidth: 56,
    alignItems: 'center',
  },
  headerColumnMedium: {
    minWidth: 80,
    alignItems: 'center',
  },
  headerColumnRPE: {
    minWidth: 50,
    alignItems: 'center',
  },
  headerColumnQuality: {
    minWidth: 70,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  exerciseNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  exerciseName: {
    fontWeight: '600',
    color: '#111827',
    fontSize: 16,
    flexShrink: 1,
  },
  columnContainer: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnText: {
    color: '#374151',
    fontWeight: '500',
  },
  weightTimeContainer: {
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightTimeText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  rpeContainer: {
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityContainer: {
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FE5858',
  },
  qualityBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  qualityDash: {
    color: '#9CA3AF',
  },
  metconContent: {
    padding: 20,
  },
  metconTitleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  metconTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  metconFormat: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '500',
  },
  metconScoreSection: {
    marginBottom: 24,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#282B34',
  },
  percentileSection: {
    marginBottom: 20,
  },
  percentileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  percentileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  percentileValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FE5858',
  },
  sliderContainer: {
    position: 'relative',
  },
  sliderTrack: {
    width: '100%',
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#FE5858',
    borderRadius: 999,
  },
  sliderIndicator: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -10 }],
  },
  sliderDot: {
    width: 20,
    height: 20,
    backgroundColor: '#FE5858',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tierContainer: {
    alignItems: 'center',
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metconExerciseBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
})

