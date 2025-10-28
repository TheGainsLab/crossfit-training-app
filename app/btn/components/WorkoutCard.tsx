'use client'

import { useState } from 'react'
import ResultLoggingForm from './ResultLoggingForm'

interface WorkoutCardProps {
  workout: {
    id: number
    workout_name: string
    workout_format: string
    time_domain: string
    exercises: any[]
    rounds: number | null
    amrap_time: number | null
    pattern: string | null
    user_score: string | null
    result_time: string | null
    result_rounds: number | null
    result_reps: number | null
    notes: string | null
    completed_at: string | null
    created_at: string
    percentile: string | null
    performance_tier: string | null
  }
  onUpdate: () => void
}

export default function WorkoutCard({ workout, onUpdate }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showLogging, setShowLogging] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isCompleted = !!workout.completed_at

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatResult = () => {
    if (workout.result_time) {
      return workout.result_time
    }
    if (workout.result_rounds !== null && workout.result_reps !== null) {
      return `${workout.result_rounds} rounds + ${workout.result_reps} reps`
    }
    if (workout.result_rounds !== null) {
      return `${workout.result_rounds} rounds`
    }
    if (workout.user_score) {
      return workout.user_score
    }
    return null
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/btn/workouts/${workout.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onUpdate() // Refresh list
      } else {
        alert('Failed to delete workout. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting workout:', error)
      alert('Error deleting workout. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleResultSaved = () => {
    setShowLogging(false)
    setExpanded(false)
    onUpdate()
  }

  const formatWorkoutFormat = () => {
    if (workout.workout_format === 'Rounds For Time' && workout.rounds) {
      return `${workout.rounds} Rounds For Time`
    }
    if (workout.workout_format === 'AMRAP' && workout.amrap_time) {
      return `AMRAP ${workout.amrap_time} min`
    }
    if (workout.pattern) {
      return `${workout.workout_format}: ${workout.pattern}`
    }
    return workout.workout_format
  }

  const result = formatResult()

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900">{workout.workout_name}</h3>
              {isCompleted ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full flex items-center gap-1">
                  <span>✅</span> Completed
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full flex items-center gap-1">
                  <span>📝</span> To Do
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <span><strong>Format:</strong> {formatWorkoutFormat()}</span>
              <span><strong>Time Domain:</strong> {workout.time_domain}</span>
              <span><strong>Exercises:</strong> {workout.exercises?.length || 0}</span>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Generated: {formatDate(workout.created_at)}
            </p>

            {isCompleted && result && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-semibold text-green-900">
                  Result: {result}
                  {workout.percentile && (
                    <span className="ml-3 text-green-700">
                      ({workout.percentile}th percentile{workout.performance_tier && ` - ${workout.performance_tier}`})
                    </span>
                  )}
                </p>
                {workout.notes && (
                  <p className="text-sm text-green-700 mt-1">"{workout.notes}"</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            {expanded ? 'Hide Details ▲' : 'View Details ▼'}
          </button>
          
          {!isCompleted && (
            <button
              onClick={() => {
                setExpanded(true)
                setShowLogging(true)
              }}
              className="px-4 py-2 text-sm bg-[#FE5858] text-white rounded-lg hover:bg-[#ff6b6b] transition-colors font-medium"
            >
              Log Result
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">📋 Workout Details:</h4>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              {workout.pattern && (
                <p className="font-semibold text-gray-900 mb-2">{workout.pattern}</p>
              )}
              
              {workout.exercises && workout.exercises.length > 0 ? (
                <div className="space-y-1">
                  {workout.exercises.map((exercise: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-1">
                      <span className="text-gray-900">
                        {exercise.reps && `${exercise.reps} `}
                        {exercise.name}
                      </span>
                      {exercise.weight && (
                        <span className="text-gray-600 text-sm">@ {exercise.weight}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No exercise details available</p>
              )}
            </div>

            {/* Result Logging Form */}
            {showLogging && !isCompleted && (
              <ResultLoggingForm
                workoutId={workout.id}
                workoutFormat={workout.workout_format}
                onSuccess={handleResultSaved}
                onCancel={() => setShowLogging(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
