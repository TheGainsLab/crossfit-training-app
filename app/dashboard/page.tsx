'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

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

// Training Blocks Visualization Component
const TrainingBlocksWidget: React.FC<{ analytics: any; blockData: any }> = ({ analytics, blockData }) => {
  if (!blockData?.data?.blockAnalysis?.blockSummaries) {
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

  const blockSummaries = blockData.data.blockAnalysis.blockSummaries
  
  if (blockSummaries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">🎯 Training Blocks</h3>
        <p className="text-gray-600">Complete more exercises to see training block analytics!</p>
      </div>
    )
  }

  // Calculate totals
  const totalExercises = blockSummaries.reduce((sum: number, block: any) => sum + block.exercisesCompleted, 0)
  
  // Prepare donut chart data
  const donutChartData = {
    labels: blockSummaries.map((block: any) => block.blockName),
    datasets: [{
      data: blockSummaries.map((block: any) => block.exercisesCompleted),
      backgroundColor: [
        '#3B82F6', // Blue - Strength
        '#EF4444', // Red - Skills
        '#F59E0B', // Orange - Accessories  
        '#10B981', // Green - Technical
        '#8B5CF6'  // Purple - MetCons
      ],
      borderColor: [
        '#1D4ED8',
        '#DC2626', 
        '#D97706',
        '#059669',
        '#7C3AED'
      ],
      borderWidth: 2,
      hoverBorderWidth: 3
    }]
  }

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const block = blockSummaries[context.dataIndex];
            const percentage = block?.percentageOfTotal || 0;
            return `${label}: ${value} exercises (${percentage}%)`;
          }
        }
      }
    }
  }

  // Prepare RPE bar chart
  const rpeChartData = {
    labels: blockSummaries.filter((block: any) => block.avgRPE !== null).map((block: any) => block.blockName),
    datasets: [{
      label: 'Average RPE',
      data: blockSummaries.filter((block: any) => block.avgRPE !== null).map((block: any) => block.avgRPE),
      backgroundColor: 'rgba(59, 130, 246, 0.6)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1
    }]
  }

  const rpeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        title: {
          display: true,
          text: 'RPE (1-10)'
        }
      }
    }
  }

  // Helper functions
  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '↗️'
      case 'declining': return '↘️'
      default: return '➡️'
    }
  }

  const formatLastActive = (weeksActive: number): string => {
    if (weeksActive === 0) return 'No activity'
    if (weeksActive === 1) return 'This week'
    return `${weeksActive} weeks active`
  }

  return (
    <div className="space-y-6">
      {/* Donut Chart and RPE Chart */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Exercise Distribution Donut Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">🎯 Training Block Distribution</h3>
          <div className="h-64">
            <Doughnut data={donutChartData} options={donutChartOptions} />
          </div>
        </div>

        {/* RPE Comparison Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">💪 Average RPE by Block</h3>
          <div className="h-64">
            <Bar data={rpeChartData} options={rpeChartOptions} />
          </div>
        </div>
      </div>

      {/* Block Performance Cards */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Block Performance Details</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blockSummaries.map((block: any) => (
            <div key={block.blockName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{block.blockName}</h4>
                <div className="text-2xl font-bold text-blue-600">{block.exercisesCompleted}</div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Volume:</span>
                  <span className="font-medium">{block.percentageOfTotal}% of total</span>
                </div>
                
                {block.avgRPE && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg RPE:</span>
                    <span className="font-medium">{block.avgRPE}/10 {getTrendIcon(block.rpeTrend)}</span>
                  </div>
                )}
                
                {block.avgQuality && !block.qualityGrade.includes('%ile') && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Quality:</span>
                    <span className="font-medium">{block.qualityGrade} {getTrendIcon(block.qualityTrend)}</span>
                  </div>
                )}

                {block.qualityGrade.includes('%ile') && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className="font-medium">{block.qualityGrade} {getTrendIcon(block.qualityTrend)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Activity:</span>
                  <span className="font-medium">{formatLastActive(block.weeksActive)}</span>
                </div>
              </div>

              {/* Quality Grade Badge */}
              {block.qualityGrade !== 'N/A' && !block.qualityGrade.includes('%ile') && (
                <div className="mt-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    block.qualityGrade.startsWith('A') ? 'bg-green-100 text-green-800' :
                    block.qualityGrade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                    block.qualityGrade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Quality: {block.qualityGrade}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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
  const [blockData, setBlockData] = useState<any>(null)
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
      fetchAnalytics()
    }
  }, [userId, currentProgram])

  const fetchAnalytics = async () => {
    if (!userId) return
    
    setAnalyticsLoading(true)
    try {
      // Fetch both dashboard and block analytics
      const [dashboardRes, blockRes] = await Promise.allSettled([
        fetch(`/api/analytics/${userId}/dashboard`),
        fetch(`/api/analytics/${userId}/block-analyzer`)
      ])

      // Process Dashboard Data
      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        const data = await dashboardRes.value.json()
        setDashboardAnalytics(data)
      }

      // Process Block Analytics
      if (blockRes.status === 'fulfilled' && blockRes.value.ok) {
        const data = await blockRes.value.json()
        setBlockData(data)
      }

    } catch (error) {
      console.error('Error fetching dashboard analytics:', error)
      setDashboardAnalytics(null)
      setBlockData(null)
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
        {/* Training Blocks Visualization Section */}
        <div className="mb-8">
          {analyticsLoading ? (
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
          ) : (
            <TrainingBlocksWidget analytics={dashboardAnalytics} blockData={blockData} />
          )}

          {/* View Progress Link */}
          <div className="text-center mt-6">
            <Link
              href="/dashboard/progress"
              className="inline-flex items-center px-6 py-3 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
            >
              <span className="text-2xl mr-3">📊</span>
              <div className="text-left">
                <div className="font-semibold text-gray-900">View Detailed Analytics</div>
                <div className="text-sm text-gray-600">Skills progress, strength analysis & conditioning insights</div>
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
