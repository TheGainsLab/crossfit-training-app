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
  FileText,
  Plus
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
  engine_program_version: string | null
  engine_current_day: number | null
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
}

interface AdminNote {
  id: number
  content: string
  created_at: string
  admin_name: string | null
}

interface UserDetailData {
  user: UserProfile
  subscription: SubscriptionData | null
  engagement: EngagementData
  recentWorkouts: RecentWorkout[]
  notes: AdminNote[]
}

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

  const { user, subscription, engagement, recentWorkouts, notes } = data

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
          {user.current_program || user.engine_program_version ? (
            <>
              <InfoRow
                label="Current Program"
                value={user.current_program || `Engine ${user.engine_program_version}`}
              />
              {user.engine_current_day && (
                <InfoRow label="Program Day" value={user.engine_current_day} />
              )}
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
    </div>
  )
}
