'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  TrendingUp,
  Users,
  Dumbbell,
} from 'lucide-react'

type TimeRange = '7d' | '1m' | '3m' | '1y' | 'all'

interface TrainingStats {
  totalWorkouts: number
  workoutsInRange: number
  activeUsersInRange: number
  avgWorkoutsPerUser: number
  topPrograms: { name: string; count: number }[]
  workoutsByBlock: { block: string; count: number }[]
  dailyWorkouts: { date: string; count: number }[]
  range: string
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

function WorkoutActivityChart({
  data,
  range,
  workoutsInRange,
  activeUsersInRange,
  onRangeChange
}: {
  data: { date: string; count: number }[]
  range: TimeRange
  workoutsInRange: number
  activeUsersInRange: number
  onRangeChange: (range: TimeRange) => void
}) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  const rangeOptions: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7D' },
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'All' },
  ]

  const getRangeLabel = (r: TimeRange) => {
    switch (r) {
      case '7d': return 'Last 7 Days'
      case '1m': return 'Last 30 Days'
      case '3m': return 'Last 3 Months'
      case '1y': return 'Last Year'
      case 'all': return 'All Time'
      default: return 'Last 7 Days'
    }
  }

  const formatDateLabel = (dateStr: string) => {
    if (range === 'all') {
      // Format as "Jan 2024"
      const [year, month] = dateStr.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    } else if (range === '3m' || range === '1y') {
      // Format as "Jan 15"
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      // Format as "Jan 15"
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      {/* Header with title and range toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Workout Activity</h4>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onRangeChange(option.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                range === option.value
                  ? 'bg-white text-coral shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-3">
        <p className="text-sm text-gray-500">{getRangeLabel(range)}</p>
        {data.length > 0 ? (
          <div className="flex items-end gap-1 h-40">
            {data.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-coral/80 rounded-t transition-all hover:bg-coral cursor-pointer"
                  style={{
                    height: `${(day.count / maxCount) * 100}%`,
                    minHeight: day.count > 0 ? '4px' : '0'
                  }}
                  title={`${formatDateLabel(day.date)}: ${day.count} workouts`}
                />
                {/* Only show every nth label to avoid crowding */}
                {(data.length <= 14 || i % Math.ceil(data.length / 10) === 0) && (
                  <span className="text-xs text-gray-400 -rotate-45 origin-left whitespace-nowrap">
                    {formatDateLabel(day.date)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <p className="text-gray-400">No workout data available</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-coral/10 rounded-lg">
              <Dumbbell className="w-5 h-5 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{workoutsInRange.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Workouts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeUsersInRange}</p>
              <p className="text-sm text-gray-500">Active Users</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminTrainingPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<TrainingStats | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')

  const fetchStats = async (range: TimeRange) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/training/analytics?range=${range}`)
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

  useEffect(() => {
    fetchStats(timeRange)
  }, [timeRange])

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range)
  }

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="bg-white rounded-lg border p-5 h-80" />
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

      {/* Consolidated Workout Activity Chart */}
      <WorkoutActivityChart
        data={stats?.dailyWorkouts ?? []}
        range={timeRange}
        workoutsInRange={stats?.workoutsInRange ?? 0}
        activeUsersInRange={stats?.activeUsersInRange ?? 0}
        onRangeChange={handleRangeChange}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workouts by Block */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          {stats?.workoutsByBlock && stats.workoutsByBlock.length > 0 ? (
            <SimpleBarChart
              data={stats.workoutsByBlock.map(b => ({ name: b.block, value: b.count }))}
              label="Workouts by Block Type (Last 30 Days)"
            />
          ) : (
            <p className="text-gray-500 text-sm">No block data available</p>
          )}
        </div>

        {/* Engagement Metrics */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Engagement Metrics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-coral">
                {stats?.avgWorkoutsPerUser?.toFixed(1) ?? '0'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Avg Workouts/User (30d)</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-coral">
                {stats?.workoutsInRange && stats?.activeUsersInRange
                  ? (stats.workoutsInRange / stats.activeUsersInRange).toFixed(1)
                  : '0'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Avg Workouts/Active User</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg col-span-2">
              <p className="text-2xl font-bold text-coral">
                {stats?.totalWorkouts?.toLocaleString() ?? '0'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total Workouts (All Time)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
