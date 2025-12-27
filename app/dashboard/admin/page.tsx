'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  CreditCard,
  ArrowRight
} from 'lucide-react'

interface SystemStats {
  users: {
    total: number
    athletes: number
    coaches: number
    admins: number
  }
  subscriptions: {
    premium: number
    free: number
    btn: number
    appliedPower: number
    engine: number
    total: number
  }
  activity: {
    totalPerformanceLogs: number
    activeUsers: number
    recentLogs: number
    recentPrograms: number
  }
}

interface SubscriptionStats {
  active: number
  trial: number
  canceled: number
  expired: number
  pastDue: number
  expiringTrials3Days: number
}

interface EngagementStats {
  activeRecently: number    // Active in last 7 days
  atRisk7Days: number       // No activity 7-14 days
  atRisk14Days: number      // No activity 14-30 days
  critical30Days: number    // No activity 30+ days
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  href,
  color = 'gray'
}: {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  href?: string
  color?: 'coral' | 'green' | 'yellow' | 'red' | 'blue' | 'gray'
}) {
  const colorClasses = {
    coral: 'bg-coral/10 text-coral',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-100 text-gray-600'
  }

  const content = (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend === 'up' ? 'text-green-600' :
            trend === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> :
             trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
            {trendLabel}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {href && (
        <div className="mt-3 flex items-center text-sm text-coral font-medium">
          View all <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

function AlertCard({
  title,
  count,
  description,
  href,
  severity
}: {
  title: string
  count: number
  description: string
  href: string
  severity: 'warning' | 'danger' | 'info'
}) {
  const severityClasses = {
    warning: 'border-yellow-200 bg-yellow-50',
    danger: 'border-red-200 bg-red-50',
    info: 'border-blue-200 bg-blue-50'
  }

  const iconClasses = {
    warning: 'text-yellow-600',
    danger: 'text-red-600',
    info: 'text-blue-600'
  }

  return (
    <Link href={href} className={`block rounded-lg border p-4 ${severityClasses[severity]} hover:shadow-sm transition-shadow`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 mt-0.5 ${iconClasses[severity]}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">{title}</h3>
            <span className="text-lg font-bold text-gray-900">{count}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  )
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null)
  const [engagementStats, setEngagementStats] = useState<EngagementStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch system stats
        const [sysRes, subRes, engRes] = await Promise.all([
          fetch('/api/admin/system-stats'),
          fetch('/api/admin/subscriptions/stats'),
          fetch('/api/admin/engagement/stats')
        ])

        if (sysRes.ok) {
          const sysData = await sysRes.json()
          if (sysData.success) {
            setStats(sysData.stats)
          }
        }

        if (subRes.ok) {
          const subData = await subRes.json()
          if (subData.success) {
            setSubscriptionStats(subData.stats)
          }
        }

        if (engRes.ok) {
          const engData = await engRes.json()
          if (engData.success) {
            setEngagementStats(engData.stats)
          }
        }

      } catch (err) {
        console.error('Failed to fetch stats:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 h-32" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500 mt-1">Monitor user engagement and subscription health</p>
      </div>

      {/* Engagement Alerts */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Needs Attention</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AlertCard
            title="Trials Expiring (3 days)"
            count={subscriptionStats?.expiringTrials3Days ?? 0}
            description="Users whose trial ends soon — reach out before they expire"
            href="/dashboard/admin/engagement?filter=expiring-trials"
            severity="warning"
          />
          <AlertCard
            title="At-Risk Users"
            count={(engagementStats?.atRisk7Days ?? 0) + (engagementStats?.atRisk14Days ?? 0)}
            description="Active subscribers with no activity in 7+ days"
            href="/dashboard/admin/engagement?filter=at-risk"
            severity="danger"
          />
          <AlertCard
            title="Billing Issues"
            count={subscriptionStats?.pastDue ?? 0}
            description="Subscriptions with payment problems"
            href="/dashboard/admin/subscriptions?filter=past-due"
            severity="danger"
          />
        </div>
      </div>

      {/* Subscription Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Subscriptions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Subscribers"
            value={subscriptionStats?.active ?? stats?.subscriptions?.total ?? 0}
            subtitle="Paying customers"
            icon={<UserCheck className="w-5 h-5" />}
            color="green"
            href="/dashboard/admin/subscriptions?status=active"
          />
          <MetricCard
            title="On Trial"
            value={subscriptionStats?.trial ?? 0}
            subtitle="Free trial users"
            icon={<Clock className="w-5 h-5" />}
            color="blue"
            href="/dashboard/admin/subscriptions?status=trial"
          />
          <MetricCard
            title="Canceled"
            value={subscriptionStats?.canceled ?? 0}
            subtitle="Win-back opportunities"
            icon={<UserX className="w-5 h-5" />}
            color="yellow"
            href="/dashboard/admin/engagement?filter=win-back"
          />
          <MetricCard
            title="Expired"
            value={subscriptionStats?.expired ?? 0}
            subtitle="Inactive subscriptions"
            icon={<CreditCard className="w-5 h-5" />}
            color="gray"
            href="/dashboard/admin/subscriptions?status=expired"
          />
        </div>
      </div>

      {/* Engagement Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">User Engagement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active (7 days)"
            value={engagementStats?.activeRecently ?? stats?.activity?.activeUsers ?? 0}
            subtitle="Users with recent activity"
            icon={<Activity className="w-5 h-5" />}
            color="green"
            href="/dashboard/admin/users?activity=7"
          />
          <MetricCard
            title="Warning (7-14d)"
            value={engagementStats?.atRisk7Days ?? 0}
            subtitle="Starting to disengage"
            icon={<AlertTriangle className="w-5 h-5" />}
            color="yellow"
            href="/dashboard/admin/users?activity=7-14"
          />
          <MetricCard
            title="At Risk (14-30d)"
            value={engagementStats?.atRisk14Days ?? 0}
            subtitle="Significant inactivity"
            icon={<AlertTriangle className="w-5 h-5" />}
            color="red"
            href="/dashboard/admin/users?activity=14-30"
          />
          <MetricCard
            title="Critical (30d+)"
            value={engagementStats?.critical30Days ?? 0}
            subtitle="Very likely to churn"
            icon={<UserX className="w-5 h-5" />}
            color="gray"
            href="/dashboard/admin/users?activity=30"
          />
        </div>
      </div>

      {/* User Counts */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Total Users</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Users"
            value={stats?.users?.total ?? 0}
            icon={<Users className="w-5 h-5" />}
            color="coral"
            href="/dashboard/admin/users"
          />
          <MetricCard
            title="Athletes"
            value={stats?.users?.athletes ?? 0}
            icon={<Users className="w-5 h-5" />}
            color="gray"
            href="/dashboard/admin/users?role=athlete"
          />
          <MetricCard
            title="Coaches"
            value={stats?.users?.coaches ?? 0}
            icon={<Users className="w-5 h-5" />}
            color="gray"
            href="/dashboard/admin/users?role=coach"
          />
          <MetricCard
            title="Workouts Logged"
            value={stats?.activity?.totalPerformanceLogs ?? 0}
            subtitle="All time"
            icon={<Activity className="w-5 h-5" />}
            color="gray"
            href="/dashboard/admin/training"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/admin/users"
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Search Users
          </Link>
          <Link
            href="/dashboard/admin/engagement?filter=expiring-trials"
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Expiring Trials
          </Link>
          <Link
            href="/dashboard/admin/engagement?filter=at-risk"
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View At-Risk Users
          </Link>
          <Link
            href="/dashboard/admin/workouts-import"
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Import Workouts
          </Link>
        </div>
      </div>
    </div>
  )
}
