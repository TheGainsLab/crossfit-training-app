'use client'

import { useEffect, useState } from 'react'
import { Clock, User, MessageSquare, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'btn' | 'engine'
  userId: number
  userName: string | null
  userEmail: string | null
  userTier: string | null
  timestamp: string
  block: string | null
  summary: string
  details: string[]
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

function ActivityRow({ item, onSendNote }: { item: ActivityItem; onSendNote: (item: ActivityItem) => void }) {
  const [expanded, setExpanded] = useState(false)

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

      {/* Workout Summary */}
      <div className="mt-3 pl-10">
        <p className="text-sm font-medium text-gray-800">{item.summary}</p>

        {/* Expandable Details */}
        {item.details.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide details' : `Show ${item.details.length} exercise${item.details.length > 1 ? 's' : ''}`}
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1">
                {item.details.map((detail, i) => (
                  <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-200">
                    {detail}
                  </li>
                ))}
              </ul>
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
        <a
          href={`/dashboard/admin/users/${item.userId}`}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          View Profile
        </a>
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [tierFilter, setTierFilter] = useState('')
  const [noteModal, setNoteModal] = useState<ActivityItem | null>(null)
  const [noteText, setNoteText] = useState('')

  const fetchActivity = async () => {
    setLoading(true)
    try {
      let url = `/api/admin/activity?hours=${hours}`
      if (tierFilter) {
        url += `&tier=${tierFilter}`
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
  }, [hours, tierFilter])

  const handleSendNote = (item: ActivityItem) => {
    setNoteModal(item)
    setNoteText('')
  }

  const submitNote = async () => {
    if (!noteModal || !noteText.trim()) return

    // TODO: Implement actual note sending (could use existing chat system)
    console.log('Sending note to user:', noteModal.userId, noteText)
    alert(`Note would be sent to ${noteModal.userName}: "${noteText}"`)

    setNoteModal(null)
    setNoteText('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity Feed</h2>
          <p className="text-gray-500 mt-1">Recent workout completions from your athletes</p>
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

        <div className="flex items-center text-sm text-gray-500">
          {activity.length} activit{activity.length === 1 ? 'y' : 'ies'}
        </div>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-32 animate-pulse" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900">No recent activity</h3>
          <p className="text-gray-500 mt-1">No workouts completed in the selected timeframe</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((item) => (
            <ActivityRow key={item.id} item={item} onSendNote={handleSendNote} />
          ))}
        </div>
      )}

      {/* Send Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
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
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setNoteModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitNote}
                disabled={!noteText.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-coral rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
