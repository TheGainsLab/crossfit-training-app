import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import { BTNAnalyticsData } from '@/lib/api/btn'
import { Card } from '@/components/ui/Card'

type MetricType = 'percentile' | 'rpe' | 'quality' | 'heartrate'

interface BTNHeatMapProps {
  data: BTNAnalyticsData
  metric?: MetricType
  hideTitle?: boolean
}

interface CellDetail {
  exercise: string
  timeDomain: string
  value: number | null
  sessions: number
  percentile: number | null
  hrData?: { avgHR: number | null, maxHR: number | null } | null
  rpeData?: { avgRpe: number | null, avgQuality: number | null } | null
}

export default function BTNHeatMap({ 
  data, 
  metric = 'percentile',
  hideTitle = false
}: BTNHeatMapProps) {
  const [selectedCell, setSelectedCell] = useState<CellDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  if (!data || !data.exercises || data.exercises.length === 0) {
    const emptyMessage = metric === 'percentile' 
      ? 'Complete more workouts to see exercise-specific performance data!'
      : metric === 'rpe'
      ? 'Log workouts with RPE to see effort statistics!'
      : metric === 'quality'
      ? 'Log workouts with Quality ratings to see statistics!'
      : 'Log workouts with Heart Rate to see statistics!'
    
    return (
      <View style={styles.emptyContainer}>
        {!hideTitle && (
          <Text style={styles.emptyTitle}>{getMetricTitle(metric)}</Text>
        )}
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>💪</Text>
          <Text style={styles.emptyTitleText}>No {getMetricTitle(metric)} Data Yet</Text>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      </View>
    )
  }

  const { exercises, timeDomains } = data

  const getCellValue = (exercise: string, timeDomain: string): number | null => {
    const cell = data.heatmapCells.find(
      cell => cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    if (!cell) return null

    switch (metric) {
      case 'percentile':
        return cell.avg_percentile
      case 'rpe':
        return cell.avg_rpe ?? null
      case 'quality':
        return cell.avg_quality ?? null
      case 'heartrate':
        return cell.avg_heart_rate ?? null
      default:
        return null
    }
  }

  const getSessionCount = (exercise: string, timeDomain: string): number => {
    const cell = data.heatmapCells.find(
      cell => cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? cell.session_count : 0
  }

  const getHRData = (exercise: string, timeDomain: string): { avgHR: number | null, maxHR: number | null } | null => {
    const cell = data.heatmapCells.find(
      cell => cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? {
      avgHR: cell.avg_heart_rate ?? null,
      maxHR: cell.max_heart_rate ?? null
    } : null
  }

  const getPercentile = (exercise: string, timeDomain: string): number | null => {
    const cell = data.heatmapCells.find(
      cell => cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? cell.avg_percentile : null
  }

  const calculateExerciseAverage = (exercise: string): number | null => {
    const exerciseCells = data.heatmapCells.filter(
      cell => cell.exercise_name === exercise
    )
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

  const calculateTimeDomainAverage = (timeDomain: string): number | null => {
    const domainCells = data.heatmapCells.filter(
      cell => cell.time_range === timeDomain
    )
    if (domainCells.length === 0) return null

    let totalWeighted = 0
    let totalSessions = 0

    domainCells.forEach(cell => {
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

  const getGlobalAverage = (): number | null => {
    let totalWeighted = 0
    let totalSessions = 0

    data.heatmapCells.forEach(cell => {
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

  const formatCellValue = (value: number | null): string => {
    if (value === null) return '—'
    
    switch (metric) {
      case 'percentile':
        return `${value}%`
      case 'rpe':
        return value.toFixed(1)
      case 'quality':
        return getQualityGrade(value)
      case 'heartrate':
        return Math.round(value).toString()
      default:
        return value.toString()
    }
  }

  const getQualityGrade = (quality: number | null): string => {
    if (quality === null) return '—'
    if (quality >= 3.5) return 'A'
    if (quality >= 2.5) return 'B'
    if (quality >= 1.5) return 'C'
    return 'D'
  }

  const getCellColor = (value: number | null): string => {
    if (value === null) return '#F3F4F6' // gray-100

    switch (metric) {
      case 'percentile':
        if (value >= 90) return '#1E40AF' // blue-800
        if (value >= 75) return '#2563EB' // blue-600
        if (value >= 50) return '#3B82F6' // blue-500
        if (value >= 25) return '#60A5FA' // blue-400
        return '#93C5FD' // blue-300
      case 'rpe':
        if (value >= 9) return '#DC2626' // red-600
        if (value >= 8) return '#EF4444' // red-500
        if (value >= 7) return '#F97316' // orange-500
        if (value >= 6) return '#FB923C' // orange-400
        return '#FCD34D' // yellow-300
      case 'quality':
        if (value >= 3.5) return '#10B981' // green-500
        if (value >= 2.5) return '#34D399' // green-400
        if (value >= 1.5) return '#FCD34D' // yellow-300
        return '#FCA5A5' // red-300
      case 'heartrate':
        if (value >= 180) return '#DC2626' // red-600
        if (value >= 160) return '#EF4444' // red-500
        if (value >= 140) return '#F97316' // orange-500
        if (value >= 120) return '#FB923C' // orange-400
        return '#FCD34D' // yellow-300
      default:
        return '#F3F4F6'
    }
  }

  const getTextColor = (value: number | null): string => {
    if (value === null) return '#9CA3AF' // gray-400
    // Use white text for darker backgrounds
    switch (metric) {
      case 'percentile':
        return value >= 50 ? '#FFFFFF' : '#1F2937'
      case 'rpe':
        return value >= 7 ? '#FFFFFF' : '#1F2937'
      case 'quality':
        return value >= 3.5 ? '#FFFFFF' : '#1F2937'
      case 'heartrate':
        return value >= 160 ? '#FFFFFF' : '#1F2937'
      default:
        return '#1F2937'
    }
  }

  const getMetricTitle = (metricType: MetricType): string => {
    switch (metricType) {
      case 'percentile': return 'Percentile Heatmap'
      case 'rpe': return 'RPE Heatmap'
      case 'quality': return 'Quality Heatmap'
      case 'heartrate': return 'Heart Rate Heatmap'
      default: return 'MetCon Heat Map'
    }
  }

  const hasMedal = (percentile: number | null): boolean => {
    return percentile !== null && percentile >= 90
  }

  const handleCellPress = (exercise: string, timeDomain: string) => {
    const cellValue = getCellValue(exercise, timeDomain)
    const sessions = getSessionCount(exercise, timeDomain)
    const percentile = getPercentile(exercise, timeDomain)
    const hrData = metric === 'heartrate' ? getHRData(exercise, timeDomain) : null
    const rpeData = metric === 'rpe' || metric === 'quality' ? {
      avgRpe: data.heatmapCells.find(
        cell => cell.exercise_name === exercise && cell.time_range === timeDomain
      )?.avg_rpe ?? null,
      avgQuality: data.heatmapCells.find(
        cell => cell.exercise_name === exercise && cell.time_range === timeDomain
      )?.avg_quality ?? null
    } : null

    if (cellValue !== null || sessions > 0) {
      setSelectedCell({
        exercise,
        timeDomain,
        value: cellValue,
        sessions,
        percentile,
        hrData,
        rpeData
      })
      setShowDetailModal(true)
    }
  }

  return (
    <View style={styles.container}>
      {!hideTitle && (
        <>
          <Text style={styles.title}>{getMetricTitle(metric)}</Text>
          <Text style={styles.subtitle}>{getMetricSubtitle(metric)}</Text>
        </>
      )}
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header Row */}
          <View style={styles.row}>
            <View style={[styles.cell, styles.headerCell, styles.exerciseHeaderCell]}>
              <Text style={styles.headerText}>Exercise</Text>
            </View>
            {timeDomains.map(domain => (
              <View key={domain} style={[styles.cell, styles.headerCell, styles.timeDomainCell]}>
                <Text style={styles.headerText} numberOfLines={2}>{domain}</Text>
              </View>
            ))}
            <View style={[styles.cell, styles.headerCell, styles.totalCell]}>
              <Text style={styles.headerText}>Exercise Avg</Text>
            </View>
          </View>

          {/* Data Rows */}
          {exercises.map(exercise => {
            const exerciseAvg = calculateExerciseAverage(exercise)
            const exerciseData = data.exerciseAverages.find(
              avg => avg.exercise_name === exercise
            )
            const exercisePercentile = exerciseData?.overall_avg_percentile || null

            return (
              <View key={exercise} style={styles.row}>
                <View style={[styles.cell, styles.exerciseCell]}>
                  <Text style={styles.exerciseText} numberOfLines={2}>
                    {exercise}
                  </Text>
                </View>
                {timeDomains.map(domain => {
                  const cellValue = getCellValue(exercise, domain)
                  const sessions = getSessionCount(exercise, domain)
                  const percentile = getPercentile(exercise, domain)
                  const hrData = metric === 'heartrate' ? getHRData(exercise, domain) : null

                  return (
                    <TouchableOpacity
                      key={domain}
                      style={[styles.cell, styles.timeDomainCell]}
                      onPress={() => handleCellPress(exercise, domain)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.valueBox,
                        { backgroundColor: getCellColor(cellValue) }
                      ]}>
                        {hasMedal(percentile) && (
                          <Text style={styles.medal}>🏅</Text>
                        )}
                        {cellValue !== null ? (
                          <View>
                            {metric === 'heartrate' && hrData ? (
                              <>
                                <Text style={[styles.valueText, { color: getTextColor(cellValue) }]}>
                                  {Math.round(hrData.avgHR || 0)} / {Math.round(hrData.maxHR || 0)}
                                </Text>
                                {sessions > 0 && (
                                  <Text style={[styles.sessionText, { color: getTextColor(cellValue) }]}>
                                    {sessions} {sessions === 1 ? 'wkt' : 'wkts'}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <>
                                <Text style={[styles.valueText, { color: getTextColor(cellValue) }]}>
                                  {formatCellValue(cellValue)}
                                </Text>
                                {sessions > 0 && (
                                  <Text style={[styles.sessionText, { color: getTextColor(cellValue) }]}>
                                    {sessions} {sessions === 1 ? 'wkt' : 'wkts'}
                                  </Text>
                                )}
                              </>
                            )}
                          </View>
                        ) : (
                          <Text style={[styles.valueText, { color: '#9CA3AF' }]}>—</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
                <TouchableOpacity
                  style={[styles.cell, styles.totalCell]}
                  onPress={() => {
                    // Show exercise average details
                    if (exerciseAvg !== null || (exerciseData && exerciseData.total_sessions > 0)) {
                      setSelectedCell({
                        exercise,
                        timeDomain: 'All Time Domains',
                        value: exerciseAvg,
                        sessions: exerciseData?.total_sessions || 0,
                        percentile: exercisePercentile,
                        hrData: null,
                        rpeData: null
                      })
                      setShowDetailModal(true)
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.valueBox,
                    { backgroundColor: getCellColor(exerciseAvg) }
                  ]}>
                    {hasMedal(exercisePercentile) && (
                      <Text style={styles.medal}>🏅</Text>
                    )}
                    {exerciseAvg !== null ? (
                      <View>
                        <Text style={[styles.valueText, styles.boldText, { color: getTextColor(exerciseAvg) }]}>
                          {formatCellValue(exerciseAvg)}
                        </Text>
                        {exerciseData && exerciseData.total_sessions > 0 && (
                          <Text style={[styles.sessionText, { color: getTextColor(exerciseAvg) }]}>
                            {exerciseData.total_sessions} {exerciseData.total_sessions === 1 ? 'wkt' : 'wkts'}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={[styles.valueText, { color: '#9CA3AF' }]}>—</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )
          })}

          {/* Time Domain Average Row */}
          <View style={[styles.row, styles.totalRow]}>
            <View style={[styles.cell, styles.exerciseCell, styles.totalRowHeader]}>
              <Text style={styles.totalRowText}>Time Domain Avg</Text>
            </View>
            {timeDomains.map(domain => {
              const domainAvg = calculateTimeDomainAverage(domain)
              const totalWorkouts = data.timeDomainWorkoutCounts?.[domain] || 0
              const domainCells = data.heatmapCells.filter(
                cell => cell.time_range === domain
              )
              const domainPercentile = domainCells.length > 0
                ? Math.round(domainCells.reduce((sum, cell) => 
                    sum + (cell.avg_percentile * cell.session_count), 0) / 
                    domainCells.reduce((sum, cell) => sum + cell.session_count, 0))
                : null

              return (
                <TouchableOpacity
                  key={domain}
                  style={[styles.cell, styles.timeDomainCell]}
                  onPress={() => {
                    // Show time domain average details
                    if (domainAvg !== null || totalWorkouts > 0) {
                      setSelectedCell({
                        exercise: 'All Exercises',
                        timeDomain: domain,
                        value: domainAvg,
                        sessions: totalWorkouts,
                        percentile: domainPercentile,
                        hrData: null,
                        rpeData: null
                      })
                      setShowDetailModal(true)
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.valueBox,
                    { backgroundColor: getCellColor(domainAvg) }
                  ]}>
                    {hasMedal(domainPercentile) && (
                      <Text style={styles.medal}>🏅</Text>
                    )}
                    {domainAvg !== null ? (
                      <View>
                        <Text style={[styles.valueText, styles.boldText, { color: getTextColor(domainAvg) }]}>
                          {formatCellValue(domainAvg)}
                        </Text>
                        {totalWorkouts > 0 && (
                          <Text style={[styles.sessionText, { color: getTextColor(domainAvg) }]}>
                            {totalWorkouts} {totalWorkouts === 1 ? 'wkt' : 'wkts'}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={[styles.valueText, { color: '#9CA3AF' }]}>—</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
            <View style={[styles.cell, styles.totalCell, styles.globalCell]}>
              <View style={styles.globalBox}>
                {hasMedal(data.globalFitnessScore) && (
                  <Text style={styles.medal}>🏅</Text>
                )}
                {(() => {
                  const globalAvg = metric === 'percentile' ? data.globalFitnessScore : getGlobalAverage()
                  const label = metric === 'percentile' ? 'FITNESS' : 
                                metric === 'rpe' ? 'AVG RPE' :
                                metric === 'quality' ? 'AVG QUALITY' : 'AVG HR'
                  
                  return globalAvg !== null ? (
                    <View>
                      <Text style={styles.globalValue}>{formatCellValue(globalAvg)}</Text>
                      <Text style={styles.globalLabel}>{label}</Text>
                    </View>
                  ) : (
                    <Text style={styles.globalValue}>—</Text>
                  )
                })()}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Performance Medal:</Text>
        <View style={styles.legendItem}>
          <Text style={styles.medalIcon}>🏅</Text>
          <Text style={styles.legendText}>90%+</Text>
        </View>
        <Text style={styles.tapHint}>Tap cells for details</Text>
      </View>

      {/* Cell Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedCell && (
              <View>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Cell Details</Text>
                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Exercise:</Text>
                    <Text style={styles.detailValue}>{selectedCell.exercise}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time Domain:</Text>
                    <Text style={styles.detailValue}>{selectedCell.timeDomain}</Text>
                  </View>

                  {selectedCell.value !== null ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        {metric === 'percentile' ? 'Percentile' :
                         metric === 'rpe' ? 'RPE' :
                         metric === 'quality' ? 'Quality' :
                         'Heart Rate'}:
                      </Text>
                      <Text style={styles.detailValue}>
                        {metric === 'heartrate' && selectedCell.hrData
                          ? `${Math.round(selectedCell.hrData.avgHR || 0)} / ${Math.round(selectedCell.hrData.maxHR || 0)} bpm`
                          : formatCellValue(selectedCell.value)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <Text style={styles.detailValue}>No data yet</Text>
                    </View>
                  )}

                  {selectedCell.percentile !== null && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Percentile:</Text>
                      <Text style={styles.detailValue}>{selectedCell.percentile}%</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Workouts:</Text>
                    <Text style={styles.detailValue}>
                      {selectedCell.sessions} {selectedCell.sessions === 1 ? 'workout' : 'workouts'}
                    </Text>
                  </View>

                  {selectedCell.rpeData && selectedCell.rpeData.avgRpe !== null && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Avg RPE:</Text>
                      <Text style={styles.detailValue}>{selectedCell.rpeData.avgRpe.toFixed(1)}/10</Text>
                    </View>
                  )}

                  {selectedCell.rpeData && selectedCell.rpeData.avgQuality !== null && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Avg Quality:</Text>
                      <Text style={styles.detailValue}>
                        {getQualityGrade(selectedCell.rpeData.avgQuality)}
                      </Text>
                    </View>
                  )}

                  {hasMedal(selectedCell.percentile) && (
                    <View style={styles.medalBadge}>
                      <Text style={styles.medalBadgeText}>🏅 Elite Performance (90%+)</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function getMetricSubtitle(metricType: MetricType): string {
  switch (metricType) {
    case 'percentile': return 'Task Level Percentile Analysis'
    case 'rpe': return 'Rate of Perceived Exertion'
    case 'quality': return 'Movement Quality Grades'
    case 'heartrate': return 'Average Heart Rate (bpm)'
    default: return 'Task Level Analysis'
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#282B34',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cell: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
    minHeight: 70,
  },
  headerCell: {
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  exerciseHeaderCell: {
    minWidth: 120,
    alignItems: 'flex-start',
  },
  exerciseCell: {
    backgroundColor: '#DAE2EA',
    minWidth: 120,
    alignItems: 'flex-start',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  timeDomainCell: {
    minWidth: 90,
  },
  totalCell: {
    backgroundColor: '#F8FBFE',
    borderLeftWidth: 2,
    borderLeftColor: '#282B34',
    minWidth: 100,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#282B34',
    textAlign: 'center',
  },
  exerciseText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#282B34',
  },
  valueBox: {
    width: 75,
    height: 65,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '700',
  },
  sessionText: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.75,
  },
  medal: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 12,
  },
  totalRow: {
    backgroundColor: '#F8FBFE',
    borderTopWidth: 2,
    borderTopColor: '#282B34',
  },
  totalRowHeader: {
    backgroundColor: '#DAE2EA',
    borderRightWidth: 2,
    borderRightColor: '#282B34',
  },
  totalRowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#282B34',
  },
  globalCell: {
    backgroundColor: '#DAE2EA',
  },
  globalBox: {
    width: 75,
    height: 65,
    borderRadius: 8,
    backgroundColor: '#FE5858',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  globalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FBFE',
  },
  globalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FBFE',
    marginTop: 2,
    opacity: 0.75,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#3B82F6',
    textAlign: 'center',
  },
  legend: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  medalIcon: {
    fontSize: 16,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  tapHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  modalBody: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    flex: 1,
    textAlign: 'right',
  },
  medalBadge: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  medalBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
})



