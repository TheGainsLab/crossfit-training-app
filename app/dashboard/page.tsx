'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

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
  const [currentProgram, setCurrentProgram] = useState<number | null>(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [currentDay, setCurrentDay] = useState(1)
  const [user, setUser] = useState<User | null>(null)
  const [userId, setUserId] = useState<number | null>(null)

  // API Testing States - REMOVE AFTER TESTING
  const [testResult, setTestResult] = useState<any>(null)
  const [isTestLoading, setIsTestLoading] = useState(false)
  const [testExercise, setTestExercise] = useState('Bar Muscle Ups')
  const [testBlock, setTestBlock] = useState('SKILLS')

  useEffect(() => {
    loadUserAndProgram()
  }, [])

  useEffect(() => {
    if (currentProgram && currentWeek && currentDay) {
      fetchTodaysWorkout()
    }
  }, [currentProgram, currentWeek, currentDay])

  // API Test Function - REMOVE AFTER TESTING
  const testExerciseDeepDive = async () => {
    if (!userId) {
      alert('User ID not loaded yet')
      return
    }

    setIsTestLoading(true)
    setTestResult(null)
    
    try {
      const params = new URLSearchParams({
        exercise: testExercise,
        block: testBlock,
        timeRange: '90'
      })
      
      const response = await fetch(`/api/analytics/${userId}/exercise-deep-dive?${params}`)
      const data = await response.json()
      setTestResult(data)
      console.log('✅ API Response:', data)
    } catch (error) {
      console.error('❌ Test failed:', error)
      setTestResult({ error: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsTestLoading(false)
    }
  }

  const loadUserAndProgram = async () => {
    try {
      // Get current user
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      setUser(user)

      // Get user ID from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        setLoading(false)
        return
      }
      setUserId(userData.id)

      // Get latest program for this user
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, generated_at')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (programError || !programData) {
        setError('No program found. Please complete the intake assessment.')
        setLoading(false)
        return
      }

      setCurrentProgram(programData.id)

      // Calculate current week and day based on program start date
      const programStartDate = new Date(programData.generated_at)
      const today = new Date()
      const daysSinceStart = Math.floor((today.getTime() - programStartDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Assuming 5 training days per week with weekends off
      const totalTrainingDays = daysSinceStart - (Math.floor(daysSinceStart / 7) * 2)
      const weekNumber = Math.floor(totalTrainingDays / 5) + 1
      const dayNumber = (totalTrainingDays % 5) + 1

      // Cap at 12 weeks and 5 days
      const calculatedWeek = Math.min(Math.max(1, weekNumber), 12)
      const calculatedDay = Math.min(Math.max(1, dayNumber), 5)

      setCurrentWeek(calculatedWeek)
      setCurrentDay(calculatedDay)
    } catch (err) {
      console.error('Error loading user program:', err)
      setError('Failed to load program data')
      setLoading(false)
    }
  }

  const fetchTodaysWorkout = async () => {
    try {
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
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          {error.includes('No program found') && (
            <Link
              href="/intake"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Complete Assessment
            </Link>
          )}
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
        {/* API TEST SECTION - REMOVE AFTER TESTING */}
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-orange-800 mb-4">🧪 API Test Section (Remove After Testing)</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exercise:</label>
              <input 
                type="text"
                value={testExercise}
                onChange={(e) => setTestExercise(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Block:</label>
              <select 
                value={testBlock}
                onChange={(e) => setTestBlock(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="SKILLS">SKILLS</option>
                <option value="STRENGTH">STRENGTH</option>
                <option value="METCONS">METCONS</option>
                <option value="ACCESSORIES">ACCESSORIES</option>
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600">User ID: {userId || 'Loading...'}</p>
            <p className="text-sm text-gray-600">Auth User ID: {user?.id || 'No user'}</p>
            <p className="text-sm text-gray-600">User Email: {user?.email || 'No email'}</p>
          </div>

          <button 
            onClick={testExerciseDeepDive}
            disabled={isTestLoading || !userId}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isTestLoading ? 'Testing API...' : 'Test Exercise Deep Dive API'}
          </button>
          
          {testResult && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-2">API Response:</h3>
              <div className="bg-white border rounded-lg p-4 max-h-96 overflow-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
        {/* END API TEST SECTION */}

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
                        ⚡ Deload Week
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
                  href={`/dashboard/workout/${currentProgram}/week/${currentWeek}/day/${currentDay}`}
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
                    <span className="font-semibold">#{currentProgram}</span>
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
                <div className="text-3xl mb-2">📊</div>
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
