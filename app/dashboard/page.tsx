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
import ProgramNavigationWidget from './ProgramNavigationWidget'  // ADD THIS LINE HERE

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
// Training Blocks Visualization Component - Streamlined Version
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
        <h3 className="font-semibold text-gray-900 mb-4">🎯 Training Block Overview</h3>
        <p className="text-gray-600">Complete more exercises to see training block analytics!</p>
      </div>
    )
  }

  // Define the desired order for blocks
  const blockOrder = ['Skills', 'Technical', 'Strength', 'Accessories', 'MetCons']
  
  // Sort block summaries according to the desired order
  const sortedBlockSummaries = [...blockSummaries].sort((a, b) => {
    const aIndex = blockOrder.indexOf(a.blockName)
    const bIndex = blockOrder.indexOf(b.blockName)
    return aIndex - bIndex
  })

  // Prepare donut chart data with ordered blocks
  const donutChartData = {
    labels: sortedBlockSummaries.map((block: any) => block.blockName),
    datasets: [{
      data: sortedBlockSummaries.map((block: any) => block.exercisesCompleted),
      backgroundColor: [
        '#3B82F6', // Blue - Skills
        '#10B981', // Green - Technical
        '#EF4444', // Red - Strength
        '#8B5CF6', // Purple - Accessories
        '#F59E0B'  // Orange - MetCons
      ],
      borderColor: [
        '#1D4ED8',
        '#059669',
        '#DC2626', 
        '#7C3AED',
        '#D97706'
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
          },
          generateLabels: function(chart: any) {
            const data = chart.data;
            return data.labels.map((label: string, index: number) => {
              const block = sortedBlockSummaries[index];
              return {
                text: `${label} ${block.percentageOfTotal}%`,
                fillStyle: data.datasets[0].backgroundColor[index],
                strokeStyle: data.datasets[0].borderColor[index],
                lineWidth: 2,
                hidden: false,
                index: index
              };
            });
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const block = sortedBlockSummaries[context.dataIndex];
            const percentage = block?.percentageOfTotal || 0;
            return `${label}: ${value} exercises (${percentage}%)`;
          }
        }
      }
    }
  }

  // Helper function to format performance metric
  const formatPerformanceMetric = (block: any): string => {
    // For MetCons, show percentile
    if (block.blockName === 'MetCons' && block.qualityGrade.includes('%ile')) {
      return block.qualityGrade;
    }
    // For other blocks, show quality grade if available
    if (block.qualityGrade && block.qualityGrade !== 'N/A' && !block.qualityGrade.includes('%ile')) {
      return block.qualityGrade;
    }
    // Fallback
    return 'Active';
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-gray-900 mb-6">🎯 Training Block Overview</h3>
      
      {/* Donut Chart */}
      <div className="mb-8">
        <div className="h-64">
          <Doughnut data={donutChartData} options={donutChartOptions} />
        </div>
      </div>

      {/* Condensed Block Cards */}
      <div className="space-y-3 mb-6">
        {sortedBlockSummaries.map((block: any) => (
          <div key={block.blockName} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="font-medium text-gray-900">{block.blockName}:</span>
              <span className="text-gray-600">
                {block.exercisesCompleted} session{block.exercisesCompleted !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-right">
              <span className="font-medium text-gray-900">
                {formatPerformanceMetric(block)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* View Detailed Analytics Link */}
      <Link
        href="/dashboard/progress"
        className="block w-full text-center py-4 px-6 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors group"
      >
        <div className="flex items-center justify-center space-x-3">
          <span className="text-2xl">📊</span>
          <div className="text-left">
            <div className="font-semibold text-gray-900 group-hover:text-blue-700">
              View Detailed Analytics
            </div>
            <div className="text-sm text-gray-600">
              Skills progress, strength analysis & conditioning insights
            </div>
          </div>
        </div>
      </Link>
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
  // ADD THESE THREE NEW LINES HERE:
  const [isCoach, setIsCoach] = useState(false)
  const [coachData, setCoachData] = useState(null)
  const [viewMode, setViewMode] = useState('athlete') // 'athlete' or 'coach'


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

// ADD THIS NEW useEffect AND FUNCTION HERE:
useEffect(() => {
  checkCoachRole()
}, [])

const checkCoachRole = async () => {
  try {
    const response = await fetch('/api/coach/check-role')
    const data = await response.json()
    
    if (data.success && data.isCoach) {
      setIsCoach(true); console.log("Setting isCoach to true")
      setCoachData(data.coach)
      console.log('User is a coach:', data.coach)
    } else {
      setIsCoach(false)
      setCoachData(null)
    }
  } catch (error) {
    console.error('Error checking coach role:', error)
    setIsCoach(false)
  }
}


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

// ADD THESE COMPONENTS RIGHT HERE (between error check and return):
  
  const CoachToggle = () => {
    if (!isCoach) return null

    return (
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome, Coach {(coachData as any)?.name}! 
            </h3>
            <p className="text-sm text-gray-600">
              Switch between your athlete training and coaching dashboard
            </p>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('athlete')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'athlete'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🏋️ My Training
            </button>
            <button
              onClick={() => setViewMode('coach')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'coach'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              👥 Coach Portal
            </button>
          </div>
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


      {/* Coach Toggle */}
      {isCoach && (
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Welcome, Coach {(coachData as any)?.name}!
              </h3>
              <p className="text-sm text-gray-600">
                Switch between your athlete training and coaching dashboard
              </p>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("athlete")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "athlete"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🏋️ My Training
              </button>
              <button
                onClick={() => setViewMode("coach")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "coach"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                👥 Coach Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === "coach" ? (
          <CoachDashboard coachData={coachData} />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600">Your athlete training dashboard content would go here</p>
          </div>
        )}
      </div>    </div>
  );
}   
const CoachDashboard = ({ coachData }: { coachData: any }) => {
    const [athletes, setAthletes] = useState([])
    const [athletesLoading, setAthletesLoading] = useState(true)
    const [summary, setSummary] = useState(null)
    const [selectedAthlete, setSelectedAthlete] = useState(null)
    const [showInviteModal, setShowInviteModal] = useState(false)

    useEffect(() => {
      if (coachData) {
        fetchAthletes()
      }
    }, [coachData])

    const fetchAthletes = async () => {
      setAthletesLoading(true)
      try {
        const response = await fetch('/api/coach/athletes')
        const data = await response.json()
        
        if (data.success) {
          setAthletes(data.athletes || [])
          setSummary(data.summary)
        } else {
          console.error('Failed to fetch athletes:', data.error)
          setAthletes([])
        }
      } catch (error) {
        console.error('Error fetching athletes:', error)
        setAthletes([])
      } finally {
        setAthletesLoading(false)
      }
    }

    const getHealthStatusColor = (status: string) => {
      switch (status) {
        case 'good': return 'bg-green-100 text-green-800 border-green-200'
        case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        case 'needs_attention': return 'bg-red-100 text-red-800 border-red-200'
        default: return 'bg-gray-100 text-gray-800 border-gray-200'
      }
    }

    const getHealthStatusIcon = (status: string) => {
      switch (status) {
        case 'good': return '✅'
        case 'warning': return '⚠️'
        case 'needs_attention': return '🚨'
        default: return '❓'
      }
    }

    const AthleteCard = ({ athlete }: { athlete: any }) => (
      <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{(athlete as any).name}</h3>
            <p className="text-sm text-gray-500 capitalize">{(athlete as any).abilityLevel}</p>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getHealthStatusColor((athlete as any).recentActivity.healthStatus)}`}>
            {getHealthStatusIcon((athlete as any).recentActivity.healthStatus)} {(athlete as any).recentActivity.healthStatus.replace('_', ' ')}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-xl font-bold text-gray-900">{(athlete as any).recentActivity.sessionsLast14Days}</div>
            <div className="text-xs text-gray-600">Sessions (14d)</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-xl font-bold text-gray-900">
              {(athlete as any).recentActivity.daysSinceLastSession === null ? '—' : `${(athlete as any).recentActivity.daysSinceLastSession}d`}
            </div>
            <div className="text-xs text-gray-600">Since Last</div>
          </div>
        </div>

        {/* Permission Level */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">Access Level:</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            (athlete as any).coachingDetails.permissionLevel === 'full' ? 'bg-purple-100 text-purple-800' :
            (athlete as any).coachingDetails.permissionLevel === 'edit' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {(athlete as any).coachingDetails.permissionLevel}
          </span>
        </div>

        {/* Current Program */}
        {(athlete as any).currentProgram && (
          <div className="text-xs text-gray-500 mb-3">
            Program #{(athlete as any).currentProgram.id} • Generated {new Date((athlete as any).currentProgram.generatedAt).toLocaleDateString()}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => setSelectedAthlete(athlete)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          View Details →
        </button>
      </div>
    )

    const InviteAthleteModal = () => {
      const [email, setEmail] = useState('')
      const [message, setMessage] = useState('')
      const [permission, setPermission] = useState('view')
      const [inviting, setInviting] = useState(false)

      const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setInviting(true)
        try {
          const response = await fetch('/api/coach/assign-athlete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              athleteEmail: email,
              permissionLevel: permission,
              message: message
            })
          })

          const data = await response.json()
          if (data.success) {
            alert('Invitation sent successfully!')
            setShowInviteModal(false)
            setEmail('')
            setMessage('')
            fetchAthletes() // Refresh the list
          } else {
            alert(`Failed to send invitation: ${data.error}`)
          }
        } catch (error) {
          console.error('Error sending invitation:', error)
          alert('Error sending invitation')
        } finally {
          setInviting(false)
        }
      }

      if (!showInviteModal) return null

      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Athlete</h3>
            
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Athlete Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@example.com"
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permission Level
                </label>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="view">View Only</option>
                  <option value="edit">Edit Access</option>
                  <option value="full">Full Access</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Message (Optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi! I'd like to be your coach..."
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Coach Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Coach Dashboard</h2>
              <p className="text-gray-600">Manage your athletes and track their progress</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{athletes.length}</div>
              <div className="text-sm text-gray-600">Total Athletes</div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Athletes</p>
                  <p className="text-2xl font-bold text-green-600">{(summary as any).recentlyActiveathletes}</p>
                </div>
                <div className="text-green-600">✅</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Need Attention</p>
                  <p className="text-2xl font-bold text-red-600">{(summary as any).athletesNeedingAttention}</p>
                </div>
                <div className="text-red-600">🚨</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Warnings</p>
                  <p className="text-2xl font-bold text-yellow-600">{(summary as any).athletesWithWarnings}</p>
                </div>
                <div className="text-yellow-600">⚠️</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Sessions</p>
                  <p className="text-2xl font-bold text-blue-600">{(summary as any).averageSessionsPerAthlete}</p>
                </div>
                <div className="text-blue-600">📊</div>
              </div>
            </div>
          </div>
        )}

        {/* Athletes Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Your Athletes</h3>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              + Invite Athlete
            </button>
          </div>

          {athletesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-48"></div>
              ))}
            </div>
          ) : athletes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">👥</div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Athletes Yet</h4>
              <p className="text-gray-600 mb-4">Start building your coaching roster by inviting athletes!</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Send Your First Invitation
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athletes.map((athlete) => (
                <AthleteCard key={(athlete as any).relationshipId} athlete={athlete} />
              ))}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        <InviteAthleteModal />

        {/* Athlete Detail Modal - TODO: Implement this */}
        {selectedAthlete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {(selectedAthlete as any).name} - Detailed View
                </h3>
                <button
                  onClick={() => setSelectedAthlete(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">Detailed athlete analytics would go here...</p>
                <p className="text-sm text-gray-500">
                  This would show the full analytics dashboard for this athlete,
                  using the /api/coach/athlete/{(selectedAthlete as any).id} endpoint.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }



