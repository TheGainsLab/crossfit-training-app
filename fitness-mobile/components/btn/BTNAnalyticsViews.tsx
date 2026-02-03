import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { BTNAnalyticsData } from '@/lib/api/btn'
import MetConHeatMap, { HeatmapCell } from '@/components/analytics/MetConHeatMap'
import { Card } from '@/components/ui/Card'

interface BTNAnalyticsViewsProps {
  heatmapData: BTNAnalyticsData
  activeTab: 'performance' | 'effort' | 'quality' | 'heartrate'
}

type MetricType = 'percentile' | 'rpe' | 'quality' | 'heartrate'

// Helper function to calculate exercise average for a specific metric
function calculateExerciseAverage(
  cells: HeatmapCell[],
  exerciseName: string,
  metric: MetricType
): number | null {
  const exerciseCells = cells.filter(c => c.exercise_name === exerciseName)
  if (exerciseCells.length === 0) return null

  let totalWeighted = 0
  let totalSessions = 0

  exerciseCells.forEach(cell => {
    let value: number | null = null
    switch (metric) {
      case 'percentile':
        value = cell.avg_percentile
        break
      case 'rpe':
        value = cell.avg_rpe ?? null
        break
      case 'quality':
        value = cell.avg_quality ?? null
        break
      case 'heartrate':
        value = cell.avg_heart_rate ?? null
        break
    }

    if (value !== null && value !== undefined) {
      totalWeighted += value * cell.session_count
      totalSessions += cell.session_count
    }
  })

  return totalSessions > 0 ? Math.round((totalWeighted / totalSessions) * 10) / 10 : null
}

// Helper function to get top 3 exercises for a metric
function getTop3Exercises(
  cells: HeatmapCell[],
  metric: MetricType
): { name: string; value: number; sessions: number }[] {
  const exercises = [...new Set(cells.map(c => c.exercise_name))]

  const exerciseData = exercises
    .map(exercise => {
      const exerciseCells = cells.filter(c => c.exercise_name === exercise)
      const avg = calculateExerciseAverage(cells, exercise, metric)
      const sessions = exerciseCells.reduce((sum, c) => sum + c.session_count, 0)
      return { name: exercise, value: avg, sessions }
    })
    .filter(e => e.value !== null) as { name: string; value: number; sessions: number }[]

  // Sort by value (descending for percentile/quality, could be different for others)
  // For all metrics, higher is "better" in the context of showing top performers
  exerciseData.sort((a, b) => b.value - a.value)

  return exerciseData.slice(0, 3)
}

// Helper function to format value based on metric
function formatValue(value: number, metric: MetricType): string {
  switch (metric) {
    case 'percentile':
      return `${Math.round(value)}%`
    case 'rpe':
      return value.toFixed(1)
    case 'quality':
      if (value >= 3.5) return 'A'
      if (value >= 2.5) return 'B'
      if (value >= 1.5) return 'C'
      return 'D'
    case 'heartrate':
      return `${Math.round(value)}`
    default:
      return value.toString()
  }
}

// Helper function to get metric label
function getMetricLabel(metric: MetricType): string {
  switch (metric) {
    case 'percentile':
      return 'Performance'
    case 'rpe':
      return 'Effort (RPE)'
    case 'quality':
      return 'Quality'
    case 'heartrate':
      return 'Heart Rate'
    default:
      return ''
  }
}

// Top 3 Card Component
function Top3Card({
  cells,
  metric
}: {
  cells: HeatmapCell[]
  metric: MetricType
}) {
  const top3 = getTop3Exercises(cells, metric)

  if (top3.length === 0) return null

  const maxValue = Math.max(...top3.map(e => e.value))
  const medals = ['gold', 'silver', '#CD7F32'] // gold, silver, bronze colors

  return (
    <Card style={styles.top3Card}>
      <Text style={styles.top3Title}>Your Top 3</Text>
      <Text style={styles.top3Subtitle}>{getMetricLabel(metric)}</Text>

      <View style={styles.top3List}>
        {top3.map((exercise, index) => {
          const percentage = maxValue > 0 ? (exercise.value / maxValue) * 100 : 0

          return (
            <View key={exercise.name} style={styles.top3Item}>
              <Text style={[styles.top3Medal, { color: medals[index] }]}>
                {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}
              </Text>
              <View style={styles.top3BarContainer}>
                <Text style={styles.top3ExerciseName} numberOfLines={1}>
                  {exercise.name}
                </Text>
                <View style={styles.top3BarBackground}>
                  <View
                    style={[
                      styles.top3Bar,
                      {
                        width: `${percentage}%`,
                        backgroundColor: index === 0 ? '#FE5858' : index === 1 ? '#F97316' : '#EAB308'
                      }
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.top3Value}>
                {formatValue(exercise.value, metric)}
              </Text>
            </View>
          )
        })}
      </View>
    </Card>
  )
}

export function PerformanceView({ heatmapData }: BTNAnalyticsViewsProps) {
  const completions = heatmapData?.totalCompletedWorkouts || 0
  const cells = heatmapData?.heatmapCells || []

  return (
    <View style={styles.container}>
      <Top3Card cells={cells} metric="percentile" />
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Percentile Heatmap ({completions})</Text>
        <MetConHeatMap
          heatmapCells={heatmapData.heatmapCells}
          exerciseAverages={heatmapData.exerciseAverages}
          globalFitnessScore={heatmapData.globalFitnessScore}
          timeDomainWorkoutCounts={heatmapData.timeDomainWorkoutCounts}
          metric="percentile"
          hideTitle
        />
      </Card>
    </View>
  )
}

export function EffortView({ heatmapData }: BTNAnalyticsViewsProps) {
  const cells = heatmapData?.heatmapCells || []

  // Calculate global RPE
  const validRpe = cells.filter(c => c.avg_rpe !== null && c.avg_rpe !== undefined)
  const workoutCount = validRpe.reduce((sum, c) => sum + c.session_count, 0)

  return (
    <View style={styles.container}>
      {validRpe.length > 0 ? (
        <>
          <Top3Card cells={cells} metric="rpe" />
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>RPE Heatmap ({workoutCount})</Text>
            <MetConHeatMap
              heatmapCells={heatmapData.heatmapCells}
              exerciseAverages={heatmapData.exerciseAverages}
              globalFitnessScore={heatmapData.globalFitnessScore}
              timeDomainWorkoutCounts={heatmapData.timeDomainWorkoutCounts}
              metric="rpe"
              hideTitle
            />
          </Card>
        </>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No RPE data available. Log workouts with RPE to see effort statistics.
          </Text>
        </Card>
      )}
    </View>
  )
}

export function QualityView({ heatmapData }: BTNAnalyticsViewsProps) {
  const cells = heatmapData?.heatmapCells || []

  // Calculate global Quality
  const validQuality = cells.filter(c => c.avg_quality !== null && c.avg_quality !== undefined)
  const workoutCount = validQuality.reduce((sum, c) => sum + c.session_count, 0)

  return (
    <View style={styles.container}>
      {validQuality.length > 0 ? (
        <>
          <Top3Card cells={cells} metric="quality" />
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Quality Heatmap ({workoutCount})</Text>
            <MetConHeatMap
              heatmapCells={heatmapData.heatmapCells}
              exerciseAverages={heatmapData.exerciseAverages}
              globalFitnessScore={heatmapData.globalFitnessScore}
              timeDomainWorkoutCounts={heatmapData.timeDomainWorkoutCounts}
              metric="quality"
              hideTitle
            />
          </Card>
        </>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No Quality data available. Log workouts with Quality ratings to see statistics.
          </Text>
        </Card>
      )}
    </View>
  )
}

export function HeartRateView({ heatmapData }: BTNAnalyticsViewsProps) {
  const cells = heatmapData?.heatmapCells || []

  // Check if we have any HR data
  const validHR = cells.filter(c => c.avg_heart_rate !== null && c.avg_heart_rate !== undefined)
  const workoutCount = validHR.reduce((sum, c) => sum + c.session_count, 0)

  return (
    <View style={styles.container}>
      {validHR.length > 0 ? (
        <>
          <Top3Card cells={cells} metric="heartrate" />
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Heart Rate Heatmap ({workoutCount})</Text>
            <MetConHeatMap
              heatmapCells={heatmapData.heatmapCells}
              exerciseAverages={heatmapData.exerciseAverages}
              globalFitnessScore={heatmapData.globalFitnessScore}
              timeDomainWorkoutCounts={heatmapData.timeDomainWorkoutCounts}
              metric="heartrate"
              hideTitle
            />
          </Card>
        </>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No Heart Rate data available. Log workouts with HR to see statistics.
          </Text>
        </Card>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
  },
  card: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 16,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Top 3 Card Styles
  top3Card: {
    padding: 16,
  },
  top3Title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
  },
  top3Subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  top3List: {
    gap: 12,
  },
  top3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  top3Medal: {
    fontSize: 14,
    fontWeight: '700',
    width: 32,
  },
  top3BarContainer: {
    flex: 1,
  },
  top3ExerciseName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  top3BarBackground: {
    height: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  top3Bar: {
    height: '100%',
    borderRadius: 4,
  },
  top3Value: {
    fontSize: 14,
    fontWeight: '700',
    color: '#282B34',
    width: 50,
    textAlign: 'right',
  },
})
