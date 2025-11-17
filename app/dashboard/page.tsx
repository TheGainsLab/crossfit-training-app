'use client'

// Add this import at the top
import TrainingChatInterface from '@/components/TrainingChatInterface'
import { useState, useEffect, useRef } from 'react'
import AthleteDetailModal from './AthleteDetailModal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const donutRef = useRef<any>(null)
  if (!blockData?.data?.blockAnalysis?.blockSummaries) {
    return (
      <div className="bg-ice-blue rounded-lg border border-charcoal p-6">
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
      <div className="bg-ice-blue rounded-lg border border-charcoal p-6">
        <h3 className="font-semibold text-gray-900 mb-4 text-center">🎯 Training Block Overview</h3>
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
            const label = context.label || ''
            const value = context.parsed
            const block = sortedBlockSummaries[context.dataIndex]
            const percentage = block?.percentageOfTotal || 0
            const perf = formatPerformanceMetric(block)
            return `${label}: ${value} exercises (${percentage}%) • ${perf}`
          }
        }
      }
    }
  }

  const navigateForBlock = (blockName: string) => {
    const name = (blockName || '').toLowerCase()
    let route = '/dashboard/analytics'
    
    if (name.includes('skill')) route = '/dashboard/analytics/skills'
    else if (name.includes('strength')) route = '/dashboard/analytics/strength'
    else if (name.includes('metcon')) route = '/dashboard/analytics/metcons'
    else if (name.includes('technical')) route = '/dashboard/analytics/technical'
    else if (name.includes('accessories')) route = '/dashboard/analytics/accessories'
    
    router.push(route)
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
    <div className="bg-ice-blue rounded-lg border border-charcoal p-6">
<h3 className="font-semibold text-gray-900 mb-6 text-center">Training Block Overview</h3>      
      {/* Donut Chart */}
      <div className="mb-6">
        <div className="h-44">
          <Doughnut 
            data={donutChartData} 
            options={donutChartOptions} 
            ref={donutRef}
            onClick={(event: any) => {
              const chart = donutRef.current
              if (!chart) return
              const elements = chart.getElementsAtEventForMode(
                event.nativeEvent,
                'nearest',
                { intersect: true },
                true
              )
              if (!elements || elements.length === 0) return
              const idx = elements[0].index
              const block = sortedBlockSummaries[idx]
              if (block?.blockName) navigateForBlock(block.blockName)
            }}
          />
        </div>
      </div>

      {/* Quick links to detailed analytics */}
      <div className="flex flex-wrap gap-2 mb-2">
        {sortedBlockSummaries.map((block: any) => {
          let href = '/dashboard/analytics'
          const name = (block.blockName || '').toLowerCase()
          if (name.includes('skill')) href = '/dashboard/analytics/skills'
          else if (name.includes('strength')) href = '/dashboard/analytics/strength'
          else if (name.includes('metcon')) href = '/dashboard/analytics/metcons'
          else if (name.includes('technical')) href = '/dashboard/analytics/technical'
          else if (name.includes('accessories')) href = '/dashboard/analytics/accessories'
          return (
            <Link
              key={block.blockName}
              href={href}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:border-[#FE5858]"
              style={{ 
                backgroundColor: '#DAE2EA', 
                borderColor: '#282B34', 
                color: '#282B34' 
              }}
              title={`Go to ${block.blockName} analytics`}
            >
              {block.blockName}: {block.exercisesCompleted} ({block.percentageOfTotal}%)
            </Link>
          )
        })}
        {/* AI Insights pill - Hidden for MVP, keep for future */}
        {/* <Link
          href="/dashboard/progress?tab=insights#insights-panel"
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border hover:opacity-90"
          style={{ backgroundColor: '#509895', color: '#ffffff', borderColor: 'transparent' }}
          title="Open AI Insights"
        >
          AI Insights
        </Link> */}
      </div>

      
    </div>
  )
}



// Enhanced Coach Dashboard Component with A9 Integration

const CoachAlerts = ({ coachData }: { coachData: any }) => {
  
const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
const [rosterInsights, setRosterInsights] = useState<any>(null);  

  useEffect(() => {
    if (coachData) {
      fetchCoachAlerts();
    }
  }, [coachData]);

  const fetchCoachAlerts = async () => {
    setAlertsLoading(true);
    try {
      const response = await fetch('/api/coach/alerts');
      const data = await response.json();
      
      if (data.success) {
        setAlerts(data.alerts || []);
        setRosterInsights(data.rosterInsights);
      } else {
        console.error('Failed to fetch coach alerts:', data.error);
        setAlerts([]);
      }
    } catch (error) {
      console.error('Error fetching coach alerts:', error);
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'immediate': return '🚨';
      case 'this_week': return '⚠️';
      case 'next_week': return '📅';
      default: return '💡';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'safety': return '⛑️';
      case 'behavioral': return '🧠';
      case 'communication': return '💬';
      case 'data_anomaly': return '📊';
      case 'engagement': return '🎯';
      default: return '❓';
    }
  };

  if (alertsLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Coach Alerts</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Roster Health Overview */}
      {rosterInsights && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Roster Health</h3>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              rosterInsights.rosterHealth === 'good' ? 'bg-green-100 text-green-800' :
              rosterInsights.rosterHealth === 'needs_attention' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {rosterInsights.rosterHealth.replace('_', ' ')}
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{rosterInsights.totalAthletes}</div>
              <div className="text-sm text-gray-600">Total Athletes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{rosterInsights.athletesNeedingAttention}</div>
              <div className="text-sm text-gray-600">Need Attention</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {rosterInsights.totalAthletes - rosterInsights.athletesNeedingAttention}
              </div>
              <div className="text-sm text-gray-600">On Track</div>
            </div>
          </div>

          {rosterInsights.commonIssues.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Roster-Wide Patterns</h4>
              <div className="space-y-2">
                {rosterInsights.commonIssues.map((issue: any, index: number) => (
                  <div key={index} className="border-l-4 border-purple-400 bg-purple-50 p-3 rounded-r">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-purple-800">
                          {issue.issue.replace('_', ' ')} - {issue.athleteCount} athletes
                        </div>
                        <div className="text-sm text-purple-600">{issue.recommendation}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Priority Alerts */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Athlete Alerts</h3>
          <button
            onClick={fetchCoachAlerts}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Refresh
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✅</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">All Clear!</h4>
            <p className="text-gray-600">No athletes currently need human coaching intervention beyond automated program adjustments.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert: any) => (
              <div key={alert.athleteId} className={`border-l-4 p-4 rounded-r-lg ${getPriorityColor(alert.priority)}`}>
                {/* Alert Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{getUrgencyIcon(alert.urgencyLevel)}</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">{alert.athleteName}</h4>
                      <div className="text-sm text-gray-600">
                        {alert.priority} priority • {alert.urgencyLevel.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    {alert.interventionTriggers.map((trigger: any, i: number) => (
                      <span key={i} className="text-lg" title={trigger.category}>
                        {getCategoryIcon(trigger.category)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* AI Context */}
                {alert.aiContext && (
                  <div className="mb-4">
                    <div className="text-gray-700 mb-2">{alert.aiContext.situationSummary}</div>
                    <div className="text-sm text-gray-600 italic mb-2">
                      Why coaching needed: {alert.aiContext.aiLimitations}
                    </div>
                  </div>
                )}

                {/* Data Snapshot */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sessions:</span>
                    <span className="ml-2 font-medium">{alert.dataSnapshot.totalSessions}/14 days</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg RPE:</span>
                    <span className="ml-2 font-medium">{alert.dataSnapshot.avgRPE}/10</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Consistency:</span>
                    <span className="ml-2 font-medium">{Math.round(alert.dataSnapshot.sessionConsistency * 100)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Contact:</span>
                    <span className="ml-2 font-medium">
                      {alert.dataSnapshot.daysSinceContact > 30 ? '30+' : alert.dataSnapshot.daysSinceContact} days
                    </span>
                  </div>
                </div>

                {/* Conversation Starters */}
                {alert.aiContext?.conversationStarters && (
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-800 mb-2">Conversation Starters:</h5>
                    <ul className="space-y-1">
                      {alert.aiContext.conversationStarters.map((starter: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          <span className="italic">"{starter}"</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested Actions */}
                <div className="flex flex-wrap gap-2">
                  {alert.suggestedActions.map((action: string, i: number) => (
                    <span key={i} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {action}
                    </span>
                  ))}
                </div>

                {/* Intervention Triggers Details (Expandable) */}
                <details className="mt-4">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                    View technical details ({alert.interventionTriggers.length} triggers)
                  </summary>
                  <div className="mt-2 space-y-2">
                    {alert.interventionTriggers.map((trigger: any, i: number) => (
                      <div key={i} className="text-xs bg-gray-100 p-2 rounded">
                        <div className="font-medium">{trigger.type.replace('_', ' ')}</div>
                        <div className="text-gray-600">{trigger.reason}</div>
                        {trigger.metrics && (
                          <div className="text-gray-500 mt-1">
                            {Object.entries(trigger.metrics).map(([key, value]: [string, any]) => (
                              <span key={key} className="mr-3">
                                {key}: {typeof value === 'number' ? value.toFixed(1) : value.toString()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};



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
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedAthlete(athlete)}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            View Details →
          </button>
          <button
            onClick={() => {
              window.location.href = `/dashboard?viewAs=athlete&athleteId=${(athlete as any).athlete.id}`
            }}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            View Dashboard
          </button>
        </div>
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

<CoachAlerts coachData={coachData} />

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

// Admin Dashboard Component
const AdminDashboard = () => {
  const [athletes, setAthletes] = useState<any[]>([])
  const [athletesLoading, setAthletesLoading] = useState(true)
  const [systemStats, setSystemStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedAthlete, setSelectedAthlete] = useState<any>(null)
  const [hasProgramFilter, setHasProgramFilter] = useState<string>('all') // 'all', 'with', 'without'
  const [activity, setActivity] = useState<any[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    fetchSystemStats()
    fetchAthletes()
    fetchDailyActivity()
  }, [])

  useEffect(() => {
    fetchAthletes()
  }, [currentPage, searchTerm, hasProgramFilter])

  const fetchSystemStats = async () => {
    setStatsLoading(true)
    try {
      const response = await fetch('/api/admin/system-stats')
      const data = await response.json()
      
      if (data.success) {
        setSystemStats(data.stats)
      } else {
        console.error('Failed to fetch system stats:', data.error)
      }
    } catch (error) {
      console.error('Error fetching system stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchAthletes = async () => {
    setAthletesLoading(true)
    try {
      let url = `/api/admin/athletes?page=${currentPage}&limit=50`
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`
      }
      if (hasProgramFilter === 'with') {
        url += `&hasProgram=true`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        let filteredAthletes = data.athletes || []
        
        // Client-side filter for 'without programs'
        if (hasProgramFilter === 'without') {
          filteredAthletes = filteredAthletes.filter((a: any) => !a.hasProgram)
        }
        
        setAthletes(filteredAthletes)
        setTotalPages(data.pagination?.totalPages || 1)
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

  const fetchDailyActivity = async () => {
    setActivityLoading(true)
    try {
      const res = await fetch('/api/admin/daily-active-users')
      const data = await res.json()
      if (data.success) {
        setActivity(data.rows || [])
      } else {
        console.error('Failed to fetch daily activity:', data.error)
        setActivity([])
      }
    } catch (e) {
      console.error('Error fetching daily activity:', e)
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }

  const AthleteCard = ({ athlete }: { athlete: any }) => (
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">{athlete.name}</h3>
          <p className="text-sm text-gray-500">{athlete.email}</p>
          <p className="text-xs text-gray-400 capitalize mt-1">{athlete.abilityLevel}</p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          athlete.hasProgram 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-gray-100 text-gray-800 border border-gray-200'
        }`}>
          {athlete.hasProgram ? '✓ Program' : 'No Program'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-600">Tier</div>
          <div className="font-semibold text-gray-900">{athlete.subscriptionTier}</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-600">Status</div>
          <div className="font-semibold text-gray-900">{athlete.subscriptionStatus}</div>
        </div>
      </div>

      {athlete.hasProgram && (
        <div className="text-xs text-gray-500 mb-3">
          {athlete.programCount} program{athlete.programCount !== 1 ? 's' : ''} • Latest: {athlete.latestProgramDate ? new Date(athlete.latestProgramDate).toLocaleDateString() : 'N/A'}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            window.location.href = `/dashboard?viewAs=athlete&athleteId=${athlete.id}`
          }}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          View Dashboard
        </button>
        <button
          onClick={() => setSelectedAthlete(athlete)}
          className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Details
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
            <p className="text-gray-600">System overview and athlete management</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-600">🔐</div>
            <div className="text-sm text-gray-600">Admin Access</div>
          </div>
        </div>
      </div>

      {/* System Stats */}
      {statsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-24"></div>
          ))}
        </div>
      ) : systemStats && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{systemStats.users?.total || 0}</p>
              </div>
              <div className="text-2xl">👥</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {systemStats.users?.athletes || 0} athletes • {systemStats.users?.coaches || 0} coaches
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recent Activity</p>
                <p className="text-2xl font-bold text-green-600">{systemStats.activity?.recentLogs || 0}</p>
              </div>
              <div className="text-2xl">📊</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {systemStats.activity?.activeUsers || 0} active users (24h)
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Subscriptions</p>
                <p className="text-2xl font-bold text-purple-600">{systemStats.subscriptions?.total || 0}</p>
              </div>
              <div className="text-2xl">💳</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {systemStats.subscriptions?.premium || 0} premium • {systemStats.subscriptions?.free || 0} free
              {systemStats.subscriptions?.btn ? ` • ${systemStats.subscriptions.btn} BTN` : ''}
              {systemStats.subscriptions?.appliedPower ? ` • ${systemStats.subscriptions.appliedPower} AP` : ''}
              {systemStats.subscriptions?.null ? ` • ${systemStats.subscriptions.null} null` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Daily Activity Inbox */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Last 24 Hours Activity</h3>
          <span className="text-xs text-gray-500">
            {activity.length} active {activity.length === 1 ? 'athlete' : 'athletes'}
          </span>
        </div>

        {activityLoading ? (
          <div className="text-sm text-gray-500">Loading activity…</div>
        ) : activity.length === 0 ? (
          <div className="text-sm text-gray-500">No recent activity.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="py-2 pr-4 text-left">Athlete</th>
                  <th className="py-2 px-4 text-left">Program Type</th>
                  <th className="py-2 px-4 text-left">Month</th>
                  <th className="py-2 px-4 text-right">Sessions</th>
                  <th className="py-2 px-4 text-right">Tasks</th>
                  <th className="py-2 px-4 text-right">MetCons</th>
                  <th className="py-2 pl-4 text-right">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-gray-900">{row.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{row.email}</div>
                    </td>
                    <td className="py-2 px-4">{row.subscriptionTier || '—'}</td>
                    <td className="py-2 px-4">{row.programMonth ?? '—'}</td>
                    <td className="py-2 px-4 text-right">{row.sessions}</td>
                    <td className="py-2 px-4 text-right">{row.tasks}</td>
                    <td className="py-2 px-4 text-right">{row.metcons}</td>
                    <td className="py-2 pl-4 text-right text-xs text-gray-500">
                      {row.lastActivityAt
                        ? new Date(row.lastActivityAt).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Athletes Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">All Athletes</h3>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1) // Reset to first page on search
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* Filter */}
            <select
              value={hasProgramFilter}
              onChange={(e) => {
                setHasProgramFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Athletes</option>
              <option value="with">With Programs</option>
              <option value="without">Without Programs</option>
            </select>
          </div>
        </div>

        {athletesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-48"></div>
            ))}
          </div>
        ) : athletes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">👥</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Athletes Found</h4>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {athletes.map((athlete) => (
                <AthleteCard key={athlete.id} athlete={athlete} />
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Athlete Detail Modal */}
      {selectedAthlete && (
        <AthleteDetailModal 
          athlete={selectedAthlete} 
          onClose={() => setSelectedAthlete(null)} 
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [todaysWorkout, setTodaysWorkout] = useState<WorkoutSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentProgram, setCurrentProgram] = useState<number | null>(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [currentDay, setCurrentDay] = useState(1)
  const [programSpecificWeek, setProgramSpecificWeek] = useState(1) // Program-specific week (1-4) for API calls
  const [user, setUser] = useState<User | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [dashboardAnalytics, setDashboardAnalytics] = useState<DashboardAnalytics | null>(null)
const [blockData, setBlockData] = useState<any>(null)
const [heatMapData, setHeatMapData] = useState<any>(null)  
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  // ADD THESE THREE NEW LINES HERE:
  const [isCoach, setIsCoach] = useState(false)
  const [coachData, setCoachData] = useState(null)
  const [viewMode, setViewMode] = useState('athlete') // 'athlete', 'coach', or 'admin'
  const [pendingInvitations, setPendingInvitations] = useState([])
  // Admin/Coach viewing athlete state
  const [viewingAsAthlete, setViewingAsAthlete] = useState<number | null>(null)
  const [viewingAthleteName, setViewingAthleteName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [invitationsLoading, setInvitationsLoading] = useState(false)
  const [isRefreshingAI, setIsRefreshingAI] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<any>(null)
  const [allPrograms, setAllPrograms] = useState<Array<{ id: number; weeks_generated: number[] }>>([])
  const [estimatedTDEE, setEstimatedTDEE] = useState<number | null>(null)
  const [tdeeLoading, setTdeeLoading] = useState(false)

  useEffect(() => {
    // Check for viewAs parameter in URL
    const initializeView = async () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const viewAs = params.get('viewAs')
        const athleteId = params.get('athleteId')
        
        if (viewAs === 'athlete' && athleteId) {
          const athleteIdNum = parseInt(athleteId)
          if (!isNaN(athleteIdNum)) {
            await checkViewPermissions(athleteIdNum)
          } else {
            await loadUserAndProgram()
          }
        } else {
          await loadUserAndProgram()
        }
      } else {
        await loadUserAndProgram()
      }
      
      fetchPendingInvitations()
    }
    
    initializeView()
  }, [])
  
  // Reload when viewingAsAthlete is cleared (user clicks "Exit View")
  useEffect(() => {
    // Only reload when viewingAsAthlete is cleared (goes from a value to null)
    // When it's set, loadUserAndProgram is called directly in checkViewPermissions
    if (viewingAsAthlete === null && userId !== null) {
      loadUserAndProgram()
    }
  }, [viewingAsAthlete])

  useEffect(() => {
    if (currentProgram && currentWeek && currentDay) {
      fetchTodaysWorkout()
      calculateEstimatedTDEE()
    }
  }, [currentProgram, currentWeek, currentDay, userId])

  // Defer analytics loading to improve initial page load performance
  // Load analytics after critical UI (workout) has rendered
  useEffect(() => {
    if (userId && currentProgram) {
      // Use setTimeout to defer analytics loading until after initial render
      // This allows the critical path (workout) to load first
      const analyticsTimer = setTimeout(() => {
        fetchAnalytics()
      }, 100) // Small delay to let critical UI render first
      
      return () => clearTimeout(analyticsTimer)
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
    
    // Check if user is admin
    if (data.success && data.user) {
      const supabase = createClient()
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()
      
      if (userData?.role === 'admin') {
        setIsAdmin(true)
      }
    }
  } catch (error) {
    console.error('Error checking coach role:', error)
    setIsCoach(false)
  }
}

const checkViewPermissions = async (athleteId: number): Promise<void> => {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/dashboard')
      return
    }
    
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single()
    
    if (!currentUser) {
      router.push('/dashboard')
      return
    }
    
    // Check permissions using canAccessAthleteData (handles admin and coach)
    const { canAccessAthleteData } = await import('@/lib/permissions')
    const permissionCheck = await canAccessAthleteData(supabase, currentUser.id, athleteId)
    
    if (permissionCheck.hasAccess) {
      // Get athlete name
      const { data: athleteData } = await supabase
        .from('users')
        .select('name')
        .eq('id', athleteId)
        .single()
      
      if (athleteData) {
        setViewingAsAthlete(athleteId)
        setViewingAthleteName(athleteData.name)
        if (permissionCheck.isAdmin) {
          setIsAdmin(true)
        }
        if (permissionCheck.isCoach) {
          setIsCoach(true)
        }
        // Load user and program data for the athlete we're viewing
        loadUserAndProgram()
      }
    } else {
      // No permission - redirect or show error
      console.warn('No permission to view athlete:', athleteId)
      router.push('/dashboard')
    }
  } catch (error) {
    console.error('Error checking view permissions:', error)
    router.push('/dashboard')
  }
}


  // Helper functions for global week conversion
  // Global Week = 4(m-1) + w, where m = program index, w = week within program (1-4)
  const globalWeekToProgramAndWeek = (globalWeek: number): { programIndex: number; week: number } => {
    const programIndex = Math.ceil(globalWeek / 4)
    const week = ((globalWeek - 1) % 4) + 1
    return { programIndex, week }
  }

  const programAndWeekToGlobalWeek = (programIndex: number, week: number): number => {
    return 4 * (programIndex - 1) + week
  }

  // Find the program and week for a global week number
  const findProgramAndWeekForGlobalWeek = async (globalWeek: number): Promise<{ programId: number; week: number } | null> => {
    const { programIndex, week } = globalWeekToProgramAndWeek(globalWeek)

    // If we have programs cached, use them
    if (allPrograms.length > 0) {
      const program = allPrograms[programIndex - 1] // programIndex is 1-based, array is 0-based
      if (program) {
        // Verify the week exists in this program's weeks_generated
        if (Array.isArray(program.weeks_generated) && program.weeks_generated.includes(week)) {
          return { programId: program.id, week }
        }
      }
    }

    // If not cached, query the database
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) return null

      // Fetch all programs for this user
      const { data: programs } = await supabase
        .from('programs')
        .select('id, weeks_generated')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: true })

      if (!programs || programs.length === 0) return null

      // Cache all programs
      setAllPrograms(programs)

      // Get the program at the calculated index (programIndex is 1-based)
      const program = programs[programIndex - 1]
      if (!program) return null

      // Verify the week exists in this program's weeks_generated
      if (Array.isArray(program.weeks_generated) && program.weeks_generated.includes(week)) {
        return { programId: program.id, week }
      }

      return null
    } catch (err) {
      console.error('Error finding program for global week:', err)
      return null
    }
  }

  // Legacy function for backward compatibility - now uses global weeks
  const findProgramForWeek = async (globalWeek: number): Promise<number | null> => {
    const result = await findProgramAndWeekForGlobalWeek(globalWeek)
    return result?.programId || null
  }

  const fetchAnalytics = async () => {
    if (!userId) return
    
    setAnalyticsLoading(true)
    try {
      
// Fetch dashboard, block analytics, and heat map data
const [dashboardRes, blockRes, heatMapRes] = await Promise.allSettled([
  fetch(`/api/analytics/${userId}/dashboard`),
  fetch(`/api/analytics/${userId}/block-analyzer`),
  fetch(`/api/analytics/${userId}/exercise-heatmap`)
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

// Process Heat Map Data
if (heatMapRes.status === 'fulfilled' && heatMapRes.value.ok) {
  const data = await heatMapRes.value.json()
  setHeatMapData(data.data)
}

} catch (error) {
  console.error('Error fetching dashboard analytics:', error)
  setDashboardAnalytics(null)
  setBlockData(null)
  setHeatMapData(null)
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

      // Determine effective user ID (viewing as athlete or own)
      let effectiveUserId: number | null = null
      
      if (viewingAsAthlete) {
        // Admin/Coach viewing as athlete - use athlete's ID
        effectiveUserId = viewingAsAthlete
      } else {
        // Normal user - get their own ID
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, subscription_tier')
          .eq('auth_id', user.id)
          .single()

        if (userError || !userData) {
          setError('User not found')
          setLoading(false)
          return
        }
        effectiveUserId = userData.id
        
        // Only check subscription tier for own account
        // BTN users should use the workout generator, not the program dashboard
        if (userData.subscription_tier === 'BTN') {
          console.log('🎯 BTN user detected - redirecting to generator')
          router.push('/btn')
          return
        }
      }
      
      setUserId(effectiveUserId)

      // Get latest program for effective user
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, generated_at')
        .eq('user_id', effectiveUserId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (programError || !programData) {
        setError('No program found. Please complete the intake assessment.')
        setLoading(false)
        return
      }

      // Fetch all programs for effective user to enable seamless navigation
      const { data: allProgramsData } = await supabase
        .from('programs')
        .select('id, weeks_generated')
        .eq('user_id', effectiveUserId)
        .order('generated_at', { ascending: true })

      if (allProgramsData) {
        setAllPrograms(allProgramsData)
      }

      setCurrentProgram(programData.id)

      // Determine next incomplete day based on available data
      // Need to check all programs and convert to global weeks
      try {
        // Get all programs to find the first incomplete workout across all programs
        const { data: allProgramsForInit } = await supabase
          .from('programs')
          .select('id')
          .eq('user_id', effectiveUserId)
          .order('generated_at', { ascending: true })

        const { data: logs } = await supabase
          .from('performance_logs')
          .select('program_id, week, day')
          .eq('user_id', effectiveUserId)

        // Build completed set using program_id-week-day
        const completed = new Set<string>((logs || []).map((l: any) => `${l.program_id}-${l.week}-${l.day}`))

        let foundNext = false

        // Check each program in order
        if (allProgramsForInit && allProgramsForInit.length > 0) {
          for (let programIdx = 0; programIdx < allProgramsForInit.length; programIdx++) {
            const program = allProgramsForInit[programIdx]
            const programIndex = programIdx + 1 // 1-based index

            // Get workouts for this program
            const { data: workouts } = await supabase
              .from('program_workouts')
              .select('week, day')
              .eq('program_id', program.id)
              .order('week', { ascending: true })
              .order('day', { ascending: true })

            if (workouts && workouts.length > 0) {
              // Find first incomplete workout in this program
              for (const w of workouts) {
                const key = `${program.id}-${w.week}-${w.day}`
                if (!completed.has(key)) {
                  // Convert to global week
                  const globalWeek = programAndWeekToGlobalWeek(programIndex, w.week)
                  setCurrentWeek(globalWeek)
                  setCurrentDay(w.day)
                  setCurrentProgram(program.id)
                  setProgramSpecificWeek(w.week) // Set program-specific week
                  foundNext = true
                  break
                }
              }
              if (foundNext) break
            }
          }
        }

        // Fallback: if no workouts found, default to first program, week 1, day 1
        if (!foundNext) {
          if (allProgramsForInit && allProgramsForInit.length > 0) {
            setCurrentWeek(1) // Global week 1 = Program 1, Week 1
            setCurrentDay(1)
            setCurrentProgram(allProgramsForInit[0].id)
            setProgramSpecificWeek(1) // Program-specific week 1
          }
        }
      } catch {
        // If anything fails, leave currentWeek/currentDay as defaults (week 1, day 1)
      }
    } catch (err) {
      console.error('Error loading user program:', err)
      setError('Failed to load program data')
      setLoading(false)
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch('/api/ai/last-refresh', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        if (res.ok) {
          const j = await res.json()
          setLastRefresh(j)
        }
      } catch {}
    })()
  }, [])

  const handleRefreshAI = async () => {
    try {
      if (isRefreshingAI) return
      setIsRefreshingAI(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/ai/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      if (res.status === 200) {
        alert('AI Save queued. Upcoming sessions will adapt.')
      } else if (res.status === 429) {
        const j = await res.json().catch(() => ({}))
        const when = j?.nextAvailableAt ? new Date(j.nextAvailableAt).toLocaleString() : 'later'
        alert(`Next AI Save available at ${when}.`)
      } else {
        alert('Failed to enqueue AI Save')
      }
    } catch (e) {
      alert('Failed to enqueue AI Save')
    } finally {
      setIsRefreshingAI(false)
    }
  }

  const calculateEstimatedTDEE = async () => {
    if (!userId || !currentProgram || !currentWeek || !currentDay) {
      setEstimatedTDEE(null)
      return
    }

    setTdeeLoading(true)
    try {
      const supabase = createClient()
      
      // Fetch user data
      const { data: userData } = await supabase
        .from('users')
        .select('body_weight, height, age, gender, units')
        .eq('id', userId)
        .single()

      if (!userData || !userData.body_weight || !userData.height || !userData.age) {
        setEstimatedTDEE(null)
        setTdeeLoading(false)
        return
      }

      // Calculate BMR using Mifflin-St Jeor
      const weight = userData.body_weight
      const isMetric = userData.units?.includes('kg')
      const weightKg = isMetric ? weight : weight * 0.453592
      const heightCm = isMetric ? userData.height : userData.height * 2.54
      const age = userData.age
      const s = userData.gender === 'Male' ? 5 : -161
      const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s

      // Fetch workout structure to estimate activity level
      const programAndWeek = await findProgramAndWeekForGlobalWeek(currentWeek)
      if (!programAndWeek) {
        setEstimatedTDEE(null)
        setTdeeLoading(false)
        return
      }

      const response = await fetch(`/api/workouts/${programAndWeek.programId}/week/${programAndWeek.week}/day/${currentDay}`)
      if (!response.ok) {
        setEstimatedTDEE(null)
        setTdeeLoading(false)
        return
      }

      const data = await response.json()
      if (!data.success || !data.workout) {
        setEstimatedTDEE(null)
        setTdeeLoading(false)
        return
      }

      // Estimate activity multiplier based on workout structure
      // Medium RPE assumption for pre-workout estimate
      const blocks = data.workout.blocks || []
      const totalExercises = blocks.reduce((sum: number, block: any) => 
        sum + (Array.isArray(block.exercises) ? block.exercises.length : 0), 0)
      
      // Activity multiplier: 1.375 (light), 1.55 (moderate), 1.725 (active), 1.9 (very active)
      // CrossFit training day: typically 1.725-1.9, use 1.8 for medium RPE
      const activityMultiplier = 1.8
      const tdee = Math.round(bmr * activityMultiplier)

      setEstimatedTDEE(tdee)
    } catch (err) {
      console.error('Error calculating TDEE:', err)
      setEstimatedTDEE(null)
    } finally {
      setTdeeLoading(false)
    }
  }

  const fetchTodaysWorkout = async () => {
    try {
      // Convert global week to program and week within program
      const programAndWeek = await findProgramAndWeekForGlobalWeek(currentWeek)
      
      if (!programAndWeek) {
        throw new Error(`Week ${currentWeek} not found in any program`)
      }

      const { programId: programIdForWeek, week: weekInProgram } = programAndWeek

      const response = await fetch(`/api/workouts/${programIdForWeek}/week/${weekInProgram}/day/${currentDay}`)
      
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
        
        // Update currentProgram to the correct one for this week
        if (currentProgram !== programIdForWeek) {
          setCurrentProgram(programIdForWeek)
        }
        
        // Update program-specific week for API calls
        setProgramSpecificWeek(weekInProgram)
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
      {/* Viewing As Athlete Banner */}
      {viewingAsAthlete && viewingAthleteName && (
        <div className="bg-blue-600 text-white px-4 py-3 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-lg">👁️</span>
              <div>
                <span className="font-semibold">Viewing as: {viewingAthleteName}</span>
                {isAdmin && <span className="ml-2 text-xs bg-blue-700 px-2 py-1 rounded">Admin</span>}
                {isCoach && !isAdmin && <span className="ml-2 text-xs bg-blue-700 px-2 py-1 rounded">Coach</span>}
              </div>
            </div>
            <button
              onClick={() => {
                setViewingAsAthlete(null)
                setViewingAthleteName(null)
                router.push('/dashboard')
              }}
              className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Exit View
            </button>
          </div>
        </div>
      )}

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
      {/* Admin Toggle */}
      {isAdmin && !viewingAsAthlete && (
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Welcome, Admin!
              </h3>
              <p className="text-sm text-gray-600">
                Switch between your athlete training and admin dashboard
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
                onClick={() => setViewMode("admin")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "admin"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🔐 Admin Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coach Toggle */}
      {isCoach && !isAdmin && !viewingAsAthlete && (
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
        {viewMode === "admin" && !viewingAsAthlete ? (
          <AdminDashboard />
        ) : viewMode === "coach" && !viewingAsAthlete ? (
          <CoachDashboard coachData={coachData} />
        ) : (
          <div className="space-y-6">        {/* Program Navigation */}
        {currentProgram && (
          <ProgramNavigationWidget 
            currentWeek={currentWeek}
            currentDay={currentDay}
            programId={currentProgram}
            programSpecificWeek={programSpecificWeek}
            updatedDays={(lastRefresh?.changeSummary?.updatedDays) || []}
            onNavigate={(week, day) => {
              setCurrentWeek(week)
              setCurrentDay(day)
            }}
          />
        )}

        {/* Estimated TDEE Widget */}
        {estimatedTDEE !== null && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-slate-blue">
            <p className="text-xs sm:text-sm mb-1" style={{ color: '#282B34' }}>
              Estimated TDEE (Week {currentWeek} • Day {currentDay})
            </p>
            <p className="text-xl sm:text-2xl font-bold text-coral">
              {tdeeLoading ? '...' : `${estimatedTDEE} kcal/day`}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Based on BMR + activity level (medium RPE assumption)
            </p>
          </div>
        )}
        {estimatedTDEE === null && !tdeeLoading && userId && (
          <div className="bg-gray-50 rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
            <p className="text-xs sm:text-sm text-gray-500">
              Calorie Calculations Unavailable
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Add height and age in your profile to enable TDEE estimates
            </p>
          </div>
        )}

{/* Overview Cards */}
{analyticsLoading ? (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-slate-blue animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    ))}
  </div>
) : dashboardAnalytics?.data?.dashboard && (
  <>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
    {/* Training Days */}
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-slate-blue">
      <p className="text-xs sm:text-sm" style={{ color: '#282B34' }}>Training Days</p>
      <p className="text-xl sm:text-2xl font-bold text-coral">{dashboardAnalytics.data.dashboard.overallMetrics.totalTrainingDays}</p>
    </div>

    {/* Completed Tasks - highlighted as clickable link */}
    <Link href="/dashboard/progress" className="block">
      <div className="rounded-lg shadow p-4 sm:p-6 border-2 border-slate-blue hover:shadow-md transition-shadow" style={{ backgroundColor: '#DAE2EA' }}>
        <p className="text-xs sm:text-sm" style={{ color: '#282B34' }}>Completed Tasks</p>
        <p className="text-xl sm:text-2xl font-bold text-coral">{dashboardAnalytics.data.dashboard.overallMetrics.totalExercises}</p>
      </div>
    </Link>

    {/* MetCons Completed */}
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-slate-blue">
      <p className="text-xs sm:text-sm" style={{ color: '#282B34' }}>MetCons Completed</p>
      <p className="text-xl sm:text-2xl font-bold text-coral">{heatMapData?.totalCompletedWorkouts || 0}</p>
    </div>

    {/* Fitness Score - goes directly to MetCon heat map */}
    <Link href="/dashboard/analytics/metcons" className="block">
      <div className="rounded-lg shadow p-4 sm:p-6 border-2 border-slate-blue hover:shadow-md transition-shadow" style={{ backgroundColor: '#DAE2EA' }}>
        <p className="text-xs sm:text-sm" style={{ color: '#282B34' }}>Fitness Score</p>
        <p className="text-xl sm:text-2xl font-bold text-coral">{heatMapData?.globalFitnessScore || 0}%</p>
      </div>
    </Link>
  </div>
  {/* AI Save button - Hidden for MVP, keep functionality for future */}
  {/* <div className="flex justify-end mb-4">
    <button
      onClick={handleRefreshAI}
      disabled={isRefreshingAI}
      className="px-3 py-2 text-sm rounded-md hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: '#509895', color: '#ffffff' }}
    >
      {isRefreshingAI ? 'Saving…' : 'AI Save'}
    </button>
  </div> */}
  </>
)}

{/* Training Blocks Visualization */}
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

{/* Training Assistant Chat - ADD THIS */}
<div className="mb-8">
{userId && <TrainingChatInterface userId={userId} />}
</div>
          </div>
        )}
      </div>
    </div>
  );   
}



