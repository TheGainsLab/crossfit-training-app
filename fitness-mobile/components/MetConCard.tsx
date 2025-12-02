import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
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
    peakHR?: string
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

      await onComplete(workoutScore, taskCompletions, avgHR || undefined, peakHR || undefined)

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
        className={`flex-1 py-3 rounded-lg border-2 ${
          isSelected
            ? 'bg-coral border-coral'
            : 'bg-white border-gray-300'
        }`}
      >
        <Text className={`text-center text-lg font-bold ${
          isSelected ? 'text-white' : 'text-gray-700'
        }`}>
          {grade}
        </Text>
        <Text className={`text-center text-xs ${
          isSelected ? 'text-white opacity-75' : 'text-gray-700 opacity-75'
        }`}>
          {getGradeLabel()}
        </Text>
      </TouchableOpacity>
    )
  }

  if (!metconData) return null

  const currentBenchmarks = metconData.percentileGuidance[gender]
  const currentRxWeight = metconData.rxWeights[gender]

  return (
    <View
      className={`bg-white rounded-xl shadow-sm border-2 mb-4 ${
        isCompleted
          ? 'border-coral bg-coral/5'
          : 'border-slate-blue'
      }`}
    >
      {/* MetCon Header */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        className="p-6"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center mb-4">
              <Text className="text-xl font-bold text-charcoal">
                {metconData.workoutId || 'MetCon'}
              </Text>
              {isCompleted && <Text className="text-coral text-xl ml-2">✅</Text>}
            </View>

            {metconData.workoutNotes && (
              <Text className="text-sm text-charcoal mb-4">
                {metconData.workoutNotes}
              </Text>
            )}

            {isCompleted && !isExpanded && (
              <View className="mt-4 pt-4 border-t border-gray-200">
                <Text className="text-sm text-charcoal">
                  Score: <Text className="font-semibold text-coral">{workoutScore}</Text>
                </Text>
              </View>
            )}
          </View>

          <View className="ml-4">
            <Text className="text-gray-400 text-xl">
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Completion Form */}
      {isExpanded && !isCompleted && (
        <View className="px-6 pb-6">
          {/* Gender Selection */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <View className="flex-row justify-center">
              <View className="flex-row bg-white rounded-lg p-1 border gap-1">
                <TouchableOpacity
                  onPress={() => setGender('male')}
                  className={`px-4 py-2 rounded-md ${
                    gender === 'male'
                      ? 'bg-coral'
                      : 'bg-transparent'
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    gender === 'male' ? 'text-white' : 'text-charcoal'
                  }`}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setGender('female')}
                  className={`px-4 py-2 rounded-md ${
                    gender === 'female'
                      ? 'bg-coral'
                      : 'bg-transparent'
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    gender === 'female' ? 'text-white' : 'text-charcoal'
                  }`}>
                    Female
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Benchmarks */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white rounded-lg p-3 border border-slate-blue">
                <Text className="text-xs text-charcoal font-medium text-center">Excellent</Text>
                <Text className="font-bold text-charcoal text-center">{currentBenchmarks.excellentScore}</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-3 border border-slate-blue">
                <Text className="text-xs text-charcoal font-medium text-center">Median</Text>
                <Text className="font-bold text-charcoal text-center">{currentBenchmarks.medianScore}</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-3 border border-slate-blue">
                <Text className="text-xs text-charcoal font-medium text-center">Rx Weight</Text>
                <Text className="font-bold text-charcoal text-center">{currentRxWeight}</Text>
              </View>
            </View>
          </View>

          {/* Your Score */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <Text className="text-sm font-semibold text-charcoal mb-3 uppercase">
              Your Score
            </Text>
            <TextInput
              placeholder="e.g., 12:34, 8 rounds + 15 reps, 674 total reps"
              value={workoutScore}
              onChangeText={setWorkoutScore}
              className="w-full p-3 border border-slate-blue rounded-lg bg-white"
              editable={!isSubmitting}
            />
          </View>

          {/* Heart Rate */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <Text className="text-sm font-semibold text-charcoal mb-3 uppercase">
              Heart Rate (Optional)
            </Text>
            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-xs font-medium text-charcoal mb-1">Avg HR (bpm)</Text>
                <TextInput
                  keyboardType="number-pad"
                  placeholder="e.g., 145"
                  value={avgHR}
                  onChangeText={setAvgHR}
                  className="w-full p-3 border border-slate-blue rounded-lg bg-white"
                  editable={!isSubmitting}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-charcoal mb-1">Peak HR (bpm)</Text>
                <TextInput
                  keyboardType="number-pad"
                  placeholder="e.g., 180"
                  value={peakHR}
                  onChangeText={setPeakHR}
                  className="w-full p-3 border border-slate-blue rounded-lg bg-white"
                  editable={!isSubmitting}
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          {!showNotes ? (
            <View className="bg-ice-blue rounded-lg p-4 mb-3">
              <TouchableOpacity onPress={() => setShowNotes(true)}>
                <Text className="text-sm font-semibold text-charcoal uppercase">
                  + Add Notes
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="bg-ice-blue rounded-lg p-4 mb-3">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm font-semibold text-charcoal uppercase">Notes</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowNotes(false)
                    setNotes('')
                  }}
                >
                  <Text className="text-xs text-gray-500">Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                className="w-full p-3 border border-slate-blue rounded-lg bg-white"
              />
            </View>
          )}

          {/* Task Performance */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <Text className="text-sm font-semibold text-charcoal mb-3 uppercase">
              Task Performance
            </Text>
            {metconData.tasks.map((task, index) => (
              <View key={index} className="bg-white rounded-lg p-4 border border-slate-blue mb-4">
                {/* Task Header */}
                <View className="mb-3">
                  <Text className="font-semibold text-charcoal">{task.exercise}</Text>
                  <Text className="text-sm text-charcoal">
                    {task.reps} reps {task.weight_male && `@ ${gender === 'male' ? task.weight_male : task.weight_female} lbs`}
                  </Text>
                </View>

                {/* RPE */}
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-medium text-charcoal uppercase">RPE</Text>
                    <Text className="text-sm font-bold text-coral">
                      {taskRPEs[task.exercise] || 5}/10
                    </Text>
                  </View>
                  <Slider
                    minimumValue={1}
                    maximumValue={10}
                    step={1}
                    value={taskRPEs[task.exercise] || 5}
                    onValueChange={(value) => handleTaskRPE(task.exercise, value)}
                    minimumTrackTintColor="#FE5858"
                    maximumTrackTintColor="#DAE2EA"
                    thumbTintColor="#FE5858"
                    disabled={isSubmitting}
                  />
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-500">1 - Very Easy</Text>
                    <Text className="text-xs text-gray-500">10 - Max Effort</Text>
                  </View>
                </View>

                {/* Quality */}
                <View>
                  <Text className="text-xs font-medium text-charcoal mb-2 uppercase">Quality</Text>
                  <View className="flex-row gap-2">
                    {['A', 'B', 'C', 'D'].map((grade) => (
                      <QualityButton
                        key={grade}
                        grade={grade}
                        isSelected={taskQualities[task.exercise] === grade}
                        onPress={() =>
                          handleTaskQuality(
                            task.exercise,
                            taskQualities[task.exercise] === grade ? 'C' : grade
                          )
                        }
                      />
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!workoutScore.trim() || isSubmitting}
            className={`w-full py-4 px-6 rounded-lg ${
              !workoutScore.trim() || isSubmitting ? 'bg-gray-400' : 'bg-coral'
            }`}
          >
            {isSubmitting ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="white" />
                <Text className="text-white text-center font-semibold text-base ml-2">
                  Logging MetCon...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Mark Exercise Complete
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
