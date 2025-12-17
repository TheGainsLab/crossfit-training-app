import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '@/lib/supabase/client'
import { fetchEngineAnalytics } from '@/lib/api/analytics'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'

interface WorkoutSession {
  id?: string
  user_id?: string
  workout_id?: string
  date?: string
  program_day?: number
  program_day_number?: number
  program_version?: string
  user_phase?: number
  modality?: string
  time_trial_baseline_id?: string
  day_type?: string
  total_output?: number
  actual_pace?: number
  target_pace?: number
  performance_ratio?: number
  units?: string
  average_heart_rate?: number
  peak_heart_rate?: number
  perceived_exertion?: number
  completed?: boolean
  workout_data?: any
  created_at?: string
  day_number?: number
  workout_day?: number
  duration_minutes?: number
  duration_seconds?: number
  avg_work_rest_ratio?: number | null
}

// Engine Tab Component
function EngineTab({ engineData, userId }: { engineData: any; userId: number | null }) {
  const [currentView, setCurrentView] = useState('menu')
  
  if (!engineData) {
    return (
      <View style={styles.sectionGap}>
        <Card>
          <SectionHeader title="Engine Analytics" />
          <Text style={styles.noDataText}>Loading Engine data...</Text>
        </Card>
      </View>
    )
  }

  const hasData = engineData.totalSessions > 0 || engineData.totalTimeTrials > 0

  const analyticsOptions = [
    { id: 'history', title: 'My History', description: 'Performance trends by day type and modality', icon: '📈' },
    { id: 'comparisons', title: 'Comparisons', description: 'Side by side day type analysis', icon: '⚖️' },
    { id: 'time-trials', title: 'My Time Trials', description: 'Detailed time trial tracking', icon: '🎯' },
    { id: 'targets', title: 'Targets vs Actual', description: 'Compare performance against targets', icon: '🎯' },
    { id: 'records', title: 'Personal Records', description: 'Best performances by day type', icon: '🏆' },
    { id: 'heart-rate', title: 'HR Analytics', description: 'Heart rate analysis and efficiency', icon: '❤️' },
    { id: 'work-rest', title: 'Work:Rest Ratio', description: 'Interval structure analysis', icon: '⏱️' },
    { id: 'variability', title: 'Variability Trend', description: 'Consistency tracking', icon: '📉' },
  ]

  // Render menu view
  if (currentView === 'menu') {
    return (
      <View style={styles.sectionGap}>
        {/* Summary Stats */}
        {hasData && (
          <Card style={{ paddingTop: 24 }}>
            <SectionHeader title="Summary" />
            <View style={[styles.statsRow, { paddingHorizontal: 16 }]}>
              <View style={styles.statCardWrapper}>
                <StatCard label="Workouts" value={engineData.totalSessions} />
              </View>
              <View style={styles.statCardWrapper}>
                <StatCard label="Time Trials" value={engineData.totalTimeTrials} />
              </View>
            </View>
          </Card>
        )}

        {/* No Data State */}
        {!hasData && (
        <Card>
          <SectionHeader title="Engine Analytics" />
          <Text style={styles.noDataText}>
            No Engine workout data yet. Complete Engine workouts to see detailed analytics!
          </Text>
        </Card>
        )}

        {/* Analytics Menu */}
        <View style={styles.activityList}>
          {analyticsOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setCurrentView(option.id)}
              activeOpacity={0.7}
            >
              <Card style={styles.engineAnalyticsCard}>
                <Text style={styles.engineAnalyticsCardTitle}>
                  {option.title}
                </Text>
                <Text style={styles.engineAnalyticsCardDescription}>
                  {option.description}
                </Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  // Render detail views
  return (
    <View style={styles.sectionGap}>
      {/* Back button */}
      <TouchableOpacity
        onPress={() => setCurrentView('menu')}
        style={{
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
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={16} color="#F8FBFE" style={{ marginRight: 6 }} />
        <Text style={{ fontSize: 16, color: '#F8FBFE', fontWeight: '600' }}>Back</Text>
      </TouchableOpacity>

      {/* Render specific view content */}
      {currentView === 'history' && <EngineHistoryView engineData={engineData} />}
      {currentView === 'comparisons' && <EngineComparisonsView engineData={engineData} />}
      {currentView === 'time-trials' && <EngineTimeTrialsView engineData={engineData} />}
      {currentView === 'targets' && <EngineTargetsView engineData={engineData} />}
      {currentView === 'records' && <EngineRecordsView engineData={engineData} />}
      {currentView === 'heart-rate' && <EngineHeartRateView engineData={engineData} />}
      {currentView === 'work-rest' && <EngineWorkRestView engineData={engineData} />}
      {currentView === 'variability' && <EngineVariabilityView engineData={engineData} />}
    </View>
  )
}

// Engine Overview View
function EngineOverviewView({ engineData }: { engineData: any }) {
  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      <Card>
        <SectionHeader title="Overview" />
        <View style={styles.statsRow}>
          <View style={styles.statCardWrapper}>
            <StatCard label="Total Sessions" value={engineData.totalSessions} />
          </View>
          <View style={styles.statCardWrapper}>
            <StatCard label="Time Trials" value={engineData.totalTimeTrials} />
          </View>
        </View>
      </Card>

      {/* Modalities */}
      {engineData.modalities?.length > 0 && (
        <Card>
          <SectionHeader title="Modalities" />
          <View style={styles.activityBlocks}>
            {engineData.modalities.map((modality: string, idx: number) => (
              <View key={idx} style={styles.blockBadge}>
                <Text style={styles.blockBadgeText}>{formatModality(modality)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Recent Sessions */}
      {engineData.sessions?.length > 0 && (
        <View>
          <SectionHeader title="Recent Sessions" />
          <View style={styles.activityList}>
            {engineData.sessions.slice(0, 5).map((session: any, index: number) => (
              <Card key={session.id || index}>
                <View style={styles.activityCardHeader}>
                  <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                  {session.day_type && (
                    <Text style={styles.activitySessionType}>
                      {session.day_type.charAt(0).toUpperCase() + session.day_type.slice(1)}
                    </Text>
                  )}
                </View>
                {session.modality && (
                  <Text style={styles.activityExercisesText}>{formatModality(session.modality)}</Text>
                )}
                {session.total_output && (
                  <Text style={styles.activityExercisesText}>
                    Output: {session.total_output} {session.units || ''}
                  </Text>
                )}
              </Card>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

// My History View - Performance trends by day type and modality
// Horizontal Bar Chart Component
function HorizontalBarChart({ 
  data, 
  labels, 
  maxValue, 
  unit = '', 
  height = 32 
}: { 
  data: number[], 
  labels: string[], 
  maxValue: number,
  unit?: string,
  height?: number
}) {
  return (
    <View>
      {data.map((value, index) => {
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
        return (
          <View key={index} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: '#6B7280', width: 60 }}>
                {labels[index]}
              </Text>
              <View style={{ flex: 1, height, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
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
                {Math.round(value)}{unit}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function EngineHistoryView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')
  const [selectedMetric, setSelectedMetric] = useState<'output' | 'pace'>('output')

  // Get available modalities from sessions
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality) modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  // Get available day types for selected modality
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (!selectedModality || s.modality === selectedModality) {
        if (s.day_type) dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  // Filter sessions
  const filteredSessions = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return []
    
    return engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.modality === selectedModality
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []
  }, [engineData.sessions, selectedDayType, selectedModality])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Modality Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Modality
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableModalities.map((modality) => (
              <TouchableOpacity
                key={modality}
                onPress={() => {
                  setSelectedModality(modality)
                  setSelectedDayType('') // Reset day type
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatModality(modality)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Day Type Filter */}
      {selectedModality && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Day Type
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {availableDayTypes.map((dayType) => (
                <TouchableOpacity
                  key={dayType}
                  onPress={() => setSelectedDayType(dayType)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {formatDayType(dayType)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Card>
      )}

      {/* Results */}
      {selectedDayType && selectedModality && (
        <>
          <SectionHeader title={`Performance History (${filteredSessions.length} sessions)`} />
          
          {filteredSessions.length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No sessions found for {formatDayType(selectedDayType)} with {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : filteredSessions.length === 1 ? (
            // Show single session as card if only one session
            <Card>
              <View style={styles.activityCardHeader}>
                <Text style={styles.activityMeta}>{formatDate(filteredSessions[0].date)}</Text>
                <Text style={styles.activityMeta}>Day {filteredSessions[0].program_day_number}</Text>
              </View>
                  <Text style={styles.activityExercisesText}>
                Output: {filteredSessions[0].total_output} {filteredSessions[0].units || ''}
              </Text>
              {filteredSessions[0].actual_pace && (
                <Text style={styles.activityExercisesText}>
                  Pace: {Math.round(filteredSessions[0].actual_pace)} {filteredSessions[0].units}/min
                </Text>
              )}
              {filteredSessions[0].performance_ratio && (
                <Text style={[
                  styles.activityExercisesText,
                  { 
                    color: parseFloat(filteredSessions[0].performance_ratio) >= 1.0 ? '#10B981' : 
                           parseFloat(filteredSessions[0].performance_ratio) >= 0.9 ? '#3B82F6' : '#F59E0B',
                    fontWeight: '600'
                  }
                ]}>
                  Performance: {(parseFloat(filteredSessions[0].performance_ratio) * 100).toFixed(0)}%
                  </Text>
                )}
              </Card>
          ) : (
            <ScrollView>
              {/* Metric Toggle */}
              <Card style={{ padding: 16, borderWidth: 1, borderColor: '#282B34', marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
                  Select Metric
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setSelectedMetric('output')}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: selectedMetric === 'output' ? '#FE5858' : '#E5E7EB',
                      backgroundColor: selectedMetric === 'output' ? '#FFFFFF' : '#F3F4F6',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      color: '#282B34',
                      fontWeight: '600',
                      fontSize: 14,
                    }}>
                      Output
                    </Text>
                  </TouchableOpacity>
                  {filteredSessions.some((s: any) => s.actual_pace) && (
                    <TouchableOpacity
                      onPress={() => setSelectedMetric('pace')}
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: selectedMetric === 'pace' ? '#FE5858' : '#E5E7EB',
                        backgroundColor: selectedMetric === 'pace' ? '#FFFFFF' : '#F3F4F6',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: 14,
                      }}>
                        Pace
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>

              {/* Output Chart */}
              {selectedMetric === 'output' && (
                <Card style={{ padding: 16, borderWidth: 1, borderColor: '#282B34', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                    Output Over Time
                  </Text>
                  <HorizontalBarChart
                    data={filteredSessions.map((s: any) => parseFloat(s.total_output) || 0)}
                    labels={filteredSessions.map((s: any) => formatDate(s.date))}
                    maxValue={Math.max(...filteredSessions.map((s: any) => parseFloat(s.total_output) || 0))}
                    unit={` ${filteredSessions[0]?.units || ''}`}
                    height={32}
                  />
                </Card>
              )}

              {/* Pace Chart */}
              {selectedMetric === 'pace' && filteredSessions.some((s: any) => s.actual_pace) && (
                <Card style={{ padding: 16, borderWidth: 1, borderColor: '#282B34', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                    Pace Over Time
                  </Text>
                  <HorizontalBarChart
                    data={filteredSessions.map((s: any) => Math.round(parseFloat(s.actual_pace) || 0))}
                    labels={filteredSessions.map((s: any) => formatDate(s.date))}
                    maxValue={Math.max(...filteredSessions.map((s: any) => Math.round(parseFloat(s.actual_pace) || 0)))}
                    unit={` ${filteredSessions[0]?.units || ''}/min`}
                    height={32}
                  />
                </Card>
              )}

              {/* Performance Ratio Chart (if available) */}
              {filteredSessions.some((s: any) => s.performance_ratio) && (
                <Card style={{ padding: 16, borderWidth: 1, borderColor: '#282B34', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                    Performance Ratio Over Time
                  </Text>
                  <HorizontalBarChart
                    data={filteredSessions.map((s: any) => (parseFloat(s.performance_ratio) || 0) * 100)}
                    labels={filteredSessions.map((s: any) => formatDate(s.date))}
                    maxValue={Math.max(...filteredSessions.map((s: any) => (parseFloat(s.performance_ratio) || 0) * 100), 100)}
                    unit="%"
                    height={32}
                  />
                </Card>
              )}
            </ScrollView>
          )}
        </>
      )}
    </View>
  )
}

function EngineComparisonsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')
  const [selectedDayTypes, setSelectedDayTypes] = useState<string[]>([])
  const [selectedMetric, setSelectedMetric] = useState<'pace' | 'output'>('output')

  // Get available modalities
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality && s.day_type !== 'time_trial') modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  // Get available day types for selected modality
  const availableDayTypes = React.useMemo(() => {
    if (!selectedModality) return []
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality === selectedModality && s.day_type && s.day_type !== 'time_trial') {
        dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  // Calculate comparison data
  const comparisonData = React.useMemo(() => {
    if (!selectedModality || selectedDayTypes.length === 0) return []
    
    const data = selectedDayTypes.map((dayType) => {
      const sessions = engineData.sessions?.filter((s: any) => 
        s.modality === selectedModality && 
        s.day_type === dayType &&
        s.total_output
      ) || []
      
      if (sessions.length === 0) return null
      
      const avgOutput = sessions.reduce((sum: number, s: any) => sum + parseFloat(s.total_output), 0) / sessions.length
      const maxOutput = Math.max(...sessions.map((s: any) => parseFloat(s.total_output)))
      const avgPace = sessions.filter((s: any) => s.actual_pace).reduce((sum: number, s: any) => sum + parseFloat(s.actual_pace), 0) / sessions.filter((s: any) => s.actual_pace).length
      
      return {
        dayType,
        sessionCount: sessions.length,
        avgOutput: Math.round(avgOutput),
        maxOutput: Math.round(maxOutput),
        avgPace: Math.round(avgPace),
        units: sessions[0].units
      }
    }).filter(Boolean)
    
    // Sort in descending order based on selected metric
    return data.sort((a: any, b: any) => {
      const aValue = selectedMetric === 'output' ? a.avgOutput : (a.avgPace || 0)
      const bValue = selectedMetric === 'output' ? b.avgOutput : (b.avgPace || 0)
      return bValue - aValue // Descending order
    })
  }, [engineData.sessions, selectedModality, selectedDayTypes, selectedMetric])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const toggleDayType = (dayType: string) => {
    if (selectedDayTypes.includes(dayType)) {
      setSelectedDayTypes(selectedDayTypes.filter(dt => dt !== dayType))
    } else {
      setSelectedDayTypes([...selectedDayTypes, dayType])
    }
  }

  return (
    <View style={styles.sectionGap}>
      {/* Modality Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Modality
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableModalities.map((modality) => (
              <TouchableOpacity
                key={modality}
                onPress={() => {
                  setSelectedModality(modality)
                  setSelectedDayTypes([]) // Reset day types
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatModality(modality)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Day Type Selection */}
      {selectedModality && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Day Types to Compare (tap multiple)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => toggleDayType(dayType)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedDayTypes.includes(dayType) ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedDayTypes.includes(dayType) ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
        </Card>
      )}

      {/* Comparison Results */}
      {comparisonData.length > 0 && (
        <>
          <SectionHeader title="Comparison Results" />
          
          {/* Metric Toggle */}
          <Card style={{ padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
              Select Metric
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <TouchableOpacity
                onPress={() => setSelectedMetric('output')}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedMetric === 'output' ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedMetric === 'output' ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                  Avg Output
                </Text>
              </TouchableOpacity>
              {comparisonData.some((d: any) => d.avgPace) && (
                <TouchableOpacity
                  onPress={() => setSelectedMetric('pace')}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedMetric === 'pace' ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedMetric === 'pace' ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 14,
                  }}>
                    Avg Pace
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Single Chart with All Day Types */}
          <Card style={{ padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
              {selectedMetric === 'output' ? 'Average Output Comparison' : 'Average Pace Comparison'}
            </Text>
            <HorizontalBarChart
              data={comparisonData.map((data: any) => 
                selectedMetric === 'output' 
                  ? data.avgOutput 
                  : (data.avgPace || 0)
              )}
              labels={comparisonData.map((data: any) => 
                `${formatDayType(data.dayType)} (${data.sessionCount})`
              )}
              maxValue={Math.max(...comparisonData.map((data: any) => 
                selectedMetric === 'output' 
                  ? data.avgOutput 
                  : (data.avgPace || 0)
              ))}
              unit={selectedMetric === 'output' 
                ? ` ${comparisonData[0]?.units || ''}` 
                : ` ${comparisonData[0]?.units || ''}/min`}
              height={32}
            />
          </Card>
        </>
      )}
    </View>
  )
}

function EngineTimeTrialsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Get available modalities from time trials
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.timeTrials?.forEach((trial: any) => {
      if (trial.modality) modalities.add(trial.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.timeTrials])

  // Filter and sort time trials by selected modality
  const filteredTrials = React.useMemo(() => {
    if (!selectedModality) return []
    
    const trials = engineData.timeTrials?.filter((trial: any) => 
      trial.modality === selectedModality && trial.total_output
    ) || []
    
    // Sort by date (most recent first)
    return trials.sort((a: any, b: any) => {
      const dateA = new Date(a.date || a.created_at).getTime()
      const dateB = new Date(b.date || b.created_at).getTime()
      return dateB - dateA
    })
  }, [engineData.timeTrials, selectedModality])

  // Find the most recent trial (first in sorted array)
  const mostRecentTrialId = filteredTrials.length > 0 ? (filteredTrials[0].id || filteredTrials[0].date || filteredTrials[0].created_at) : null

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="My Time Trials" />
      
      {engineData.timeTrials?.length === 0 ? (
        <Card>
          <Text style={styles.noDataText}>No time trials completed yet.</Text>
        </Card>
      ) : (
        <>
          {/* Modality Filter */}
          <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
              Select Modality
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {availableModalities.map((modality) => (
                  <TouchableOpacity
                    key={modality}
                    onPress={() => setSelectedModality(modality)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                      backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      color: '#282B34',
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                      {formatModality(modality)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Card>

          {/* Results */}
          {selectedModality && filteredTrials.length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No time trials found for {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : selectedModality && filteredTrials.length > 0 ? (
            <Card style={{ padding: 16 }}>
              <View>
                {filteredTrials.map((trial: any, index: number) => {
                  const trialDate = formatDate(trial.date || trial.created_at)
                  const output = parseFloat(trial.total_output) || 0
                  const maxOutput = Math.max(...filteredTrials.map((t: any) => parseFloat(t.total_output) || 0))
                  const percentage = maxOutput > 0 ? (output / maxOutput) * 100 : 0

                  return (
                    <View key={trial.id || index} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ width: 100 }}>
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            {trialDate}
                          </Text>
                        </View>
                        <View style={{ flex: 1, height: 32, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
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
                          {Math.round(output)} {trial.units || ''}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            </Card>
          ) : null}
        </>
      )}
    </View>
  )
}

function EngineTargetsView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')

  // Get available day types (exclude time trials)
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && s.day_type !== 'time_trial') dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Get available modalities for selected day type
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if ((!selectedDayType || s.day_type === selectedDayType) && s.day_type !== 'time_trial') {
        if (s.modality) modalities.add(s.modality)
      }
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions, selectedDayType])

  // Filter sessions with target data
  const filteredSessions = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return []
    
    return engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.modality === selectedModality &&
      s.target_pace && s.actual_pace
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []
  }, [engineData.sessions, selectedDayType, selectedModality])

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (filteredSessions.length === 0) return null
    
    const avgTarget = filteredSessions.reduce((sum: number, s: any) => sum + parseFloat(s.target_pace), 0) / filteredSessions.length
    const avgActual = filteredSessions.reduce((sum: number, s: any) => sum + parseFloat(s.actual_pace), 0) / filteredSessions.length
    const avgRatio = filteredSessions.reduce((sum: number, s: any) => sum + parseFloat(s.performance_ratio || 0), 0) / filteredSessions.length
    
    // Calculate days where target was hit (performance_ratio >= 1.0)
    const daysTargetHit = filteredSessions.filter((s: any) => parseFloat(s.performance_ratio || 0) >= 1.0).length
    const totalDays = filteredSessions.length
    
    return {
      avgTarget: Math.round(avgTarget),
      avgActual: Math.round(avgActual),
      avgRatio: (avgRatio * 100).toFixed(0),
      daysTargetHit,
      totalDays
    }
  }, [filteredSessions])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => {
                  setSelectedDayType(dayType)
                  setSelectedModality('') // Reset modality
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Modality Filter */}
      {selectedDayType && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Modality
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {availableModalities.map((modality) => (
                <TouchableOpacity
                  key={modality}
                  onPress={() => setSelectedModality(modality)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {formatModality(modality)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Card>
      )}

      {/* Results */}
      {selectedDayType && selectedModality && (
        <>
          {/* Target Hit Ratio Bar Chart */}
          {stats && stats.totalDays > 0 && (
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                Target Performance
              </Text>
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', width: 80 }}>
                    Days Completed
                  </Text>
                  <View style={{ flex: 1, height: 40, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8, position: 'relative' }}>
                    {/* Background bar for total days */}
                    <View 
                      style={{ 
                        height: '100%', 
                        width: '100%', 
                        backgroundColor: '#E5E7EB',
                        position: 'absolute'
                      }} 
                    />
                    {/* Green bar for days target hit */}
                    <View 
                      style={{ 
                        height: '100%', 
                        width: `${(stats.daysTargetHit / stats.totalDays) * 100}%`, 
                        backgroundColor: '#10B981',
                        borderRadius: 4
                      }} 
                    />
                    {/* Red bar for days target not hit */}
                    <View 
                      style={{ 
                        height: '100%', 
                        width: `${((stats.totalDays - stats.daysTargetHit) / stats.totalDays) * 100}%`, 
                        backgroundColor: '#FE5858',
                        borderRadius: 4,
                        position: 'absolute',
                        left: `${(stats.daysTargetHit / stats.totalDays) * 100}%`
                      }} 
                    />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#282B34', width: 60, textAlign: 'right' }}>
                    {stats.daysTargetHit}/{stats.totalDays}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                  {stats.daysTargetHit} of {stats.totalDays} days target met
                </Text>
              </View>
            </Card>
          )}

          {/* Summary Stats */}
          {stats && (
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                Average Performance
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statCardWrapper}>
                  <StatCard label="Target Pace" value={`${stats.avgTarget}`} />
                </View>
                <View style={styles.statCardWrapper}>
                  <StatCard label="Actual Pace" value={`${stats.avgActual}`} />
                </View>
                <View style={styles.statCardWrapper}>
                  <StatCard label="Performance" value={`${stats.avgRatio}%`} />
                </View>
              </View>
            </Card>
          )}

          {filteredSessions.length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No sessions with target data found for {formatDayType(selectedDayType)} with {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : (
          <View style={styles.activityList}>
              {filteredSessions.map((session: any, index: number) => {
                const targetPace = Math.round(parseFloat(session.target_pace))
                const actualPace = Math.round(parseFloat(session.actual_pace))
                const performanceRatio = parseFloat(session.performance_ratio || 0)
                const maxPace = Math.max(targetPace, actualPace)
                const targetPercentage = maxPace > 0 ? (targetPace / maxPace) * 100 : 0
                const actualPercentage = maxPace > 0 ? (actualPace / maxPace) * 100 : 0
                
                return (
                  <Card key={session.id || index} style={{ padding: 16 }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34' }}>
                        {formatDate(session.date)}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#6B7280' }}>
                        Day {session.program_day_number}
                      </Text>
                    </View>

                    {/* Target Bar */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', width: 60 }}>TARGET</Text>
                        <View style={{ flex: 1, height: 24, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
                          <View 
                            style={{ 
                              height: '100%', 
                              width: `${targetPercentage}%`, 
                              backgroundColor: '#6B7280',
                              borderRadius: 4
                            }} 
                          />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', width: 60, textAlign: 'right' }}>
                          {targetPace} {session.units}/min
                        </Text>
                      </View>
                    </View>

                    {/* Actual Bar */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', width: 60 }}>ACTUAL</Text>
                        <View style={{ flex: 1, height: 24, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
                          <View 
                            style={{ 
                              height: '100%', 
                              width: `${actualPercentage}%`, 
                              backgroundColor: performanceRatio >= 1.0 ? '#10B981' : performanceRatio >= 0.9 ? '#3B82F6' : '#F59E0B',
                              borderRadius: 4
                            }} 
                          />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', width: 60, textAlign: 'right' }}>
                          {actualPace} {session.units}/min
                        </Text>
                      </View>
                    </View>

                    {/* Performance Ratio */}
                    <View style={{ alignItems: 'center', marginTop: 8 }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>PERFORMANCE</Text>
                      <Text style={{
                        fontSize: 20,
                        fontWeight: '700',
                        color: performanceRatio >= 1.0 ? '#10B981' : performanceRatio >= 0.9 ? '#3B82F6' : '#F59E0B'
                      }}>
                        {(performanceRatio * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </Card>
                )
              })}
            </View>
          )}
        </>
      )}
    </View>
  )
}

function EngineRecordsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')

  // Get available modalities
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality) modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  // Calculate personal records by day type for selected modality
  const personalRecords = React.useMemo(() => {
    if (!selectedModality) return {}
    
    const records: Record<string, any> = {}
    
    engineData.sessions?.forEach((session: any) => {
      if (session.modality !== selectedModality) return
      if (!session.day_type || !session.total_output) return
      
      const dayType = session.day_type
      const output = parseFloat(session.total_output)
      
      if (!records[dayType] || output > records[dayType].total_output) {
        records[dayType] = {
          ...session,
          total_output: output
        }
      }
    })
    
    return records
  }, [engineData.sessions, selectedModality])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Modality Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Modality
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableModalities.map((modality) => (
              <TouchableOpacity
                key={modality}
                onPress={() => setSelectedModality(modality)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatModality(modality)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Personal Records */}
      {selectedModality && (
        <>
          {Object.keys(personalRecords).length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No records found for {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : (
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                Personal Records ({Object.values(personalRecords).find((r: any) => r.actual_pace)?.units || 'cal'}/min)
              </Text>
              {Object.entries(personalRecords).filter(([_, record]: [string, any]) => record.actual_pace).length === 0 ? (
                <Text style={styles.noDataText}>
                  No pace data available for records
                </Text>
              ) : (
                <>
                  <View>
                    {Object.entries(personalRecords)
                      .filter(([_, record]: [string, any]) => record.actual_pace)
                      .sort(([_, a]: [string, any], [__, b]: [string, any]) => 
                        (parseFloat(b.actual_pace) || 0) - (parseFloat(a.actual_pace) || 0)
                      )
                      .map(([dayType, record]: [string, any], index: number) => {
                        const pace = Math.round(parseFloat(record.actual_pace) || 0)
                        const maxPace = Math.max(...Object.entries(personalRecords)
                          .filter(([_, r]: [string, any]) => r.actual_pace)
                          .map(([_, r]: [string, any]) => Math.round(parseFloat(r.actual_pace) || 0)), 1)
                        const percentage = maxPace > 0 ? (pace / maxPace) * 100 : 0
                        const units = record.units || ''
                        
                        return (
                          <View key={dayType} style={{ marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View style={{ flex: 1, height: 32, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginRight: 8, position: 'relative' }}>
                                <View 
                                  style={{ 
                                    height: '100%', 
                                    width: `${percentage}%`, 
                                    backgroundColor: '#FE5858',
                                    borderRadius: 4
                                  }} 
                                />
                                {/* Label inside bar */}
                                <View style={{ 
                                  position: 'absolute', 
                                  left: 8, 
                                  top: 0, 
                                  height: '100%', 
                                  justifyContent: 'center',
                                  zIndex: 1
                                }}>
                                  <Text style={{ 
                                    fontSize: 12, 
                                    fontWeight: '600', 
                                    color: '#FFFFFF'
                                  }}>
                                    {formatDayType(dayType)}
                                  </Text>
                                </View>
                              </View>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', width: 70, textAlign: 'right' }}>
                                {pace}
                              </Text>
                            </View>
                          </View>
                        )
                      })}
                  </View>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </View>
  )
}

function EngineHeartRateView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')

  // Get baseline paces from time trials (most recent for each modality)
  const baselines = React.useMemo(() => {
    const baselineMap: Record<string, number> = {}
    
    if (!engineData.timeTrials || engineData.timeTrials.length === 0) {
      return baselineMap
    }
    
    // Get most recent time trial for each modality
    const modalityTrials: Record<string, any> = {}
    engineData.timeTrials.forEach((trial: any) => {
      const modality = trial.modality || 'unknown'
      if (!modalityTrials[modality]) {
        modalityTrials[modality] = trial
      } else {
        const trialDate = trial.date ? new Date(trial.date) : new Date(0)
        const existingDate = modalityTrials[modality].date ? new Date(modalityTrials[modality].date) : new Date(0)
        if (trialDate > existingDate) {
          modalityTrials[modality] = trial
        }
      }
    })
    
    // Calculate baseline pace for each modality (output per minute)
    Object.entries(modalityTrials).forEach(([modality, trial]: [string, any]) => {
      if (trial.total_output && trial.duration_seconds) {
        baselineMap[modality] = trial.total_output / (trial.duration_seconds / 60)
      }
    })
    
    return baselineMap
  }, [engineData.timeTrials])

  // Helper function to calculate pace from session
  const calculatePace = (session: any): number | null => {
    if (session.actual_pace) {
      return parseFloat(session.actual_pace)
    }
    if (session.total_output && session.total_work_seconds) {
      return session.total_output / (session.total_work_seconds / 60)
    }
    return null
  }

  // Get available day types with HR data
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && (s.average_heart_rate || s.peak_heart_rate)) {
        dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Calculate HR stats for selected day type
  const hrStats = React.useMemo(() => {
    if (!selectedDayType) return null
    
    const sessions = engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      (s.average_heart_rate || s.peak_heart_rate)
    ) || []
    
    if (sessions.length === 0) return null
    
    const avgHRs = sessions.filter((s: any) => s.average_heart_rate).map((s: any) => parseFloat(s.average_heart_rate))
    const peakHRs = sessions.filter((s: any) => s.peak_heart_rate).map((s: any) => parseFloat(s.peak_heart_rate))
    
    // Calculate efficiency and training load for each session
    const efficiencies: number[] = []
    const trainingLoads: number[] = []
    
    sessions.forEach((session: any) => {
      const pace = calculatePace(session)
      const avgHR = session.average_heart_rate ? parseFloat(session.average_heart_rate) : null
      const modality = session.modality || 'unknown'
      const baseline = baselines[modality]
      
      // Get duration in minutes
      let durationMinutes = 0
      if (session.total_work_seconds) {
        durationMinutes = session.total_work_seconds / 60
      }
      
      if (pace !== null && avgHR !== null && avgHR > 0) {
        let efficiency = 0
        let trainingLoad = 0
        
        if (baseline && baseline > 0) {
          // Normalized efficiency: (pace / baseline) / avgHR * 1000
          efficiency = ((pace / baseline) / avgHR) * 1000
          // Training load: (pace / baseline) × avgHR × durationMinutes
          trainingLoad = (pace / baseline) * avgHR * durationMinutes
        } else {
          // Fallback calculation if no baseline
          efficiency = (pace / avgHR) * 1000
          trainingLoad = pace * avgHR * durationMinutes
        }
        
        efficiencies.push(efficiency)
        trainingLoads.push(trainingLoad)
      }
    })
    
    return {
      sessionCount: sessions.length,
      avgAvgHR: avgHRs.length > 0 ? Math.round(avgHRs.reduce((a: number, b: number) => a + b, 0) / avgHRs.length) : null,
      avgPeakHR: peakHRs.length > 0 ? Math.round(peakHRs.reduce((a: number, b: number) => a + b, 0) / peakHRs.length) : null,
      maxPeakHR: peakHRs.length > 0 ? Math.max(...peakHRs) : null,
      minAvgHR: avgHRs.length > 0 ? Math.min(...avgHRs) : null,
      avgEfficiency: efficiencies.length > 0 ? Math.round((efficiencies.reduce((a: number, b: number) => a + b, 0) / efficiencies.length) * 10) / 10 : null,
      avgTrainingLoad: trainingLoads.length > 0 ? Math.round(trainingLoads.reduce((a: number, b: number) => a + b, 0) / trainingLoads.length) : null,
      sessions
    }
  }, [engineData.sessions, selectedDayType, baselines])

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {availableDayTypes.map((dayType) => (
            <TouchableOpacity
              key={dayType}
              onPress={() => setSelectedDayType(dayType)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                color: '#282B34',
                fontWeight: '600',
                fontSize: 13,
              }}>
                {formatDayType(dayType)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* HR Stats */}
      {hrStats && (
        <>
          <Card>
            <SectionHeader title={`Heart Rate Analysis - ${formatDayType(selectedDayType)}`} />
            <View style={styles.statsRow}>
              <View style={styles.statCardWrapper}>
                <StatCard label="Sessions" value={hrStats.sessionCount} />
              </View>
              {hrStats.avgAvgHR && (
                <View style={styles.statCardWrapper}>
                  <StatCard label="Avg HR" value={`${hrStats.avgAvgHR} bpm`} />
                </View>
              )}
            </View>
            <View style={styles.statsRow}>
              {hrStats.avgPeakHR && (
                <View style={styles.statCardWrapper}>
                  <StatCard label="Avg Peak HR" value={`${hrStats.avgPeakHR} bpm`} />
                </View>
              )}
              {hrStats.maxPeakHR && (
                <View style={styles.statCardWrapper}>
                  <StatCard label="Max Peak HR" value={`${Math.round(hrStats.maxPeakHR)} bpm`} />
                </View>
              )}
            </View>
            {(hrStats.avgEfficiency !== null || hrStats.avgTrainingLoad !== null) && (
              <View style={styles.statsRow}>
                {hrStats.avgEfficiency !== null && (
                  <View style={styles.statCardWrapper}>
                    <StatCard label="HR Efficiency" value={hrStats.avgEfficiency.toFixed(1)} />
                  </View>
                )}
                {hrStats.avgTrainingLoad !== null && (
                  <View style={styles.statCardWrapper}>
                    <StatCard label="Training Load" value={hrStats.avgTrainingLoad.toFixed(0)} />
                  </View>
                )}
              </View>
            )}
          </Card>

          <SectionHeader title="Recent Sessions" />
          <View style={styles.activityList}>
            {hrStats.sessions.slice(0, 10).map((session: any, index: number) => {
              // Calculate efficiency and training load for this session
              const pace = calculatePace(session)
              const avgHR = session.average_heart_rate ? parseFloat(session.average_heart_rate) : null
              const modality = session.modality || 'unknown'
              const baseline = baselines[modality]
              
              let durationMinutes = 0
              if (session.total_work_seconds) {
                durationMinutes = session.total_work_seconds / 60
              }
              
              let efficiency: number | null = null
              let trainingLoad: number | null = null
              
              if (pace !== null && avgHR !== null && avgHR > 0) {
                if (baseline && baseline > 0) {
                  efficiency = ((pace / baseline) / avgHR) * 1000
                  trainingLoad = (pace / baseline) * avgHR * durationMinutes
                } else {
                  efficiency = (pace / avgHR) * 1000
                  trainingLoad = pace * avgHR * durationMinutes
                }
              }
              
              return (
                <Card key={session.id || index}>
                  <View style={styles.activityCardHeader}>
                    <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                    <Text style={styles.activityMeta}>Day {session.program_day_number}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    {session.average_heart_rate && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>AVG HR</Text>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: '#EF4444' }}>
                          {session.average_heart_rate}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>bpm</Text>
                      </View>
                    )}
                    {session.peak_heart_rate && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>PEAK HR</Text>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: '#DC2626' }}>
                          {session.peak_heart_rate}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>bpm</Text>
                      </View>
                    )}
                  </View>
                  {(efficiency !== null || trainingLoad !== null) && (
                    <View style={[styles.statsRow, { marginTop: 8 }]}>
                      {efficiency !== null && (
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>EFFICIENCY</Text>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34' }}>
                            {efficiency.toFixed(1)}
                          </Text>
                        </View>
                      )}
                      {trainingLoad !== null && trainingLoad > 0 && (
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>TRAINING LOAD</Text>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34' }}>
                            {Math.round(trainingLoad)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {session.total_output && (
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>
                      Output: {session.total_output} {session.units}
                    </Text>
                  )}
                </Card>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}

function EngineWorkRestView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')

  // Get available day types with work:rest ratio data
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && s.day_type !== 'time_trial' && s.avg_work_rest_ratio) {
        dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Filter sessions and calculate stats
  const filteredData = React.useMemo(() => {
    if (!selectedDayType) return null
    
    const sessions = engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.avg_work_rest_ratio &&
      s.actual_pace
    ) || []
    
    if (sessions.length === 0) return null
    
    // Group by work:rest ratio ranges
    const ratioGroups: Record<string, any[]> = {}
    sessions.forEach((s: any) => {
      const ratio = parseFloat(s.avg_work_rest_ratio)
      let group = '1:1'
      if (ratio < 0.8) group = '1:2+'
      else if (ratio < 1.2) group = '1:1'
      else if (ratio < 1.8) group = '1.5:1'
      else group = '2:1+'
      
      if (!ratioGroups[group]) ratioGroups[group] = []
      ratioGroups[group].push(s)
    })
    
    const groupStats = Object.entries(ratioGroups).map(([group, sessions]) => ({
      group,
      sessionCount: sessions.length,
      avgPace: Math.round(sessions.reduce((sum, s) => sum + parseFloat(s.actual_pace), 0) / sessions.length),
      avgOutput: Math.round(sessions.reduce((sum, s) => sum + parseFloat(s.total_output), 0) / sessions.length),
      units: sessions[0].units
    })).sort((a, b) => a.group.localeCompare(b.group))
    
    return {
      sessions,
      groupStats
    }
  }, [engineData.sessions, selectedDayType])

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
                  </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {availableDayTypes.map((dayType) => (
            <TouchableOpacity
              key={dayType}
              onPress={() => setSelectedDayType(dayType)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                color: '#282B34',
                fontWeight: '600',
                fontSize: 13,
              }}>
                {formatDayType(dayType)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Results */}
      {filteredData && (
        <>
          <Card>
            <SectionHeader title="Work:Rest Ratio Analysis" />
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              How pace varies with different work:rest structures
            </Text>
            
            {filteredData.groupStats.map((stat: any) => (
              <View key={stat.group} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#333333', marginBottom: 8 }}>
                  {stat.group} Work:Rest
                </Text>
                <View style={styles.statsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Sessions</Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#3B82F6' }}>
                      {stat.sessionCount}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Avg Pace</Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#333333' }}>
                      {stat.avgPace}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{stat.units}/min</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Avg Output</Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#10B981' }}>
                      {stat.avgOutput}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{stat.units}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>

          <SectionHeader title={`All Sessions (${filteredData.sessions.length})`} />
          <View style={styles.activityList}>
            {filteredData.sessions.slice(0, 15).map((session: any, index: number) => (
              <Card key={session.id || index}>
                <View style={styles.activityCardHeader}>
                  <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                  <Text style={styles.activityMeta}>Ratio: {parseFloat(session.avg_work_rest_ratio).toFixed(1)}</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>PACE</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333333' }}>
                      {Math.round(parseFloat(session.actual_pace))}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{session.units}/min</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>OUTPUT</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#10B981' }}>
                      {session.total_output}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{session.units}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function EngineVariabilityView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')

  // Get available day types
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && s.day_type !== 'time_trial') dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Get available modalities for selected day type
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if ((!selectedDayType || s.day_type === selectedDayType) && s.day_type !== 'time_trial') {
        if (s.modality) modalities.add(s.modality)
      }
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions, selectedDayType])

  // Calculate variability stats
  const variabilityData = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return null
    
    const sessions = engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.modality === selectedModality &&
      s.actual_pace
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []
    
    if (sessions.length < 2) return null
    
    const paces = sessions.map((s: any) => parseFloat(s.actual_pace))
    const avgPace = paces.reduce((a: number, b: number) => a + b, 0) / paces.length
    const variance = paces.reduce((sum: number, pace: number) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = (stdDev / avgPace) * 100
    
    return {
      sessions,
      avgPace: Math.round(avgPace),
      stdDev: Math.round(stdDev * 10) / 10,
      coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10,
      minPace: Math.min(...paces),
      maxPace: Math.max(...paces)
    }
  }, [engineData.sessions, selectedDayType, selectedModality])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => {
                  setSelectedDayType(dayType)
                  setSelectedModality('') // Reset modality
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
              </Card>

      {/* Modality Filter */}
      {selectedDayType && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Modality
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {availableModalities.map((modality) => (
                <TouchableOpacity
                  key={modality}
                  onPress={() => setSelectedModality(modality)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {formatModality(modality)}
                  </Text>
                </TouchableOpacity>
            ))}
          </View>
          </ScrollView>
        </Card>
      )}

      {/* Variability Stats */}
      {variabilityData && (
        <>
          <Card>
            <SectionHeader title="Consistency Metrics" />
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              Lower variability indicates more consistent performance
            </Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>AVG PACE</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#3B82F6' }}>
                  {variabilityData.avgPace}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {variabilityData.sessions[0].units}/min
                </Text>
        </View>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>STD DEV</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#F59E0B' }}>
                  ±{variabilityData.stdDev}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {variabilityData.sessions[0].units}/min
                </Text>
              </View>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>VARIABILITY</Text>
                <Text style={{ fontSize: 20, fontWeight: '600', color: '#8B5CF6' }}>
                  {variabilityData.coefficientOfVariation}%
                </Text>
              </View>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>RANGE</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>
                  {Math.round(variabilityData.minPace)} - {Math.round(variabilityData.maxPace)}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {variabilityData.sessions[0].units}/min
                </Text>
              </View>
            </View>
          </Card>

          <SectionHeader title={`Session History (${variabilityData.sessions.length})`} />
          <View style={styles.activityList}>
            {variabilityData.sessions.map((session: any, index: number) => {
              const pace = parseFloat(session.actual_pace)
              const deviationFromAvg = pace - variabilityData.avgPace
              const isAboveAvg = deviationFromAvg > 0
              
              return (
                <Card key={session.id || index}>
                  <View style={styles.activityCardHeader}>
                    <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                    <Text style={styles.activityMeta}>Day {session.program_day_number}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>PACE</Text>
                      <Text style={{ fontSize: 18, fontWeight: '600', color: '#333333' }}>
                        {Math.round(pace)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{session.units}/min</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>DEVIATION</Text>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: isAboveAvg ? '#10B981' : '#EF4444'
                      }}>
                        {isAboveAvg ? '+' : ''}{Math.round(deviationFromAvg)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>from avg</Text>
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    color: '#4B5563',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionGap: {
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCardWrapper: {
    flex: 1,
    minWidth: 0,
    marginBottom: 16,
  },
  activityList: {
    gap: 12,
  },
  activityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  activityMeta: {
    fontSize: 14,
    fontWeight: '700',
    color: '#282B34',
  },
  activitySessionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
  },
  activityExercisesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activityBlocks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  blockBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  blockBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#282B34',
  },
  noDataText: {
    color: '#4B5563',
  },
  engineAnalyticsCard: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#FE5858',
    padding: 16,
  },
  engineAnalyticsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  engineAnalyticsCardDescription: {
    fontSize: 14,
    color: '#282B34',
  },
})

export default function EngineAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [engineData, setEngineData] = useState<any>(null)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadEngineData()
    }
  }, [userId])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        setUserId((userData as any).id)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  const loadEngineData = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const data = await fetchEngineAnalytics(userId)
      setEngineData(data)
    } catch (error) {
      console.error('Error loading engine data:', error)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadEngineData()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <EngineTab engineData={engineData} userId={userId} />
      </ScrollView>
    </View>
  )
}
