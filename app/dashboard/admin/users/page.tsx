'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  X,
  RefreshCw,
  ArrowUpDown
} from 'lucide-react'

interface UserData {
  id: number
  email: string
  name: string | null
  role: string
  subscription_tier: string | null
  subscription_status: string | null
  created_at: string
  last_activity: string | null
  days_since_activity: number | null
  workouts_30d: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
  { value: 'past_due', label: 'Past Due' },
]

const TIER_OPTIONS = [
  { value: 'ENGINE', label: 'ENGINE' },
  { value: 'BTN', label: 'BTN' },
  { value: 'PREMIUM', label: 'PREMIUM' },
  { value: 'APPLIED_POWER', label: 'APPLIED_POWER' },
]

const ACTIVITY_OPTIONS = [
  { value: '7', label: '< 7d' },
  { value: '7-14', label: '7\u201314d' },
  { value: '14-30', label: '14\u201330d' },
  { value: '30', label: '30d+' },
]

const ROLE_OPTIONS = [
  { value: 'athlete', label: 'Athlete' },
  { value: 'coach', label: 'Coach' },
  { value: 'admin', label: 'Admin' },
]

function ChipGroup({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-400 font-medium w-14 shrink-0">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-coral text-white'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
    trialing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Trial' },
    canceled: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Canceled' },
    expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' },
    past_due: { bg: 'bg-red-100', text: 'text-red-700', label: 'Past Due' },
  }

  const config = status ? statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status } : { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Free' }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-gray-400 text-sm">-</span>

  const tierConfig: Record<string, { bg: string; text: string }> = {
    ENGINE: { bg: 'bg-purple-100', text: 'text-purple-700' },
    BTN: { bg: 'bg-coral/10', text: 'text-coral' },
    PREMIUM: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    APPLIED_POWER: { bg: 'bg-orange-100', text: 'text-orange-700' },
    FREE: { bg: 'bg-gray-100', text: 'text-gray-600' },
  }

  const config = tierConfig[tier] || { bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {tier}
    </span>
  )
}

function ActivityBadge({ daysSince }: { daysSince: number | null }) {
  if (daysSince === null) {
    return <span className="text-gray-400 text-sm">Never</span>
  }

  let config = { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' }

  if (daysSince > 30) {
    config = { bg: 'bg-red-200', text: 'text-red-800', label: `${daysSince}d ago` }
  } else if (daysSince > 14) {
    config = { bg: 'bg-red-100', text: 'text-red-700', label: `${daysSince}d ago` }
  } else if (daysSince > 7) {
    config = { bg: 'bg-yellow-100', text: 'text-yellow-700', label: `${daysSince}d ago` }
  } else if (daysSince > 0) {
    config = { bg: 'bg-green-100', text: 'text-green-700', label: `${daysSince}d ago` }
  } else {
    config = { bg: 'bg-green-100', text: 'text-green-700', label: 'Today' }
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function AdminUsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [users, setUsers] = useState<UserData[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search: input tracks keystrokes, searchTerm is applied on submit
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')

  // Filter chips
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [tierFilter, setTierFilter] = useState(searchParams.get('tier') || '')
  const [activityFilter, setActivityFilter] = useState(searchParams.get('activity') || '')
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')

  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchUsers = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '25')
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter) params.set('status', statusFilter)
      if (tierFilter) params.set('tier', tierFilter)
      if (activityFilter) params.set('activity', activityFilter)
      if (roleFilter) params.set('role', roleFilter)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)

      const res = await fetch(`/api/admin/users/list?${params.toString()}`)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      setUsers(data.users)
      setPagination(data.pagination)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter, tierFilter, activityFilter, roleFilter, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers(1)
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchTerm(searchInput)
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearchTerm('')
    setStatusFilter('')
    setTierFilter('')
    setActivityFilter('')
    setRoleFilter('')
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const hasActiveFilters = searchTerm || statusFilter || tierFilter || activityFilter || roleFilter

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users & Subscriptions</h2>
          <p className="text-gray-500 mt-1">
            {pagination.total} total users
          </p>
        </div>
        <button
          onClick={() => fetchUsers(1)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filter chip groups */}
        <div className="space-y-2">
          {hasActiveFilters && (
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            </div>
          )}
          <ChipGroup label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <ChipGroup label="Tier" options={TIER_OPTIONS} value={tierFilter} onChange={setTierFilter} />
          <ChipGroup label="Activity" options={ACTIVITY_OPTIONS} value={activityFilter} onChange={setActivityFilter} />
          <ChipGroup label="Role" options={ROLE_OPTIONS} value={roleFilter} onChange={setRoleFilter} />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    User
                    {sortBy === 'name' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('subscription_status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortBy === 'subscription_status' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('subscription_tier')}
                >
                  <div className="flex items-center gap-1">
                    Tier
                    {sortBy === 'subscription_tier' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('days_since_activity')}
                >
                  <div className="flex items-center gap-1">
                    Last Active
                    {sortBy === 'days_since_activity' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('workouts_30d')}
                >
                  <div className="flex items-center gap-1">
                    Workouts (30d)
                    {sortBy === 'workouts_30d' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1">
                    Joined
                    {sortBy === 'created_at' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4">
                      <div className="h-4 bg-gray-200 rounded w-48" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-6 bg-gray-200 rounded w-16" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-6 bg-gray-200 rounded w-20" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-6 bg-gray-200 rounded w-16" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 bg-gray-200 rounded w-8" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/admin/users/${user.id}`)}
                  >
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
                      <StatusBadge status={user.subscription_status} />
                    </td>
                    <td className="px-4 py-4">
                      <TierBadge tier={user.subscription_tier} />
                    </td>
                    <td className="px-4 py-4">
                      <ActivityBadge daysSince={user.days_since_activity} />
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {user.workouts_30d}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
