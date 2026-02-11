'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, User, MessageSquare, ChevronDown, ChevronUp, RefreshCw, Search, X, Filter } from 'lucide-react'

interface BlockDetail {
  blockName: string
  exercises: string[]
}

interface ActivityItem {
  id: string
  userId: number
  userName: string | null
  userEmail: string | null
  userTier: string | null
  timestamp: string
  week: number
  day: number
  blocks: BlockDetail[]
  summary: string
}

interface UserSearchResult {
  id: number
  name: string | null
  email: string | null
  subscription_tier: string | null
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) {
    return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else {
    return `${diffDays}d ago`
  }
}

function getTierColor(tier: string | null): string {
  switch (tier?.toUpperCase()) {
    case 'BTN':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'ENGINE':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'APPLIED_POWER':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'PREMIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'FULL-PROGRAM':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

function getBlockColor(blockName: string): string {
  switch (blockName) {
    case 'SKILLS':
      return 'text-blue-700 bg-blue-50'
    case 'TECHNICAL WORK':
      return 'text-cyan-700 bg-cyan-50'
    case 'STRENGTH AND POWER':
      return 'text-red-700 bg-red-50'
    case 'ACCESSORIES':
      return 'text-orange-700 bg-orange-50'
    case 'ENGINE':
      return 'text-green-700 bg-green-50'
    case 'METCON':
      return 'text-purple-700 bg-purple-50'
    default:
      return 'text-gray-700 bg-gray-50'
  }
}

function ActivityRow({ item, onSendNote, onFilterUser }: { item: ActivityItem; onSendNote: (item: ActivityItem) => void; onFilterUser: (userId: number) => void }) {
  const [expanded, setExpanded] = useState(false)

  const totalExercises = item.blocks.reduce((sum, b) => sum + b.exercises.length, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* User Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-gray-100 rounded-full">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">
                {item.userName || 'Unknown User'}
              </span>
              {item.userTier && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getTierColor(item.userTier)}`}>
                  {item.userTier}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">{item.userEmail}</p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1 text-sm text-gray-500 whitespace-nowrap">
          <Clock className="w-4 h-4" />
          {formatTimeAgo(item.timestamp)}
        </div>
      </div>

      {/* Training Day Summary */}
      <div className="mt-3 pl-10">
        <p className="text-sm font-semibold text-gray-900">
          Week {item.week}, Day {item.day}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {item.blocks.map((block) => (
            <span
              key={block.blockName}
              className={`px-2 py-0.5 text-xs font-medium rounded ${getBlockColor(block.blockName)}`}
            >
              {block.blockName}
            </span>
          ))}
        </div>

        {/* Expandable Details */}
        {totalExercises > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide details' : `Show details (${totalExercises} item${totalExercises > 1 ? 's' : ''})`}
            </button>
            {expanded && (
              <div className="mt-2 space-y-3">
                {item.blocks.map((block) => (
                  <div key={block.blockName}>
                    <p className={`text-xs font-semibold mb-1 ${getBlockColor(block.blockName).split(' ')[0]}`}>
                      {block.blockName}
                    </p>
                    <ul className="space-y-0.5">
                      {block.exercises.map((exercise, i) => (
                        <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-200">
                          {exercise}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 pl-10 flex gap-2">
        <button
          onClick={() => onSendNote(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-coral bg-coral/10 rounded-lg hover:bg-coral/20 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Send Note
        </button>
        <button
          onClick={() => onFilterUser(item.userId)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filter to this user
        </button>
        <Link
          href={`/dashboard/admin/users/${item.userId}`}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          View Profile
        </Link>
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [tierFilter, setTierFilter] = useState('')
  const [blockFilter, setBlockFilter] = useState('')
  const [userFilter, setUserFilter] = useState<number | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [selectedUserInfo, setSelectedUserInfo] = useState<UserSearchResult | null>(null)
  const [noteModal, setNoteModal] = useState<ActivityItem | null>(null)
  const [noteText, setNoteText] = useState('')

  const fetchActivity = async () => {
    setLoading(true)
    try {
      let url = `/api/admin/activity?hours=${hours}`
      if (tierFilter) {
        url += `&tier=${tierFilter}`
      }
      if (blockFilter) {
        url += `&block=${blockFilter}`
      }
      if (userFilter) {
        url += `&userId=${userFilter}`
      }
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setActivity(data.activity)
      }
    } catch (err) {
      console.error('Failed to fetch activity:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivity()
  }, [hours, tierFilter, blockFilter, userFilter])

  // Debounced user search
  useEffect(() => {
    if (userSearchQuery.length < 2) {
      setUserSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(userSearchQuery)}`)
        const data = await res.json()
        if (data.success) {
          setUserSearchResults(data.users || [])
          setShowSearchDropdown(true)
        }
      } catch (err) {
        console.error('Failed to search users:', err)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [userSearchQuery])

  const handleSelectUser = (user: UserSearchResult) => {
    setUserFilter(user.id)
    setSelectedUserInfo(user)
    setUserSearchQuery('')
    setShowSearchDropdown(false)
  }

  const handleClearUserFilter = () => {
    setUserFilter(null)
    setSelectedUserInfo(null)
    setUserSearchQuery('')
  }

  const handleFilterToUser = (userId: number) => {
    const userActivity = activity.find(a => a.userId === userId)
    if (userActivity) {
      setUserFilter(userId)
      setSelectedUserInfo({
        id: userId,
        name: userActivity.userName,
        email: userActivity.userEmail,
        subscription_tier: userActivity.userTier
      })
    } else {
      setUserFilter(userId)
    }
  }

  const handleSendNote = (item: ActivityItem) => {
    setNoteModal(item)
    setNoteText('')
  }

  const [sendingNote, setSendingNote] = useState(false)
  const [noteSuccess, setNoteSuccess] = useState(false)

  const submitNote = async () => {
    if (!noteModal || !noteText.trim() || sendingNote) return

    setSendingNote(true)
    setNoteSuccess(false)

    try {
      const res = await fetch('/api/admin/chat/send-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: noteModal.userId,
          content: noteText.trim(),
          context: noteModal.summary
        })
      })

      const data = await res.json()

      if (data.success) {
        setNoteSuccess(true)
        setTimeout(() => {
          setNoteModal(null)
          setNoteText('')
          setNoteSuccess(false)
        }, 1500)
      } else {
        alert(`Failed to send note: ${data.error}`)
      }
    } catch (err) {
      console.error('Error sending note:', err)
      alert('Failed to send note. Please try again.')
    } finally {
      setSendingNote(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity Feed</h2>
          <p className="text-gray-500 mt-1">Recent training day completions from your athletes</p>
        </div>
        <button
          onClick={fetchActivity}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={hours}
          onChange={(e) => setHours(parseInt(e.target.value))}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50"
        >
          <option value={24}>Last 24 hours</option>
          <option value={48}>Last 48 hours</option>
          <option value={168}>Last 7 days</option>
          <option value={720}>Last 30 days</option>
          <option value={87600}>All time</option>
        </select>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50"
        >
          <option value="">All Programs</option>
          <option value="BTN">BTN</option>
          <option value="ENGINE">Engine</option>
          <option value="APPLIED_POWER">Applied Power</option>
          <option value="PREMIUM">Premium</option>
          <option value="FULL-PROGRAM">Full Program</option>
        </select>

        <select
          value={blockFilter}
          onChange={(e) => setBlockFilter(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50"
        >
          <option value="">All Blocks</option>
          <option value="SKILLS">Skills</option>
          <option value="TECHNICAL WORK">Technical Work</option>
          <option value="STRENGTH AND POWER">Strength & Power</option>
          <option value="ACCESSORIES">Accessories</option>
          <option value="METCON">MetCon</option>
          <option value="ENGINE">Engine</option>
        </select>

        {/* User Search */}
        <div className="relative flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              onFocus={() => userSearchResults.length > 0 && setShowSearchDropdown(true)}
              placeholder="Search users by name or email..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50"
            />
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && userSearchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              {userSearchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {user.name || 'Unknown User'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                  {user.subscription_tier && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getTierColor(user.subscription_tier)}`}>
                      {user.subscription_tier}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center text-sm text-gray-500">
          {activity.length} training day{activity.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Active User Filter Banner */}
      {selectedUserInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-900">
              Filtering by user: <strong>{selectedUserInfo.name || selectedUserInfo.email}</strong>
            </span>
            {selectedUserInfo.subscription_tier && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getTierColor(selectedUserInfo.subscription_tier)}`}>
                {selectedUserInfo.subscription_tier}
              </span>
            )}
          </div>
          <button
            onClick={handleClearUserFilter}
            className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {/* Activity List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-32 animate-pulse" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">No recent activity</h3>
          <p className="text-gray-500 mt-1">No workouts completed in the selected timeframe</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((item) => (
            <ActivityRow key={item.id} item={item} onSendNote={handleSendNote} onFilterUser={handleFilterToUser} />
          ))}
        </div>
      )}

      {/* Send Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {noteSuccess ? (
              <div className="text-center py-4">
                <p className="text-lg font-medium text-gray-900">Note Sent!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {noteModal.userName} will see this in their messages
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Send Note</h3>
                <p className="text-sm text-gray-500 mb-4">
                  To: {noteModal.userName} ({noteModal.userEmail})
                </p>
                <p className="text-xs text-gray-400 mb-3 p-2 bg-gray-50 rounded">
                  Re: {noteModal.summary}
                </p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Great work on those squats! Keep it up..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50 resize-none"
                  rows={4}
                  autoFocus
                  disabled={sendingNote}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => setNoteModal(null)}
                    disabled={sendingNote}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitNote}
                    disabled={!noteText.trim() || sendingNote}
                    className="px-4 py-2 text-sm font-medium text-white bg-coral rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sendingNote ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Note'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
