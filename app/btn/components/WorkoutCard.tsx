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
    median_score: string | null
    excellent_score: string | null
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

  // Format workout format to match generated card
  const formatDisplayFormat = () => {
    if (workout.workout_format === 'Rounds For Time' && workout.rounds) {
      return `${workout.rounds} Rounds For Time`
    }
    if (workout.workout_format === 'AMRAP' && workout.amrap_time) {
      return `AMRAP ${workout.amrap_time} minutes`
    }
    if (workout.pattern) {
      return `${workout.workout_format}: ${workout.pattern}`
    }
    return workout.workout_format
  }

  return (
    <div className="border rounded-lg p-6" style={{ backgroundColor: '#F8FBFE' }}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-lg font-bold">{workout.workout_name}</h4>
        <div className="flex gap-2">
          {!isCompleted ? (
            <button
              onClick={() => {
                setExpanded(true)
                setShowLogging(true)
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
            >
              Log Result
            </button>
          ) : (
            <button
              disabled
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
            >
              Completed
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <div>
          <span className="font-semibold">Time Domain:</span> {workout.time_domain}
        </div>
      </div>
      
      <div className="rounded p-4 mb-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#282B34' }}>
        <p className="font-semibold mb-2">
          {formatDisplayFormat()}
        </p>
        {workout.exercises && workout.exercises.length > 0 ? (
          workout.exercises.map((exercise: any, exIndex: number) => (
            <div key={exIndex} className="flex justify-between py-1">
              <span>
                {workout.workout_format === 'For Time' && workout.pattern
                  ? exercise.name
                  : `${exercise.reps || ''} ${exercise.name}`.trim()}
              </span>
              {exercise.weight && <span className="text-[#FE5858] font-medium">{exercise.weight}</span>}
            </div>
          ))
        ) : (
          <p className="text-gray-600">No exercises available</p>
        )}
      </div>
      
      {/* Benchmark Scores */}
      {workout.median_score && workout.excellent_score && (
        <div className="mb-4 p-3 border rounded-lg" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="text-sm font-semibold mb-2 text-center" style={{ color: '#FE5858' }}>Performance Benchmarks</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">50th Percentile (Median):</span>
              <span className="ml-2 font-semibold" style={{ color: '#FE5858' }}>{workout.median_score}</span>
            </div>
            <div>
              <span className="text-gray-600">90th Percentile (Excellent):</span>
              <span className="ml-2 font-semibold" style={{ color: '#FE5858' }}>{workout.excellent_score}</span>
            </div>
          </div>
        </div>
      )}

      {/* Completed Result Display */}
      {isCompleted && result && (
        <div className="mt-4 p-3 bg-white rounded-lg border border-[#282B34]">
          <p className="text-sm font-semibold">
            Result: <span style={{ color: '#FE5858' }}>{result}</span>
            {workout.percentile && (
              <span className="ml-3" style={{ color: '#282B34' }}>
                ({workout.percentile}%)
              </span>
            )}
          </p>
          {workout.notes && (
            <p className="text-sm mt-1" style={{ color: '#282B34' }}>
              Notes: {workout.notes.toLowerCase()}
            </p>
          )}
        </div>
      )}

      {/* Result Logging Form */}
      {showLogging && !isCompleted && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <ResultLoggingForm
            workoutId={workout.id}
            workoutFormat={workout.workout_format}
            exercises={workout.exercises || []}
            onSuccess={handleResultSaved}
            onCancel={() => setShowLogging(false)}
          />
        </div>
      )}
    </div>
  )
}
