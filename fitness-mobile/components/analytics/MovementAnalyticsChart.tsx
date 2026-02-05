import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native'
import { Card } from '@/components/ui/Card'
import { fetchMovementSessionHistory, StrengthMovement, SessionHistoryRow } from '@/lib/api/analytics'

interface MovementAnalyticsChartProps {
  movements: StrengthMovement[]
  userId: number | null
  blockType: 'STRENGTH AND POWER' | 'TECHNICAL WORK' | 'ACCESSORIES'
}

export default function MovementAnalyticsChart({ 
  movements, 
  userId, 
  blockType 
}: MovementAnalyticsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<'maxWeight' | 'avgWeight' | 'avgRPE' | 'totalVolume'>('maxWeight')
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Determine header based on blockType
  const getSummaryHeader = () => {
    switch (blockType) {
      case 'TECHNICAL WORK':
        return 'Technical Summary'
      case 'ACCESSORIES':
        return 'Accessory Summary'
      case 'STRENGTH AND POWER':
      default:
        return 'Strength Summary'
    }
  }

  const handleCardPress = async (exerciseName: string) => {
    if (!userId) return
    
    setSelectedExercise(exerciseName)
    setLoadingHistory(true)
    setModalVisible(true)

    try {
      const history = await fetchMovementSessionHistory(
        userId,
        exerciseName,
        blockType,
        90
      )
      setSessionHistory(history)
    } catch (error) {
      console.error('Error fetching session history:', error)
      setSessionHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Prepare chart data based on selected metric
  const chartData = movements
    .map(movement => {
      let value = 0
      let unit = ''
      
      switch (selectedMetric) {
        case 'maxWeight':
          value = isNaN(movement.maxWeight) ? 0 : movement.maxWeight
          unit = ' lbs'
          break
        case 'avgWeight':
          value = isNaN(movement.averageWeight) ? 0 : movement.averageWeight
          unit = ' lbs'
          break
        case 'avgRPE':
          value = isNaN(movement.avgRPE) ? 0 : movement.avgRPE
          unit = ''
          break
        case 'totalVolume':
          value = isNaN(movement.totalVolume) ? 0 : movement.totalVolume
          unit = ''
          break
      }
      
      return {
        name: movement.name,
        value,
        unit,
        movement
      }
    })
    .filter(item => item.value > 0) // Only show exercises with data
    .sort((a, b) => b.value - a.value) // Sort descending

  const maxValue = chartData.length > 0 
    ? Math.max(...chartData.map(item => item.value))
    : 1

  const metricLabels = {
    maxWeight: 'Max Weight',
    avgWeight: 'Avg Weight',
    avgRPE: 'Avg RPE',
    totalVolume: 'Total Volume'
  }

  // Calculate headline stats
  const headlineStats = React.useMemo(() => {
    if (!movements || movements.length === 0) {
      return { maxWeight: null, mostVolume: null }
    }

    // Find max weight across all movements
    let maxWeightMovement: { name: string; weight: number } | null = null
    let mostVolumeMovement: { name: string; volume: number } | null = null

    movements.forEach(movement => {
      const weight = isNaN(movement.maxWeight) ? 0 : movement.maxWeight
      const volume = isNaN(movement.totalVolume) ? 0 : movement.totalVolume

      if (weight > 0 && (!maxWeightMovement || weight > maxWeightMovement.weight)) {
        maxWeightMovement = { name: movement.name, weight }
      }

      if (volume > 0 && (!mostVolumeMovement || volume > mostVolumeMovement.volume)) {
        mostVolumeMovement = { name: movement.name, volume }
      }
    })

    return { maxWeight: maxWeightMovement, mostVolume: mostVolumeMovement }
  }, [movements])

  return (
    <View style={styles.sectionGap}>
      {/* Headline Summary Card */}
      {(headlineStats.maxWeight || headlineStats.mostVolume) && (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#282B34', textAlign: 'center', marginBottom: 16 }}>
            {getSummaryHeader()}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Max Weight */}
            <View style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB'
            }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#FE5858' }}>
                {headlineStats.maxWeight ? Math.round(headlineStats.maxWeight.weight) : '--'}
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>lbs</Text>
              <View style={{ height: 1, backgroundColor: '#E5E7EB', width: '80%', marginVertical: 8 }} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#282B34' }}>Max Weight</Text>
              <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
                {headlineStats.maxWeight?.name || '--'}
              </Text>
            </View>

            {/* Most Volume */}
            <View style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB'
            }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#FE5858' }}>
                {headlineStats.mostVolume ? headlineStats.mostVolume.volume.toLocaleString() : '--'}
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>lbs</Text>
              <View style={{ height: 1, backgroundColor: '#E5E7EB', width: '80%', marginVertical: 8 }} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#282B34' }}>Most Volume</Text>
              <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
                {headlineStats.mostVolume?.name || '--'}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Metric Selector */}
      <Card style={{ borderWidth: 1, borderColor: '#282B34', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Metric
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['maxWeight', 'avgWeight', 'avgRPE', 'totalVolume'] as const).map((metric) => (
              <TouchableOpacity
                key={metric}
                onPress={() => setSelectedMetric(metric)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedMetric === metric ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedMetric === metric ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {metricLabels[metric]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Chart */}
      {chartData.length > 0 ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
            {metricLabels[selectedMetric]} Comparison
          </Text>
          <View>
            {chartData.map((item, index) => {
              const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleCardPress(item.name)}
                  activeOpacity={0.7}
                  style={{ marginBottom: 10 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', flex: 0.6, flexWrap: 'wrap' }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={{ flex: 3.0, height: 28, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 6 }}>
                      <View 
                        style={{ 
                          height: '100%', 
                          width: `${percentage}%`, 
                          backgroundColor: '#FE5858',
                          borderRadius: 4
                        }} 
                      />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#282B34', width: 60, textAlign: 'right' }}>
                      {selectedMetric === 'totalVolume' 
                        ? item.value.toLocaleString() 
                        : selectedMetric === 'avgRPE' 
                        ? item.value.toFixed(1)
                        : selectedMetric === 'avgWeight'
                        ? item.value.toFixed(1)
                        : Math.round(item.value)
                      }{item.unit}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>
      ) : (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
            No data available for {metricLabels[selectedMetric]}
          </Text>
        </Card>
      )}

      <SessionHistoryModal
        visible={modalVisible}
        exerciseName={selectedExercise}
        sessionHistory={sessionHistory}
        loading={loadingHistory}
        onClose={() => setModalVisible(false)}
      />
    </View>
  )
}

// Session History Modal Component
function SessionHistoryModal({
  visible,
  exerciseName,
  sessionHistory,
  loading,
  onClose,
}: {
  visible: boolean
  exerciseName: string
  sessionHistory: SessionHistoryRow[]
  loading?: boolean
  onClose: () => void
}) {
  const formatDateCompact = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getQualityGrade = (quality: number | null) => {
    if (quality === null) return ''
    if (quality >= 4) return 'A'
    if (quality >= 3) return 'B'
    if (quality >= 2) return 'C'
    return 'D'
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Session history: {exerciseName}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseButton}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.sessionHistoryEmpty}>
              <ActivityIndicator size="large" color="#FE5858" />
              <Text style={[styles.sessionHistoryEmptyText, { marginTop: 12 }]}>
                Loading session history...
              </Text>
            </View>
          ) : sessionHistory.length === 0 ? (
            <View style={styles.sessionHistoryEmpty}>
              <Text style={styles.sessionHistoryEmptyText}>
                No entries for this range.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={true}>
              <View style={styles.sessionHistoryTable}>
                {/* Header */}
                <View style={styles.sessionHistoryHeader}>
                  <View style={[styles.sessionHistoryHeaderCell, styles.sessionHistoryDateCell]}>
                    <Text style={styles.sessionHistoryHeaderText}>Date</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Sets</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Reps</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Wt/Time</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>RPE</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Quality</Text>
                  </View>
                </View>

                {/* Rows */}
                {[...sessionHistory]
                  .sort((a, b) => (a.training_date < b.training_date ? 1 : -1))
                  .map((row, index) => (
                    <View
                      key={index}
                      style={[
                        styles.sessionHistoryRow,
                        index % 2 === 1 ? styles.sessionHistoryRowOdd : null,
                      ]}
                    >
                      <View style={[styles.sessionHistoryCell, styles.sessionHistoryDateCell]}>
                        <Text style={styles.sessionHistoryDateText}>
                          {formatDateCompact(row.training_date)}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.sets ?? ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.reps ?? ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.weight_time && row.weight_time !== 'NaN' ? row.weight_time : ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.rpe ?? ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {getQualityGrade(row.completion_quality)}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sectionGap: {
    gap: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#4B5563',
    fontWeight: '300',
  },
  sessionHistoryTable: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sessionHistoryHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sessionHistoryHeaderCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    flex: 1,
  },
  sessionHistoryHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  sessionHistoryRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sessionHistoryRowOdd: {
    backgroundColor: '#F9FAFB',
  },
  sessionHistoryCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    flex: 1,
    justifyContent: 'center',
  },
  sessionHistoryCellText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  sessionHistoryDateCell: {
    flex: 1.2,
  },
  sessionHistoryDateText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'left',
  },
  sessionHistoryEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  sessionHistoryEmptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
})
