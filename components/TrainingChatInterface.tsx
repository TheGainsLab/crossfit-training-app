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
      const response = await fetch(`/api/chat/${userId}`, {
        method: 'POST',
  credentials: 'include',      
  headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // <-- ADDED
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
  const renderAssistantContent = (message: Message) => {
    if (message.role !== 'assistant') {
      return <div className="whitespace-pre-wrap">{message.content}</div>
    }
    try {
      const parsed = JSON.parse(message.content)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === 'object') {
        const block = parsed[0] as any
        const rows = Array.isArray(block.data) ? block.data : []
        // If it's a list of skills: objects with exercise_name
        if (rows.length > 0 && rows.every((r: any) => r && typeof r === 'object' && 'exercise_name' in r)) {
          const names = rows.map((r: any) => String(r.exercise_name)).filter(Boolean)
          return (
            <div>
              <ul className="list-disc list-inside">
                {names.map((n: string) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )
        }
        // Generic table fallback: render first block as pre
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

              {renderAssistantContent(message)}

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

