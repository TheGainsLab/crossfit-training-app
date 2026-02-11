'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Dumbbell,
  Upload,
  ArrowRight
} from 'lucide-react'

interface QuickStats {
  subscriptions: {
    active: number
    trial: number
    canceled: number
    expired: number
  }
}

interface ProgramData {
  name: string
  count: number
}

function QuickLink({
  href,
  icon: Icon,
  label,
  description
}: {
  href: string
  icon: any
  label: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md hover:border-coral/30 transition-all group"
    >
      <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-coral/10 transition-colors">
        <Icon className="w-6 h-6 text-gray-600 group-hover:text-coral transition-colors" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-gray-900">{label}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-coral transition-colors" />
    </Link>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
  }

  return (
    <div className={`px-4 py-3 rounded-lg min-w-[120px] text-center ${colorClasses[color]}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-sm ml-1">{label}</span>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [programs, setPrograms] = useState<ProgramData[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const [subsRes, trainingRes] = await Promise.all([
          fetch('/api/admin/subscriptions/stats'),
          fetch('/api/admin/training/analytics')
        ])

        const subsData = await subsRes.json()
        const trainingData = await trainingRes.json()

        if (subsData.success) {
          setStats({
            subscriptions: subsData.stats
          })
        }

        if (trainingData.success && trainingData.stats?.topPrograms) {
          setPrograms(trainingData.stats.topPrograms)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-8">
      {/* Quick Stats Row */}
      {!loading && stats && (
        <div className="flex flex-wrap gap-3">
          <StatBadge label="Active" value={stats.subscriptions.active} color="green" />
          <StatBadge label="Trial" value={stats.subscriptions.trial} color="blue" />
          <StatBadge label="Expired" value={stats.subscriptions.expired} color="yellow" />
          <StatBadge label="Canceled" value={stats.subscriptions.canceled} color="red" />
        </div>
      )}

      {/* Active Programs */}
      {!loading && programs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Subscriptions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {programs.map((program, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{program.name}</span>
                <span className="text-coral font-bold">{program.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Navigation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickLink
            href="/dashboard/admin/users"
            icon={Users}
            label="Users & Subscriptions"
            description="Search users, filter by status, tier, and engagement"
          />
          <QuickLink
            href="/dashboard/admin/training"
            icon={Dumbbell}
            label="Training Analytics"
            description="View workout stats and training data"
          />
          <QuickLink
            href="/dashboard/admin/metcons-import"
            icon={Upload}
            label="Import MetCons"
            description="Bulk import MetCon workouts via CSV"
          />
          <QuickLink
            href="/dashboard/admin/workouts-import"
            icon={Upload}
            label="Import Competition Workouts"
            description="Bulk import competition workouts via CSV"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-lg w-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
