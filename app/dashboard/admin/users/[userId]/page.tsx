'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  User,
  Mail,
  Calendar,
  CreditCard,
  Activity,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  MessageCircle,
  FileText,
  Plus,
  Send,
  Heart,
  Flame,
  Zap,
  Timer,
  Dumbbell,
  BarChart3,
  ClipboardList,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface UserProfile {
  id: number
  email: string
  name: string | null
  role: string
  ability_level: string | null
  subscription_tier: string | null
  subscription_status: string | null
  created_at: string
  auth_id: string
  current_program: string | null
}

interface SubscriptionData {
  id: number
  status: string
  is_trial_period: boolean
  plan: string | null
  entitlement_identifier: string | null
  billing_interval: string | null
  subscription_start: string | null
  current_period_end: string | null
  canceled_at: string | null
  platform: string | null
}

interface EngagementData {
  days_since_activity: number | null
  last_activity: string | null
  workouts_30d: number
  workouts_7d: number
  streak: number
  completion_rate: number | null
}

interface RecentWorkout {
  id: number
  logged_at: string
  exercise_name: string | null
  block: string | null
  rpe: number | null
  week: number | null
  day: number | null
  program_id: number | null
}

interface EngineSession {
  id: string
  date: string
  day_type: string | null
  modality: string | null
  total_output: number | null
  actual_pace: number | null
  target_pace: number | null
  performance_ratio: number | null
  total_work_seconds: number | null
  total_rest_seconds: number | null
  peak_heart_rate: number | null
  average_heart_rate: number | null
  perceived_exertion: number | null
  units: string | null
}

interface AdminNote {
  id: number
  content: string
  created_at: string
  admin_name: string | null
}

interface ChatMessage {
  id: string
  sender_type: 'user' | 'admin'
  content: string
  created_at: string
  is_auto_reply: boolean
}

interface ChatConversation {
  id: string
  status: string
  last_message_at: string | null
  unread: boolean
}

interface AthleteProfile {
  height: number | null
  age: number | null
  body_weight: number | null
  gender: string | null
  units: string
  equipment: string[]
  oneRMs: { [key: string]: number | null }
  skills: { [key: string]: string }
  benchmarks: { [key: string]: string | null }
  skillsAssessment: {
    dont_have: string[]
    beginner: string[]
    intermediate: string[]
    advanced: string[]
  } | null
  technicalFocus: {
    snatch_technical_count: number
    clean_jerk_technical_count: number
  } | null
  accessoryNeeds: {
    needs_upper_back: boolean
    needs_leg_strength: boolean
    needs_posterior_chain: boolean
    needs_upper_body_pressing: boolean
    needs_upper_body_pulling: boolean
    needs_core: boolean
  } | null
  profileGeneratedAt: string | null
}

interface UserDetailData {
  user: UserProfile
  subscription: SubscriptionData | null
  engagement: EngagementData
  recentWorkouts: RecentWorkout[]
  engineSessions: EngineSession[]
  notes: AdminNote[]
  athleteProfile?: AthleteProfile
}

type TabType = 'overview' | 'profile' | 'program' | 'analytics'

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({ label, value, badge }: { label: string; value: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-600 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {badge}
        <span className="text-gray-900 font-medium text-sm">{value}</span>
      </div>
    </div>
  )
}

function StatusBadge({ status, isTrial }: { status: string; isTrial?: boolean }) {
  let config = { bg: 'bg-gray-100', text: 'text-gray-600', label: status }

  if (isTrial) {
    config = { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Trial' }
  } else if (status === 'active') {
    config = { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' }
  } else if (status === 'canceled') {
    config = { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Canceled' }
  } else if (status === 'expired') {
    config = { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' }
  } else if (status === 'past_due') {
    config = { bg: 'bg-red-100', text: 'text-red-700', label: 'Past Due' }
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

function EngagementBadge({ daysSince }: { daysSince: number | null }) {
  if (daysSince === null) {
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Never Active</span>
  }

  let config = { bg: 'bg-green-100', text: 'text-green-700', label: 'Engaged' }

  if (daysSince > 30) {
    config = { bg: 'bg-red-200', text: 'text-red-800', label: 'Critical' }
  } else if (daysSince > 14) {
    config = { bg: 'bg-red-100', text: 'text-red-700', label: 'At Risk' }
  } else if (daysSince > 7) {
    config = { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Warning' }
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<UserDetailData | null>(null)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Analytics filter state
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)

  // Chat state
  const [chatConversation, setChatConversation] = useState<ChatConversation | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    async function fetchUserDetail() {
      try {
        const res = await fetch(`/api/admin/users/${userId}/profile`)
        const result = await res.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch user')
        }

        setData(result)
      } catch (err: any) {
        console.error('Error fetching user:', err)
        setError(err.message || 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }

    fetchUserDetail()
  }, [userId])

  // Fetch chat conversation for this user
  useEffect(() => {
    async function fetchChat() {
      setChatLoading(true)
      try {
        // Find conversation for this user from all conversations
        const res = await fetch('/api/admin/chat/conversations')
        const data = await res.json()

        if (data.success) {
          const userConv = data.conversations.find((c: any) => c.user_id === parseInt(userId))
          if (userConv) {
            setChatConversation({
              id: userConv.id,
              status: userConv.status,
              last_message_at: userConv.last_message_at,
              unread: userConv.unread
            })

            // Fetch messages
            const msgRes = await fetch(`/api/admin/chat/conversations/${userConv.id}`)
            const msgData = await msgRes.json()
            if (msgData.success) {
              setChatMessages(msgData.messages || [])
            }
          }
        }
      } catch (err) {
        console.error('Error fetching chat:', err)
      } finally {
        setChatLoading(false)
      }
    }

    fetchChat()
  }, [userId])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatConversation || sendingMessage) return

    setSendingMessage(true)
    try {
      const res = await fetch(`/api/admin/chat/conversations/${chatConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() })
      })

      const data = await res.json()
      if (data.success) {
        setChatMessages(prev => [...prev, data.message])
        setNewMessage('')
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSendingMessage(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return

    setSavingNote(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote })
      })

      const result = await res.json()
      if (result.success) {
        setData(prev => prev ? {
          ...prev,
          notes: [result.note, ...prev.notes]
        } : null)
        setNewNote('')
      }
    } catch (err) {
      console.error('Error saving note:', err)
    } finally {
      setSavingNote(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5 h-64" />
            <div className="bg-white rounded-lg border p-5 h-64" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error || 'User not found'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-red-600 hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  const { user, subscription, engagement, recentWorkouts, engineSessions, notes, athleteProfile } = data

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'program', label: 'Program', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Users
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {user.name || 'Unnamed User'}
              </h2>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <EngagementBadge daysSince={engagement.days_since_activity} />
          {subscription && (
            <StatusBadge status={subscription.status} isTrial={subscription.is_trial_period} />
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-coral text-coral'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Info */}
        <InfoCard title="Account Info">
          <InfoRow label="User ID" value={user.id} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.role} />
          <InfoRow label="Ability Level" value={user.ability_level || '-'} />
          <InfoRow
            label="Joined"
            value={new Date(user.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          />
        </InfoCard>

        {/* Subscription */}
        <InfoCard title="Subscription">
          {subscription ? (
            <>
              <InfoRow
                label="Status"
                value=""
                badge={<StatusBadge status={subscription.status} isTrial={subscription.is_trial_period} />}
              />
              <InfoRow label="Plan" value={subscription.entitlement_identifier || subscription.plan || '-'} />
              <InfoRow label="Billing" value={subscription.billing_interval || '-'} />
              <InfoRow label="Platform" value={subscription.platform || '-'} />
              <InfoRow
                label="Started"
                value={subscription.subscription_start
                  ? new Date(subscription.subscription_start).toLocaleDateString()
                  : '-'
                }
              />
              <InfoRow
                label={subscription.is_trial_period ? 'Trial Ends' : 'Renews'}
                value={subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : '-'
                }
              />
              {subscription.canceled_at && (
                <InfoRow
                  label="Canceled"
                  value={new Date(subscription.canceled_at).toLocaleDateString()}
                />
              )}
            </>
          ) : user.subscription_tier ? (
            // Fallback to users table subscription data (used by mobile app)
            <>
              <InfoRow
                label="Status"
                value=""
                badge={<StatusBadge status={user.subscription_status || 'active'} />}
              />
              <InfoRow label="Plan" value={user.subscription_tier} />
              <InfoRow label="Source" value="User Profile" />
            </>
          ) : (
            <p className="text-gray-500 text-sm">No active subscription</p>
          )}
        </InfoCard>

        {/* Engagement */}
        <InfoCard title="Engagement">
          <InfoRow
            label="Status"
            value=""
            badge={<EngagementBadge daysSince={engagement.days_since_activity} />}
          />
          <InfoRow
            label="Last Active"
            value={engagement.last_activity
              ? `${engagement.days_since_activity} days ago`
              : 'Never'
            }
          />
          <InfoRow label="Workouts (7d)" value={engagement.workouts_7d} />
          <InfoRow label="Workouts (30d)" value={engagement.workouts_30d} />
          <InfoRow label="Current Streak" value={`${engagement.streak} days`} />
          {engagement.completion_rate !== null && (
            <InfoRow
              label="Completion Rate"
              value={`${Math.round(engagement.completion_rate)}%`}
            />
          )}
        </InfoCard>

        {/* Program Status */}
        <InfoCard title="Training Program">
          {user.current_program || user.subscription_tier ? (
            <>
              <InfoRow
                label="Current Program"
                value={user.current_program || user.subscription_tier || '-'}
              />
              <InfoRow label="Tier" value={user.subscription_tier || '-'} />
            </>
          ) : (
            <p className="text-gray-500 text-sm">No active program</p>
          )}
        </InfoCard>
      </div>

      {/* Recent Workouts */}
      <InfoCard title="Recent Activity">
        {recentWorkouts.length > 0 ? (
          <div className="space-y-3">
            {recentWorkouts.map((workout) => (
              <div key={workout.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {workout.exercise_name || workout.block || 'Workout'}
                  </p>
                  <p className="text-xs text-gray-500">{workout.block}</p>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(workout.logged_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No recent workouts</p>
        )}
      </InfoCard>

      {/* ENGINE Sessions */}
      {engineSessions && engineSessions.length > 0 && (
        <InfoCard title="ENGINE Sessions">
          <div className="space-y-4">
            {engineSessions.map((session) => {
              const formatDuration = (seconds: number | null) => {
                if (!seconds) return '-'
                const mins = Math.floor(seconds / 60)
                const secs = seconds % 60
                return `${mins}:${secs.toString().padStart(2, '0')}`
              }

              const formatModality = (modality: string | null) => {
                if (!modality) return '-'
                return modality
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase())
              }

              const formatDayType = (dayType: string | null) => {
                if (!dayType) return '-'
                return dayType
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase())
              }

              const performancePercent = session.performance_ratio
                ? (session.performance_ratio * 100).toFixed(0)
                : null

              return (
                <div key={session.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  {/* Session Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-coral/10 text-coral">
                        ENGINE: {formatDayType(session.day_type)}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{formatModality(session.modality)}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Training Summary Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Work Duration */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-1 mb-1">
                        <Timer className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500 uppercase">Work Duration</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatDuration(session.total_work_seconds)}
                      </p>
                    </div>

                    {/* Total Work Goal (Output/Calories) */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-1 mb-1">
                        <Flame className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500 uppercase">Total Work Goal</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {session.total_output ?? '-'} <span className="text-sm font-normal text-gray-500">{session.units || 'cal'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {/* Pace */}
                    <div className="text-center p-2 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Pace</p>
                      <p className="font-semibold text-gray-900">
                        {session.actual_pace?.toFixed(1) ?? '-'}
                      </p>
                    </div>

                    {/* Output */}
                    <div className="text-center p-2 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Output</p>
                      <p className="font-semibold text-gray-900">
                        {session.total_output ?? '-'}
                      </p>
                    </div>

                    {/* Performance */}
                    <div className="text-center p-2 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Performance</p>
                      <p className={`font-semibold ${
                        performancePercent && parseFloat(performancePercent) >= 100
                          ? 'text-green-600'
                          : performancePercent && parseFloat(performancePercent) >= 90
                            ? 'text-yellow-600'
                            : 'text-gray-900'
                      }`}>
                        {performancePercent ? `${performancePercent}%` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Heart Rate Section (if present) */}
                  {(session.peak_heart_rate || session.average_heart_rate) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-4 text-sm">
                        {session.average_heart_rate && (
                          <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-400" />
                            <span className="text-gray-500">Avg HR:</span>
                            <span className="font-medium text-gray-900">{session.average_heart_rate} bpm</span>
                          </div>
                        )}
                        {session.peak_heart_rate && (
                          <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-500" />
                            <span className="text-gray-500">Max HR:</span>
                            <span className="font-medium text-gray-900">{session.peak_heart_rate} bpm</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </InfoCard>
      )}

      {/* Admin Notes */}
      <InfoCard title="Admin Notes">
        <div className="space-y-4">
          {/* Add note form */}
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this user..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/20 resize-none"
              rows={2}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || savingNote}
              className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Notes list */}
          {notes.length > 0 ? (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              {notes.map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{note.content}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">{note.admin_name || 'Admin'}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm pt-4 border-t border-gray-100">No notes yet</p>
          )}
        </div>
      </InfoCard>

      {/* Support Chat */}
      <InfoCard title="Support Chat">
        {chatLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-coral"></div>
          </div>
        ) : chatConversation ? (
          <div className="space-y-4">
            {/* Messages */}
            <div className="max-h-64 overflow-y-auto space-y-3 p-2 bg-gray-50 rounded-lg">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        msg.sender_type === 'admin'
                          ? msg.is_auto_reply
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-coral text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        msg.sender_type === 'admin' && !msg.is_auto_reply
                          ? 'text-white/70'
                          : 'text-gray-400'
                      }`}>
                        {new Date(msg.created_at).toLocaleString()}
                        {msg.is_auto_reply && ' • Auto'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 text-sm py-4">No messages yet</p>
              )}
            </div>

            {/* Reply input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Type a reply..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/20"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Link to full chat */}
            <div className="pt-2 border-t border-gray-100">
              <Link
                href={`/dashboard/admin/chat?id=${chatConversation.id}`}
                className="text-sm text-coral hover:text-coral/80 flex items-center gap-1"
              >
                <MessageCircle className="w-4 h-4" />
                View full conversation
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No support conversation with this user yet</p>
            <p className="text-gray-400 text-xs mt-1">The user will appear here when they send their first message</p>
          </div>
        )}
      </InfoCard>
        </>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {athleteProfile ? (
            <>
              {/* Physical Stats */}
              <InfoCard title="Physical Stats">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Height</p>
                    <p className="text-xl font-bold text-gray-900">
                      {athleteProfile.height ? `${athleteProfile.height}${athleteProfile.units.includes('kg') ? ' cm' : '"'}` : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Weight</p>
                    <p className="text-xl font-bold text-gray-900">
                      {athleteProfile.body_weight ? `${athleteProfile.body_weight} ${athleteProfile.units.includes('kg') ? 'kg' : 'lbs'}` : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Age</p>
                    <p className="text-xl font-bold text-gray-900">{athleteProfile.age || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Gender</p>
                    <p className="text-xl font-bold text-gray-900">{athleteProfile.gender || '-'}</p>
                  </div>
                </div>
              </InfoCard>

              {/* 1RM Lifts */}
              <InfoCard title="1RM Lifts">
                {Object.keys(athleteProfile.oneRMs).length > 0 ? (
                  <div className="space-y-6">
                    {/* Olympic Lifts */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Dumbbell className="w-4 h-4" />
                        Olympic Lifts
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { key: 'snatch', label: 'Snatch' },
                          { key: 'clean_and_jerk', label: 'Clean & Jerk' },
                          { key: 'power_snatch', label: 'Power Snatch' },
                          { key: 'power_clean', label: 'Power Clean' },
                          { key: 'clean_only', label: 'Clean' },
                          { key: 'jerk_only', label: 'Jerk' },
                        ].map(lift => (
                          <div key={lift.key} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">{lift.label}</p>
                            <p className="text-lg font-bold text-gray-900">
                              {athleteProfile.oneRMs[lift.key]
                                ? `${athleteProfile.oneRMs[lift.key]} ${athleteProfile.units.includes('kg') ? 'kg' : 'lbs'}`
                                : '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Foundation Lifts */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Dumbbell className="w-4 h-4" />
                        Foundation Lifts
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { key: 'back_squat', label: 'Back Squat' },
                          { key: 'front_squat', label: 'Front Squat' },
                          { key: 'overhead_squat', label: 'Overhead Squat' },
                          { key: 'deadlift', label: 'Deadlift' },
                          { key: 'bench_press', label: 'Bench Press' },
                          { key: 'push_press', label: 'Push Press' },
                          { key: 'strict_press', label: 'Strict Press' },
                          { key: 'weighted_pullup', label: 'Weighted Pull-up' },
                        ].map(lift => (
                          <div key={lift.key} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">{lift.label}</p>
                            <p className="text-lg font-bold text-gray-900">
                              {athleteProfile.oneRMs[lift.key]
                                ? `${athleteProfile.oneRMs[lift.key]} ${athleteProfile.units.includes('kg') ? 'kg' : 'lbs'}`
                                : '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No 1RM data recorded</p>
                )}
              </InfoCard>

              {/* Conditioning Benchmarks */}
              <InfoCard title="Conditioning Benchmarks">
                {Object.keys(athleteProfile.benchmarks).length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'mile_run', label: 'Mile Run' },
                      { key: 'five_k_run', label: '5K Run' },
                      { key: 'ten_k_run', label: '10K Run' },
                      { key: 'one_k_row', label: '1K Row' },
                      { key: 'two_k_row', label: '2K Row' },
                      { key: 'five_k_row', label: '5K Row' },
                      { key: 'air_bike_10_min', label: '10 Min Air Bike' },
                    ].map(benchmark => (
                      <div key={benchmark.key} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">{benchmark.label}</p>
                        <p className="text-lg font-bold text-gray-900">
                          {athleteProfile.benchmarks[benchmark.key] || '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No benchmark data recorded</p>
                )}
              </InfoCard>

              {/* Skills Assessment */}
              <InfoCard title="Skills Assessment">
                {Object.keys(athleteProfile.skills).length > 0 ? (
                  <div className="space-y-4">
                    {/* Skill level legend */}
                    <div className="flex gap-4 text-xs pb-3 border-b border-gray-100">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Advanced
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Intermediate
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span> Beginner
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-300"></span> Don't Have
                      </span>
                    </div>

                    {/* Skills grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {Object.entries(athleteProfile.skills).map(([skillName, level]) => {
                        const levelColors: { [key: string]: string } = {
                          'advanced': 'bg-green-100 text-green-800 border-green-200',
                          'intermediate': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                          'beginner': 'bg-orange-100 text-orange-800 border-orange-200',
                          'dont_have': 'bg-gray-100 text-gray-500 border-gray-200',
                        }
                        const colorClass = levelColors[level] || levelColors['dont_have']

                        return (
                          <div
                            key={skillName}
                            className={`rounded-lg p-2 text-xs border ${colorClass}`}
                          >
                            <p className="font-medium truncate" title={skillName}>{skillName}</p>
                            <p className="capitalize">{level.replace('_', "'t ")}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No skills data recorded</p>
                )}
              </InfoCard>

              {/* Equipment */}
              {athleteProfile.equipment && athleteProfile.equipment.length > 0 && (
                <InfoCard title="Available Equipment">
                  <div className="flex flex-wrap gap-2">
                    {athleteProfile.equipment.map((item) => (
                      <span
                        key={item}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </InfoCard>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No profile data available</p>
              <p className="text-gray-400 text-sm mt-1">This user may not have completed their intake assessment</p>
            </div>
          )}
        </div>
      )}

      {/* Program Tab */}
      {activeTab === 'program' && (
        <div className="space-y-6">
          <InfoCard title="Current Training Program">
            {user.current_program || user.subscription_tier ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-coral/5 rounded-lg border border-coral/20">
                  <div>
                    <p className="font-semibold text-gray-900">{user.current_program || user.subscription_tier}</p>
                    <p className="text-sm text-gray-500">Subscription Tier: {user.subscription_tier || 'Unknown'}</p>
                  </div>
                  <span className="px-3 py-1 bg-coral/10 text-coral rounded-full text-sm font-medium">
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Ability Level</p>
                    <p className="font-semibold text-gray-900">{user.ability_level || 'Not set'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Workouts (30d)</p>
                    <p className="font-semibold text-gray-900">{engagement.workouts_30d}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No active training program</p>
              </div>
            )}
          </InfoCard>

          {/* Recent Activity for Program context */}
          <InfoCard title="Recent Workout Activity">
            {recentWorkouts.length > 0 ? (
              <div className="space-y-2">
                {recentWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {workout.exercise_name || 'Workout'}
                      </p>
                      <p className="text-sm text-gray-500">{workout.block || 'General'}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(workout.logged_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">No recent workout activity</p>
            )}
          </InfoCard>

          {/* ENGINE Sessions in Program Tab */}
          {engineSessions && engineSessions.length > 0 && (
            <InfoCard title="Recent ENGINE Sessions">
              <div className="space-y-3">
                {engineSessions.slice(0, 5).map((session) => {
                  const formatDuration = (seconds: number | null) => {
                    if (!seconds) return '-'
                    const mins = Math.floor(seconds / 60)
                    const secs = seconds % 60
                    return `${mins}:${secs.toString().padStart(2, '0')}`
                  }
                  const performancePercent = session.performance_ratio
                    ? (session.performance_ratio * 100).toFixed(0)
                    : null

                  return (
                    <div key={session.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.day_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Session'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {session.modality?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} • {formatDuration(session.total_work_seconds)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          performancePercent && parseFloat(performancePercent) >= 100
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }`}>
                          {performancePercent ? `${performancePercent}%` : '-'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(session.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </InfoCard>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {(engineSessions && engineSessions.length > 0) || (recentWorkouts && recentWorkouts.length > 0) ? (
            (() => {
              // Compute stats from ENGINE sessions (if any)
              const hasEngineSessions = engineSessions && engineSessions.length > 0
              const hasWorkouts = recentWorkouts && recentWorkouts.length > 0

              // Count unique sessions using (program_id, week, day) - matching mobile's sessionKey logic
              const uniqueSessions = hasWorkouts
                ? new Set(recentWorkouts.map(w => `${w.program_id || 0}-W${w.week || 0}D${w.day || 0}`)).size
                : 0
              const totalCount = hasEngineSessions ? engineSessions.length : uniqueSessions

              // ENGINE-specific stats
              const sessionsWithPerf = hasEngineSessions ? engineSessions.filter(s => s.performance_ratio !== null) : []
              const avgPerformance = sessionsWithPerf.length > 0
                ? sessionsWithPerf.reduce((sum, s) => sum + (s.performance_ratio || 0), 0) / sessionsWithPerf.length
                : null
              const sessionsWithHR = hasEngineSessions ? engineSessions.filter(s => s.average_heart_rate !== null) : []
              const avgHR = sessionsWithHR.length > 0
                ? Math.round(sessionsWithHR.reduce((sum, s) => sum + (s.average_heart_rate || 0), 0) / sessionsWithHR.length)
                : null
              const totalWorkSeconds = hasEngineSessions
                ? engineSessions.reduce((sum, s) => sum + (s.total_work_seconds || 0), 0)
                : 0

              // Group by modality (ENGINE) or block (BTN)
              const byModality = hasEngineSessions
                ? engineSessions.reduce((acc, s) => {
                    const mod = s.modality || 'Unknown'
                    acc[mod] = (acc[mod] || 0) + 1
                    return acc
                  }, {} as { [key: string]: number })
                : {}

              // Count unique (exercise, session) pairs per block
              // Each unique exercise on a unique day counts as 1
              // Multiple sets of same exercise on same day = 1
              // Same exercise on different day = counts again
              const byBlock = hasWorkouts
                ? (() => {
                    const counts: { [block: string]: number } = {}
                    // Use Set to track unique (block, exercise, session) combinations
                    const uniqueCombinations = new Set<string>()
                    recentWorkouts.forEach(w => {
                      const block = w.block || 'General'
                      const exercise = w.exercise_name || 'Unknown'
                      const sessionKey = `${w.program_id || 0}-W${w.week || 0}D${w.day || 0}`
                      uniqueCombinations.add(`${block}|${exercise}|${sessionKey}`)
                    })
                    // Count per block
                    uniqueCombinations.forEach(key => {
                      const block = key.split('|')[0]
                      counts[block] = (counts[block] || 0) + 1
                    })
                    return counts
                  })()
                : {}

              // Calculate Avg RPE - for ENGINE from perceived_exertion, for BTN from rpe field
              // Filter by selected block if one is selected
              let avgRPE: number | null = null
              if (hasEngineSessions) {
                const sessionsWithRPE = engineSessions.filter(s => s.perceived_exertion !== null)
                avgRPE = sessionsWithRPE.length > 0
                  ? sessionsWithRPE.reduce((sum, s) => sum + (s.perceived_exertion || 0), 0) / sessionsWithRPE.length
                  : null
              } else if (hasWorkouts) {
                // Filter by selected block if one is selected
                const filteredWorkouts = selectedBlock
                  ? recentWorkouts.filter(w => (w.block || 'General') === selectedBlock)
                  : recentWorkouts
                const workoutsWithRPE = filteredWorkouts.filter(w => w.rpe !== null)
                avgRPE = workoutsWithRPE.length > 0
                  ? workoutsWithRPE.reduce((sum, w) => sum + (w.rpe || 0), 0) / workoutsWithRPE.length
                  : null
              }

              const formatDuration = (seconds: number) => {
                const hours = Math.floor(seconds / 3600)
                const mins = Math.floor((seconds % 3600) / 60)
                if (hours > 0) return `${hours}h ${mins}m`
                return `${mins}m`
              }

              const formatSessionDuration = (seconds: number | null) => {
                if (!seconds) return '-'
                const mins = Math.floor(seconds / 60)
                const secs = seconds % 60
                return `${mins}:${secs.toString().padStart(2, '0')}`
              }

              return (
                <>
                  {/* Summary Cards */}
                  <div className={`grid gap-4 ${hasEngineSessions ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-500 mb-1">Total Workouts</p>
                      <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
                    </div>
                    {hasEngineSessions && (
                      <>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-sm text-gray-500 mb-1">Total Work Time</p>
                          <p className="text-2xl font-bold text-gray-900">{formatDuration(totalWorkSeconds)}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-sm text-gray-500 mb-1">Avg Performance</p>
                          <p className={`text-2xl font-bold ${
                            avgPerformance && avgPerformance >= 1 ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {avgPerformance ? `${(avgPerformance * 100).toFixed(0)}%` : '-'}
                          </p>
                        </div>
                      </>
                    )}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-500 mb-1">
                        {selectedBlock ? `Avg RPE (${selectedBlock})` : 'Avg RPE'}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {avgRPE ? avgRPE.toFixed(1) : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Breakdown Section */}
                  {hasEngineSessions && Object.keys(byModality).length > 0 && (
                    <InfoCard title="Sessions by Modality">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(byModality).map(([modality, count]) => (
                          <div key={modality} className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500 mb-1">
                              {modality.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <p className="text-xl font-bold text-gray-900">{count}</p>
                          </div>
                        ))}
                      </div>
                      {avgHR && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-400" />
                          <span className="text-sm text-gray-600">Average Heart Rate:</span>
                          <span className="font-semibold text-gray-900">{avgHR} bpm</span>
                        </div>
                      )}
                    </InfoCard>
                  )}

                  {hasWorkouts && Object.keys(byBlock).length > 0 && (
                    <InfoCard title="Workouts by Block (click to filter RPE)">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(byBlock).map(([block, count]) => {
                          const isSelected = selectedBlock === block
                          return (
                            <button
                              key={block}
                              onClick={() => setSelectedBlock(isSelected ? null : block)}
                              className={`rounded-lg p-3 text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-coral text-white ring-2 ring-coral ring-offset-2'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <p className={`text-xs mb-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                {block}
                              </p>
                              <p className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                {count}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                      {selectedBlock && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => setSelectedBlock(null)}
                            className="text-sm text-coral hover:text-coral/80"
                          >
                            Clear filter (show all)
                          </button>
                        </div>
                      )}
                    </InfoCard>
                  )}

                  {/* All Workouts List */}
                  <InfoCard title="All Workouts">
                    <div className="space-y-3">
                      {hasEngineSessions && engineSessions.map((session) => {
                        const performancePercent = session.performance_ratio
                          ? (session.performance_ratio * 100).toFixed(0)
                          : null

                        return (
                          <div key={session.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">
                                  {session.day_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Session'}
                                </p>
                                <span className="text-xs px-2 py-0.5 bg-gray-200 rounded text-gray-600">
                                  {session.modality?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                <span>{formatSessionDuration(session.total_work_seconds)} work</span>
                                {session.total_output && (
                                  <span>{session.total_output} {session.units || 'cal'}</span>
                                )}
                                {session.perceived_exertion && (
                                  <span>RPE {session.perceived_exertion}</span>
                                )}
                                {session.average_heart_rate && (
                                  <span className="flex items-center gap-1">
                                    <Heart className="w-3 h-3 text-red-400" />
                                    {session.average_heart_rate} bpm
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${
                                performancePercent && parseFloat(performancePercent) >= 100
                                  ? 'text-green-600'
                                  : performancePercent && parseFloat(performancePercent) >= 90
                                    ? 'text-yellow-600'
                                    : 'text-gray-900'
                              }`}>
                                {performancePercent ? `${performancePercent}%` : '-'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(session.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      {hasWorkouts && recentWorkouts.map((workout) => (
                        <div
                          key={workout.id}
                          className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {workout.exercise_name || 'Workout'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {workout.block || 'General'}
                              {workout.rpe && ` • RPE ${workout.rpe}`}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(workout.logged_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </InfoCard>
                </>
              )
            })()
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No training data available</p>
              <p className="text-gray-400 text-sm mt-1">This user has not completed any workouts yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
