'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, Calendar, BarChart3 } from 'lucide-react'
import engineDatabaseService from '@/lib/engine/databaseService'

interface AnalyticsProps {
  onBack: () => void
}

export default function Analytics({ onBack }: AnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [completedSessions, setCompletedSessions] = useState<any[]>([])
  const [timeTrials, setTimeTrials] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)

      const [progress, trials] = await Promise.all([
        engineDatabaseService.loadUserProgress(),
        engineDatabaseService.loadTimeTrials()
      ])

      if (progress.user) {
        setUser(progress.user)
      }

      setCompletedSessions(progress.completedSessions || [])
      setTimeTrials(trials || [])
    } catch (error) {
      console.error('Error loading analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <button
          onClick={onBack}
          className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">Track your progress and performance metrics</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Total Sessions</h3>
              <Calendar className="w-8 h-8 text-[#FE5858]" />
            </div>
            <p className="text-4xl font-bold text-gray-900">{completedSessions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Workouts completed</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Time Trials</h3>
              <TrendingUp className="w-8 h-8 text-[#FE5858]" />
            </div>
            <p className="text-4xl font-bold text-gray-900">{timeTrials.length}</p>
            <p className="text-sm text-gray-500 mt-2">Baseline tests completed</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Current Day</h3>
              <BarChart3 className="w-8 h-8 text-[#FE5858]" />
            </div>
            <p className="text-4xl font-bold text-gray-900">{user?.current_day || 0}</p>
            <p className="text-sm text-gray-500 mt-2">Days in program</p>
          </div>
        </div>

        {/* Placeholder for detailed analytics */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Performance Metrics</h2>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-blue-800 mb-4">
              The full analytics interface with charts, progress tracking, and performance analysis will be integrated here.
            </p>
            <p className="text-sm text-blue-600">
              This includes: performance ratio trends, pace improvements, modality-specific metrics, and historical comparisons.
            </p>
          </div>
        </div>

        {/* Recent Sessions */}
        {completedSessions.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Sessions</h2>
            <div className="space-y-4">
              {completedSessions.slice(0, 10).map((session, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      Day {session.program_day_number || session.day_number || session.workout_day}
                    </p>
                    <p className="text-sm text-gray-600">
                      {session.day_type?.replace('_', ' ') || 'Workout'}
                    </p>
                  </div>
                  <div className="text-right">
                    {session.date && (
                      <p className="text-sm text-gray-600">
                        {new Date(session.date).toLocaleDateString()}
                      </p>
                    )}
                    {session.total_output && (
                      <p className="text-sm font-medium text-gray-900">
                        {session.total_output} {session.modality || ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

