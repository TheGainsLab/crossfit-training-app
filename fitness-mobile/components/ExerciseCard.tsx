import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'

interface Exercise {
  name: string
  sets: number | string
  reps: number | string
  weightTime: string
  notes: string
}

interface Completion {
  exerciseName: string
  setsCompleted?: number
  repsCompleted?: string
  weightUsed?: number
  rpe?: number
  quality?: string
  notes?: string
  wasRx?: boolean
}

interface ExerciseCardProps {
  exercise: Exercise
  block: string
  completion?: Completion
  onComplete: (completion: Partial<Completion>) => void
}

export default function ExerciseCard({
  exercise,
  block,
  completion,
  onComplete
}: ExerciseCardProps) {
  const [isExpanded, setIsExpanded] = useState(!completion)
  const [showCues, setShowCues] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [completionType, setCompletionType] = useState(
    completion && completion.wasRx === false ? 'modified' : 'asRx'
  )
  const [formData, setFormData] = useState({
    setsCompleted: completion?.setsCompleted || exercise.sets || '',
    repsCompleted: completion?.repsCompleted || exercise.reps?.toString() || '',
    weightUsed: completion?.weightUsed || (exercise.weightTime && exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : ''),
    rpe: completion?.rpe || 7,
    quality: completion?.quality || '',
    notes: completion?.notes || ''
  })

  useEffect(() => {
    if (completionType === 'modified' && !completion) {
      setFormData(prev => ({
        setsCompleted: prev.setsCompleted || exercise.sets || '',
        repsCompleted: prev.repsCompleted || exercise.reps?.toString() || '',
        weightUsed: prev.weightUsed || (exercise.weightTime && exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : ''),
        rpe: prev.rpe || 7,
        quality: prev.quality || '',
        notes: prev.notes || ''
      }))
    }
  }, [completionType, exercise, completion])

  const isCompleted = completion !== undefined

  const handleDetailedSubmit = () => {
    let completionData

    if (completionType === 'asRx') {
      completionData = {
        setsCompleted: parseInt(exercise.sets.toString()),
        repsCompleted: exercise.reps.toString(),
        weightUsed: exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : undefined,
        rpe: formData.rpe,
        quality: formData.quality || undefined,
        notes: formData.notes.toString(),
        wasRx: true
      }
    } else {
      completionData = {
        setsCompleted: formData.setsCompleted ? parseInt(formData.setsCompleted.toString()) : (parseInt(exercise.sets.toString()) || 1),
        repsCompleted: formData.repsCompleted && formData.repsCompleted.toString().trim() !== '' ? formData.repsCompleted.toString() : exercise.reps.toString(),
        weightUsed: formData.weightUsed ? parseFloat(formData.weightUsed.toString()) : (exercise.weightTime !== 'BW' ? parseFloat(exercise.weightTime) : undefined),
        rpe: formData.rpe,
        quality: formData.quality || undefined,
        notes: formData.notes.toString(),
        wasRx: false
      }
    }

    onComplete(completionData)
    setIsExpanded(false)
  }

  const QualityButton = ({ grade, isSelected, onPress }: { grade: string, isSelected: boolean, onPress: () => void }) => {
    const getGradeLabel = () => {
      switch (grade) {
        case 'A': return 'Excellent'
        case 'B': return 'Good'
        case 'C': return 'Average'
        case 'D': return 'Poor'
        default: return grade
      }
    }

    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.qualityButton,
          isSelected ? styles.qualityButtonSelected : styles.qualityButtonUnselected
        ]}
      >
        <Text style={[
          styles.qualityGrade,
          isSelected ? styles.qualityGradeSelected : styles.qualityGradeUnselected
        ]}>
          {grade}
        </Text>
        <Text style={[
          styles.qualityLabel,
          isSelected ? styles.qualityLabelSelected : styles.qualityLabelUnselected
        ]}>
          {getGradeLabel()}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <View
      style={[
        styles.card,
        isCompleted ? styles.cardCompleted : styles.cardDefault
      ]}
    >
      {/* Exercise Header */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.header}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {/* Exercise Title */}
            <View style={styles.titleRow}>
              <Text style={styles.exerciseTitle}>{exercise.name}</Text>
              {exercise.notes ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation()
                    setShowCues(!showCues)
                  }}
                  style={styles.infoButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.infoText}>i</Text>
                </TouchableOpacity>
              ) : null}
              {isCompleted ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>

            {/* Performance Cues */}
            {showCues && exercise.notes ? (
              <View style={styles.cuesContainer}>
                <Text style={styles.cuesText}>{exercise.notes}</Text>
              </View>
            ) : null}

            {/* Exercise Specs - Grid Layout */}
            <View style={[
              styles.specsGrid,
              exercise.weightTime && exercise.weightTime !== 'BW' ? styles.specsGridThree : styles.specsGridTwo
            ]}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Sets:</Text>
                <Text style={[styles.specValue, { marginLeft: 8 }]}>{exercise.sets || '-'}</Text>
              </View>
              <View style={[styles.specItem, { marginLeft: 24 }]}>
                <Text style={styles.specLabel}>Reps:</Text>
                <Text style={[styles.specValue, { marginLeft: 8 }]}>{exercise.reps || '-'}</Text>
              </View>
              {exercise.weightTime && exercise.weightTime !== 'BW' ? (
                <View style={[styles.specItem, { marginLeft: 24 }]}>
                  <Text style={styles.specLabel}>Weight:</Text>
                  <Text style={[styles.specValue, { marginLeft: 8 }]}>{exercise.weightTime}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Chevron */}
          <View style={styles.chevronContainer}>
            <Text style={styles.chevron}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Completion Form */}
      {isExpanded ? (
        <View style={styles.formContainer}>
          {/* Completion Type Selection */}
          <View style={styles.section}>
            <TouchableOpacity
              onPress={() => setCompletionType('asRx')}
              style={styles.radioOption}
              activeOpacity={0.7}
            >
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radioOuter,
                  completionType === 'asRx' ? styles.radioOuterSelected : null
                ]}>
                  {completionType === 'asRx' ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.radioLabel}>As Prescribed (As Rx)</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCompletionType('modified')}
              style={[styles.radioOption, styles.radioOptionLast]}
              activeOpacity={0.7}
            >
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radioOuter,
                  completionType === 'modified' ? styles.radioOuterSelected : null
                ]}>
                  {completionType === 'modified' ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.radioLabel}>Modified Workout</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Performance Inputs - Only show for Modified */}
          {completionType === 'modified' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERFORMANCE</Text>
              <View style={[
                styles.inputGrid,
                exercise.weightTime === 'BW' ? styles.inputGridTwo : styles.inputGridThree
              ]}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Sets</Text>
                  <TextInput
                    value={formData.setsCompleted.toString()}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, setsCompleted: text }))}
                    keyboardType="number-pad"
                    style={styles.input}
                    placeholder="0"
                  />
                </View>
                <View style={[styles.inputGroup, { marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Reps</Text>
                  <TextInput
                    value={formData.repsCompleted.toString()}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, repsCompleted: text }))}
                    keyboardType="default"
                    style={styles.input}
                    placeholder="0"
                  />
                </View>
                {exercise.weightTime !== 'BW' ? (
                  <View style={[styles.inputGroup, { marginLeft: 12 }]}>
                    <Text style={styles.inputLabel}>Weight</Text>
                    <TextInput
                      value={formData.weightUsed.toString()}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, weightUsed: text }))}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      placeholder="lbs"
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* RPE Section */}
          <View style={[styles.section, { marginTop: 12 }]}>
            <View style={styles.rpeHeader}>
              <Text style={styles.sectionTitle}>RPE</Text>
              <Text style={styles.rpeValue}>{Math.round(formData.rpe)}/10</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={formData.rpe}
                onValueChange={(value) => setFormData(prev => ({ ...prev, rpe: value }))}
                minimumTrackTintColor="#FE5858"
                maximumTrackTintColor="#DAE2EA"
                thumbTintColor="#FE5858"
                style={styles.slider}
              />
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>1 - Very Easy</Text>
              <Text style={styles.sliderLabel}>10 - Max Effort</Text>
            </View>
          </View>

          {/* Quality Section */}
          <View style={[styles.section, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>QUALITY</Text>
            <View style={styles.qualityGrid}>
              {['A', 'B', 'C', 'D'].map((grade, index) => (
                <View key={grade} style={[styles.qualityButtonWrapper, index > 0 && styles.qualityButtonSpacing]}>
                  <QualityButton
                    grade={grade}
                    isSelected={formData.quality === grade}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      quality: prev.quality === grade ? '' : grade
                    }))}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Notes Section */}
          {!showNotes ? (
            <View style={[styles.section, { marginTop: 12 }]}>
              <TouchableOpacity
                onPress={() => setShowNotes(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.addNotesText}>+ Add Notes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.section, { marginTop: 12 }]}>
              <View style={styles.notesHeader}>
                <Text style={styles.sectionTitle}>NOTES</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowNotes(false)
                    setFormData(prev => ({ ...prev, notes: '' }))
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removeNotesText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={formData.notes.toString()}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
                style={styles.notesInput}
                placeholder="Add your notes here..."
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleDetailedSubmit}
            style={[styles.submitButton, { marginTop: 12 }]}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>
              {isCompleted ? 'Update Exercise' : 'Mark Exercise Complete'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#282B34',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardDefault: {
    borderColor: '#282B34',
  },
  cardCompleted: {
    borderColor: '#282B34',
    backgroundColor: '#FFF5F5',
  },
  header: {
    padding: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  exerciseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1F2E',
  },
  infoButton: {
    width: 24,
    height: 24,
    backgroundColor: '#FE5858',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  checkmark: {
    color: '#FE5858',
    fontSize: 20,
    marginLeft: 8,
  },
  cuesContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  cuesText: {
    color: '#1A1F2E',
    fontSize: 14,
    lineHeight: 20,
  },
  specsGrid: {
    flexDirection: 'row',
  },
  specsGridTwo: {
    justifyContent: 'flex-start',
  },
  specsGridThree: {
    justifyContent: 'space-between',
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  specValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1F2E',
  },
  chevronContainer: {
    marginLeft: 16,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1F2E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  radioOption: {
    marginBottom: 12,
  },
  radioOptionLast: {
    marginBottom: 0,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: '#FE5858',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FE5858',
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1F2E',
  },
  inputGrid: {
    flexDirection: 'row',
  },
  inputGridTwo: {
    // Two columns
  },
  inputGridThree: {
    // Three columns
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1F2E',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: 8,
    borderWidth: 1,
    borderColor: '#DAE2EA',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: '#1A1F2E',
  },
  rpeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rpeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FE5858',
  },
  sliderContainer: {
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  qualityGrid: {
    flexDirection: 'row',
  },
  qualityButtonWrapper: {
    flex: 1,
  },
  qualityButtonSpacing: {
    marginLeft: 8,
  },
  qualityButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityButtonSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
    shadowColor: '#FE5858',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  qualityButtonUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  qualityGrade: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  qualityGradeSelected: {
    color: '#FFFFFF',
  },
  qualityGradeUnselected: {
    color: '#374151',
  },
  qualityLabel: {
    fontSize: 11,
    opacity: 0.75,
  },
  qualityLabelSelected: {
    color: '#FFFFFF',
  },
  qualityLabelUnselected: {
    color: '#374151',
  },
  addNotesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1F2E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  removeNotesText: {
    fontSize: 12,
    color: '#6B7280',
  },
  notesInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#DAE2EA',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: '#1A1F2E',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FE5858',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
