'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

// Keep your existing interface
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

// ADD these new interfaces
interface DayCompletion {
  week: number
  day: number
  totalExercises: number
  completedExercises: number
  isFullyComplete: boolean
  completionPercentage: number
}

interface CompletionMap {
  [key: string]: DayCompletion // key format: "week-day"
}

// ADD these new interfaces after CompletionMap
interface DashboardAnalytics {
  weeklyPerformance: {
    averageRPE: number
    averageQuality: number
    completionRate: number
    trend: 'improving' | 'stable' | 'declining'
  }
  blockStatus: {
    skills: { completion: number; status: string; alert?: string }
    strength: { completion: number; status: string; alert?: string }
    metcons: { completion: number; status: string; alert?: string }
    accessories: { completion: number; status: string; alert?: string }
  }
  coachingInsights: string[]
  topAchievement?: string
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
  const [completionStatus, setCompletionStatus] = useState<CompletionMap>({})
  const [completionLoading, setCompletionLoading] = useState(false)
// ADD these new state variables after your existing useState declarations
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

  // ADD this new useEffect
  useEffect(() => {
    if (currentProgram && userId) {
      fetchCompletionData()
    }
  }, [currentProgram, userId])

  // Completion tracking functions
  const fetchCompletionStatus = async (programId: number, userId: number): Promise<CompletionMap> => {
    try {
      const supabase = createClient()
      
      // Get completed exercises from performance_logs
      const { data: completedLogs, error: logsError } = await supabase
        .from('performance_logs')
        .select('week, day, block, exercise_name, set_number')
        .eq('program_id', programId)
        .eq('user_id', userId)

      if (logsError) {
        console.error('Error fetching performance logs:', logsError)
        return {}
      }

      // Get program structure to count total exercises
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('program_data')
        .eq('id', programId)
        .single()

      if (programError || !programData) {
        console.error('Error fetching program data:', programError)
        return {}
      }

      // Count completed exercises per day
      const completedByDay: { [key: string]: Set<string> } = {}
      
      completedLogs?.forEach(log => {
        const dayKey = `${log.week}-${log.day}`
        if (!completedByDay[dayKey]) {
          completedByDay[dayKey] = new Set()
        }
        // Create unique exercise identifier
        const exerciseKey = `${log.block}-${log.exercise_name}-${log.set_number}`
        completedByDay[dayKey].add(exerciseKey)
      })

      // Count total exercises per day from program structure
      const completionMap: CompletionMap = {}
      
      programData.program_data.weeks.forEach((week: any) => {
        week.days.forEach((day: any) => {
          const dayKey = `${week.week}-${day.day}`
          
          // Count total exercises across all blocks
          let totalExercises = 0
          day.blocks.forEach((block: any) => {
            totalExercises += block.exercises.length
          })

          // Get completed count
          const completedCount = completedByDay[dayKey]?.size || 0
          
          completionMap[dayKey] = {
            week: week.week,
            day: day.day,
            totalExercises,
            completedExercises: completedCount,
            isFullyComplete: completedCount === totalExercises && totalExercises > 0,
            completionPercentage: totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0
          }
        })
      })

      return completionMap
    } catch (error) {
      console.error('Error in fetchCompletionStatus:', error)
      return {}
    }
  }

  const fetchCompletionData = async () => {
    if (!currentProgram || !userId) return
    
    setCompletionLoading(true)
    try {
      const completion = await fetchCompletionStatus(currentProgram, userId)
      setCompletionStatus(completion)
    } catch (error) {
      console.error('Error fetching completion status:', error)
    } finally {
      setCompletionLoading(false)
    }
  }

// ADD this function after fetchCompletionData
const fetchDashboardAnalytics = async () => {
  if (!userId) return
  
  setAnalyticsLoading(true)
  try {
    const response = await fetch(`/api/analytics/${userId}/dashboard`)
    const data = await response.json()
    
    // Transform the API response into our widget format
    const analytics: DashboardAnalytics = {
      weeklyPerformance: {
        averageRPE: data.weeklyStats?.averageRPE || 0,
        averageQuality: data.weeklyStats?.averageQuality || 0,
        completionRate: data.completionRate || 0,
        trend: data.performanceTrend || 'stable'
      },
      blockStatus: {
        skills: {
          completion: data.blockProgress?.skills?.completion || 0,
          status: data.blockProgress?.skills?.status || 'on-track',
          alert: data.blockProgress?.skills?.alert
        },
        strength: {
          completion: data.blockProgress?.strength?.completion || 0,
          status: data.blockProgress?.strength?.status || 'on-track',
          alert: data.blockProgress?.strength?.alert
        },
        metcons: {
          completion: data.blockProgress?.metcons?.completion || 0,
          status: data.blockProgress?.metcons?.status || 'on-track',
          alert: data.blockProgress?.metcons?.alert
        },
        accessories: {
          completion: data.blockProgress?.accessories?.completion || 0,
          status: data.blockProgress?.accessories?.status || 'on-track',
          alert: data.blockProgress?.accessories?.alert
        }
      },
      coachingInsights: data.coachingRecommendations || [],
      topAchievement: data.topAchievement
    }
    
    setDashboardAnalytics(analytics)
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error)
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

      // Default to Week 1, Day 1
      setCurrentWeek(1)
      setCurrentDay(1)
    } catch (err) {
      console.error('Error loading user program:', err)
      setError('Failed to load program data')
      setLoading(false)
    }
  }

  // Add the DayCompletionBadge component
  const DayCompletionBadge: React.FC<{ completion: DayCompletion }> = ({ completion }) => {
    if (completion.isFullyComplete) {
      return (
        <div className="flex items-center justify-center w-6 h-6 bg-green-500 text-white rounded-full text-xs font-bold">
          ✓
        </div>
      )
    }
    
    if (completion.completedExercises > 0) {
      return (
        <div className="flex items-center justify-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
          {completion.completedExercises}/{completion.totalExercises}
        </div>
      )
    }
    
    return null // No badge for untouched days
  }


// Add these interfaces to your existing interfaces section
interface DashboardAnalytics {
  weeklyPerformance: {
    averageRPE: number
    averageQuality: number
    completionRate: number
    trend: 'improving' | 'stable' | 'declining'
  }
  blockStatus: {
    skills: { completion: number; status: string; alert?: string }
    strength: { completion: number; status: string; alert?: string }
    metcons: { completion: number; status: string; alert?: string }
    accessories: { completion: number; status: string; alert?: string }
  }
  coachingInsights: string[]
  topAchievement?: string
}

// Add these state variables to your existing state
const [dashboardAnalytics, setDashboardAnalytics] = useState<DashboardAnalytics | null>(null)
const [analyticsLoading, setAnalyticsLoading] = useState(false)

// Add this function to fetch dashboard analytics
const fetchDashboardAnalytics = async () => {
  if (!userId) return
  
  setAnalyticsLoading(true)
  try {
    const response = await fetch(`/api/analytics/${userId}/dashboard`)
    const data = await response.json()
    
    // Transform the API response into our widget format
    const analytics: DashboardAnalytics = {
      weeklyPerformance: {
        averageRPE: data.weeklyStats?.averageRPE || 0,
        averageQuality: data.weeklyStats?.averageQuality || 0,
        completionRate: data.completionRate || 0,
        trend: data.performanceTrend || 'stable'
      },
      blockStatus: {
        skills: {
          completion: data.blockProgress?.skills?.completion || 0,
          status: data.blockProgress?.skills?.status || 'on-track',
          alert: data.blockProgress?.skills?.alert
        },
        strength: {
          completion: data.blockProgress?.strength?.completion || 0,
          status: data.blockProgress?.strength?.status || 'on-track',
          alert: data.blockProgress?.strength?.alert
        },
        metcons: {
          completion: data.blockProgress?.metcons?.completion || 0,
          status: data.blockProgress?.metcons?.status || 'on-track',
          alert: data.blockProgress?.metcons?.alert
        },
        accessories: {
          completion: data.blockProgress?.accessories?.completion || 0,
          status: data.blockProgress?.accessories?.status || 'on-track',
          alert: data.blockProgress?.accessories?.alert
        }
      },
      coachingInsights: data.coachingRecommendations || [],
      topAchievement: data.topAchievement
    }
    
    setDashboardAnalytics(analytics)
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error)
  } finally {
    setAnalyticsLoading(false)
  }
}

// Add this useEffect to fetch analytics
useEffect(() => {
  if (userId && currentProgram) {
    fetchDashboardAnalytics()
  }
}, [userId, currentProgram])

// Analytics Widget Components
const WeeklyPerformanceWidget: React.FC<{ analytics: DashboardAnalytics }> = ({ analytics }) => {
  const { weeklyPerformance } = analytics
  
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈'
      case 'declining': return '📉'
      default: return '➡️'
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600'
      case 'declining': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">📊 This Week's Performance</h3>
        <span className={`text-sm font-medium ${getTrendColor(weeklyPerformance.trend)}`}>
          {getTrendIcon(weeklyPerformance.trend)} {weeklyPerformance.trend}
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Average RPE</span>
          <span className="font-semibold">{weeklyPerformance.averageRPE.toFixed(1)}/10</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Quality Score</span>
          <span className="font-semibold">
            {weeklyPerformance.averageQuality >= 3.5 ? 'A' : 
             weeklyPerformance.averageQuality >= 2.5 ? 'B' : 
             weeklyPerformance.averageQuality >= 1.5 ? 'C' : 'D'}+
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Completion Rate</span>
          <span className="font-semibold">{Math.round(weeklyPerformance.completionRate)}%</span>
        </div>
      </div>
    </div>
  )
}

const BlockStatusWidget: React.FC<{ analytics: DashboardAnalytics }> = ({ analytics }) => {
  const { blockStatus } = analytics
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ahead': return 'text-green-600'
      case 'behind': return 'text-red-600'
      case 'alert': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ahead': return '⭐'
      case 'behind': return '⚠️'
      case 'alert': return '🔥'
      default: return '✅'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-gray-900 mb-4">🎯 Training Block Status</h3>
      
      <div className="space-y-3">
        {Object.entries(blockStatus).map(([block, data]) => (
          <div key={block} className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 capitalize">{block}</span>
              {data.alert && (
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                  {data.alert}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{data.completion}%</span>
              <span className={getStatusColor(data.status)}>
                {getStatusIcon(data.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CoachingInsightsWidget: React.FC<{ analytics: DashboardAnalytics }> = ({ analytics }) => {
  const { coachingInsights, topAchievement } = analytics

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-gray-900 mb-4">🧠 AI Coaching Insights</h3>
      
      {topAchievement && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-green-600">🏆</span>
            <span className="text-sm text-green-800 font-medium">{topAchievement}</span>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {coachingInsights.slice(0, 3).map((insight, index) => (
          <div key={index} className="flex items-start space-x-2">
            <span className="text-blue-600 mt-1">•</span>
            <span className="text-sm text-gray-700">{insight}</span>
          </div>
        ))}
        
        {coachingInsights.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            Complete more workouts to get personalized coaching insights!
          </p>
        )}
      </div>
      
      <div className="mt-4">
        <Link
          href="/dashboard/progress"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View detailed analysis →
        </Link>
      </div>
    </div>
  )
}

// ADD this main analytics section component
const AnalyticsWidgetsSection = () => {
  if (analyticsLoading) {
    return (
      <div className="mb-8">
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!dashboardAnalytics) {
    return (
      <div className="mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <span className="text-blue-600">📊</span>
            <span className="text-blue-800 font-medium">Analytics loading...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="grid md:grid-cols-3 gap-6">
        <WeeklyPerformanceWidget analytics={dashboardAnalytics} />
        <BlockStatusWidget analytics={dashboardAnalytics} />
        <CoachingInsightsWidget analytics={dashboardAnalytics} />
      </div>
    </div>
  )
}

// Main Analytics Widgets Section (add this to your JSX)
const AnalyticsWidgetsSection = () => {
  if (analyticsLoading) {
    return (
      <div className="mb-8">
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!dashboardAnalytics) {
    return (
      <div className="mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <span className="text-blue-600">📊</span>
            <span className="text-blue-800 font-medium">Analytics loading...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="grid md:grid-cols-3 gap-6">
        <WeeklyPerformanceWidget analytics={dashboardAnalytics} />
        <BlockStatusWidget analytics={dashboardAnalytics} />
        <CoachingInsightsWidget analytics={dashboardAnalytics} />
      </div>
    </div>
  )
}

// Add this to your main JSX return, right after the header and before todaysWorkout check:
{/* Analytics Widgets Section */}
<AnalyticsWidgetsSection />


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
  {/* Analytics Widgets Section */}
  <AnalyticsWidgetsSection />
  
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
              {/* Week Navigation - UPDATED WITH COMPLETION BADGES */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">This Week's Training</h3>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(day => {
                    const dayKey = `${currentWeek}-${day}`
                    const dayCompletion = completionStatus[dayKey]
                    
                    return (
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
                          <div className="flex items-center space-x-3">
                            <span className="font-medium">Day {day}</span>
                            {day === currentDay && <span className="text-sm text-blue-600">← Today</span>}
                          </div>
                          <div className="flex items-center space-x-2">
                            {dayCompletion && <DayCompletionBadge completion={dayCompletion} />}
                            {completionLoading && (
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Quick Stats - UPDATED WITH COMPLETION STATS */}
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
                  
                  {/* Add completion progress */}
                  {Object.keys(completionStatus).length > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">This Week</span>
                        <span className="font-semibold">
                          {[1,2,3,4,5].filter(day => {
                            const dayKey = `${currentWeek}-${day}`
                            return completionStatus[dayKey]?.isFullyComplete
                          }).length}/5 days complete
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Overall Progress</span>
                        <span className="font-semibold">
                          {Object.values(completionStatus).filter(c => c.isFullyComplete).length}/
                          {Object.keys(completionStatus).length} days
                        </span>
                      </div>
                    </>
                  )}
                  
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

