import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native'
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

  return (
    <View
      className={`bg-white rounded-xl shadow-sm border-2 mb-4 ${
        isCompleted
          ? 'border-coral bg-coral/5'
          : 'border-slate-blue'
      }`}
    >
      {/* Exercise Header */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        className="p-6"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            {/* Exercise Title */}
            <View className="flex-row items-center mb-4">
              <Text className="text-xl font-bold text-charcoal">{exercise.name}</Text>
              {exercise.notes && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation()
                    setShowCues(!showCues)
                  }}
                  className="w-6 h-6 bg-coral rounded-full ml-3 items-center justify-center"
                >
                  <Text className="text-white text-xs">i</Text>
                </TouchableOpacity>
              )}
              {isCompleted && <Text className="text-coral text-xl ml-2">✓</Text>}
            </View>

            {/* Performance Cues */}
            {showCues && exercise.notes && (
              <View className="mb-4 bg-coral/10 rounded-lg p-3">
                <Text className="text-charcoal text-sm">{exercise.notes}</Text>
              </View>
            )}

            {/* Exercise Specs */}
            <View className={`flex-row gap-6 ${exercise.weightTime && exercise.weightTime !== 'BW' ? 'justify-between' : 'justify-start'}`}>
              <View className="flex-row items-center">
                <Text className="text-gray-500 font-medium">Sets: </Text>
                <Text className="text-charcoal font-semibold text-base">{exercise.sets || '-'}</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-gray-500 font-medium">Reps: </Text>
                <Text className="text-charcoal font-semibold text-base">{exercise.reps || '-'}</Text>
              </View>
              {exercise.weightTime && exercise.weightTime !== 'BW' && (
                <View className="flex-row items-center">
                  <Text className="text-gray-500 font-medium">Weight: </Text>
                  <Text className="text-charcoal font-semibold text-base">{exercise.weightTime}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Chevron */}
          <View className="ml-4">
            <Text className="text-gray-400 text-xl">
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Completion Form */}
      {isExpanded && (
        <View className="px-6 pb-6">
          {/* Completion Type Selection */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <TouchableOpacity
              onPress={() => setCompletionType('asRx')}
              className="flex-row items-center mb-3"
            >
              <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${
                completionType === 'asRx' ? 'border-coral' : 'border-gray-300'
              }`}>
                {completionType === 'asRx' && (
                  <View className="w-2 h-2 rounded-full bg-coral" />
                )}
              </View>
              <Text className="text-base font-medium text-charcoal">
                As Prescribed (As Rx)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCompletionType('modified')}
              className="flex-row items-center"
            >
              <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${
                completionType === 'modified' ? 'border-coral' : 'border-gray-300'
              }`}>
                {completionType === 'modified' && (
                  <View className="w-2 h-2 rounded-full bg-coral" />
                )}
              </View>
              <Text className="text-base font-medium text-charcoal">
                Modified Workout
              </Text>
            </TouchableOpacity>
          </View>

          {/* Performance Inputs - Only show for Modified */}
          {completionType === 'modified' && (
            <View className="bg-ice-blue rounded-lg p-4 mb-3">
              <Text className="text-sm font-semibold text-charcoal mb-3 uppercase">
                Performance
              </Text>
              <View className={`flex-row gap-3 ${exercise.weightTime === 'BW' ? '' : ''}`}>
                <View className="flex-1">
                  <Text className="text-xs font-medium text-charcoal mb-1">Sets</Text>
                  <TextInput
                    value={formData.setsCompleted.toString()}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, setsCompleted: text }))}
                    keyboardType="number-pad"
                    className="w-full p-2 border border-slate-blue rounded-lg bg-white"
                    placeholder="0"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-medium text-charcoal mb-1">Reps</Text>
                  <TextInput
                    value={formData.repsCompleted.toString()}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, repsCompleted: text }))}
                    className="w-full p-2 border border-slate-blue rounded-lg bg-white"
                    placeholder="0"
                  />
                </View>
                {exercise.weightTime !== 'BW' && (
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-charcoal mb-1">Weight</Text>
                    <TextInput
                      value={formData.weightUsed.toString()}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, weightUsed: text }))}
                      keyboardType="decimal-pad"
                      className="w-full p-2 border border-slate-blue rounded-lg bg-white"
                      placeholder="lbs"
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* RPE Section */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-charcoal uppercase">RPE</Text>
              <Text className="text-lg font-bold text-coral">{formData.rpe}/10</Text>
            </View>
            <Slider
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={formData.rpe}
              onValueChange={(value) => setFormData(prev => ({ ...prev, rpe: value }))}
              minimumTrackTintColor="#FE5858"
              maximumTrackTintColor="#DAE2EA"
              thumbTintColor="#FE5858"
            />
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500">1 - Very Easy</Text>
              <Text className="text-xs text-gray-500">10 - Max Effort</Text>
            </View>
          </View>

          {/* Quality Section */}
          <View className="bg-ice-blue rounded-lg p-4 mb-3">
            <Text className="text-sm font-semibold text-charcoal mb-3 uppercase">
              Quality
            </Text>
            <View className="flex-row gap-2">
              {['A', 'B', 'C', 'D'].map((grade) => (
                <QualityButton
                  key={grade}
                  grade={grade}
                  isSelected={formData.quality === grade}
                  onPress={() => setFormData(prev => ({
                    ...prev,
                    quality: prev.quality === grade ? '' : grade
                  }))}
                />
              ))}
            </View>
          </View>

          {/* Notes Section */}
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
                    setFormData(prev => ({ ...prev, notes: '' }))
                  }}
                >
                  <Text className="text-xs text-gray-500">Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={formData.notes.toString()}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
                className="w-full p-3 border border-slate-blue rounded-lg bg-white"
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleDetailedSubmit}
            className="w-full bg-coral py-4 px-6 rounded-lg"
          >
            <Text className="text-white text-center font-semibold text-base">
              {isCompleted ? 'Update Exercise' : 'Mark Exercise Complete'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
