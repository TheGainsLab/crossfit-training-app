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
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  Plus,
  Search
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

interface SearchUser {
  id: number
  name: string | null
  email: string
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

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File
    preview: string
    type: 'image' | 'video'
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Realtime subscription refs
  const messagesChannelRef = useRef<RealtimeChannel | null>(null)
  const conversationsChannelRef = useRef<RealtimeChannel | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // New chat modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [newChatMessage, setNewChatMessage] = useState('')
  const [searching, setSearching] = useState(false)
  const [creatingChat, setCreatingChat] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setError('Please select an image or video file')
      return
    }

    // Check file size (10MB for images, 50MB for videos)
    const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024
    if (file.size > maxSize) {
      setError(`File too large. Max size: ${isImage ? '10MB' : '50MB'}`)
      return
    }

    // Create preview
    const preview = URL.createObjectURL(file)
    setPendingAttachment({
      file,
      preview,
      type: isImage ? 'image' : 'video'
    })
    setError(null)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const clearAttachment = () => {
    if (pendingAttachment?.preview) {
      URL.revokeObjectURL(pendingAttachment.preview)
    }
    setPendingAttachment(null)
  }

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !pendingAttachment) || !selectedId || sending || uploading) return

    setSending(true)
    setError(null)

    try {
      let attachments: ChatAttachment[] | undefined

      // Upload attachment if present
      if (pendingAttachment && selectedConversation) {
        setUploading(true)

        // Upload to Supabase Storage
        const timestamp = Date.now()
        const ext = pendingAttachment.file.name.split('.').pop() || 'jpg'
        const filename = `${timestamp}.${ext}`
        const storagePath = `${selectedConversation.user_id}/${filename}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(storagePath, pendingAttachment.file, {
            contentType: pendingAttachment.file.type,
            upsert: false
          })

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(storagePath)

        attachments = [{
          type: pendingAttachment.type,
          url: urlData.publicUrl,
          filename: pendingAttachment.file.name,
          size_bytes: pendingAttachment.file.size
        }]

        setUploading(false)
      }

      const res = await fetch(`/api/admin/chat/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage.trim(),
          attachments
        })
      })

      const data = await res.json()

      if (data.success) {
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        clearAttachment()
        fetchConversations()
      } else {
        setError(data.error || 'Failed to send message')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setUploading(false)
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

  // Search users for new chat
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=10`)
      const data = await res.json()

      if (data.success && data.users) {
        setSearchResults(data.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email
        })))
      }
    } catch (err) {
      console.error('Error searching users:', err)
    } finally {
      setSearching(false)
    }
  }, [])

  // Debounced search
  const handleUserSearch = (query: string) => {
    setUserSearchQuery(query)
    setSelectedUser(null)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(query)
    }, 300)
  }

  // Create new chat
  const handleCreateChat = async () => {
    if (!selectedUser || !newChatMessage.trim()) return

    setCreatingChat(true)
    try {
      const res = await fetch('/api/admin/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          message: newChatMessage.trim()
        })
      })

      const data = await res.json()

      if (data.success) {
        // Close modal and navigate to the new conversation
        setShowNewChatModal(false)
        setUserSearchQuery('')
        setSearchResults([])
        setSelectedUser(null)
        setNewChatMessage('')
        fetchConversations()
        router.push(`/dashboard/admin/chat?id=${data.conversationId}`)
      } else {
        setError(data.error || 'Failed to create conversation')
      }
    } catch (err) {
      console.error('Error creating chat:', err)
      setError('Failed to create conversation')
    } finally {
      setCreatingChat(false)
    }
  }

  // Close modal and reset state
  const closeNewChatModal = () => {
    setShowNewChatModal(false)
    setUserSearchQuery('')
    setSearchResults([])
    setSelectedUser(null)
    setNewChatMessage('')
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
            onClick={() => setShowNewChatModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-coral hover:bg-coral/90 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
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

                {/* Attachment preview */}
                {pendingAttachment && (
                  <div className="mb-3 relative inline-block">
                    {pendingAttachment.type === 'image' ? (
                      <img
                        src={pendingAttachment.preview}
                        alt="Attachment preview"
                        className="max-h-32 rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                        <span className="text-xl">🎬</span>
                        <span className="text-sm text-gray-600 truncate max-w-48">
                          {pendingAttachment.file.name}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={clearAttachment}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Attachment button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploading}
                    className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add attachment"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

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
                    disabled={(!newMessage.trim() && !pendingAttachment) || sending || uploading}
                    className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {uploading ? 'Uploading...' : 'Send'}
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

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Start New Chat</h3>
              <button
                onClick={closeNewChatModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* User Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select User
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
                  />
                </div>

                {/* Search Results */}
                {(searchResults.length > 0 || searching) && !selectedUser && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {searching ? (
                      <div className="p-3 text-center text-gray-500">
                        <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                        Searching...
                      </div>
                    ) : (
                      searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user)
                            setUserSearchQuery(user.name || user.email)
                            setSearchResults([])
                          }}
                          className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <p className="font-medium text-gray-900">{user.name || 'Unnamed User'}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Selected User Badge */}
                {selectedUser && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-coral/10 rounded-lg">
                    <User className="w-4 h-4 text-coral" />
                    <span className="text-sm font-medium text-gray-900">
                      {selectedUser.name || selectedUser.email}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedUser(null)
                        setUserSearchQuery('')
                      }}
                      className="ml-auto text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={closeNewChatModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChat}
                disabled={!selectedUser || !newChatMessage.trim() || creatingChat}
                className="px-4 py-2 text-sm text-white bg-coral hover:bg-coral/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingChat ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Start Chat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
