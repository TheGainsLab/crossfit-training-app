'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Calendar,
  Activity,
  X
} from 'lucide-react'

interface UserData {
  id: number
  email: string
  name: string | null
  role: string
  ability_level: string | null
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

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [tierFilter, setTierFilter] = useState(searchParams.get('tier') || '')
  const [activityFilter, setActivityFilter] = useState(searchParams.get('activity') || '')
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')
  const [showFilters, setShowFilters] = useState(false)

  const fetchUsers = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '25')
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (tierFilter) params.set('tier', tierFilter)
      if (activityFilter) params.set('activity', activityFilter)
      if (roleFilter) params.set('role', roleFilter)

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
  }, [search, statusFilter, tierFilter, activityFilter, roleFilter])

  useEffect(() => {
    fetchUsers(1)
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(1)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setTierFilter('')
    setActivityFilter('')
    setRoleFilter('')
  }

  const hasActiveFilters = search || statusFilter || tierFilter || activityFilter || roleFilter

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-500 mt-1">
            {pagination.total} total users
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              hasActiveFilters ? 'border-coral text-coral bg-coral/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-coral text-white text-xs px-1.5 py-0.5 rounded-full">
                {[statusFilter, tierFilter, activityFilter, roleFilter].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/20"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="canceled">Canceled</option>
                  <option value="expired">Expired</option>
                  <option value="past_due">Past Due</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/20"
                >
                  <option value="">All Tiers</option>
                  <option value="ENGINE">ENGINE</option>
                  <option value="BTN">BTN</option>
                  <option value="PREMIUM">PREMIUM</option>
                  <option value="APPLIED_POWER">APPLIED_POWER</option>
                  <option value="FREE">FREE</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/20"
                >
                  <option value="">All Activity</option>
                  <option value="7">Active (last 7 days)</option>
                  <option value="7-14">Warning (7-14 days)</option>
                  <option value="14-30">At Risk (14-30 days)</option>
                  <option value="30">Critical (30+ days)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/20"
                >
                  <option value="">All Roles</option>
                  <option value="athlete">Athlete</option>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workouts (30d)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
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
                      {new Date(user.created_at).toLocaleDateString()}
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
