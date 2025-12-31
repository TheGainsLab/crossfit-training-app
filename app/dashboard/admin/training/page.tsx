'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  TrendingUp,
  Users,
  Calendar,
  Dumbbell,
  Timer,
  Target
} from 'lucide-react'

interface TrainingStats {
  totalWorkouts: number
  workoutsThisWeek: number
  workoutsThisMonth: number
  avgWorkoutsPerUser: number
  activeUsersThisWeek: number
  topPrograms: { name: string; count: number }[]
  workoutsByBlock: { block: string; count: number }[]
  dailyWorkouts: { date: string; count: number }[]
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color = 'gray'
}: {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ReactNode
  color?: 'coral' | 'green' | 'blue' | 'purple' | 'gray'
}) {
  const colorClasses = {
    coral: 'bg-coral/10 text-coral',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function SimpleBarChart({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  const maxValue = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">{label}</h4>
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{item.name}</span>
            <span className="font-medium text-gray-900">{item.value}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-coral rounded-full transition-all"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Daily Workouts (Last 7 Days)</h4>
      <div className="flex items-end gap-1 h-32">
        {data.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-coral/80 rounded-t transition-all hover:bg-coral"
              style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
              title={`${day.date}: ${day.count} workouts`}
            />
            <span className="text-xs text-gray-400 -rotate-45 origin-left whitespace-nowrap">
              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminTrainingPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<TrainingStats | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/training/analytics')
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch training data')
        }

        setStats(data.stats)
      } catch (err: any) {
        console.error('Error fetching training stats:', err)
        setError(err.message || 'Failed to load training data')
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Training Analytics</h2>
        <p className="text-gray-500 mt-1">Platform-wide workout and performance metrics</p>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Workouts"
          value={stats?.totalWorkouts?.toLocaleString() ?? 0}
          subtitle="All time"
          icon={<Dumbbell className="w-5 h-5" />}
          color="coral"
        />
        <MetricCard
          title="This Week"
          value={stats?.workoutsThisWeek ?? 0}
          subtitle="Workouts logged"
          icon={<Calendar className="w-5 h-5" />}
          color="green"
        />
        <MetricCard
          title="This Month"
          value={stats?.workoutsThisMonth ?? 0}
          subtitle="Workouts logged"
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard
          title="Active Users"
          value={stats?.activeUsersThisWeek ?? 0}
          subtitle="Logged workout this week"
          icon={<Users className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          {stats?.dailyWorkouts && stats.dailyWorkouts.length > 0 ? (
            <ActivityChart data={stats.dailyWorkouts} />
          ) : (
            <p className="text-gray-500 text-sm">No workout data available</p>
          )}
        </div>

        {/* Workouts by Block */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          {stats?.workoutsByBlock && stats.workoutsByBlock.length > 0 ? (
            <SimpleBarChart
              data={stats.workoutsByBlock.map(b => ({ name: b.block, value: b.count }))}
              label="Workouts by Block Type"
            />
          ) : (
            <p className="text-gray-500 text-sm">No block data available</p>
          )}
        </div>
      </div>

      {/* Program Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Programs</h3>
        {stats?.topPrograms && stats.topPrograms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.topPrograms.map((program, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{program.name}</span>
                <span className="text-coral font-bold">{program.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No program data available</p>
        )}
      </div>

      {/* Average Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-coral">
              {stats?.avgWorkoutsPerUser?.toFixed(1) ?? '0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">Avg Workouts/User (30d)</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-coral">
              {stats?.activeUsersThisWeek ?? 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Active Users This Week</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-coral">
              {stats?.workoutsThisWeek && stats?.activeUsersThisWeek
                ? (stats.workoutsThisWeek / stats.activeUsersThisWeek).toFixed(1)
                : '0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">Avg Workouts/Active User (Week)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
