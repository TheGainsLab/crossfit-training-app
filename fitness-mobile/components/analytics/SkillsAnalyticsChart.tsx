import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native'
import { Card } from '@/components/ui/Card'
import { SkillData } from '@/lib/api/analytics'

interface SkillsAnalyticsChartProps {
  skills: SkillData[]
  userId: number | null
}

export default function SkillsAnalyticsChart({ 
  skills, 
  userId 
}: SkillsAnalyticsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<'sessions' | 'reps' | 'avgRPE' | 'quality'>('sessions')
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillData | null>(null)

  const handleBarPress = (skill: SkillData) => {
    setSelectedSkill(skill)
    setModalVisible(true)
  }

  // Convert quality grade to numeric value for sorting (A highest)
  const qualityToNumeric = (grade: string): number => {
    const gradeMap: Record<string, number> = {
      'A': 4.0,
      'A-': 3.7,
      'B+': 2.7,
      'B': 2.3,
      'B-': 1.7,
      'C+': 1.3,
      'C': 1.0,
      'D': 0.5,
    }
    return gradeMap[grade] || 0
  }

  // Prepare chart data based on selected metric
  const chartData = skills
    .map(skill => {
      let value = 0
      let displayValue = ''
      let unit = ''
      
      switch (selectedMetric) {
        case 'sessions':
          value = skill.sessions.length
          displayValue = value.toString()
          unit = ''
          break
        case 'reps':
          value = skill.totalReps
          displayValue = value.toLocaleString()
          unit = ''
          break
        case 'avgRPE':
          value = isNaN(skill.avgRPE) ? 0 : skill.avgRPE
          displayValue = value.toFixed(1)
          unit = ''
          break
        case 'quality':
          value = qualityToNumeric(skill.qualityGrade)
          displayValue = skill.qualityGrade
          unit = ''
          break
      }
      
      return {
        name: skill.name,
        value,
        displayValue,
        unit,
        skill
      }
    })
    .filter(item => item.value > 0) // Only show skills with data
    .sort((a, b) => b.value - a.value) // Sort descending

  const maxValue = chartData.length > 0 
    ? Math.max(...chartData.map(item => item.value))
    : 1

  const metricLabels = {
    sessions: 'Sessions',
    reps: 'Reps',
    avgRPE: 'Avg RPE',
    quality: 'Quality'
  }

  return (
    <View style={styles.sectionGap}>
      {/* Metric Selector */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Metric
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['sessions', 'reps', 'avgRPE', 'quality'] as const).map((metric) => (
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
                  onPress={() => handleBarPress(item.skill)}
                  activeOpacity={0.7}
                  style={{ marginBottom: 12 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', flex: 0.8, flexWrap: 'wrap' }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={{ flex: 2.5, height: 32, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 6 }}>
                      <View 
                        style={{ 
                          height: '100%', 
                          width: `${percentage}%`, 
                          backgroundColor: '#FE5858',
                          borderRadius: 4
                        }} 
                      />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#282B34', width: 70, textAlign: 'right' }}>
                      {item.displayValue}{item.unit}
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

      {/* Training History Modal */}
      {selectedSkill && (
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Training history: {selectedSkill.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              {selectedSkill.sessions.length === 0 ? (
                <View style={styles.sessionHistoryEmpty}>
                  <Text style={styles.sessionHistoryEmptyText}>
                    No training history available.
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
                    {selectedSkill.sessions
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((session, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.sessionHistoryRow,
                            idx % 2 === 1 ? styles.sessionHistoryRowOdd : null,
                          ]}
                        >
                          <View style={[styles.sessionHistoryCell, styles.sessionHistoryDateCell]}>
                            <Text style={styles.sessionHistoryDateText}>
                              {new Date(session.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                          <View style={styles.sessionHistoryCell}>
                            <Text style={styles.sessionHistoryCellText}>
                              {session.sets}
                            </Text>
                          </View>
                          <View style={styles.sessionHistoryCell}>
                            <Text style={styles.sessionHistoryCellText}>
                              {session.reps}
                            </Text>
                          </View>
                          <View style={styles.sessionHistoryCell}>
                            <Text style={styles.sessionHistoryCellText}>
                              -
                            </Text>
                          </View>
                          <View style={styles.sessionHistoryCell}>
                            <Text style={styles.sessionHistoryCellText}>
                              {session.rpe}
                            </Text>
                          </View>
                          <View style={styles.sessionHistoryCell}>
                            <Text style={styles.sessionHistoryCellText}>
                              {session.quality >= 4 ? 'A' : session.quality >= 3 ? 'B' : session.quality >= 2 ? 'C' : 'D'}
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
      )}
    </View>
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
  sessionHistoryEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  sessionHistoryEmptyText: {
    fontSize: 14,
    color: '#6B7280',
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
})
