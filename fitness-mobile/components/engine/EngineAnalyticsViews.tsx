import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'

// Shared Styles
const styles = StyleSheet.create({
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
    textAlign: 'center',
    padding: 20,
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
  // HR Specific Styles
  metricButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    backgroundColor: '#FFFFFF',
  },
  metricButtonActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  metricButtonText: {
    color: '#282B34',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center'
  },
  metricButtonTextActive: {
    color: '#FE5858',
    fontWeight: '600',
  }
})

// Helper functions
const formatModality = (modality: string) => {
  return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const formatDayType = (dayType: string) => {
  return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown Date'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const calculatePace = (session: any): number | null => {
  if (session.actual_pace) return parseFloat(session.actual_pace)
  if (session.total_output && session.total_work_seconds) {
    return session.total_output / (session.total_work_seconds / 60)
  }
  return null
}

// Convert decimal ratio (work/rest) to "work:rest" format
const formatWorkRestRatio = (decimalRatio: number): string => {
  if (decimalRatio >= 2.7) return "3:1"
  if (decimalRatio >= 1.7) return "2:1"
  if (decimalRatio >= 1.3) return "3:2"
  if (decimalRatio >= 0.9) return "1:1"
  if (decimalRatio >= 0.6) return "2:3"
  if (decimalRatio >= 0.4) return "1:2"
  return "1:3"
}

// Components
export function HorizontalBarChart({ 
  data, 
  labels, 
  maxValue, 
  unit = '', 
  height = 20,
  onPressRow
}: { 
  data: number[], 
  labels: string[], 
  maxValue: number,
  unit?: string,
  height?: number,
  onPressRow?: (index: number) => void
}) {
  return (
    <View>
      {data.map((value, index) => {
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
        const content = (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: '#6B7280', width: 60 }} numberOfLines={1}>
              {labels[index]}
            </Text>
            <View style={{ flex: 1, height, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 6 }}>
              <View 
                style={{ 
                  height: '100%', 
                  width: `${percentage}%`, 
                  backgroundColor: '#FE5858',
                  borderRadius: 4
                }} 
              />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#282B34', width: 65, textAlign: 'right' }}>
              {typeof value === 'number' ? Math.round(value) : value}{unit}
            </Text>
          </View>
        )

        if (onPressRow) {
          return (
            <TouchableOpacity key={index} style={{ marginBottom: 12 }} onPress={() => onPressRow(index)}>
              {content}
            </TouchableOpacity>
          )
        }

        return (
          <View key={index} style={{ marginBottom: 12 }}>
            {content}
          </View>
        )
      })}
    </View>
  )
}

export function EngineOverviewView({ engineData }: { engineData: any }) {
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

export function EngineHistoryView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')
  const [selectedMetric, setSelectedMetric] = useState<'output' | 'pace'>('output')

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality) modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (!selectedModality || s.modality === selectedModality) {
        if (s.day_type) dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  const filteredSessions = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return []
    return engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && s.modality === selectedModality
    ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) || []
  }, [engineData.sessions, selectedDayType, selectedModality])

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="My History" />
      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Modality
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {availableModalities.map((modality) => (
            <TouchableOpacity
              key={modality}
              onPress={() => {
                setSelectedModality(modality)
                setSelectedDayType('')
              }}
              style={[
                styles.metricButton,
                selectedModality === modality && styles.metricButtonActive
              ]}
            >
              <Text style={[
                styles.metricButtonText,
                selectedModality === modality && styles.metricButtonTextActive
              ]}>
                {formatModality(modality)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {selectedModality && (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Day Type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => setSelectedDayType(dayType)}
                style={[
                  styles.metricButton,
                  selectedDayType === dayType && styles.metricButtonActive
                ]}
              >
                <Text style={[
                  styles.metricButtonText,
                  selectedDayType === dayType && styles.metricButtonTextActive
                ]}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {selectedDayType && selectedModality && (
        <>
          <SectionHeader title={`Performance History (${filteredSessions.length} sessions)`} />
          {filteredSessions.length === 0 ? (
            <Card><Text style={styles.noDataText}>No sessions found.</Text></Card>
          ) : (
            <ScrollView>
              <Card style={{ padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setSelectedMetric('output')}
                    style={[styles.metricButton, selectedMetric === 'output' && styles.metricButtonActive]}
                  >
                    <Text style={[styles.metricButtonText, selectedMetric === 'output' && styles.metricButtonTextActive]}>Output</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedMetric('pace')}
                    style={[styles.metricButton, selectedMetric === 'pace' && styles.metricButtonActive]}
                  >
                    <Text style={[styles.metricButtonText, selectedMetric === 'pace' && styles.metricButtonTextActive]}>Pace</Text>
                  </TouchableOpacity>
                </View>
              </Card>

              <Card style={{ padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                  {selectedMetric === 'output' ? 'Output Over Time' : 'Pace Over Time'}
                </Text>
                {(() => {
                  const sortedSessions = [...filteredSessions].sort((a: any, b: any) => {
                    const aVal = selectedMetric === 'output' ? parseFloat(a.total_output) : parseFloat(a.actual_pace) || 0
                    const bVal = selectedMetric === 'output' ? parseFloat(b.total_output) : parseFloat(b.actual_pace) || 0
                    return bVal - aVal // highest to lowest
                  })
                  return (
                    <HorizontalBarChart
                      data={sortedSessions.map((s: any) => selectedMetric === 'output' ? parseFloat(s.total_output) : Math.round(parseFloat(s.actual_pace) || 0))}
                      labels={sortedSessions.map((s: any) => formatDate(s.date).split(',')[0])}
                      maxValue={Math.max(...sortedSessions.map((s: any) => selectedMetric === 'output' ? parseFloat(s.total_output) : Math.round(parseFloat(s.actual_pace) || 0)), 1)}
                      unit={selectedMetric === 'output' ? ` ${sortedSessions[0]?.units || ''}` : ` ${sortedSessions[0]?.units || ''}/min`}
                    />
                  )
                })()}
              </Card>
            </ScrollView>
          )}
        </>
      )}
    </View>
  )
}

export function EngineComparisonsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')
  const [selectedDayTypes, setSelectedDayTypes] = useState<string[]>([])
  const [selectedMetric, setSelectedMetric] = useState<'pace' | 'output'>('output')

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality && s.day_type !== 'time_trial') modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  const availableDayTypes = React.useMemo(() => {
    if (!selectedModality) return []
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality === selectedModality && s.day_type && s.day_type !== 'time_trial') dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  const comparisonData = React.useMemo(() => {
    if (!selectedModality || selectedDayTypes.length === 0) return []
    const data = selectedDayTypes.map((dayType) => {
      const sessions = engineData.sessions?.filter((s: any) => 
        s.modality === selectedModality && s.day_type === dayType && s.total_output
      ) || []
      if (sessions.length === 0) return null
      const avgOutput = sessions.reduce((sum: number, s: any) => sum + parseFloat(s.total_output), 0) / sessions.length
      const avgPace = sessions.filter((s: any) => s.actual_pace).reduce((sum: number, s: any) => sum + parseFloat(s.actual_pace), 0) / sessions.filter((s: any) => s.actual_pace).length
      return {
        dayType,
        sessionCount: sessions.length,
        avgOutput: Math.round(avgOutput),
        avgPace: Math.round(avgPace),
        units: sessions[0].units
      }
    }).filter(Boolean)
    
    return data.sort((a: any, b: any) => {
      const aVal = selectedMetric === 'output' ? a.avgOutput : (a.avgPace || 0)
      const bVal = selectedMetric === 'output' ? b.avgOutput : (b.avgPace || 0)
      return bVal - aVal
    })
  }, [engineData.sessions, selectedModality, selectedDayTypes, selectedMetric])

  const toggleDayType = (dayType: string) => {
    if (selectedDayTypes.includes(dayType)) {
      setSelectedDayTypes(selectedDayTypes.filter(dt => dt !== dayType))
    } else {
      setSelectedDayTypes([...selectedDayTypes, dayType])
    }
  }

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="Comparisons" />
      <Card style={{ padding: 16 }}>
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
                  setSelectedDayTypes([])
                }}
                style={[styles.metricButton, selectedModality === modality && styles.metricButtonActive]}
              >
                <Text style={[styles.metricButtonText, selectedModality === modality && styles.metricButtonTextActive]}>
                  {formatModality(modality)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {selectedModality && (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Day Types to Compare
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => toggleDayType(dayType)}
                style={[styles.metricButton, selectedDayTypes.includes(dayType) && styles.metricButtonActive]}
              >
                <Text style={[styles.metricButtonText, selectedDayTypes.includes(dayType) && styles.metricButtonTextActive]}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {comparisonData.length > 0 && (
        <>
          <SectionHeader title="Comparison Results" />
          <Card style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <TouchableOpacity
                onPress={() => setSelectedMetric('output')}
                style={[styles.metricButton, selectedMetric === 'output' && styles.metricButtonActive]}
              >
                <Text style={[styles.metricButtonText, selectedMetric === 'output' && styles.metricButtonTextActive]}>Avg Output</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedMetric('pace')}
                style={[styles.metricButton, selectedMetric === 'pace' && styles.metricButtonActive]}
              >
                <Text style={[styles.metricButtonText, selectedMetric === 'pace' && styles.metricButtonTextActive]}>Avg Pace</Text>
              </TouchableOpacity>
            </View>
          </Card>

          <Card style={{ padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
              {selectedMetric === 'output' ? 'Average Output Comparison' : 'Average Pace Comparison'}
            </Text>
            <HorizontalBarChart
              data={comparisonData.map((d: any) => selectedMetric === 'output' ? d.avgOutput : (d.avgPace || 0))}
              labels={comparisonData.map((d: any) => `${formatDayType(d.dayType)} (${d.sessionCount})`)}
              maxValue={Math.max(...comparisonData.map((d: any) => selectedMetric === 'output' ? d.avgOutput : (d.avgPace || 0)))}
              unit={selectedMetric === 'output' ? ` ${comparisonData[0]?.units || ''}` : ` ${comparisonData[0]?.units || ''}/min`}
            />
          </Card>
        </>
      )}
    </View>
  )
}

export function EngineTimeTrialsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.timeTrials?.forEach((trial: any) => {
      if (trial.modality) modalities.add(trial.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.timeTrials])

  const filteredTrials = React.useMemo(() => {
    if (!selectedModality) return []
    return (engineData.timeTrials?.filter((trial: any) => 
      trial.modality === selectedModality && trial.total_output
    ) || []).sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime())
  }, [engineData.timeTrials, selectedModality])

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="My Time Trials" />
      {engineData.timeTrials?.length === 0 ? (
        <Card><Text style={styles.noDataText}>No time trials completed yet.</Text></Card>
      ) : (
        <>
          <Card style={{ padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Modality</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {availableModalities.map((modality) => (
                <TouchableOpacity
                  key={modality}
                  onPress={() => setSelectedModality(modality)}
                  style={[styles.metricButton, selectedModality === modality && styles.metricButtonActive]}
                >
                  <Text style={[styles.metricButtonText, selectedModality === modality && styles.metricButtonTextActive]}>{formatModality(modality)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {selectedModality && filteredTrials.length > 0 && (
            <Card style={{ padding: 16 }}>
              <HorizontalBarChart
                data={filteredTrials.map((t: any) => parseFloat(t.total_output) || 0)}
                labels={filteredTrials.map((t: any) => formatDate(t.date || t.created_at).split(',')[0])}
                maxValue={Math.max(...filteredTrials.map((t: any) => parseFloat(t.total_output) || 0))}
                unit={` ${filteredTrials[0].units || ''}`}
              />
            </Card>
          )}
        </>
      )}
    </View>
  )
}

export function EngineTargetsView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality && s.day_type !== 'time_trial') modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  const availableDayTypes = React.useMemo(() => {
    if (!selectedModality) return []
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality === selectedModality && s.day_type && s.day_type !== 'time_trial') dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  const filteredSessions = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return []
    return engineData.sessions?.filter((s: any) =>
      s.day_type === selectedDayType && s.modality === selectedModality && s.target_pace && s.actual_pace
    ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) || []
  }, [engineData.sessions, selectedDayType, selectedModality])

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="Targets vs Actual" />
      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Modality</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {availableModalities.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => { setSelectedModality(m); setSelectedDayType('') }}
              style={[styles.metricButton, selectedModality === m && styles.metricButtonActive]}
            >
              <Text style={[styles.metricButtonText, selectedModality === m && styles.metricButtonTextActive]}>{formatModality(m)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {selectedModality && (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Day Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {availableDayTypes.map((dt) => (
              <TouchableOpacity
                key={dt}
                onPress={() => setSelectedDayType(dt)}
                style={[styles.metricButton, selectedDayType === dt && styles.metricButtonActive]}
              >
                <Text style={[styles.metricButtonText, selectedDayType === dt && styles.metricButtonTextActive]}>{formatDayType(dt)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {filteredSessions.length > 0 && (
        <View style={styles.activityList}>
          {filteredSessions.map((session: any, index: number) => (
            <Card key={session.id || index} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>{formatDate(session.date)}</Text>
                <Text style={{ fontSize: 14, color: '#6B7280' }}>Day {session.program_day_number}</Text>
              </View>
              <View style={{ gap: 8 }}>
                {(() => {
                  const targetPace = parseFloat(session.target_pace) || 0
                  const actualPace = parseFloat(session.actual_pace) || 0
                  const maxPace = Math.max(targetPace, actualPace)
                  const targetWidth = maxPace > 0 ? `${(targetPace / maxPace) * 100}%` : '0%'
                  const actualWidth = maxPace > 0 ? `${(actualPace / maxPace) * 100}%` : '0%'
                  
                  return (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: '#282B34', width: 60 }}>TARGET</Text>
                        <View style={{ flex: 1, height: 12, backgroundColor: '#E5E7EB', borderRadius: 4, marginHorizontal: 8 }}>
                          <View style={{ height: '100%', width: targetWidth, backgroundColor: '#0B21D0', borderRadius: 4 }} />
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '600', width: 60, textAlign: 'right' }}>{Math.round(targetPace)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: '#282B34', width: 60 }}>ACTUAL</Text>
                        <View style={{ flex: 1, height: 12, backgroundColor: '#E5E7EB', borderRadius: 4, marginHorizontal: 8 }}>
                          <View style={{ height: '100%', width: actualWidth, backgroundColor: '#FE5858', borderRadius: 4 }} />
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '600', width: 60, textAlign: 'right' }}>{Math.round(actualPace)}</Text>
                      </View>
                    </>
                  )
                })()}
              </View>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}

export function EngineRecordsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality) modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  const personalRecords = React.useMemo(() => {
    if (!selectedModality) return []
    const records: Record<string, any> = {}
    engineData.sessions?.forEach((session: any) => {
      if (session.modality !== selectedModality) return
      if (!session.day_type || !session.total_output) return
      const dayType = session.day_type
      const output = parseFloat(session.total_output)
      if (!records[dayType] || output > records[dayType].total_output) {
        records[dayType] = { ...session, total_output: output }
      }
    })
    return Object.values(records)
      .map((r: any) => ({
        ...r,
        pace: Math.round(parseFloat(r.actual_pace) || 0)
      }))
      .sort((a, b) => b.pace - a.pace)
  }, [engineData.sessions, selectedModality])

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="Personal Records" />
      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Modality</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {availableModalities.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setSelectedModality(m)}
              style={[styles.metricButton, selectedModality === m && styles.metricButtonActive]}
            >
              <Text style={[styles.metricButtonText, selectedModality === m && styles.metricButtonTextActive]}>{formatModality(m)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {selectedModality && personalRecords.length > 0 && (
        <Card style={{ padding: 16 }}>
          <HorizontalBarChart
            data={personalRecords.map((r: any) => r.pace)}
            labels={personalRecords.map((r: any) => formatDayType(r.day_type))}
            maxValue={Math.max(...personalRecords.map((r: any) => r.pace), 1)}
            unit={` ${personalRecords[0]?.units || ''}/min`}
          />
        </Card>
      )}
    </View>
  )
}

export function EngineHeartRateView({ engineData }: { engineData: any }) {
  const [selectedMetric, setSelectedMetric] = useState('sessions')
  const [selectedModality, setSelectedModality] = useState('')

  const metrics = [
    { id: 'sessions', label: 'Sessions', unit: '' },
    { id: 'avg_hr', label: 'Avg HR', unit: ' bpm' },
    { id: 'avg_peak_hr', label: 'Avg Peak HR', unit: ' bpm' },
    { id: 'max_peak_hr', label: 'Max Peak HR', unit: ' bpm' },
    { id: 'efficiency', label: 'HR Efficiency', unit: '' },
    { id: 'training_load', label: 'Training Load', unit: '' }
  ]

  const baselines = React.useMemo(() => {
    const baselineMap: Record<string, number> = {}
    if (!engineData.timeTrials) return baselineMap
    const modalityTrials: Record<string, any> = {}
    engineData.timeTrials.forEach((trial: any) => {
      const modality = trial.modality || 'unknown'
      if (!modalityTrials[modality] || new Date(trial.date) > new Date(modalityTrials[modality].date)) {
        modalityTrials[modality] = trial
      }
    })
    Object.entries(modalityTrials).forEach(([modality, trial]: [string, any]) => {
      if (trial.total_output && trial.duration_seconds) baselineMap[modality] = trial.total_output / (trial.duration_seconds / 60)
    })
    return baselineMap
  }, [engineData.timeTrials])

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality && (s.average_heart_rate || s.peak_heart_rate)) modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if ((!selectedModality || s.modality === selectedModality) && s.day_type && (s.average_heart_rate || s.peak_heart_rate)) {
        dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  const allDayTypeStats = React.useMemo(() => {
    const statsMap: Record<string, any> = {}
    availableDayTypes.forEach(dayType => {
      const sessions = engineData.sessions?.filter((s: any) => 
        s.day_type === dayType && 
        (!selectedModality || s.modality === selectedModality) &&
        (s.average_heart_rate || s.peak_heart_rate)
      ) || []
      if (sessions.length === 0) return
      const avgHRs = sessions.filter((s: any) => s.average_heart_rate).map((s: any) => parseFloat(s.average_heart_rate))
      const peakHRs = sessions.filter((s: any) => s.peak_heart_rate).map((s: any) => parseFloat(s.peak_heart_rate))
      const efficiencies: number[] = []
      const trainingLoads: number[] = []
      sessions.forEach((session: any) => {
        const pace = calculatePace(session); const avgHR = session.average_heart_rate ? parseFloat(session.average_heart_rate) : null
        const baseline = baselines[session.modality || 'unknown']; const durationMinutes = session.total_work_seconds ? session.total_work_seconds / 60 : 0
        if (pace !== null && avgHR !== null && avgHR > 0) {
          // HR Efficiency: work output per heartbeat
          const efficiency = (pace / avgHR) * 1000
          // Training Load: cubed intensity + sqrt duration
          // Cubing intensity heavily weights high-intensity work
          // Sqrt duration dampens effect of long easy sessions
          const intensityFactor = baseline && baseline > 0 ? pace / baseline : 1
          const trainingLoad = Math.pow(intensityFactor, 3) * avgHR * Math.sqrt(durationMinutes)
          efficiencies.push(efficiency); trainingLoads.push(trainingLoad)
        }
      })
      statsMap[dayType] = {
        sessions: sessions.length,
        avg_hr: avgHRs.length > 0 ? avgHRs.reduce((a, b) => a + b, 0) / avgHRs.length : 0,
        avg_peak_hr: peakHRs.length > 0 ? peakHRs.reduce((a, b) => a + b, 0) / peakHRs.length : 0,
        max_peak_hr: peakHRs.length > 0 ? Math.max(...peakHRs) : 0,
        efficiency: efficiencies.length > 0 ? efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length : 0,
        training_load: trainingLoads.length > 0 ? trainingLoads.reduce((a, b) => a + b, 0) / trainingLoads.length : 0,
        all_sessions: sessions
      }
    })
    return statsMap
  }, [availableDayTypes, engineData.sessions, baselines, selectedModality])

  const chartData = React.useMemo(() => {
    const items = availableDayTypes.map(dayType => ({
      label: formatDayType(dayType),
      data: allDayTypeStats[dayType]?.[selectedMetric] || 0,
      dayType
    })).filter(i => i.data > 0).sort((a, b) => b.data - a.data)
    return { labels: items.map(i => i.label), data: items.map(i => i.data), dayTypes: items.map(i => i.dayType) }
  }, [availableDayTypes, allDayTypeStats, selectedMetric])

  const selectedMetricInfo = metrics.find(m => m.id === selectedMetric)

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="HR Analytics" />
      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Modality</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {availableModalities.map((m) => (
            <TouchableOpacity key={m} onPress={() => { setSelectedModality(m); setSelectedDayType('') }}
              style={[styles.metricButton, selectedModality === m && styles.metricButtonActive]}>
              <Text style={[styles.metricButtonText, selectedModality === m && styles.metricButtonTextActive]}>{formatModality(m)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Metric</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {metrics.map((m) => (
            <TouchableOpacity key={m.id} onPress={() => { setSelectedMetric(m.id); setSelectedDayType('') }}
              style={[styles.metricButton, selectedMetric === m.id && styles.metricButtonActive]}>
              <Text style={[styles.metricButtonText, selectedMetric === m.id && styles.metricButtonTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {chartData.data.length > 0 ? (
        <Card style={{ padding: 16 }}>
          <SectionHeader title={`${selectedMetricInfo?.label} by Day Type`} />
          <HorizontalBarChart
            data={chartData.data} labels={chartData.labels}
            maxValue={Math.max(...chartData.data)} unit={selectedMetricInfo?.unit}
          />
        </Card>
      ) : (
        <Card><Text style={styles.noDataText}>No heart rate data available.</Text></Card>
      )}
    </View>
  )
}

export function EngineWorkRestView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')
  const [selectedRatios, setSelectedRatios] = useState<string[]>([])

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality && s.day_type !== 'time_trial' && s.avg_work_rest_ratio) modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  const availableRatios = React.useMemo(() => {
    if (!selectedModality) return []
    const ratios = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality === selectedModality && s.day_type !== 'time_trial' && s.avg_work_rest_ratio) {
        const ratioLabel = formatWorkRestRatio(parseFloat(s.avg_work_rest_ratio))
        ratios.add(ratioLabel)
      }
    })
    return Array.from(ratios).sort()
  }, [engineData.sessions, selectedModality])

  const chartData = React.useMemo(() => {
    if (!selectedModality || selectedRatios.length === 0) return null
    
    const ratioGroups: Record<string, any[]> = {}
    
    engineData.sessions?.forEach((s: any) => {
      if (s.modality === selectedModality && s.day_type !== 'time_trial' && s.avg_work_rest_ratio && s.actual_pace) {
        const ratioLabel = formatWorkRestRatio(parseFloat(s.avg_work_rest_ratio))
        if (selectedRatios.includes(ratioLabel)) {
          if (!ratioGroups[ratioLabel]) ratioGroups[ratioLabel] = []
          ratioGroups[ratioLabel].push(s)
        }
      }
    })

    const stats = Object.entries(ratioGroups).map(([ratio, sessions]) => ({
      ratio,
      sessionCount: sessions.length,
      avgPace: sessions.reduce((sum, s) => sum + parseFloat(s.actual_pace), 0) / sessions.length,
      units: sessions[0].units
    }))

    // Sort by avg pace descending
    stats.sort((a, b) => b.avgPace - a.avgPace)

    return {
      labels: stats.map(s => `${s.ratio} (${s.sessionCount})`),
      data: stats.map(s => s.avgPace),
      maxValue: Math.max(...stats.map(s => s.avgPace)),
      units: stats[0]?.units || ''
    }
  }, [engineData.sessions, selectedModality, selectedRatios])

  const toggleRatio = (ratio: string) => {
    setSelectedRatios(prev =>
      prev.includes(ratio)
        ? prev.filter(r => r !== ratio)
        : [...prev, ratio]
    )
  }

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="Work:Rest Ratio" />
      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Modality</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {availableModalities.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => {
                setSelectedModality(m)
                setSelectedRatios([])
              }}
              style={[styles.metricButton, selectedModality === m && styles.metricButtonActive]}
            >
              <Text style={[styles.metricButtonText, selectedModality === m && styles.metricButtonTextActive]}>
                {formatModality(m)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {selectedModality && availableRatios.length > 0 && (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 8, textAlign: 'center' }}>
            Select Ratio(s) to Compare
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, textAlign: 'center' }}>
            Tap to add/remove ratios
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {availableRatios.map((ratio) => (
              <TouchableOpacity 
                key={ratio} 
                onPress={() => toggleRatio(ratio)}
                style={[styles.metricButton, selectedRatios.includes(ratio) && styles.metricButtonActive]}
              >
                <Text style={[styles.metricButtonText, selectedRatios.includes(ratio) && styles.metricButtonTextActive]}>
                  {ratio}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {chartData && (
        <Card style={{ padding: 16 }}>
          <SectionHeader title="Average Pace by Ratio" />
          <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 16, textAlign: 'center' }}>
            Comparing {selectedRatios.length} ratio{selectedRatios.length !== 1 ? 's' : ''}
          </Text>
          <HorizontalBarChart
            data={chartData.data}
            labels={chartData.labels}
            maxValue={chartData.maxValue}
            unit={` ${chartData.units}`}
          />
        </Card>
      )}
    </View>
  )
}

export function EngineVariabilityView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')

  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality && s.day_type !== 'time_trial') modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  const availableDayTypes = React.useMemo(() => {
    if (!selectedModality) return []
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality === selectedModality && s.day_type && s.day_type !== 'time_trial') dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  const variabilityData = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return null
    const sessions = engineData.sessions?.filter((s: any) =>
      s.day_type === selectedDayType && s.modality === selectedModality && s.actual_pace
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []
    if (sessions.length < 2) return null
    const paces = sessions.map((s: any) => parseFloat(s.actual_pace))
    const avgPace = paces.reduce((a: number, b: number) => a + b, 0) / paces.length
    const stdDev = Math.sqrt(paces.reduce((sum: number, p: number) => sum + Math.pow(p - avgPace, 2), 0) / paces.length)
    return {
      sessions,
      avgPace: Math.round(avgPace),
      stdDev: Math.round(stdDev * 10) / 10,
      cv: Math.round((stdDev / avgPace) * 1000) / 10
    }
  }, [engineData.sessions, selectedDayType, selectedModality])

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="Variability Trend" />
      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Modality</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {availableModalities.map((m) => (
            <TouchableOpacity key={m} onPress={() => { setSelectedModality(m); setSelectedDayType('') }}
              style={[styles.metricButton, selectedModality === m && styles.metricButtonActive]}>
              <Text style={[styles.metricButtonText, selectedModality === m && styles.metricButtonTextActive]}>{formatModality(m)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {selectedModality && (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>Select Day Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {availableDayTypes.map((dt) => (
              <TouchableOpacity key={dt} onPress={() => setSelectedDayType(dt)}
                style={[styles.metricButton, selectedDayType === dt && styles.metricButtonActive]}>
                <Text style={[styles.metricButtonText, selectedDayType === dt && styles.metricButtonTextActive]}>{formatDayType(dt)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {variabilityData && (
        <Card style={{ padding: 16 }}>
          <SectionHeader title="Consistency Metrics" />
          <View style={styles.statsRow}>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#9CA3AF' }}>AVG PACE</Text><Text style={{ fontSize: 24, fontWeight: '700', color: '#3B82F6' }}>{variabilityData.avgPace}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#9CA3AF' }}>VARIABILITY</Text><Text style={{ fontSize: 24, fontWeight: '700', color: '#8B5CF6' }}>{variabilityData.cv}%</Text></View>
          </View>
        </Card>
      )}
    </View>
  )
}

export function EngineTab({ engineData, userId, onBackToOverview }: { engineData: any; userId: number | null; onBackToOverview?: () => void }) {
  const [currentView, setCurrentView] = useState('menu')
  
  if (!engineData) {
    return (
      <View style={styles.sectionGap}>
        <Card><Text style={styles.noDataText}>Loading Engine data...</Text></Card>
      </View>
    )
  }

  const hasData = engineData.totalSessions > 0 || engineData.totalTimeTrials > 0

  const analyticsOptions = [
    { id: 'history', title: 'My History', description: 'Performance trends by day type and modality' },
    { id: 'comparisons', title: 'Comparisons', description: 'Side by side day type analysis' },
    { id: 'time-trials', title: 'My Time Trials', description: 'Detailed time trial tracking' },
    { id: 'targets', title: 'Targets vs Actual', description: 'Compare performance against targets' },
    { id: 'records', title: 'Personal Records', description: 'Best performances by day type' },
    { id: 'heart-rate', title: 'HR Analytics', description: 'Heart rate analysis and efficiency' },
    { id: 'work-rest', title: 'Work:Rest Ratio', description: 'Interval structure analysis' },
    { id: 'variability', title: 'Variability Trend', description: 'Consistency tracking' },
  ]

  if (currentView === 'menu') {
    return (
      <View style={styles.sectionGap}>
        {onBackToOverview && (
          <TouchableOpacity
            onPress={onBackToOverview}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
              backgroundColor: '#FE5858', borderWidth: 1, borderColor: '#282B34', borderRadius: 8,
              paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start',
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, color: '#F6FBFE', fontWeight: '600' }}>← Back</Text>
          </TouchableOpacity>
        )}
        {hasData && (
          <Card style={{ paddingTop: 24 }}>
            <SectionHeader title="Summary" />
            <View style={[styles.statsRow, { paddingHorizontal: 16 }]}>
              <View style={styles.statCardWrapper}><StatCard label="Workouts" value={engineData.totalSessions} /></View>
              <View style={styles.statCardWrapper}><StatCard label="Time Trials" value={engineData.totalTimeTrials} /></View>
            </View>
          </Card>
        )}
        {!hasData && (
          <Card><Text style={styles.noDataText}>No Engine workout data yet. Complete Engine workouts to see detailed analytics!</Text></Card>
        )}
        <View style={styles.activityList}>
          {analyticsOptions.map((option) => (
            <TouchableOpacity key={option.id} onPress={() => setCurrentView(option.id)} activeOpacity={0.7}>
              <Card style={styles.engineAnalyticsCard}>
                <Text style={styles.engineAnalyticsCardTitle}>{option.title}</Text>
                <Text style={styles.engineAnalyticsCardDescription}>{option.description}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.sectionGap}>
      <TouchableOpacity
        onPress={() => setCurrentView('menu')}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          backgroundColor: '#FE5858', borderWidth: 1, borderColor: '#282B34', borderRadius: 8,
          paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start',
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14, color: '#F6FBFE', fontWeight: '600' }}>← Back</Text>
      </TouchableOpacity>

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
