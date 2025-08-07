'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

// Keep your existing interfaces
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

interface DashboardAnalytics {
  success: boolean;
  data: {
    dashboard: {
      overallMetrics: any;
      blockPerformance: any;
      progressionTrends: any;
      keyInsights: string[];
    };
  };
  metadata: any;
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
  const [dashboardAnalytics, setDashboardAnalytics] = useState<DashboardAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  useEffect(() => {
    loadUserAndProgram()
  }, [])

  useEffect(() => {
    if (currentProgram && currentWeek && currentDay) {
      fetchTodaysWorkout()
    }
  }, [currentProgram, currentWeek, currentDay])

  useEffect(() => {
    if (userId && currentProgram) {
      fetchDashboardAnalytics()
    }
  }, [userId, currentProgram])

  const fetchDashboardAnalytics = async () => {
    if (!userId) return
    
    setAnalyticsLoading(true)
    try {
      const response = await fetch(`/api/analytics/${userId}/dashboard`)
      const apiResponse = await response.json()
      setDashboardAnalytics(apiResponse)
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error)
      setDashboardAnalytics(null)
    } finally {
      setAnalyticsLoading(false)
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
      setCurrentWeek(1)
      setCurrentDay(1)
    } catch (err) {
      console.error('Error loading user program:', err)
      setError('Failed to load program data')
      setLoading(false)
    }
  }

  // New simplified widgets
  const ProgressTrackingWidget: React.FC<{ analytics: any }> = ({ analytics }) => {
    if (!analytics?.data?.dashboard) {
      return (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      )
    }

    const { blockPerformance, overallMetrics } = analytics.data.dashboard
    
    // Calculate completion percentages for demo - replace with real data
    const totalSessions = overallMetrics?.totalTrainingDays || 0
    const overallCompletion = Math.min((totalSessions / 60) * 100, 100) // Assuming 60 sessions in program

    const blockData = [
      { name: 'Skills', completed: blockPerformance?.['SKILLS']?.exercisesCompleted || 0 },
      { name: 'Technical', completed: blockPerformance?.['TECHNICAL WORK']?.exercisesCompleted || 0 },
      { name: 'Strength', completed: blockPerformance?.['STRENGTH AND POWER']?.exercisesCompleted || 0 },
      { name: 'Accessories', completed: blockPerformance?.['ACCESSORIES']?.exercisesCompleted || 0 },
      { name: 'MetCons', completed: blockPerformance?.['METCONS']?.exercisesCompleted || 0 }
    ]

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">📊 Progress Tracking</h3>
        
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Sessions</span>
            <span className="font-semibold">{totalSessions}</span>
          </div>
          
          {blockData.map((block) => (
            <div key={block.name} className="flex justify-between items-center">
              <span className="text-gray-600">{block.name} Blocks</span>
              <span className="font-semibold">{block.completed}</span>
            </div>
          ))}
        </div>

        {/* Overall completion bar */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Overall Completion</span>
            <span className="text-sm font-medium">{Math.round(overallCompletion)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
              style={{ width: `${overallCompletion}%` }}
            ></div>
          </div>
        </div>
      </div>
    )
  }

  const PerformanceTrendsWidget: React.FC<{ analytics: any }> = ({ analytics }) => {
    if (!analytics?.data?.dashboard) {
      return (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      )
    }

    const { overallMetrics } = analytics.data.dashboard
    
    // Calculate blocks per week - replace with real calculation
    const totalBlocks = Object.values(analytics.data.dashboard.blockPerformance || {})
      .reduce((sum: number, block: any) => sum + (block.exercisesCompleted || 0), 0)
    const weeksActive = Math.max(Math.ceil(overallMetrics?.totalTrainingDays / 5) || 1, 1)
    const blocksPerWeek = Math.round((totalBlocks / weeksActive) * 10) / 10

    // Mock last workout date - replace with real data
    const lastWorkoutDate = new Date()
    lastWorkoutDate.setDate(lastWorkoutDate.getDate() - 1) // Yesterday for demo

    const formatDate = (date: Date) => {
      const today = new Date()
      const diffTime = Math.abs(today.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) return 'Yesterday'
      if (diffDays === 2) return '2 days ago'
      if (diffDays <= 7) return `${diffDays} days ago`
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">📈 Performance Trends</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Blocks per Week</span>
            <span className="font-semibold">{blocksPerWeek}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Last Workout</span>
            <span className="font-semibold">{formatDate(lastWorkoutDate)}</span>
          </div>
        </div>
      </div>
    )
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
        {/* Top Section: Simplified Widgets + Analytics Link */}
        <div className="mb-8">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {analyticsLoading ? (
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              </>
            ) : dashboardAnalytics ? (
              <>
                <ProgressTrackingWidget analytics={dashboardAnalytics} />
                <PerformanceTrendsWidget analytics={dashboardAnalytics} />
              </>
            ) : (
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">📊</span>
                  <span className="text-blue-800 font-medium">Analytics loading...</span>
                </div>
              </div>
            )}
          </div>

          {/* View Progress Link */}
          <div className="text-center">
            <Link
              href="/dashboard/progress"
              className="inline-flex items-center px-6 py-3 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
            >
              <span className="text-2xl mr-3">📊</span>
              <div className="text-left">
                <div className="font-semibold text-gray-900">View Detailed Analytics</div>
                <div className="text-sm text-gray-600">Dive deep into your performance data</div>
              </div>
            </Link>
          </div>
        </div>
        
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
                <Link
                  href={`/dashboard/workout/${currentProgram}/week/${currentWeek}/day/${currentDay}`}
                  className="block w-full bg-blue-600 text-white text-center py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
                >
                  Start Today's Workout →
                </Link>
              </div>
            </div>

            {/* Bottom Navigation */}
            <div className="grid md:grid-cols-2 gap-6">
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
