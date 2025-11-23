'use client'

import { useState, useEffect } from 'react'
import WorkoutCard from './WorkoutCard'

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
  percentile: string | null
  performance_tier: string | null
  median_score: string | null
  excellent_score: string | null
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
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('incomplete')

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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to load workouts. Status:', response.status, 'Error:', errorData)
        alert(`Failed to load workouts!\n\nError: ${errorData.error || 'Unknown error'}\nStatus: ${response.status}`)
      }
    } catch (error) {
      console.error('Error loading workouts:', error)
      alert(`Error loading workouts: ${error}`)
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
      {/* Stats Section - Mobile responsive */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        {/* Total */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-6 border" style={{ borderColor: '#282B34' }}>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total</p>
          <p className="text-2xl sm:text-4xl font-bold" style={{ color: '#FE5858' }}>{stats.total}</p>
        </div>

        {/* Logged */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-6 border" style={{ borderColor: '#282B34' }}>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Logged</p>
          <p className="text-2xl sm:text-4xl font-bold" style={{ color: '#FE5858' }}>{stats.completed}</p>
        </div>

        {/* Complete */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-6 border" style={{ borderColor: '#282B34' }}>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Complete</p>
          <p className="text-2xl sm:text-4xl font-bold" style={{ color: '#FE5858' }}>{stats.completionRate}%</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
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
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[#FE5858] text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({stats.total})
        </button>
      </div>

      {/* Workout List */}
      {workouts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {filter === 'completed' && 'No completed workouts yet!'}
            {filter === 'incomplete' && 'No workouts to do!'}
            {filter === 'all' && 'No workouts yet!'}
          </h3>
          <p className="text-gray-600 mb-6">
            {filter === 'completed' && 'When you complete workouts, you\'ll see them here with your results and stats.'}
            {filter === 'incomplete' && 'All caught up! Generate more workouts to keep training.'}
            {filter === 'all' && 'When you build your workout library, you\'ll see it here'}
          </p>
          <a
            href="/btn"
            className="inline-block px-6 py-3 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b] transition-colors"
          >
            {filter === 'all' ? 'Go to Workout Generator' : 'Generate More Workouts'}
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
