import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { BTNAnalyticsData } from '@/lib/api/btn'
import BTNHeatMap from './BTNHeatMap'
import { Card } from '@/components/ui/Card'

interface BTNAnalyticsViewsProps {
  heatmapData: BTNAnalyticsData
  activeTab: 'performance' | 'effort' | 'quality' | 'heartrate'
}

export function PerformanceView({ heatmapData }: BTNAnalyticsViewsProps) {
  const completions = heatmapData?.totalCompletedWorkouts || 0

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Percentile Heatmap ({completions})</Text>
        <BTNHeatMap data={heatmapData} metric="percentile" hideTitle />
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
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>RPE Heatmap ({workoutCount})</Text>
          <BTNHeatMap data={heatmapData} metric="rpe" hideTitle />
        </Card>
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
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Quality Heatmap ({workoutCount})</Text>
          <BTNHeatMap data={heatmapData} metric="quality" hideTitle />
        </Card>
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
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Heart Rate Heatmap ({workoutCount})</Text>
          <BTNHeatMap data={heatmapData} metric="heartrate" hideTitle />
        </Card>
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
})
