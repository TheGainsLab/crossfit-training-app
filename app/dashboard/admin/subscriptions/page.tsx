'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CreditCard,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  User,
  ChevronRight,
  Filter
} from 'lucide-react'

interface SubscriptionStats {
  active: number
  trial: number
  canceled: number
  expired: number
  pastDue: number
  byTier: { tier: string; count: number }[]
  byBilling: { interval: string; count: number }[]
  byPlatform: { platform: string; count: number }[]
}

interface SubscriptionRow {
  id: number
  user_id: number
  user_email: string
  user_name: string | null
  status: string
  is_trial_period: boolean
  plan: string | null
  entitlement_identifier: string | null
  billing_interval: string | null
  current_period_end: string | null
  canceled_at: string | null
  platform: string | null
}

function MetricCard({
  title,
  value,
  icon,
  color = 'gray',
  href
}: {
  title: string
  value: number
  icon: React.ReactNode
  color?: 'coral' | 'green' | 'blue' | 'yellow' | 'red' | 'gray'
  href?: string
}) {
  const colorClasses = {
    coral: 'bg-coral/10 text-coral',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-100 text-gray-600'
  }

  const content = (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className={`p-2 rounded-lg ${colorClasses[color]} w-fit`}>
        {icon}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{title}</p>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function StatusBadge({ status, isTrial }: { status: string; isTrial: boolean }) {
  let config = { bg: 'bg-gray-100', text: 'text-gray-600', label: status }

  if (isTrial) {
    config = { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Trial' }
  } else if (status === 'active') {
    config = { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' }
  } else if (status === 'canceled' || status === 'expired') {
    config = { bg: 'bg-red-100', text: 'text-red-700', label: status }
  } else if (status === 'past_due') {
    config = { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Past Due' }
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function AdminSubscriptionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') || ''

  const [stats, setStats] = useState<SubscriptionStats | null>(null)
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/admin/subscriptions/overview'),
        fetch(`/api/admin/subscriptions/list?status=${statusFilter}`)
      ])

      const statsData = await statsRes.json()
      const listData = await listRes.json()

      if (statsData.success) {
        setStats(statsData.stats)
      }

      if (listData.success) {
        setSubscriptions(listData.subscriptions)
      }
    } catch (err: any) {
      console.error('Error fetching subscription data:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filterButtons = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'trial', label: 'Trial' },
    { value: 'past_due', label: 'Past Due' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'expired', label: 'Expired' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Subscriptions</h2>
        <p className="text-gray-500 mt-1">Subscription health and management</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Active"
          value={stats?.active ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="green"
        />
        <MetricCard
          title="Trial"
          value={stats?.trial ?? 0}
          icon={<Clock className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard
          title="Canceled"
          value={stats?.canceled ?? 0}
          icon={<CreditCard className="w-5 h-5" />}
          color="yellow"
        />
        <MetricCard
          title="Expired"
          value={stats?.expired ?? 0}
          icon={<CreditCard className="w-5 h-5" />}
          color="gray"
        />
        <MetricCard
          title="Past Due"
          value={stats?.pastDue ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Tier */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">By Tier</h3>
          {stats?.byTier && stats.byTier.length > 0 ? (
            <div className="space-y-3">
              {stats.byTier.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{item.tier || 'Unknown'}</span>
                  <span className="font-medium text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No data</p>
          )}
        </div>

        {/* By Billing */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">By Billing</h3>
          {stats?.byBilling && stats.byBilling.length > 0 ? (
            <div className="space-y-3">
              {stats.byBilling.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">{item.interval || 'Unknown'}</span>
                  <span className="font-medium text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No data</p>
          )}
        </div>

        {/* By Platform */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">By Platform</h3>
          {stats?.byPlatform && stats.byPlatform.length > 0 ? (
            <div className="space-y-3">
              {stats.byPlatform.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">{item.platform || 'Unknown'}</span>
                  <span className="font-medium text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No data</p>
          )}
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => router.push(`/dashboard/admin/subscriptions${btn.value ? `?status=${btn.value}` : ''}`)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === btn.value
                ? 'bg-coral text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Billing
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Renews / Expires
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
                    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded w-16" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded w-12" /></td>
                  </tr>
                ))
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {sub.user_name || 'Unnamed'}
                          </p>
                          <p className="text-xs text-gray-500">{sub.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={sub.status} isTrial={sub.is_trial_period} />
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {sub.entitlement_identifier || sub.plan || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 capitalize">
                      {sub.billing_interval || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 capitalize">
                      {sub.platform || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {sub.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/dashboard/admin/users/${sub.user_id}`}
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
