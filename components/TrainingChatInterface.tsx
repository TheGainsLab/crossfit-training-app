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
  const [currentMode, setCurrentMode] = useState<'count'|'by_block'|'total_reps'|'avg_rpe'|'sessions'|'by_time_domain'|'avg_percentile'|'best_scores'>('count')
  const [domain, setDomain] = useState<'logs'|'metcons'>('logs')
  const [timeDomains, setTimeDomains] = useState<string[]>([])
  const [equipments, setEquipments] = useState<string[]>([])
  const [level, setLevel] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState<boolean>(false)
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
      setCurrentMode('count')
      setTimeDomains([])
      setEquipments([])
      setLevel(null)

      const response = await fetch(`/api/chat/${userId}`, {
        method: 'POST',
  credentials: 'include',      
  headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // <-- ADDED
          ...(patternTerms.length ? { 'X-Pattern': patternTerms.join(',') } : {}),
          ...(getRangeToken() ? { 'X-Range': String(getRangeToken()) } : {}),
          ...(contextBlock ? { 'X-Block': String(contextBlock) } : {}),
          'X-Domain': domain,
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

        // Apply AI-returned context to drive chips deterministically
        if (data?.context && typeof data.context === 'object') {
          const ctx = data.context as any
          // Domain
          if (ctx.domain === 'metcons' || ctx.domain === 'logs') {
            setDomain(ctx.domain)
            setCurrentMode(ctx.domain === 'metcons' ? 'sessions' : 'count')
            // Clear incompatible filters when switching domain
            if (ctx.domain === 'metcons') {
              setContextBlock(null)
            } else {
              setTimeDomains([])
              setEquipments([])
              setLevel(null)
            }
          }
          // Pattern terms: only seed from AI for logs domain; metcons must be explicit
          if (ctx.domain === 'logs' && Array.isArray(ctx.patternTerms) && ctx.patternTerms.length) {
            const sanitized = ctx.patternTerms
              .map((t: string) => String(t || '').trim())
              .filter((t: string) => t && !/^metcon(s)?$/i.test(t) && !/^completed$/i.test(t))
            if (sanitized.length) setPatternTerms(sanitized.map((t: string) => `%${t.toLowerCase()}%`))
          }
          // TimeDomain / Equipment (metcons) — sanitize to allowed enums only
          const allowedTD = new Set(['1-5','5-10','10-15','15-20','20+'])
          if (typeof ctx.timeDomain === 'string') {
            const tds = ctx.timeDomain.split(',').map((t: string) => t.trim()).filter((t: string) => allowedTD.has(t))
            setTimeDomains(tds)
          }
          const allowedEq = new Set(['Barbell','Dumbbells'])
          if (Array.isArray(ctx.equipment)) {
            const eqs = ctx.equipment.map((e: string) => String(e)).filter((e: string) => allowedEq.has(e))
            setEquipments(eqs)
          }
          const allowedLevel = new Set(['Open','Quarterfinals','Regionals','Games'])
          if (typeof ctx.level === 'string' && allowedLevel.has(ctx.level)) {
            setLevel(ctx.level)
          }
        }

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
      // Ensure mode persists across chips unless explicitly overridden
      const headersWithMode = { 'X-Mode': currentMode, ...(extraHeaders || {}) }
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
          'X-Domain': domain,
          ...(timeDomains.length ? { 'X-TimeDomain': timeDomains.join(',') } : {}),
          ...(equipments.length ? { 'X-Equipment': equipments.join(',') } : {}),
          ...headersWithMode,
        },
        body: JSON.stringify({ message: text, conversation_id: activeConversationId })
      })
      const data = await response.json()
      if (data?.success) {
        if (!activeConversationId) setActiveConversationId(data.conversation_id)
        const assistantMessage: Message = { role: 'assistant', content: data.response, timestamp: new Date().toISOString(), responseType: data.responseType }
        setMessages(prev => [...prev, assistantMessage])
        // Do not reload conversations after chips; keep current messages
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
    // Latest assistant index to limit toolbar to the newest result
    const lastAssistantIndex = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'assistant') return i
      }
      return -1
    })()
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
              {/* Removed heuristic filter prompt; X-Pattern comes from AI context or explicit UI */}
            </div>
          )
        }

        // Domain-aware toolbar (single source of truth)
        const renderDomainToolbar = () => {
          const logsDisabled = !patternTerms.length
          return (
            <div className="mt-3 flex flex-col gap-2 text-xs">

              {/* Mode chips (domain-aware) */}
              {domain === 'logs' ? (
                <div className="flex flex-wrap gap-2">
                  <button disabled={logsDisabled} className={`px-2 py-1 rounded border ${currentMode==='by_block' ? 'bg-blue-100 border-blue-300' : (logsDisabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200')}`} onClick={() => { setCurrentMode('by_block'); sendQuickQuery(withRange('By block'), 'chip_individual_blocks', { 'X-Mode': 'by_block' }) }}>Individual Blocks</button>
                  <button disabled={logsDisabled} className={`px-2 py-1 rounded border ${currentMode==='total_reps' ? 'bg-blue-100 border-blue-300' : (logsDisabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200')}`} onClick={() => { setCurrentMode('total_reps'); sendQuickQuery(withRange('Total reps'), 'chip_total_reps', { 'X-Mode': 'total_reps' }) }}>Total Reps</button>
                  <button disabled={logsDisabled} className={`px-2 py-1 rounded border ${currentMode==='avg_rpe' ? 'bg-blue-100 border-blue-300' : (logsDisabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200')}`} onClick={() => { setCurrentMode('avg_rpe'); sendQuickQuery(withRange('Avg RPE'), 'chip_avg_rpe', { 'X-Mode': 'avg_rpe' }) }}>Avg RPE</button>
                  <button disabled={logsDisabled} className={`px-2 py-1 rounded border ${currentMode==='sessions' ? 'bg-blue-100 border-blue-300' : (logsDisabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200')}`} onClick={() => { setCurrentMode('sessions'); sendQuickQuery(withRange('Sessions'), 'chip_sessions', { 'X-Mode': 'sessions' }) }}>Sessions</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button className={`px-2 py-1 rounded border ${currentMode==='sessions' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => { setCurrentMode('sessions'); sendQuickQuery('Metcons: Completions', 'metcon_mode', { 'X-Mode': 'sessions' }) }}>Completions</button>
                  <button className={`px-2 py-1 rounded border ${currentMode==='by_time_domain' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => { setCurrentMode('by_time_domain'); sendQuickQuery('Metcons: By time domain', 'metcon_mode', { 'X-Mode': 'by_time_domain' }) }}>By time domain</button>
                  <button className={`px-2 py-1 rounded border ${currentMode==='avg_percentile' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => { setCurrentMode('avg_percentile'); sendQuickQuery('Metcons: Avg percentile', 'metcon_mode', { 'X-Mode': 'avg_percentile' }) }}>Avg percentile</button>
                  <button className={`px-2 py-1 rounded border ${currentMode==='best_scores' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => { setCurrentMode('best_scores'); sendQuickQuery('Metcons: Best scores', 'metcon_mode', { 'X-Mode': 'best_scores' }) }}>Best scores</button>
                </div>
              )}

              {/* Persistent Range chips */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-gray-500">Range:</span>
                {['Last 7 days', 'Last 14 days', 'Last 30 days', 'This week', 'All time'].map(label => {
                  const selected = lastRangeLabel === label
                  return (
                    <button key={label} onClick={() => { setLastRangeLabel(label); sendQuickQuery(label, 'range_chip') }} className={`px-2 py-1 rounded border ${selected ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Filters toggle */}
              <div className="flex flex-wrap gap-2 items-center">
                <button className="px-2 py-1 rounded border bg-gray-100 hover:bg-gray-200" onClick={() => setShowFilters(v => !v)}>
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>

              {/* Domain-specific filters */}
              {showFilters && (domain === 'logs' ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-gray-500">Domain:</span>
                  <button className={`px-2 py-1 rounded border ${domain==='logs' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => { setDomain('logs'); setCurrentMode('count'); setTimeDomains([]); setEquipments([]); setContextBlock(null); setLevel(null) }}>Logs</button>
                  <button className={`px-2 py-1 rounded border ${domain==='metcons' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => { setDomain('metcons'); setCurrentMode('sessions'); setContextBlock(null); }}>Metcons</button>
                  <span className="text-gray-500">Block:</span>
                  {['SKILLS','TECHNICAL WORK','STRENGTH AND POWER','ACCESSORIES','METCONS'].map(b => (
                    <button
                      key={b}
                      disabled={!patternTerms.length}
                      className={`px-2 py-1 rounded border ${contextBlock===b ? 'bg-blue-100 border-blue-300' : (patternTerms.length ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-50 text-gray-400 cursor-not-allowed')}`}
                      onClick={() => { setContextBlock(b); sendQuickQuery(`Block ${b}`, 'block_chip', { 'X-Block': b }) }}
                    >
                      {b}
                    </button>
                  ))}
                  {contextBlock && (
                    <button
                      className="px-2 py-1 rounded border bg-gray-100 hover:bg-gray-200"
                      onClick={() => { setContextBlock(null); sendQuickQuery('Clear block', 'block_clear', {}) }}
                    >
                      Clear Block
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-gray-500">Domain:</span>
                    <button className={`px-2 py-1 rounded border ${domain==='logs' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-blue-100 border-blue-300'}`} onClick={() => { setDomain('logs'); setCurrentMode('count'); setTimeDomains([]); setEquipments([]); setContextBlock(null); setLevel(null) }}>Logs</button>
                    <button className={`px-2 py-1 rounded border ${domain==='metcons' ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`} onClick={() => { setDomain('metcons'); setCurrentMode('sessions'); setContextBlock(null); }}>Metcons</button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-gray-500">Time domain:</span>
                    {['1-5','5-10','10-15','15-20','20+'].map(td => (
                      <button
                        key={td}
                        className={`px-2 py-1 rounded border ${timeDomains.includes(td) ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                        onClick={() => {
                          setTimeDomains(prev => prev.includes(td) ? prev.filter(x => x!==td) : [...prev, td]);
                          sendQuickQuery(`Time domain ${td}`, 'timedomain_chip', { 'X-TimeDomain': timeDomains.includes(td) ? timeDomains.filter(x=>x!==td).join(',') : [...timeDomains, td].join(',') })
                        }}
                      >
                        {td}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-gray-500">Equipment:</span>
                    {['Barbell','Dumbbells'].map(eq => (
                      <button
                        key={eq}
                        className={`px-2 py-1 rounded border ${equipments.includes(eq) ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                        onClick={() => {
                          setEquipments(prev => prev.includes(eq) ? prev.filter(x => x!==eq) : [...prev, eq]);
                          sendQuickQuery(`Equipment ${eq}`, 'equipment_chip', { 'X-Equipment': equipments.includes(eq) ? equipments.filter(x=>x!==eq).join(',') : [...equipments, eq].join(',') })
                        }}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-gray-500">Level:</span>
                    {['Open','Quarterfinals','Regionals','Games'].map(lv => (
                      <button
                        key={lv}
                        className={`px-2 py-1 rounded border ${level===lv ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                        onClick={() => {
                          const next = level===lv ? null : lv
                          setLevel(next)
                          const header = next ? { 'X-Level': next } : {}
                          sendQuickQuery(`Level ${next || 'clear'}`, 'level_chip', header as Record<string,string>)
                        }}
                      >
                        {lv}
                      </button>
                    ))}
                    {level && (
                      <button
                        className="px-2 py-1 rounded border bg-gray-100 hover:bg-gray-200"
                        onClick={() => { setLevel(null); sendQuickQuery('Level clear', 'level_chip_clear', {}) }}
                      >
                        Clear Level
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
              {renderDomainToolbar()}
            </div>
          )
        }
        const renderActionBar = () => renderDomainToolbar()

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
                {/* Active filters summary (latest result only) */}
                {idx === lastAssistantIndex && (
                  <div className="mb-2 text-xs text-gray-600 flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded border bg-gray-50">Domain: {domain}</span>
                    <span className="px-2 py-1 rounded border bg-gray-50">Mode: {currentMode}</span>
                    {lastRangeLabel && <span className="px-2 py-1 rounded border bg-gray-50">Range: {lastRangeLabel}</span>}
                    {domain==='logs' && patternTerms.length>0 && <span className="px-2 py-1 rounded border bg-gray-50">Pattern: {patternTerms.join(', ').replace(/%/g,'')}</span>}
                    {domain==='logs' && contextBlock && <span className="px-2 py-1 rounded border bg-gray-50">Block: {contextBlock}</span>}
                    {domain==='metcons' && timeDomains.length>0 && <span className="px-2 py-1 rounded border bg-gray-50">Time: {timeDomains.join(', ')}</span>}
                    {domain==='metcons' && equipments.length>0 && <span className="px-2 py-1 rounded border bg-gray-50">Equip: {equipments.join(', ')}</span>}
                    {domain==='metcons' && level && <span className="px-2 py-1 rounded border bg-gray-50">Level: {level}</span>}
                  </div>
                )}
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
                <div className="col-span-full">{idx === lastAssistantIndex && renderActionBar()}</div>
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
              <div className="mt-2">{idx === lastAssistantIndex && renderActionBar()}</div>
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

