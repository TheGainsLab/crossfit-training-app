'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Clock, CheckCircle } from 'lucide-react'
import engineDatabaseService from '@/lib/engine/databaseService'

interface TrainingDayComponentProps {
  dayNumber: number
  onBack: () => void
  onBackToMonth?: () => void
}

export default function TrainingDayComponent({ dayNumber, onBack, onBackToMonth }: TrainingDayComponentProps) {
  const [workout, setWorkout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    if (dayNumber) {
      loadWorkoutData()
    }
  }, [dayNumber])

  const loadWorkoutData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load workout for this day
      const workoutData = await engineDatabaseService.loadWorkoutForDay(dayNumber)
      
      if (!workoutData) {
        setError('Workout not found for this day')
        return
      }

      setWorkout(workoutData)

      // Check if already completed
      const programVersion = await engineDatabaseService.loadProgramVersion()
      const session = await engineDatabaseService.getWorkoutSessionByDay(
        workoutData.program_day_number || workoutData.day_number,
        workoutData.day_type || 'endurance',
        programVersion || '5-day'
      )

      if (session) {
        setIsCompleted(true)
      }
    } catch (err: any) {
      console.error('Error loading workout:', err)
      setError(err.message || 'Failed to load workout')
    } finally {
      setLoading(false)
    }
  }

  const getWorkoutTypeDisplayName = (dayType: string) => {
    const typeMap: Record<string, string> = {
      'time_trial': 'Time Trial',
      'endurance': 'Endurance',
      'anaerobic': 'Anaerobic',
      'max_aerobic_power': 'Max Aerobic Power',
      'interval': 'Interval',
      'polarized': 'Polarized',
      'threshold': 'Threshold',
      'tempo': 'Tempo',
      'recovery': 'Recovery',
      'flux': 'Flux',
      'devour': 'Devour',
      'towers': 'Towers',
      'afterburner': 'Afterburner',
      'synthesis': 'Synthesis'
    }
    return typeMap[dayType] || dayType?.replace('_', ' ') || 'Conditioning'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workout...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-8">
          <button
            onClick={onBack}
            className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadWorkoutData}
              className="px-6 py-2 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-8">
          <button
            onClick={onBack}
            className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-600">Workout not found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={onBack}
          className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Day {workout.program_day_number || workout.day_number}
              </h1>
              {isCompleted && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Completed
                </span>
              )}
            </div>
            <p className="text-xl text-gray-600">
              {getWorkoutTypeDisplayName(workout.day_type)}
            </p>
          </div>

          <div className="space-y-6">
            {/* Workout Details */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Workout Details</h2>
              <div className="space-y-3">
                {workout.description && (
                  <div>
                    <p className="text-gray-700 whitespace-pre-line">{workout.description}</p>
                  </div>
                )}
                {workout.notes && (
                  <div>
                    <p className="text-sm text-gray-600 italic">{workout.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Placeholder for workout execution */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Workout Execution</h3>
              </div>
              <p className="text-blue-800 mb-4">
                The full workout execution interface with timers, intervals, and session tracking will be integrated here.
              </p>
              <p className="text-sm text-blue-600">
                This includes: timer controls, interval tracking, output recording, RPE input, and session saving.
              </p>
            </div>

            {/* Workout Parameters */}
            {workout.workout_params && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Workout Parameters</h3>
                <pre className="text-sm text-gray-700 bg-white p-4 rounded border overflow-auto">
                  {JSON.stringify(workout.workout_params, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

