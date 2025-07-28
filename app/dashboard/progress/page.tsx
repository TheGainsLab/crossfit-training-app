'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface WeeklySummary {
  week: number
  skills_completed: number
  skills_avg_rpe: number
  skills_avg_quality: number
  technical_completed: number
  technical_avg_rpe: number
  technical_avg_quality: number
  strength_completed: number
  strength_avg_rpe: number
  strength_avg_quality: number
  accessories_completed: number
  accessories_avg_rpe: number
  accessories_avg_quality: number
  metcons_completed: number
  metcons_avg_percentile: number
  total_exercises_completed: number
  overall_avg_rpe: number
  overall_avg_quality: number
  week_ending_date: string
}

interface RecentWorkout {
  week: number
  day: number
  exercise_name: string
  block: string
  user_rpe: number | null
  user_quality: string | null
  completed_at: string
}

export default function ProgressPage() {
  const [loading, setLoading] = useState(true)
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([])
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [programId, setProgramId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProgressData()
  }, [])

  const loadProgressData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Get user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        setError('User not found')
        setLoading(false)
        return
      }

      // Get latest program
      const { data: programData } = await supabase
        .from('programs')
        .select('id')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (!programData) {
        setError('No program found')
        setLoading(false)
        return
      }

      setProgramId(programData.id)

      // Load weekly summaries
      const { data: summaries, error: summariesError } = await supabase
        .from('weekly_summaries')
        .select('*')
        .eq('user_id', userData.id)
        .eq('program_id', programData.id)
        .order('week', { ascending: true })

      if (summariesError) throw summariesError
      setWeeklySummaries(summaries || [])

      // Load recent workouts
      const { data: workouts, error: workoutsError } = await supabase
        .from('program_workouts')
        .select('week, day, exercise_name, block, user_rpe, user_quality, completed_at')
        .eq('program_id', programData.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20)

      if (workoutsError) throw workoutsError
      setRecentWorkouts(workouts || [])

      setLoading(false)
    } catch (err) {
      console.error('Error loading progress:', err)
      setError('Failed to load progress data')
      setLoading(false)
    }
  }

  const formatQuality = (quality: number | null) => {
    if (!quality) return '-'
    return quality.toFixed(1)
  }

  const formatRPE = (rpe: number | null) => {
    if (!rpe) return '-'
    return rpe.toFixed(1)
  }

  const getQualityColor = (quality: number | null) => {
    if (!quality) return 'text-gray-500'
    if (quality >= 3.5) return 'text-green-600'
    if (quality >= 2.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRPEColor = (rpe: number | null) => {
    if (!rpe) return 'text-gray-500'
    if (rpe <= 6) return 'text-green-600'
    if (rpe <= 8) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading progress data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="mt-4 text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Training Progress
              </h1>
              <p className="text-gray-600">
                Track your performance over time
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Weekly Summaries */}
        {weeklySummaries.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Weekly Performance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Week</th>
                    <th className="text-center py-2">Completed</th>
                    <th className="text-center py-2">Avg RPE</th>
                    <th className="text-center py-2">Avg Quality</th>
                    <th className="text-center py-2">Skills</th>
                    <th className="text-center py-2">Strength</th>
                    <th className="text-center py-2">MetCons</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklySummaries.map((summary) => (
                    <tr key={summary.week} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-medium">Week {summary.week}</td>
                      <td className="text-center">{summary.total_exercises_completed}</td>
                      <td className={`text-center ${getRPEColor(summary.overall_avg_rpe)}`}>
                        {formatRPE(summary.overall_avg_rpe)}
                      </td>
                      <td className={`text-center ${getQualityColor(summary.overall_avg_quality)}`}>
                        {formatQuality(summary.overall_avg_quality)}
                      </td>
                      <td className="text-center">{summary.skills_completed}</td>
                      <td className="text-center">{summary.strength_completed}</td>
                      <td className="text-center">{summary.metcons_completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Workouts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Workouts</h2>
          {recentWorkouts.length === 0 ? (
            <p className="text-gray-600">No completed workouts yet</p>
          ) : (
            <div className="space-y-3">
              {recentWorkouts.map((workout, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{workout.exercise_name}</div>
                    <div className="text-sm text-gray-600">
                      Week {workout.week}, Day {workout.day} • {workout.block}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {workout.user_rpe && (
                      <div className="text-sm">
                        <span className="text-gray-600">RPE: </span>
                        <span className={getRPEColor(workout.user_rpe)}>
                          {workout.user_rpe}/10
                        </span>
                      </div>
                    )}
                    {workout.user_quality && (
                      <div className="text-sm">
                        <span className="text-gray-600">Quality: </span>
                        <span className="font-medium">{workout.user_quality}</span>
                      </div>
                    )}
                    <div className="text-sm text-gray-500">
                      {new Date(workout.completed_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {weeklySummaries.reduce((sum, week) => sum + week.total_exercises_completed, 0)}
            </div>
            <div className="text-gray-600">Total Exercises Completed</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {weeklySummaries.length > 0 
                ? formatRPE(
                    weeklySummaries.reduce((sum, week) => sum + (week.overall_avg_rpe || 0), 0) / 
                    weeklySummaries.filter(w => w.overall_avg_rpe).length
                  )
                : '-'
              }
            </div>
            <div className="text-gray-600">Average RPE</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {recentWorkouts.length > 0 
                ? `${Math.floor((Date.now() - new Date(recentWorkouts[0].completed_at).getTime()) / (1000 * 60 * 60 * 24))}d ago`
                : '-'
              }
            </div>
            <div className="text-gray-600">Last Workout</div>
          </div>
        </div>
      </div>
    </div>
  )
}
