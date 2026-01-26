import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import { Card } from '@/components/ui/Card'

type MetricType = 'percentile' | 'rpe' | 'quality' | 'heartrate'

export interface HeatmapCell {
  exercise_name: string
  time_range: string | null
  session_count: number
  avg_percentile: number
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  avg_rpe?: number | null
  avg_quality?: number | null
}

export interface ExerciseAverage {
  exercise_name: string
  total_sessions: number
  overall_avg_percentile: number
}

interface MetConHeatMapProps {
  heatmapCells: HeatmapCell[]
  exerciseAverages: ExerciseAverage[]
  globalFitnessScore: number | null
  timeDomainWorkoutCounts?: Record<string, number>
  metric?: MetricType
  hideTitle?: boolean
}

interface CellDetail {
  exercise: string
  timeDomain: string
  value: number | null
  sessions: number
  percentile: number | null
  hrData?: { avgHR: number | null; maxHR: number | null } | null
  rpeData?: { avgRpe: number | null; avgQuality: number | null } | null
}

export default function MetConHeatMap({
  heatmapCells,
  exerciseAverages,
  globalFitnessScore,
  timeDomainWorkoutCounts,
  metric = 'percentile',
  hideTitle = false,
}: MetConHeatMapProps) {
  const [selectedCell, setSelectedCell] = useState<CellDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Extract unique exercises and time domains
  const exercises = [...new Set(heatmapCells.map((c) => c.exercise_name))].sort()
  const timeDomains = [...new Set(heatmapCells.map((c) => c.time_range).filter(Boolean))]
    .sort((a, b) => {
      const order: Record<string, number> = {
        '1:00–5:00': 1,
        '5:00–10:00': 2,
        '10:00–15:00': 3,
        '15:00–20:00': 4,
        '20:00–30:00': 5,
        '30:00+': 6,
      }
      return (order[a as string] || 7) - (order[b as string] || 7)
    }) as string[]

  if (!heatmapCells || heatmapCells.length === 0 || exercises.length === 0) {
    const emptyMessage =
      metric === 'percentile'
        ? 'Complete more workouts to see exercise-specific performance data!'
        : metric === 'rpe'
          ? 'Log workouts with RPE to see effort statistics!'
          : metric === 'quality'
            ? 'Log workouts with Quality ratings to see statistics!'
            : 'Log workouts with Heart Rate to see statistics!'

    return (
      <View style={styles.emptyContainer}>
        {!hideTitle && <Text style={styles.emptyTitle}>{getMetricTitle(metric)}</Text>}
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>💪</Text>
          <Text style={styles.emptyTitleText}>No {getMetricTitle(metric)} Data Yet</Text>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      </View>
    )
  }

  const getCellValue = (exercise: string, timeDomain: string): number | null => {
    const cell = heatmapCells.find(
      (c) => c.exercise_name === exercise && c.time_range === timeDomain
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
    const cell = heatmapCells.find(
      (c) => c.exercise_name === exercise && c.time_range === timeDomain
    )
    return cell ? cell.session_count : 0
  }

  const getHRData = (
    exercise: string,
    timeDomain: string
  ): { avgHR: number | null; maxHR: number | null } | null => {
    const cell = heatmapCells.find(
      (c) => c.exercise_name === exercise && c.time_range === timeDomain
    )
    return cell
      ? {
          avgHR: cell.avg_heart_rate ?? null,
          maxHR: cell.max_heart_rate ?? null,
        }
      : null
  }

  const getPercentile = (exercise: string, timeDomain: string): number | null => {
    const cell = heatmapCells.find(
      (c) => c.exercise_name === exercise && c.time_range === timeDomain
    )
    return cell ? cell.avg_percentile : null
  }

  const calculateExerciseAverage = (exercise: string): number | null => {
    const exerciseCells = heatmapCells.filter((c) => c.exercise_name === exercise)
    if (exerciseCells.length === 0) return null

    let totalWeighted = 0
    let totalSessions = 0

    exerciseCells.forEach((cell) => {
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
    const domainCells = heatmapCells.filter((c) => c.time_range === timeDomain)
    if (domainCells.length === 0) return null

    let totalWeighted = 0
    let totalSessions = 0

    domainCells.forEach((cell) => {
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

    heatmapCells.forEach((cell) => {
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
        return `${Math.round(value)}%`
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

  const handleCellPress = (exercise: string, timeDomain: string) => {
    const cellValue = getCellValue(exercise, timeDomain)
    const sessions = getSessionCount(exercise, timeDomain)
    const percentile = getPercentile(exercise, timeDomain)
    const hrData = getHRData(exercise, timeDomain)
    const cell = heatmapCells.find(
      (c) => c.exercise_name === exercise && c.time_range === timeDomain
    )
    const rpeData = cell
      ? {
          avgRpe: cell.avg_rpe ?? null,
          avgQuality: cell.avg_quality ?? null,
        }
      : null

    if (cellValue !== null || sessions > 0) {
      setSelectedCell({
        exercise,
        timeDomain,
        value: cellValue,
        sessions,
        percentile,
        hrData,
        rpeData,
      })
      setShowDetailModal(true)
    }
  }

  const handleExerciseAvgPress = (exercise: string) => {
    const exerciseAvg = calculateExerciseAverage(exercise)
    const exerciseData = exerciseAverages.find((avg) => avg.exercise_name === exercise)
    const exercisePercentile = exerciseData?.overall_avg_percentile || null

    if (exerciseAvg !== null || (exerciseData && exerciseData.total_sessions > 0)) {
      setSelectedCell({
        exercise,
        timeDomain: 'All Time Domains',
        value: exerciseAvg,
        sessions: exerciseData?.total_sessions || 0,
        percentile: exercisePercentile,
        hrData: null,
        rpeData: null,
      })
      setShowDetailModal(true)
    }
  }

  const handleTimeDomainAvgPress = (timeDomain: string) => {
    const domainAvg = calculateTimeDomainAverage(timeDomain)
    const totalWorkouts = timeDomainWorkoutCounts?.[timeDomain] || 0
    const domainCells = heatmapCells.filter((c) => c.time_range === timeDomain)
    const domainPercentile =
      domainCells.length > 0
        ? Math.round(
            domainCells.reduce((sum, cell) => sum + cell.avg_percentile * cell.session_count, 0) /
              domainCells.reduce((sum, cell) => sum + cell.session_count, 0)
          )
        : null

    if (domainAvg !== null || totalWorkouts > 0) {
      setSelectedCell({
        exercise: 'All Exercises',
        timeDomain,
        value: domainAvg,
        sessions: totalWorkouts,
        percentile: domainPercentile,
        hrData: null,
        rpeData: null,
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
          <View style={styles.headerRow}>
            <View style={styles.exerciseHeaderCell}>
              <Text style={styles.headerText}>Exercise</Text>
            </View>
            {timeDomains.map((domain) => (
              <View key={domain} style={styles.headerCell}>
                <Text style={styles.headerText}>{domain}</Text>
              </View>
            ))}
            <View style={styles.exerciseAvgHeaderCell}>
              <Text style={styles.headerText}>Exercise Avg</Text>
            </View>
          </View>

          {/* Data Rows */}
          {exercises.map((exercise) => {
            const exerciseAvg = calculateExerciseAverage(exercise)
            const exerciseData = exerciseAverages.find((avg) => avg.exercise_name === exercise)

            return (
              <View key={exercise} style={styles.row}>
                {/* Exercise Name */}
                <View style={styles.exerciseCell}>
                  <Text style={styles.exerciseText} numberOfLines={0}>
                    {exercise}
                  </Text>
                </View>

                {/* Time Domain Cells */}
                {timeDomains.map((domain) => {
                  const cellValue = getCellValue(exercise, domain)
                  const sessions = getSessionCount(exercise, domain)
                  const hrData = getHRData(exercise, domain)
                  const hasData = cellValue !== null

                  return (
                    <TouchableOpacity
                      key={domain}
                      style={styles.dataCell}
                      onPress={() => handleCellPress(exercise, domain)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.cellContent,
                          {
                            backgroundColor: hasData ? '#F8FBFE' : '#F3F4F6',
                            borderColor: '#282B34',
                          },
                        ]}
                      >
                        {hasData ? (
                          <View>
                            {metric === 'heartrate' && hrData ? (
                              <>
                                <Text style={styles.cellValue}>
                                  {Math.round(hrData.avgHR || 0)} / {Math.round(hrData.maxHR || 0)}
                                </Text>
                                {sessions > 0 && (
                                  <Text style={styles.cellSessions}>
                                    {sessions} {sessions === 1 ? 'workout' : 'workouts'}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <>
                                <Text style={styles.cellValue}>{formatCellValue(cellValue)}</Text>
                                {sessions > 0 && (
                                  <Text style={styles.cellSessions}>
                                    {sessions} {sessions === 1 ? 'workout' : 'workouts'}
                                  </Text>
                                )}
                              </>
                            )}
                          </View>
                        ) : (
                          <Text style={styles.cellValueEmpty}>—</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}

                {/* Exercise Average Cell */}
                <TouchableOpacity
                  style={styles.exerciseAvgCell}
                  onPress={() => handleExerciseAvgPress(exercise)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.cellContent,
                      {
                        backgroundColor: exerciseAvg !== null ? '#F8FBFE' : '#F3F4F6',
                        borderColor: '#282B34',
                      },
                    ]}
                  >
                    {exerciseAvg !== null ? (
                      <View>
                        <Text style={[styles.cellValue, styles.boldText]}>
                          Avg: {formatCellValue(exerciseAvg)}
                        </Text>
                        {exerciseData && exerciseData.total_sessions > 0 && (
                          <Text style={styles.cellSessions}>
                            {exerciseData.total_sessions}{' '}
                            {exerciseData.total_sessions === 1 ? 'workout' : 'workouts'}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.cellValueEmpty}>—</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )
          })}

          {/* Time Domain Average Row */}
          <View style={styles.totalRow}>
            <View style={styles.totalRowHeader}>
              <Text style={styles.totalRowText}>Time Domain Avg</Text>
            </View>
            {timeDomains.map((domain) => {
              const domainAvg = calculateTimeDomainAverage(domain)
              const totalWorkouts =
                timeDomainWorkoutCounts?.[domain] ||
                heatmapCells
                  .filter((c) => c.time_range === domain)
                  .reduce((sum, c) => sum + c.session_count, 0)

              return (
                <TouchableOpacity
                  key={domain}
                  style={styles.dataCell}
                  onPress={() => handleTimeDomainAvgPress(domain)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.cellContent,
                      {
                        backgroundColor: domainAvg !== null ? '#F8FBFE' : '#F3F4F6',
                        borderColor: '#282B34',
                      },
                    ]}
                  >
                    {domainAvg !== null ? (
                      <View>
                        <Text style={[styles.cellValue, styles.boldText]}>
                          Avg: {formatCellValue(domainAvg)}
                        </Text>
                        {totalWorkouts > 0 && (
                          <Text style={styles.cellSessions}>
                            {totalWorkouts} {totalWorkouts === 1 ? 'workout' : 'workouts'}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.cellValueEmpty}>—</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}

            {/* Global Average Cell */}
            <View style={styles.globalCell}>
              <View style={styles.globalCellContent}>
                {(() => {
                  const globalAvg =
                    metric === 'percentile' ? globalFitnessScore : getGlobalAverage()
                  const label =
                    metric === 'percentile'
                      ? 'FITNESS'
                      : metric === 'rpe'
                        ? 'AVG RPE'
                        : metric === 'quality'
                          ? 'AVG QUALITY'
                          : 'AVG HR'

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
        <Text style={styles.legendText}>Tap cells for details</Text>
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
                        {metric === 'percentile'
                          ? 'Percentile'
                          : metric === 'rpe'
                            ? 'RPE'
                            : metric === 'quality'
                              ? 'Quality'
                              : 'Heart Rate'}
                        :
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

                  {selectedCell.percentile !== null && metric !== 'percentile' && (
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

                  {selectedCell.rpeData && selectedCell.rpeData.avgRpe !== null && metric !== 'rpe' && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Avg RPE:</Text>
                      <Text style={styles.detailValue}>
                        {selectedCell.rpeData.avgRpe.toFixed(1)}/10
                      </Text>
                    </View>
                  )}

                  {selectedCell.rpeData &&
                    selectedCell.rpeData.avgQuality !== null &&
                    metric !== 'quality' && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Avg Quality:</Text>
                        <Text style={styles.detailValue}>
                          {getQualityGrade(selectedCell.rpeData.avgQuality)}
                        </Text>
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

function getMetricTitle(metricType: MetricType): string {
  switch (metricType) {
    case 'percentile':
      return 'Percentile Heatmap'
    case 'rpe':
      return 'RPE Heatmap'
    case 'quality':
      return 'Quality Heatmap'
    case 'heartrate':
      return 'Heart Rate Heatmap'
    default:
      return 'MetCon Heat Map'
  }
}

function getMetricSubtitle(metricType: MetricType): string {
  switch (metricType) {
    case 'percentile':
      return 'Task Level Percentile Analysis'
    case 'rpe':
      return 'Rate of Perceived Exertion'
    case 'quality':
      return 'Movement Quality Grades'
    case 'heartrate':
      return 'Average Heart Rate (bpm)'
    default:
      return 'Task Level Analysis'
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
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#DAE2EA',
    borderBottomWidth: 2,
    borderBottomColor: '#282B34',
  },
  headerCell: {
    width: 80,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseHeaderCell: {
    width: 120,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseAvgHeaderCell: {
    width: 80,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#282B34',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DAE2EA',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 60,
    alignItems: 'stretch',
  },
  exerciseCell: {
    width: 120,
    padding: 12,
    backgroundColor: '#DAE2EA',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  exerciseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#282B34',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  dataCell: {
    width: 80,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  exerciseAvgCell: {
    width: 80,
    padding: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#282B34',
  },
  cellContent: {
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 1,
  },
  cellValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
    textAlign: 'center',
  },
  cellValueEmpty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '700',
  },
  cellSessions: {
    fontSize: 10,
    marginTop: 2,
    color: '#FE5858',
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FBFE',
    borderTopWidth: 2,
    borderTopColor: '#282B34',
    minHeight: 60,
    alignItems: 'stretch',
  },
  totalRowHeader: {
    width: 120,
    padding: 12,
    backgroundColor: '#DAE2EA',
    borderRightWidth: 2,
    borderRightColor: '#282B34',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  totalRowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#282B34',
  },
  globalCell: {
    width: 80,
    padding: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#282B34',
    backgroundColor: '#DAE2EA',
  },
  globalCellContent: {
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    backgroundColor: '#FE5858',
    borderWidth: 1,
    borderColor: '#282B34',
  },
  globalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FBFE',
    textAlign: 'center',
  },
  globalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F8FBFE',
    marginTop: 2,
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
    alignItems: 'center',
  },
  legendText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
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
})
