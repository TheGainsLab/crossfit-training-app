// components/TrainingChatInterface.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Message {
  id?: number
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  created_at?: string
  responseType?: string
}

interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
  chat_messages: Message[]
}

const TrainingChatInterface = ({ userId }: { userId: number }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [showConversations, setShowConversations] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Record<number, boolean>>({})
  const [lastRangeLabel, setLastRangeLabel] = useState<string | null>(null)
  // Persistent, explicit chat context (patternTerms are comma-separated OR terms)
  const [patternTerms, setPatternTerms] = useState<string[]>([])
  const [contextBlock, setContextBlock] = useState<string | null>(null)
  // Removed exercises/variant-family inference
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // --- Supabase singleton client + access token state ---
  const [token, setToken] = useState<string | null>(null)

  // Prime session and subscribe to changes
  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }: { data: { session: { access_token?: string } | null } }) => {
      if (!isMounted) return
      setToken(data.session?.access_token ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: { access_token?: string } | null) => {
      setToken(session?.access_token ?? null)
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch conversations once we have a token
  useEffect(() => {
    if (token) fetchConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Keep the list scrolled to bottom on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // No global exercises prefetch; chips derive only from table columns

  const fetchConversations = async () => {
    try {
      const response = await fetch(`/api/chat/${userId}/conversations`, {
credentials: 'include',      
  headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // <-- ADDED
        },
      })
      const data = await response.json()
      console.log('API Response:', data)

      if (data.success) {
        setConversations(data.conversations || [])

        if (data.conversations?.length > 0) {
          loadConversation(data.conversations[0])
        }
      } else {
        console.error('Conversations fetch failed:', data)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  const loadConversation = (conversation: Conversation) => {
    setActiveConversationId(conversation.id)

    setMessages(
      conversation.chat_messages?.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at || msg.timestamp || new Date().toISOString(),
      })) || []
    )
    setShowConversations(false)
  }

  const startNewConversation = () => {
    setActiveConversationId(null)
    setMessages([])
    setShowConversations(false)
  }

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    if (!token) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Please log in to use chat.',
          timestamp: new Date().toISOString(),
          responseType: 'error',
        },
      ])
      return
    }

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Optimistic render of user message
    const tempUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      // New typed query: reset entire context; chips will re-enable after explicit filter confirm
      setPatternTerms([])
      setContextBlock(null)
      setLastRangeLabel(null)

      const response = await fetch(`/api/chat/${userId}`, {
        method: 'POST',
  credentials: 'include',      
  headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // <-- ADDED
          ...(patternTerms.length ? { 'X-Pattern': patternTerms.join(',') } : {}),
          ...(getRangeToken() ? { 'X-Range': String(getRangeToken()) } : {}),
          ...(contextBlock ? { 'X-Block': String(contextBlock) } : {}),
          // Optional filters/modes can be attached by quick chips below
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: activeConversationId,
        }),
      })
      console.log('Response status:', response.status)
      const data = await response.json()

      // Rate limit
      if (response.status === 429) {
        const assistantMessage: Message = {
          role: 'assistant',
          content:
            (data && (data.message || data.error)) ||
            'You have reached the chat limit. Please try again later.',
          timestamp: new Date().toISOString(),
          responseType: 'error',
        }
        setMessages(prev => [...prev, assistantMessage])
        setLoading(false)
        return
      }

      if (data.success) {
        if (!activeConversationId) {
          setActiveConversationId(data.conversation_id)
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
          responseType: data.responseType,
        }
        setMessages(prev => [...prev, assistantMessage])

        if (data.responseType !== 'domain_guard') {
          if (data.coachAlertGenerated) {
            // optional toast/notification
          }
          fetchConversations()
        }
      } else {
        throw new Error(data.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content:
          'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date().toISOString(),
        responseType: 'error',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Send a quick follow-up without typing
  const withRange = (text: string) => (lastRangeLabel ? `${text} for ${lastRangeLabel.toLowerCase()}` : text)
  const getRangeToken = (): string | null => {
    const l = (lastRangeLabel || '').toLowerCase()
    if (!l) return null
    if (l.includes('7')) return 'last_7_days'
    if (l.includes('14')) return 'last_14_days'
    if (l.includes('30')) return 'last_30_days'
    if (l.includes('all')) return 'all_time'
    if (l.includes('week')) return 'this_week'
    return null
  }

  const getBlockFromMessage = (): string | null => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const t = (lastUser?.content || '').toUpperCase()
    const blocks = ['SKILLS','TECHNICAL WORK','STRENGTH AND POWER','ACCESSORIES','METCONS']
    for (const b of blocks) { if (t.includes(b)) return b }
    return null
  }

  const getLastUserText = (): string => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    return (lastUser?.content || '').toLowerCase()
  }
  // Build pattern terms from the user's last free-text message (explicitly applied)
  const derivePatternFromLastUserMessage = (): string | null => {
    const text = getLastUserText()
    if (!text) return null
    const stop: Record<string, true> = {
      how: true, many: true, times: true, have: true, done: true, do: true, did: true, the: true, and: true, or: true, for: true, my: true, so: true, far: true,
      of: true, to: true, in: true, on: true, by: true, with: true, this: true, that: true, these: true, those: true, what: true, why: true, when: true, where: true,
      is: true, are: true, was: true, were: true, been: true, be: true, i: true, me: true, you: true, we: true, they: true
    }
    const tokens = (text.match(/[a-z][a-z\-']{4,}/g) || []).filter(t => !stop[t as keyof typeof stop])
    if (!tokens.length) return null
    let candidate = tokens[tokens.length - 1]
    if (candidate.endsWith('s') && candidate.length > 4) {
      candidate = candidate.slice(0, -1)
    }
    return `%${candidate}%`
  }
  // Removed variant/family detection and suggestions

  const sendQuickQuery = async (text: string, actionName?: string, extraHeaders?: Record<string, string>) => {
    if (!text || loading) return
    if (!token) return
    setLoading(true)
    const tempUserMessage: Message = { role: 'user', content: text, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, tempUserMessage])
    try {
      const response = await fetch(`/api/chat/${userId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(actionName ? { 'X-Action-Name': actionName } : {}),
          ...(patternTerms.length ? { 'X-Pattern': patternTerms.join(',') } : {}),
          ...(getRangeToken() ? { 'X-Range': String(getRangeToken()) } : {}),
          ...(contextBlock ? { 'X-Block': String(contextBlock) } : {}),
          ...(extraHeaders || {}),
        },
        body: JSON.stringify({ message: text, conversation_id: activeConversationId })
      })
      const data = await response.json()
      if (data?.success) {
        if (!activeConversationId) setActiveConversationId(data.conversation_id)
        const assistantMessage: Message = { role: 'assistant', content: data.response, timestamp: new Date().toISOString(), responseType: data.responseType }
        setMessages(prev => [...prev, assistantMessage])
        if (data.responseType !== 'domain_guard') fetchConversations()
      } else {
        throw new Error(data?.error || 'Failed')
      }
    } catch (_e) {
      const errorMessage: Message = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date().toISOString(), responseType: 'error' }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (v: any) => {
    if (v === null || v === undefined || v === '') return ''
    const n = Number(v)
    if (!isNaN(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return String(v)
  }

  const getMessageStyle = (message: Message) => {
    if (message.role === 'user') {
      return 'bg-blue-600 text-white ml-auto'
    }
    switch (message.responseType) {
      case 'medical_referral':
        return 'bg-red-50 border border-red-200 text-red-800'
      case 'coach_escalation':
        return 'bg-yellow-50 border border-yellow-200 text-yellow-800'
      case 'error':
        return 'bg-red-50 border border-red-200 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getResponseTypeIcon = (responseType?: string) => {
    switch (responseType) {
      case 'medical_referral':
        return '🏥'
      case 'coach_escalation':
        return '👨‍🏫'
      case 'program_guidance':
        return '📋'
      case 'technique_advice':
        return '🎯'
      case 'nutrition_guidance':
        return '🥗'
      case 'recovery_advice':
        return '💤'
      case 'error':
        return '⚠️'
      default:
        return '💪'
    }
  }

  // Render assistant content with basic JSON-aware formatting for raw query results
  const renderAssistantContent = (message: Message, idx: number) => {
    if (message.role !== 'assistant') {
      return <div className="whitespace-pre-wrap">{message.content}</div>
    }
    try {
      const parsed = JSON.parse(message.content)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === 'object') {
        const block = parsed[0] as any
        const rows = Array.isArray(block.data) ? block.data : []
        // Zero-state UX when no rows
        if (rows.length === 0) {
          return (
            <div className="text-sm">
              <div className="text-gray-700">No results for this window.</div>
              <div className="text-gray-500 mb-2">Try a different range:</div>
              <div className="flex flex-wrap gap-2">
        {['Last 7 days', 'Last 14 days', 'Last 30 days', 'All time'].map(label => (
                  <button key={label} onClick={() => { setLastRangeLabel(label); sendQuickQuery(label, 'range_chip') }} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">
                    {label}
                  </button>
                ))}
              </div>
              {/* Offer explicit filter confirmation if not set */}
              {!patternTerms.length && (
                <div className="mt-3">
                  <div className="text-gray-500 mb-1">Set a filter:</div>
                  {(() => {
                    const candidate = derivePatternFromLastUserMessage()
                    if (!candidate) return null
                    const label = candidate.replace(/%/g, '')
                    return (
                      <button
                        className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700"
                        onClick={() => setPatternTerms([candidate])}
                      >
                        Use '{label}' as filter
                      </button>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        }

        // If rows include training_date, render date-grouped sessions
        if (rows.length > 0 && rows.some((r: any) => 'training_date' in r)) {
          // Group by date (string or Date)
          const byDate = new Map<string, Array<{ name: string; sets?: any; reps?: any; weight?: any }>>()
          for (const r of rows) {
            const dRaw = r.training_date
            const d = typeof dRaw === 'string' ? dRaw : (dRaw?.toString?.() || '')
            const name = String(r.exercise_name ?? '')
            const sets = r.sets
            const reps = r.reps
            const weight = r.weight_time
            if (!byDate.has(d)) byDate.set(d, [])
            byDate.get(d)!.push({ name, sets, reps, weight })
          }
          const orderedDates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1))
          const labelSuffix = ''
          return (
            <div className="text-sm">
              {orderedDates.map(date => (
                <div key={date} className="mb-3">
                  <div className="font-semibold">{date}</div>
                  <ul className="list-disc list-inside">
                    {(byDate.get(date) || []).map((it, i) => (
                      <li key={`${date}-${i}`}>
                        {it.name}
                        {/* Optionally show details if present */}
                        {it.reps ? ` — ${it.reps}` : ''}
                        {it.sets ? ` ${it.sets}` : ''}
                        {it.weight ? ` ${it.weight}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {/* Refinement-only chips (mode only, context persists). Disable if filter not confirmed */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button disabled={!patternTerms.length} className={`px-2 py-1 rounded border ${patternTerms.length ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`} onClick={() => sendQuickQuery(withRange('By block'), 'chip_individual_blocks', { 'X-Mode': 'by_block' })}>Individual Blocks</button>
                <button disabled={!patternTerms.length} className={`px-2 py-1 rounded border ${patternTerms.length ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`} onClick={() => sendQuickQuery(withRange('Total reps'), 'chip_total_reps', { 'X-Mode': 'total_reps' })}>Total Reps</button>
                <button disabled={!patternTerms.length} className={`px-2 py-1 rounded border ${patternTerms.length ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`} onClick={() => sendQuickQuery(withRange('Avg RPE'), 'chip_avg_rpe', { 'X-Mode': 'avg_rpe' })}>Avg RPE</button>
              </div>
            </div>
          )
        }
        const renderActionBar = () => {
          const candidate = derivePatternFromLastUserMessage()
          const disabled = !patternTerms.length
          return (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {disabled && candidate && (
              <button
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700"
                onClick={() => setPatternTerms([candidate])}
              >
                Use '{candidate.replace(/%/g, '')}' as filter
              </button>
            )}
            <button disabled={disabled} className={`px-2 py-1 rounded border ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => sendQuickQuery(withRange('By block'), 'chip_individual_blocks', { 'X-Mode': 'by_block' })}>Individual Blocks</button>
            <button disabled={disabled} className={`px-2 py-1 rounded border ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => sendQuickQuery(withRange('Total reps'), 'chip_total_reps', { 'X-Mode': 'total_reps' })}>Total Reps</button>
            <button disabled={disabled} className={`px-2 py-1 rounded border ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => sendQuickQuery(withRange('Avg RPE'), 'chip_avg_rpe', { 'X-Mode': 'avg_rpe' })}>Avg RPE</button>
          </div>
          )
        }

        // If it's a list with exercise_name plus aggregates (avg_rpe, total_reps)
        if (rows.length > 0 && rows.every((r: any) => r && typeof r === 'object' && 'exercise_name' in r)) {
          const hasAvgRpe = rows.some((r: any) => 'avg_rpe' in r)
          const hasTotalReps = rows.some((r: any) => 'total_reps' in r)
          const hasSessions = rows.some((r: any) => ('session_count' in r) || ('sessions' in r))

          if (hasAvgRpe || hasTotalReps || hasSessions) {
            const topN = 10
            const expanded = !!expandedMessages[idx]
            const displayRows = expanded ? rows : rows.slice(0, topN)
            return (
              <div>
                <ul className="list-disc list-inside">
                  {displayRows.map((r: any, ridx: number) => {
                    const name = String(r.exercise_name ?? '')
                    const repsStr = (hasTotalReps && r.total_reps !== undefined && r.total_reps !== null) ? `: ${r.total_reps} reps` : ''
                    const rpeStr = (hasAvgRpe && r.avg_rpe !== undefined && r.avg_rpe !== null) ? `: ${r.avg_rpe} RPE` : ''
                    const sessionVal = r.session_count ?? r.sessions
                    const sessionsStr = (sessionVal !== undefined && sessionVal !== null) ? ` (${sessionVal} sessions)` : ''
                    return (
                      <li key={ridx}>
                        {`${name}${repsStr}${rpeStr}${sessionsStr}`}
                      </li>
                    )
                  })}
                </ul>
                {rows.length > topN && (
                  <button onClick={() => setExpandedMessages(s => ({ ...s, [idx]: !expanded }))} className="mt-2 text-xs text-blue-600 hover:underline">
                    {expanded ? 'Show less' : `Show all (${rows.length})`}
                  </button>
                )}
                {renderActionBar()}
              </div>
            )
          }

          // Otherwise, render just the names
          const hasBlock = rows.some((r: any) => 'block' in r)
          if (hasBlock) {
            const groups = new Map<string, Set<string>>()
            for (const r of rows) {
              const b = String(r.block ?? '').trim() || 'UNKNOWN'
              const n = String(r.exercise_name ?? '').trim()
              if (!n) continue
              if (!groups.has(b)) groups.set(b, new Set<string>())
              groups.get(b)!.add(n)
            }
            const orderedBlocks = Array.from(groups.keys())
            return (
              <div>
                {orderedBlocks.map(blockName => (
                  <div key={blockName} className="mb-2">
                    <div className="font-semibold">{blockName}</div>
                    <ul className="list-disc list-inside">
                      {Array.from(groups.get(blockName) || []).map((n: string) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {renderActionBar()}
              </div>
            )
          } else {
            const names = rows.map((r: any) => String(r.exercise_name)).filter(Boolean)
            return (
              <div>
                <ul className="list-disc list-inside">
                  {names.map((n: string) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                {renderActionBar()}
              </div>
            )
          }
        }
        // If single-metric rows (e.g., [{ unique_exercises: 41 }]) render stat cards
        if (rows.length && rows.every((r: any) => r && typeof r === 'object')) {
          const keys = Object.keys(rows[0] || {})
          if (keys.length === 1 && rows.length <= 3) {
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {rows.map((r: any, i: number) => {
                  const k = Object.keys(r)[0]
                  const v = r[k]
                  const label = k.replace(/_/g, ' ')
                  return (
                    <div key={i} className="p-3 border rounded bg-white">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-lg font-semibold">{formatNumber(v)}</div>
                    </div>
                  )
                })}
                <div className="col-span-full">{renderActionBar()}</div>
              </div>
            )
          }
          // Generic table fallback
          const columns: string[] = Array.from(new Set(rows.flatMap((r: any) => Object.keys(r)))) as string[]
          const topN = 10
          const expanded = !!expandedMessages[idx]
          const displayRows = expanded ? rows : rows.slice(0, topN)
          return (
            <div className="overflow-x-auto text-sm">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map((c: string) => (
                      <th key={String(c)} className="text-left p-2 border-b capitalize">{String(c).replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r: any, i: number) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      {columns.map((c: string) => (
                        <td key={String(c)} className="p-2 border-b">{formatNumber((r as any)[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > topN && (
                <button onClick={() => setExpandedMessages(s => ({ ...s, [idx]: !expanded }))} className="mt-2 text-xs text-blue-600 hover:underline">
                  {expanded ? 'Show less' : `Show all (${rows.length})`}
                </button>
              )}
            </div>
          )
        }
        return <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(block.data ?? parsed, null, 2)}</pre>
      }
      // If parsed is not the expected structure, fall back to raw
      return <pre className="whitespace-pre-wrap text-sm">{message.content}</pre>
    } catch {
      return <div className="whitespace-pre-wrap">{message.content}</div>
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">🤖</div>
          <div>
            <h3 className="font-semibold text-gray-900">Training Assistant</h3>
            <p className="text-sm text-gray-600">Ask me anything about your training</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setShowConversations(!showConversations)}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            title="View conversations"
          >
            📝
          </button>
          <button
            onClick={startNewConversation}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            title="New conversation"
          >
            ➕
          </button>
        </div>
      </div>

      {/* Conversations Sidebar */}
      {showConversations && (
        <div className="border-b bg-gray-50 p-4 max-h-32 overflow-y-auto">
          <h4 className="font-medium text-gray-900 mb-2">Recent Conversations</h4>
          <div className="space-y-1">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`w-full text-left p-2 text-sm rounded hover:bg-gray-100 ${
                  activeConversationId === conv.id
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-gray-700'
                }`}
              >
                <div className="font-medium truncate">{conv.title}</div>
                <div className="text-xs text-gray-500">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">💬</div>
            <h4 className="font-medium text-gray-900 mb-2">Start a conversation!</h4>
            <p className="text-sm">
              Ask me about your workouts, form, nutrition, or any training questions.
            </p>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-gray-700">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "How's my squat progression?",
                  "Why was today's workout so hard?",
                  'Should I modify my program?',
                  'How can I improve my recovery?',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-lg ${getMessageStyle(message)}`}>
              {message.role === 'assistant' && message.responseType && (
                <div className="flex items-center space-x-1 mb-2 text-xs opacity-75">
                  <span>{getResponseTypeIcon(message.responseType)}</span>
                  <span className="capitalize">{message.responseType.replace('_', ' ')}</span>
                </div>
              )}

              {renderAssistantContent(message, index)}

              <div className="text-xs opacity-75 mt-2">
                {new Date(message.timestamp || new Date()).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full animate-bounce bg-gray-500"></div>
                  <div
                    className="w-2 h-2 rounded-full animate-bounce bg-gray-500"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full animate-bounce bg-gray-500"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your training..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading || !token} // <-- disable until token exists
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !token} // <-- disable until token exists
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>

        {!token ? (
          <p className="text-xs text-red-600 mt-2">
            Please log in to use chat.
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-2">
            I have access to your complete training history and can provide personalized advice.
          </p>
        )}
      </div>
    </div>
  )
}

export default TrainingChatInterface

