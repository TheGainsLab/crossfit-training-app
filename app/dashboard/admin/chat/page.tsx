'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  MessageCircle,
  User,
  Clock,
  CheckCircle,
  Circle,
  ChevronRight,
  RefreshCw,
  Filter,
  Send
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Conversation {
  id: string
  user_id: number
  user_email: string
  user_name: string | null
  status: string
  created_at: string
  last_message_at: string | null
  unread: boolean
  last_message_preview: string | null
}

interface ChatAttachment {
  type: 'image' | 'video'
  url: string
  thumbnail_url?: string
  filename: string
  size_bytes: number
}

interface Message {
  id: string
  sender_type: 'user' | 'admin'
  sender_id: number | null
  content: string
  created_at: string
  is_auto_reply: boolean
  attachments?: ChatAttachment[] | null
}

function ConversationRow({
  conversation,
  isSelected,
  onClick
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}) {
  const timeAgo = (date: string | null) => {
    if (!date) return 'Never'
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-coral/5 border-l-4 border-l-coral' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-400" />
          </div>
          {conversation.unread && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-coral rounded-full" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-medium text-gray-900 truncate ${conversation.unread ? 'font-semibold' : ''}`}>
              {conversation.user_name || 'Unnamed User'}
            </p>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {timeAgo(conversation.last_message_at)}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">{conversation.user_email}</p>
          {conversation.last_message_preview && (
            <p className={`text-sm mt-1 truncate ${conversation.unread ? 'text-gray-700' : 'text-gray-400'}`}>
              {conversation.last_message_preview}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isAdmin = message.sender_type === 'admin'
  const hasAttachments = message.attachments && message.attachments.length > 0

  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isAdmin
            ? message.is_auto_reply
              ? 'bg-gray-100 text-gray-600'
              : 'bg-coral text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {/* Attachments */}
        {hasAttachments && (
          <div className="mb-2 space-y-2">
            {message.attachments!.map((attachment, idx) => (
              <div key={idx}>
                {attachment.type === 'image' ? (
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={attachment.url}
                      alt={attachment.filename}
                      className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90"
                    />
                  </a>
                ) : (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      isAdmin && !message.is_auto_reply
                        ? 'bg-white/20 hover:bg-white/30'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    <span className="text-xl">🎬</span>
                    <span className="text-sm truncate">{attachment.filename}</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        {message.content && (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
        <p className={`text-xs mt-1 ${isAdmin && !message.is_auto_reply ? 'text-white/70' : 'text-gray-400'}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.is_auto_reply && ' • Auto-reply'}
        </p>
      </div>
    </div>
  )
}

export default function AdminChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')
  const statusFilter = searchParams.get('status') || ''

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Realtime subscription refs
  const messagesChannelRef = useRef<RealtimeChannel | null>(null)
  const conversationsChannelRef = useRef<RealtimeChannel | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/chat/conversations${statusFilter ? `?status=${statusFilter}` : ''}`)
      const data = await res.json()

      if (data.success) {
        setConversations(data.conversations)
      }
    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true)
    try {
      const res = await fetch(`/api/admin/chat/conversations/${conversationId}`)
      const data = await res.json()

      if (data.success) {
        setMessages(data.messages)
        setSelectedConversation(data.conversation)
        // Refresh conversations to update unread status
        fetchConversations()
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setMessagesLoading(false)
    }
  }, [fetchConversations])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    } else {
      setSelectedConversation(null)
      setMessages([])
    }
  }, [selectedId, fetchMessages])

  // Subscribe to conversation list changes (new conversations, status updates)
  useEffect(() => {
    // Clean up existing subscription
    if (conversationsChannelRef.current) {
      supabase.removeChannel(conversationsChannelRef.current)
    }

    const channel = supabase
      .channel('admin-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_conversations'
        },
        () => {
          // Refresh conversations list when any conversation changes
          fetchConversations()
        }
      )
      .subscribe()

    conversationsChannelRef.current = channel

    return () => {
      if (conversationsChannelRef.current) {
        supabase.removeChannel(conversationsChannelRef.current)
      }
    }
  }, [fetchConversations])

  // Subscribe to messages in the selected conversation
  useEffect(() => {
    // Clean up existing subscription
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current)
      messagesChannelRef.current = null
    }

    if (!selectedId) return

    const channel = supabase
      .channel(`admin-messages-${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${selectedId}`
        },
        (payload: { new: Message }) => {
          const newMsg = payload.new
          // Only add if not already in the list (avoid duplicates from our own sends)
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // Scroll to bottom
          setTimeout(() => {
            messagesContainerRef.current?.scrollTo({
              top: messagesContainerRef.current.scrollHeight,
              behavior: 'smooth'
            })
          }, 100)
        }
      )
      .subscribe()

    messagesChannelRef.current = channel

    return () => {
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current)
      }
    }
  }, [selectedId])

  const handleSelectConversation = (conv: Conversation) => {
    router.push(`/dashboard/admin/chat?id=${conv.id}${statusFilter ? `&status=${statusFilter}` : ''}`)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedId || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/admin/chat/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() })
      })

      const data = await res.json()

      if (data.success) {
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        fetchConversations()
      } else {
        setError(data.error || 'Failed to send message')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status: 'open' | 'resolved') => {
    if (!selectedId) return

    try {
      const res = await fetch(`/api/admin/chat/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      const data = await res.json()

      if (data.success) {
        setSelectedConversation(prev => prev ? { ...prev, status } : null)
        fetchConversations()
      }
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  const unreadCount = conversations.filter(c => c.unread).length

  return (
    <div className="h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Chat</h2>
          <p className="text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread conversation${unreadCount > 1 ? 's' : ''}` : 'User support messages'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live
          </div>
          <button
            onClick={fetchConversations}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => router.push('/dashboard/admin/chat')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !statusFilter ? 'bg-coral text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => router.push('/dashboard/admin/chat?status=open')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'open' ? 'bg-coral text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => router.push('/dashboard/admin/chat?status=resolved')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'resolved' ? 'bg-coral text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Main content */}
      <div className="flex bg-white rounded-lg border border-gray-200 h-full overflow-hidden">
        {/* Conversations list */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No conversations yet</p>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationRow
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedId === conv.id}
                  onClick={() => handleSelectConversation(conv)}
                />
              ))
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {selectedConversation.user_name || 'Unnamed User'}
                    </p>
                    <p className="text-sm text-gray-500">{selectedConversation.user_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/admin/users/${selectedConversation.user_id}`}
                    className="text-sm text-coral hover:text-coral/80 flex items-center gap-1"
                  >
                    View Profile
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleStatusChange(selectedConversation.status === 'open' ? 'resolved' : 'open')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedConversation.status === 'open'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {selectedConversation.status === 'open' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Mark Resolved
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4" />
                        Reopen
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No messages yet
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                )}
              </div>

              {/* Message input */}
              <div className="p-4 border-t border-gray-200">
                {error && (
                  <p className="text-sm text-red-600 mb-2">{error}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
