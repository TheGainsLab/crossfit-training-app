'use client'

import { useState, useEffect } from 'react'
import AthleteDetailModal from './AthleteDetailModal'
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
        const response = await fetch('/api/coach/athlete')
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




{/* Complete Athlete Detail Modal */}
{selectedAthlete && (
  <AthleteDetailModal 
    athlete={selectedAthlete} 
    onClose={() => setSelectedAthlete(null)} 
  />
)}

      </div>
    )
  }


// Dashboard Summary Cards Component - ADD THIS AFTER CoachDashboard
const DashboardSummaryCards: React.FC<{ userId: number | null; currentProgram: number | null }> = ({ userId, currentProgram }) => {
  const [summaryData, setSummaryData] = useState({
    fitnessScore: null,
    metconsCompleted: 0,
    weeklyProgress: {
      currentWeek: 1,
      completedDays: [],
      totalDays: 5,
      lastWorkout: null,
      exercisesLogged: 0,
      totalExercises: 0
    }
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (userId && currentProgram) {
      fetchSummaryData()
    }
  }, [userId, currentProgram])

  const fetchSummaryData = async () => {
    if (!userId || !currentProgram) return
    
    setLoading(true)
    try {
      // Fetch all data in parallel
      const [fitnessRes, metconsRes, weeklyRes] = await Promise.allSettled([
        fetch(`/api/analytics/${userId}/exercise-heatmap`),
        fetch(`/api/dashboard/metcons-count?userId=${userId}`),
        fetch(`/api/dashboard/weekly-progress?userId=${userId}&programId=${currentProgram}`)
      ])

      // Process Fitness Score
      if (fitnessRes.status === 'fulfilled' && fitnessRes.value.ok) {
        const data = await fitnessRes.value.json()
        if (data.success && data.data?.globalFitnessScore) {
          setSummaryData(prev => ({
            ...prev,
            fitnessScore: data.data.globalFitnessScore
          }))
        }
      }

      // Process MetCons Count
      if (metconsRes.status === 'fulfilled' && metconsRes.value.ok) {
        const data = await metconsRes.value.json()
        if (data.success) {
          setSummaryData(prev => ({
            ...prev,
            metconsCompleted: data.count || 0
          }))
        }
      }

      // Process Weekly Progress
      if (weeklyRes.status === 'fulfilled' && weeklyRes.value.ok) {
        const data = await weeklyRes.value.json()
        if (data.success) {
          setSummaryData(prev => ({
            ...prev,
            weeklyProgress: data.weeklyProgress
          }))
        }
      }

    } catch (error) {
      console.error('Error fetching summary data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatLastWorkout = (lastWorkout: string | null) => {
    if (!lastWorkout) return 'No recent activity'
    
    const date = new Date(lastWorkout)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Yesterday'
    if (diffDays === 2) return '2 days ago'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const generateWeekPattern = () => {
    const { completedDays, totalDays } = summaryData.weeklyProgress
    const pattern = []
    
    for (let i = 1; i <= totalDays; i++) {
      if (completedDays.includes(i)) {
        pattern.push('●') // Completed
      } else {
        pattern.push('○') // Not completed
      }
    }
    
    return pattern.join('')
  }

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 mb-8">
      {/* Fitness Score Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Fitness Score</p>
            <p className="text-3xl font-bold text-blue-600">
              {summaryData.fitnessScore ? `${summaryData.fitnessScore}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summaryData.fitnessScore ? 'Conditioning Level' : 'Complete MetCons to see score'}
            </p>
          </div>
          <div className="text-blue-600 text-2xl">🎯</div>
        </div>
      </div>

      {/* MetCons Completed Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">MetCons Done</p>
            <p className="text-3xl font-bold text-orange-600">
              {summaryData.metconsCompleted}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summaryData.metconsCompleted === 1 ? 'workout' : 'workouts'} completed
            </p>
          </div>
          <div className="text-orange-600 text-2xl">🔥</div>
        </div>
      </div>

      {/* This Week Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-600">This Week</p>
            <p className="text-lg font-bold text-green-600">
              {generateWeekPattern()} ({summaryData.weeklyProgress.completedDays.length}/{summaryData.weeklyProgress.totalDays})
            </p>
          </div>
          <div className="text-green-600 text-xl">📅</div>
        </div>
        
        <div className="text-xs text-gray-500 space-y-1">
          <div>
            Last: {formatLastWorkout(summaryData.weeklyProgress.lastWorkout)}
          </div>
          {summaryData.weeklyProgress.exercisesLogged > 0 && (
            <div>
              {summaryData.weeklyProgress.exercisesLogged}/{summaryData.weeklyProgress.totalExercises} exercises
            </div>
          )}
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
  // ADD THESE THREE NEW LINES HERE:
  const [isCoach, setIsCoach] = useState(false)
  const [coachData, setCoachData] = useState(null)
  const [viewMode, setViewMode] = useState('athlete') // 'athlete' or 'coach'
  const [pendingInvitations, setPendingInvitations] = useState([])
  const [invitationsLoading, setInvitationsLoading] = useState(false)

  useEffect(() => {
    loadUserAndProgram()
    fetchPendingInvitations()
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

  const handleInvitationResponse = async (relationshipId: number, action: "accept" | "decline") => {
    try {
      const response = await fetch(`/api/coach/accept-coach/${relationshipId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setPendingInvitations(prev => prev.filter((inv: any) => inv.id !== relationshipId))
        
        if (action === "accept") {
          alert("Coach invitation accepted! Your new coach can now track your progress.")
        } else {
          alert("Coach invitation declined.")
        }
      } else {
        alert(`Failed to ${action} invitation: ${data.error}`)
      }
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error)
      alert(`Error ${action}ing invitation. Please try again.`)
    }
  }

  const fetchPendingInvitations = async () => {
    try {
      setInvitationsLoading(true)
      const response = await fetch("/api/invitations")
      const data = await response.json()
      
      if (data.success) {
        setPendingInvitations(data.invitations || [])
      } else {
        console.error("Failed to fetch invitations:", data.error)
      }
    } catch (error) {
      console.error("Error fetching invitations:", error)
    } finally {
      setInvitationsLoading(false)
    }
  }

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

      {/* Coach Toggle */}

      {/* Pending Coach Invitations */}
      {!isCoach && pendingInvitations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-4xl mx-auto">
          <div className="flex items-start space-x-3">
            <div className="text-blue-600 text-xl">👋</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                You have {pendingInvitations.length} pending coach invitation{pendingInvitations.length > 1 ? "s" : ""}!
              </h3>
              <div className="space-y-3">
                {pendingInvitations.map((invitation: any) => (
                  <div key={invitation.id} className="bg-white rounded-lg p-4 border border-blue-100">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          Coach {invitation.coaches[0]?.coach_name} wants to be your coach
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Permission Level: {invitation.permission_level}
                        </p>
                        {invitation.invitation_message && (
                          <p className="text-sm text-gray-700 mt-2 italic">
                            "{invitation.invitation_message}"
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Invited {new Date(invitation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleInvitationResponse(invitation.id, "accept")}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleInvitationResponse(invitation.id, "decline")}
                          className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
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
          <div className="space-y-6">       
             {/* Program Navigation */}
        {currentProgram && (
          <ProgramNavigationWidget 
            currentWeek={currentWeek}
            currentDay={currentDay}
            programId={currentProgram}
            onNavigate={(week, day) => {
              setCurrentWeek(week)
              setCurrentDay(day)
            }}
          />
        )}


{/* Summary Cards */}
{currentProgram && (
  <DashboardSummaryCards userId={userId} currentProgram={currentProgram} />
)}





        {/* Training Blocks Visualization */}
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
        </div>

        {/* Settings Link */}
        <div className="flex justify-center">
          <Link
            href="/dashboard/settings"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-3xl mb-2">⚙️</div>
            <h3 className="font-semibold text-gray-900 mb-1">Settings</h3>
            <p className="text-gray-600 text-sm">Update 1RMs and preferences</p>
          </Link>
        </div>
          </div>
        )}
      </div>
    </div>
  );   
}
