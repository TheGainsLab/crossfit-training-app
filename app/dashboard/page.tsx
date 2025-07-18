'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface WorkoutSummary {
  programId: number
  week: number
  day: number
  dayName: string
  mainLift: string
  isDeload: boolean
  totalExercises: number
  totalBlocks: number
}

export default function DashboardPage() {
  const [todaysWorkout, setTodaysWorkout] = useState<WorkoutSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // For demo purposes, we'll use Program 3, Week 1, Day 1
  // In production, this would calculate based on user's program start date
  const currentProgram = 3
  const currentWeek = 1
  const currentDay = 1

  useEffect(() => {
    fetchTodaysWorkout()
  }, [])

  const fetchTodaysWorkout = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workouts/${currentProgram}/week/${currentWeek}/day/${currentDay}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch today\'s workout')
      }

      const data = await response.json()
      
      if (data.success) {
        setTodaysWorkout({
          programId: data.workout.programId,
          week: data.workout.week,
          day: data.workout.day,
          dayName: data.workout.dayName,
          mainLift: data.workout.mainLift,
          isDeload: data.workout.isDeload,
          totalExercises: data.workout.totalExercises,
          totalBlocks: data.workout.totalBlocks
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your workout...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Workout Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchTodaysWorkout}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">The Gains Apps</h1>
              <p className="text-gray-600">{getGreeting()}, ready to train?</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">{formatDate(new Date())}</p>
              <p className="text-lg font-semibold text-blue-600">
                Week {currentWeek}, Day {currentDay}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {todaysWorkout && (
          <>
            {/* Today's Workout Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Today's Training</h2>
                    <p className="text-blue-100 text-lg">{todaysWorkout.dayName} - {todaysWorkout.mainLift} Focus</p>
                    {todaysWorkout.isDeload && (
                      <span className="inline-block bg-yellow-500 text-yellow-900 px-3 py-1 rounded-full text-sm font-medium mt-2">
                        🔄 Deload Week
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold">🏋️</div>
                    <p className="text-blue-200 mt-2">{todaysWorkout.totalExercises} exercises</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-1">🎯</div>
                    <p className="text-sm text-gray-600">Skills</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-1">🔧</div>
                    <p className="text-sm text-gray-600">Technical</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <div className="text-2xl mb-1">💪</div>
                    <p className="text-sm text-blue-600 font-medium">Strength</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-1">🔨</div>
                    <p className="text-sm text-gray-600">Accessories</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-1">🔥</div>
                    <p className="text-sm text-gray-600">MetCon</p>
                  </div>
                </div>
                
                <Link 
                  href={`/dashboard/workout/${todaysWorkout.programId}/week/${todaysWorkout.week}/day/${todaysWorkout.day}`}
                  className="block w-full bg-blue-600 text-white text-center py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
                >
                  Start Today's Workout →
                </Link>
              </div>
            </div>

            {/* Quick Navigation */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Week Navigation */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">This Week's Training</h3>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(day => (
                    <Link
                      key={day}
                      href={`/dashboard/workout/${currentProgram}/week/${currentWeek}/day/${day}`}
                      className={`block p-3 rounded-lg border transition-colors ${
                        day === currentDay 
                          ? 'bg-blue-50 border-blue-200 text-blue-700' 
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Day {day}</span>
                        {day === currentDay && <span className="text-sm text-blue-600">← Today</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Current Program</span>
                    <span className="font-semibold">#{todaysWorkout.programId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Week Progress</span>
                    <span className="font-semibold">{currentWeek} of 12</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Main Focus</span>
                    <span className="font-semibold">{todaysWorkout.mainLift}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(currentWeek / 12) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Link 
                href="/dashboard/progress"
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-2">📈</div>
                <h3 className="font-semibold text-gray-900 mb-1">View Progress</h3>
                <p className="text-gray-600 text-sm">See your strength gains and improvements</p>
              </Link>

              <Link 
                href="/dashboard/program"
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-2">📅</div>
                <h3 className="font-semibold text-gray-900 mb-1">Full Program</h3>
                <p className="text-gray-600 text-sm">Browse your complete 12-week plan</p>
              </Link>

              <Link 
                href="/dashboard/settings"
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-2">⚙️</div>
                <h3 className="font-semibold text-gray-900 mb-1">Settings</h3>
                <p className="text-gray-600 text-sm">Update 1RMs and preferences</p>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
