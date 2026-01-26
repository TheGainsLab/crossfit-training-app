import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'

interface MetConCardProps {
  metconData?: {
    id: number
    workoutId: string
    workoutFormat: string
    workoutNotes: string
    timeRange: string
    tasks: Array<{
      reps: string
      exercise: string
      weight_male: string
      weight_female: string
    }>
    percentileGuidance: {
      male: { excellentScore: string, medianScore: string }
      female: { excellentScore: string, medianScore: string }
    }
    rxWeights: { male: string, female: string }
  }
  onComplete: (
    workoutScore: string,
    taskCompletions: { exerciseName: string, rpe: number, quality: string }[],
    avgHR?: string,
    peakHR?: string,
    notes?: string
  ) => void
}

export default function MetConCard({ metconData, onComplete }: MetConCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const [workoutScore, setWorkoutScore] = useState('')
  const [taskRPEs, setTaskRPEs] = useState<{ [key: string]: number }>({})
  const [taskQualities, setTaskQualities] = useState<{ [key: string]: string }>({})
  const [notes, setNotes] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [avgHR, setAvgHR] = useState('')
  const [peakHR, setPeakHR] = useState('')

  const handleTaskRPE = (exerciseName: string, rpe: number) => {
    setTaskRPEs(prev => ({ ...prev, [exerciseName]: rpe }))
  }

  const handleTaskQuality = (exerciseName: string, quality: string) => {
    setTaskQualities(prev => ({ ...prev, [exerciseName]: quality }))
  }

  const handleSubmit = async () => {
    if (!workoutScore.trim()) return

    setIsSubmitting(true)

    try {
      const taskCompletions = metconData?.tasks.map(task => ({
        exerciseName: task.exercise,
        rpe: taskRPEs[task.exercise] || 5,
        quality: taskQualities[task.exercise] || 'C'
      })) || []

      await onComplete(workoutScore, taskCompletions, avgHR || undefined, peakHR || undefined, notes || undefined)

      setIsCompleted(true)
      setIsExpanded(false)
    } catch (error) {
      console.error('Error submitting MetCon:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const QualityButton = ({
    grade,
    isSelected,
    onPress
  }: {
    grade: string
    isSelected: boolean
    onPress: () => void
  }) => {
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
      </TouchableOpacity>
    )
  }

  if (!metconData) return null

  const currentBenchmarks = metconData.percentileGuidance?.[gender]
  const currentRxWeight = metconData.rxWeights?.[gender]

  return (
    <View style={[
      styles.card,
      isCompleted ? styles.cardCompleted : styles.cardDefault
    ]}>
      {/* MetCon Header */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {metconData.workoutId || 'MetCon'}
              </Text>
              {isCompleted && <Text style={styles.checkmark}>✅</Text>}
            </View>

            {metconData.workoutNotes && (
              <View style={styles.notesContainer}>
                {(() => {
                  const colonIndex = metconData.workoutNotes.indexOf(':');
                  if (colonIndex === -1) {
                    return <Text style={styles.notes}>{metconData.workoutNotes}</Text>;
                  }
                  const header = metconData.workoutNotes.substring(0, colonIndex + 1).trim();
                  const movementsPart = metconData.workoutNotes.substring(colonIndex + 1).trim();
                  const movements = movementsPart.split(' + ').map(m => m.trim());
                  return (
                    <>
                      <Text style={styles.notesHeader}>{header}</Text>
                      {movements.map((movement, idx) => (
                        <Text key={idx} style={styles.notesMovement}>• {movement}</Text>
                      ))}
                    </>
                  );
                })()}
              </View>
            )}

            {isCompleted && !isExpanded && (
              <View style={styles.completedScoreContainer}>
                <Text style={styles.completedScoreLabel}>
                  Score: <Text style={styles.completedScoreValue}>{workoutScore}</Text>
                </Text>
              </View>
            )}
          </View>

          <View style={styles.expandIcon}>
            <Text style={styles.expandIconText}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Completion Form */}
      {isExpanded && !isCompleted && (
        <View style={styles.form}>
          {/* Gender Selection */}
          <View style={styles.section}>
            <View style={styles.genderContainer}>
              <View style={styles.genderToggle}>
                <TouchableOpacity
                  onPress={() => setGender('male')}
                  style={[
                    styles.genderButton,
                    gender === 'male' ? styles.genderButtonActive : styles.genderButtonInactive
                  ]}
                >
                  <Text style={[
                    styles.genderButtonText,
                    gender === 'male' ? styles.genderButtonTextActive : styles.genderButtonTextInactive
                  ]}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setGender('female')}
                  style={[
                    styles.genderButton,
                    gender === 'female' ? styles.genderButtonActive : styles.genderButtonInactive
                  ]}
                >
                  <Text style={[
                    styles.genderButtonText,
                    gender === 'female' ? styles.genderButtonTextActive : styles.genderButtonTextInactive
                  ]}>
                    Female
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Benchmarks */}
          {currentBenchmarks && (
            <View style={styles.section}>
              <View style={styles.benchmarksRow}>
                <View style={styles.benchmarkCard}>
                  <Text style={styles.benchmarkLabel}>90%</Text>
                  <Text style={styles.benchmarkValue}>
                    {currentBenchmarks.excellentScore || 'N/A'}
                  </Text>
                </View>
                <View style={styles.benchmarkCard}>
                  <Text style={styles.benchmarkLabel}>50%</Text>
                  <Text style={styles.benchmarkValue}>
                    {currentBenchmarks.medianScore || 'N/A'}
                  </Text>
                </View>
                <View style={styles.benchmarkCard}>
                  <Text style={styles.benchmarkLabel}>Rx</Text>
                  <Text style={styles.benchmarkValue}>
                    {currentRxWeight || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Your Score */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Score</Text>
            <TextInput
              placeholder="e.g., 12:34, 8 rounds + 15 reps, 674 total reps"
              value={workoutScore}
              onChangeText={setWorkoutScore}
              style={styles.input}
              editable={!isSubmitting}
            />
          </View>

          {/* Heart Rate */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heart Rate (Optional)</Text>
            <View style={styles.hrRow}>
              <View style={styles.hrInputContainer}>
                <Text style={styles.hrLabel}>Avg HR (bpm)</Text>
                <TextInput
                  keyboardType="number-pad"
                  placeholder=""
                  value={avgHR}
                  onChangeText={setAvgHR}
                  style={styles.input}
                  editable={!isSubmitting}
                />
              </View>
              <View style={styles.hrInputContainer}>
                <Text style={styles.hrLabel}>Peak HR (bpm)</Text>
                <TextInput
                  keyboardType="number-pad"
                  placeholder=""
                  value={peakHR}
                  onChangeText={setPeakHR}
                  style={styles.input}
                  editable={!isSubmitting}
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          {!showNotes ? (
            <View style={styles.section}>
              <TouchableOpacity onPress={() => setShowNotes(true)}>
                <Text style={styles.addNotesText}>+ Add Notes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.notesHeader}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowNotes(false)
                    setNotes('')
                  }}
                >
                  <Text style={styles.removeNotesText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />
            </View>
          )}

          {/* Task Performance */}
          {metconData.tasks && metconData.tasks.length > 0 && (() => {
            // Group tasks by exercise + weight to avoid duplicate ratings
            const getTaskKey = (task: any) => {
              const weight = gender === 'male' ? task.weight_male : task.weight_female
              return weight ? `${task.exercise}-${weight}` : task.exercise
            }

            const taskGroups = metconData.tasks.reduce((acc: any, task: any) => {
              const key = getTaskKey(task)
              if (!acc[key]) {
                acc[key] = {
                  exercise: task.exercise,
                  weight: gender === 'male' ? task.weight_male : task.weight_female,
                  totalReps: 0,
                  repsList: []
                }
              }
              acc[key].totalReps += parseInt(task.reps) || 0
              acc[key].repsList.push(task.reps)
              return acc
            }, {})

            const uniqueTasks = Object.values(taskGroups)

            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Task Performance</Text>
                {uniqueTasks.map((taskGroup: any, index: number) => (
              <View key={index} style={styles.taskCard}>
                {/* Task Header */}
                <View style={styles.taskHeader}>
                  <Text style={styles.taskExercise}>{taskGroup.exercise}</Text>
                  {taskGroup.weight && (
                    <Text style={styles.taskReps}>
                      {taskGroup.weight} lbs
                    </Text>
                  )}
                </View>

                {/* RPE */}
                <View style={styles.rpeContainer}>
                  <View style={styles.rpeHeader}>
                    <Text style={styles.rpeLabel}>RPE</Text>
                    <Text style={styles.rpeValue}>
                      {taskRPEs[taskGroup.exercise] || 5}/10
                    </Text>
                  </View>
                  <Slider
                    minimumValue={1}
                    maximumValue={10}
                    step={1}
                    value={taskRPEs[taskGroup.exercise] || 5}
                    onValueChange={(value) => handleTaskRPE(taskGroup.exercise, value)}
                    minimumTrackTintColor="#FE5858"
                    maximumTrackTintColor="#C4E2EA"
                    thumbTintColor="#FE5858"
                    disabled={isSubmitting}
                  />
                  <View style={styles.rpeLabels}>
                    <Text style={styles.rpeLabelText}>1 - Very Easy</Text>
                    <Text style={styles.rpeLabelText}>10 - Max Effort</Text>
                  </View>
                </View>

                {/* Quality */}
                <View>
                  <Text style={styles.qualityTitle}>Quality</Text>
                  <View style={styles.qualityButtons}>
                    {['A', 'B', 'C', 'D'].map((grade) => (
                      <QualityButton
                        key={grade}
                        grade={grade}
                        isSelected={taskQualities[taskGroup.exercise] === grade}
                        onPress={() =>
                          handleTaskQuality(
                            taskGroup.exercise,
                            taskQualities[taskGroup.exercise] === grade ? 'C' : grade
                          )
                        }
                      />
                    ))}
                  </View>
                </View>
              </View>
                ))}
              </View>
            )
          })()}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!workoutScore.trim() || isSubmitting}
            style={[
              styles.submitButton,
              (!workoutScore.trim() || isSubmitting) && styles.submitButtonDisabled
            ]}
          >
            {isSubmitting ? (
              <View style={styles.submitButtonContent}>
                <ActivityIndicator color="white" />
                <Text style={styles.submitButtonText}>
                  Logging MetCon...
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>
                Mark Exercise Complete
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDefault: {
    borderWidth: 2,
    borderColor: '#282B34',
  },
  cardCompleted: {
    borderWidth: 2,
    borderColor: '#FE5858',
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
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  checkmark: {
    color: '#FE5858',
    fontSize: 20,
    marginLeft: 8,
  },
  notesContainer: {
    marginBottom: 16,
  },
  notes: {
    fontSize: 14,
    color: '#282B34',
    lineHeight: 22,
  },
  notesHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  notesMovement: {
    fontSize: 14,
    color: '#282B34',
    lineHeight: 22,
    paddingLeft: 8,
  },
  completedScoreContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  completedScoreLabel: {
    fontSize: 14,
    color: '#282B34',
  },
  completedScoreValue: {
    fontWeight: '600',
    color: '#FE5858',
  },
  expandIcon: {
    marginLeft: 16,
  },
  expandIconText: {
    color: '#9CA3AF',
    fontSize: 20,
  },
  form: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    backgroundColor: '#F6FBFE',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  genderToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  genderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  genderButtonActive: {
    backgroundColor: '#FE5858',
  },
  genderButtonInactive: {
    backgroundColor: 'transparent',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
  },
  genderButtonTextInactive: {
    color: '#282B34',
  },
  benchmarksRow: {
    flexDirection: 'row',
    gap: 12,
  },
  benchmarkCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C4E2EA',
  },
  benchmarkLabel: {
    fontSize: 12,
    color: '#282B34',
    fontWeight: '500',
    textAlign: 'center',
  },
  benchmarkValue: {
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
    marginTop: 4,
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  hrRow: {
    flexDirection: 'row',
    gap: 16,
  },
  hrInputContainer: {
    flex: 1,
  },
  hrLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#282B34',
    marginBottom: 4,
  },
  addNotesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    textTransform: 'uppercase',
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
  textArea: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C4E2EA',
    marginBottom: 16,
  },
  taskHeader: {
    marginBottom: 12,
  },
  taskExercise: {
    fontWeight: '600',
    color: '#282B34',
    fontSize: 16,
  },
  taskReps: {
    fontSize: 14,
    color: '#282B34',
    marginTop: 4,
  },
  rpeContainer: {
    marginBottom: 16,
  },
  rpeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rpeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#282B34',
    textTransform: 'uppercase',
  },
  rpeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FE5858',
  },
  rpeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rpeLabelText: {
    fontSize: 12,
    color: '#6B7280',
  },
  qualityTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#282B34',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  qualityButtonSelected: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  qualityButtonUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  qualityGrade: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  qualityGradeSelected: {
    color: '#FFFFFF',
  },
  qualityGradeUnselected: {
    color: '#374151',
  },
  qualityLabel: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.75,
  },
  qualityLabelSelected: {
    color: '#FFFFFF',
  },
  qualityLabelUnselected: {
    color: '#374151',
  },
  submitButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FE5858',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
})
