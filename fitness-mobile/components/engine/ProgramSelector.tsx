import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  getAvailableEnginePrograms,
  switchEngineProgram,
  EngineProgram,
} from '@/lib/api/enginePrograms'

interface ProgramSelectorProps {
  visible: boolean
  onClose: () => void
  userId: number
  currentProgramId: string | null
  subscriptionTier: string | null
  onProgramChanged: (newProgramId: string) => void
}

export default function ProgramSelector({
  visible,
  onClose,
  userId,
  currentProgramId,
  subscriptionTier,
  onProgramChanged,
}: ProgramSelectorProps) {
  const [programs, setPrograms] = useState<EngineProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<EngineProgram | null>(null)

  useEffect(() => {
    if (visible) {
      loadPrograms()
    }
  }, [visible])

  const loadPrograms = async () => {
    setLoading(true)
    const { programs: data, error } = await getAvailableEnginePrograms()
    if (data) {
      setPrograms(data)
    } else if (error) {
      Alert.alert('Error', 'Failed to load programs. Please try again.')
    }
    setLoading(false)
  }

  const handleProgramSelect = (program: EngineProgram) => {
    if (program.id === currentProgramId) {
      Alert.alert('Already Selected', 'You are already on this program.')
      return
    }
    setSelectedProgram(program)
  }

  const confirmSwitch = () => {
    if (!selectedProgram) return

    const isPureEngine = subscriptionTier?.toUpperCase() === 'ENGINE'
    const message = isPureEngine
      ? `Your program will switch immediately to ${selectedProgram.display_name}. You'll start from day 1 of the new program.`
      : `Your Engine block will change to ${selectedProgram.display_name} on your next program generation (every 4 weeks).`

    Alert.alert(
      `Switch to ${selectedProgram.display_name}?`,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedProgram(null) },
        { text: 'Confirm', onPress: executeSwitch },
      ]
    )
  }

  const executeSwitch = async () => {
    if (!selectedProgram) return

    setSwitching(true)
    const { success, error } = await switchEngineProgram(
      userId,
      selectedProgram.id,
      subscriptionTier
    )

    if (success) {
      onProgramChanged(selectedProgram.id)
      Alert.alert(
        'Program Changed',
        `You are now on ${selectedProgram.display_name}.`,
        [{ text: 'OK', onPress: onClose }]
      )
    } else {
      Alert.alert('Error', 'Failed to switch programs. Please try again.')
    }

    setSwitching(false)
    setSelectedProgram(null)
  }

  useEffect(() => {
    if (selectedProgram) {
      confirmSwitch()
    }
  }, [selectedProgram])

  const formatDuration = (weeks: number) => {
    if (weeks >= 52) {
      const years = Math.floor(weeks / 52)
      const remainingWeeks = weeks % 52
      if (remainingWeeks === 0) {
        return `${years} year${years > 1 ? 's' : ''}`
      }
      return `${years}+ years`
    }
    return `${weeks} weeks`
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Choose Your Engine Program</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#282B34" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>
            {subscriptionTier?.toUpperCase() === 'ENGINE'
              ? 'Changes take effect immediately'
              : 'Changes take effect on your next program generation'}
          </Text>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FE5858" />
            <Text style={styles.loadingText}>Loading programs...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {programs.map((program) => {
              const isCurrentProgram = program.id === currentProgramId
              return (
                <TouchableOpacity
                  key={program.id}
                  style={[
                    styles.programCard,
                    isCurrentProgram && styles.programCardCurrent,
                  ]}
                  onPress={() => handleProgramSelect(program)}
                  disabled={switching}
                  activeOpacity={0.7}
                >
                  <View style={styles.programCardHeader}>
                    <View style={styles.programTitleRow}>
                      <Text style={styles.programName}>{program.display_name}</Text>
                      {isCurrentProgram && (
                        <View style={styles.currentBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.programMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                        <Text style={styles.metaText}>
                          {program.frequency_per_week} days/week
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color="#6B7280" />
                        <Text style={styles.metaText}>
                          {formatDuration(program.duration_weeks)}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="fitness-outline" size={14} color="#6B7280" />
                        <Text style={styles.metaText}>
                          {program.total_days} workouts
                        </Text>
                      </View>
                    </View>
                  </View>

                  {program.description && (
                    <Text style={styles.programDescription}>{program.description}</Text>
                  )}

                  {program.focus_areas && program.focus_areas.length > 0 && (
                    <View style={styles.focusAreasContainer}>
                      {program.focus_areas.map((area, index) => (
                        <View key={index} style={styles.focusAreaTag}>
                          <Text style={styles.focusAreaText}>{area}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Switching overlay */}
        {switching && (
          <View style={styles.switchingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.switchingText}>Switching program...</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FBFE',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  closeButton: {
    padding: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  programCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  programCardCurrent: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  programCardHeader: {
    marginBottom: 8,
  },
  programTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  programName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    flex: 1,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 4,
  },
  programMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  programDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  focusAreasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusAreaTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  focusAreaText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  switchingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
