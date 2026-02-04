import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Modal, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getAvailableEnginePrograms, getUserCurrentProgram, switchEngineProgram, type EngineProgram } from '@/lib/api/enginePrograms'
import ProgramCard from './ProgramCard'

interface ProgramSelectorProps {
  visible: boolean
  onClose: () => void
  userId: number
  onProgramChanged?: () => void
}

export default function ProgramSelector({
  visible,
  onClose,
  userId,
  onProgramChanged
}: ProgramSelectorProps) {
  const [programs, setPrograms] = useState<EngineProgram[]>([])
  const [currentProgram, setCurrentProgram] = useState<EngineProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    if (visible) {
      loadData()
    }
  }, [visible, userId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [programsResult, currentProgramResult] = await Promise.all([
        getAvailableEnginePrograms(),
        getUserCurrentProgram(userId)
      ])

      if (programsResult.error) {
        console.error('Error loading programs:', programsResult.error)
        Alert.alert('Error', 'Failed to load programs. Please try again.')
        return
      }

      if (currentProgramResult.error) {
        console.error('Error loading current program:', currentProgramResult.error)
      }

      if (programsResult.programs) {
        setPrograms(programsResult.programs)
      }

      if (currentProgramResult.program) {
        setCurrentProgram(currentProgramResult.program)
      }
    } catch (error) {
      console.error('Error in loadData:', error)
      Alert.alert('Error', 'Failed to load programs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleProgramPress = (programId: string) => {
    // If selecting current program, just show info
    if (programId === currentProgram?.id) {
      Alert.alert(
        'Current Program',
        `You're already on ${currentProgram.display_name}!`,
        [{ text: 'OK' }]
      )
      return
    }

    // Show confirmation for switching
    setSelectedProgramId(programId)
    setShowConfirmation(true)
  }

  const handleConfirmSwitch = async () => {
    if (!selectedProgramId) return

    setSwitching(true)
    setShowConfirmation(false)

    try {
      const { success, error } = await switchEngineProgram(userId, selectedProgramId)

      if (error || !success) {
        console.error('Error switching program:', error)
        Alert.alert('Error', 'Failed to switch programs. Please try again.')
        return
      }

      // Success!
      Alert.alert(
        'Program Switched',
        `You've switched to ${programs.find(p => p.id === selectedProgramId)?.display_name}. Your progress has been reset to Day 1.`,
        [
          {
            text: 'OK',
            onPress: () => {
              onProgramChanged?.()
              onClose()
            }
          }
        ]
      )
    } catch (error) {
      console.error('Error in handleConfirmSwitch:', error)
      Alert.alert('Error', 'Failed to switch programs. Please try again.')
    } finally {
      setSwitching(false)
      setSelectedProgramId(null)
    }
  }

  const handleCancelSwitch = () => {
    setShowConfirmation(false)
    setSelectedProgramId(null)
  }

  const selectedProgram = programs.find(p => p.id === selectedProgramId)

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
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Choose Your Program</Text>
            <Text style={styles.subtitle}>
              Changes reset progress to Day 1
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FE5858" />
            <Text style={styles.loadingText}>Loading programs...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
          >
            {programs.map((program) => {
              const isActive = program.id === currentProgram?.id
              return (
                <ProgramCard
                  key={program.id}
                  program={program}
                  isActive={isActive}
                  onPress={() => handleProgramPress(program.id)}
                  buttonText={isActive ? 'Currently Active' : 'Switch to This Program'}
                  buttonStyle={isActive ? 'active' : 'secondary'}
                />
              )
            })}
          </ScrollView>
        )}

        {/* Confirmation Dialog */}
        {showConfirmation && selectedProgram && (
          <View style={styles.overlay}>
            <View style={styles.confirmationDialog}>
              <Text style={styles.confirmationTitle}>
                Switch to {selectedProgram.display_name}?
              </Text>
              
              <View style={styles.confirmationContent}>
                <View style={styles.warningItem}>
                  <Ionicons name="refresh" size={20} color="#6B7280" />
                  <Text style={styles.warningText}>You'll restart at Day 1</Text>
                </View>
                
                <View style={styles.warningItem}>
                  <Ionicons name="save" size={20} color="#6B7280" />
                  <Text style={styles.warningText}>
                    Your progress in {currentProgram?.display_name} will be saved
                  </Text>
                </View>
                
                <View style={styles.warningItem}>
                  <Ionicons name="card" size={20} color="#6B7280" />
                  <Text style={styles.warningText}>Your billing stays the same</Text>
                </View>
              </View>

              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.cancelButton]}
                  onPress={handleCancelSwitch}
                  disabled={switching}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.confirmButton]}
                  onPress={handleConfirmSwitch}
                  disabled={switching}
                >
                  {switching ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Switch Program</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmationDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmationContent: {
    gap: 16,
    marginBottom: 24,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  confirmButton: {
    backgroundColor: '#FE5858',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
