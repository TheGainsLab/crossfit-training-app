'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  UserX,
  User,
  ChevronRight,
  RefreshCw
} from 'lucide-react'

interface UserRow {
  id: number
  email: string
  name: string | null
  subscription_tier: string | null
  subscription_status: string | null
  days_since_activity: number | null
  last_activity: string | null
  workouts_30d: number
  trial_ends: string | null
  canceled_at: string | null
}

interface TabConfig {
  id: string
  label: string
  icon: React.ReactNode
  description: string
}

const tabs: TabConfig[] = [
  {
    id: 'at-risk',
    label: 'At-Risk Users',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Active subscribers with no recent activity'
  },
  {
    id: 'expiring-trials',
    label: 'Expiring Trials',
    icon: <Clock className="w-4 h-4" />,
    description: 'Trial users whose subscription ends soon'
  },
  {
    id: 'win-back',
    label: 'Win-Back',
    icon: <UserX className="w-4 h-4" />,
    description: 'Canceled users who may re-subscribe'
  }
]

function ActivityBadge({ daysSince }: { daysSince: number | null }) {
  if (daysSince === null) {
    return <span className="text-xs text-gray-400">Never</span>
  }

  let colorClass = 'bg-green-100 text-green-700'
  if (daysSince > 30) {
    colorClass = 'bg-red-200 text-red-800'
  } else if (daysSince > 14) {
    colorClass = 'bg-red-100 text-red-700'
  } else if (daysSince > 7) {
    colorClass = 'bg-yellow-100 text-yellow-700'
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
    </span>
  )
}

function TrialBadge({ trialEnds }: { trialEnds: string | null }) {
  if (!trialEnds) return null

  const endDate = new Date(trialEnds)
  const now = new Date()
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  let colorClass = 'bg-blue-100 text-blue-700'
  if (daysLeft <= 1) {
    colorClass = 'bg-red-100 text-red-700'
  } else if (daysLeft <= 3) {
    colorClass = 'bg-yellow-100 text-yellow-700'
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {daysLeft <= 0 ? 'Expired' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
    </span>
  )
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-gray-400 text-sm">-</span>

  const colors: Record<string, string> = {
    ENGINE: 'bg-purple-100 text-purple-700',
    BTN: 'bg-coral/10 text-coral',
    PREMIUM: 'bg-indigo-100 text-indigo-700',
    APPLIED_POWER: 'bg-orange-100 text-orange-700'
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[tier] || 'bg-gray-100 text-gray-600'}`}>
      {tier}
    </span>
  )
}

export default function AdminEngagementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentFilter = searchParams.get('filter') || 'at-risk'

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/engagement/users?filter=${currentFilter}`)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      setUsers(data.users)
    } catch (err: any) {
      console.error('Error fetching engagement users:', err)
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [currentFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const currentTab = tabs.find(t => t.id === currentFilter) || tabs[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Engagement</h2>
          <p className="text-gray-500 mt-1">Users who need attention</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.push(`/dashboard/admin/engagement?filter=${tab.id}`)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentFilter === tab.id
                ? 'bg-coral text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-600">{currentTab.description}</p>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Users list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                {currentFilter === 'at-risk' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                )}
                {currentFilter === 'expiring-trials' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trial Ends
                  </th>
                )}
                {currentFilter === 'win-back' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Canceled
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workouts (30d)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-48" /></td>
                    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded w-20" /></td>
                    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded w-16" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-8" /></td>
                    <td className="px-4 py-4"><div className="h-8 bg-gray-200 rounded w-16" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No users found in this category
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.name || 'Unnamed'}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <TierBadge tier={user.subscription_tier} />
                    </td>
                    {currentFilter === 'at-risk' && (
                      <td className="px-4 py-4">
                        <ActivityBadge daysSince={user.days_since_activity} />
                      </td>
                    )}
                    {currentFilter === 'expiring-trials' && (
                      <td className="px-4 py-4">
                        <TrialBadge trialEnds={user.trial_ends} />
                      </td>
                    )}
                    {currentFilter === 'win-back' && (
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">
                          {user.canceled_at
                            ? new Date(user.canceled_at).toLocaleDateString()
                            : '-'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-4 text-gray-600">
                      {user.workouts_30d}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/dashboard/admin/users/${user.id}`}
                        className="flex items-center gap-1 text-sm text-coral hover:text-coral/80 font-medium"
                      >
                        View
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
