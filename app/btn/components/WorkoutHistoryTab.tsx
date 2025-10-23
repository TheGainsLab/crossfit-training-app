'use client'

import { useState, useEffect } from 'react'
import WorkoutCard from './WorkoutCard'
import BTNExerciseHeatMap from './BTNExerciseHeatMap'

interface WorkoutHistoryStats {
  total: number
  completed: number
  incomplete: number
  completionRate: number
}

interface SavedWorkout {
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
}

export default function WorkoutHistoryTab() {
  const [workouts, setWorkouts] = useState<SavedWorkout[]>([])
  const [stats, setStats] = useState<WorkoutHistoryStats>({
    total: 0,
    completed: 0,
    incomplete: 0,
    completionRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('all')

  useEffect(() => {
    loadWorkouts()
  }, [filter])

  const loadWorkouts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/btn/workouts?filter=${filter}`)
      if (response.ok) {
        const data = await response.json()
        setWorkouts(data.workouts || [])
        setStats(data.stats || { total: 0, completed: 0, incomplete: 0, completionRate: 0 })
      } else {
        console.error('Failed to load workouts')
      }
    } catch (error) {
      console.error('Error loading workouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWorkoutUpdate = () => {
    loadWorkouts() // Refresh list after logging result or deleting
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858]"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Workouts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Generated</p>
              <p className="text-4xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="text-4xl">🎲</div>
          </div>
        </div>

        {/* Completed Workouts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-4xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
              <p className="text-4xl font-bold text-[#FE5858]">{stats.completionRate}%</p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>
      </div>

      {/* Exercise Distribution Heat Map */}
      <div className="mb-6">
        <BTNExerciseHeatMap />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[#FE5858] text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'completed'
              ? 'bg-[#FE5858] text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Completed ({stats.completed})
        </button>
        <button
          onClick={() => setFilter('incomplete')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'incomplete'
              ? 'bg-[#FE5858] text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          To Do ({stats.incomplete})
        </button>
      </div>

      {/* Workout List */}
      {workouts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">
            {filter === 'completed' ? '✅' : filter === 'incomplete' ? '📝' : '🎲'}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {filter === 'completed' && 'No completed workouts yet!'}
            {filter === 'incomplete' && 'No workouts to do!'}
            {filter === 'all' && 'No workouts yet!'}
          </h3>
          <p className="text-gray-600 mb-6">
            {filter === 'completed' && 'When you complete workouts, you\'ll see them here with your results and stats.'}
            {filter === 'incomplete' && 'All caught up! Generate more workouts to keep training.'}
            {filter === 'all' && 'When you complete workouts, you\'ll see them here. Start by generating your first batch!'}
          </p>
          <a
            href="/btn"
            className="inline-block px-6 py-3 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b] transition-colors"
          >
            {filter === 'all' ? 'Go to Generator' : 'Generate More Workouts'}
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {workouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              onUpdate={handleWorkoutUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
