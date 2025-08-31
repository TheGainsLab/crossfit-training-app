// components/TrainingChatInterface.tsx
'use client'

import { useState, useEffect, useRef } from 'react'

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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/chat/conversations')
      const data = await response.json()
      
      if (data.success) {
        setConversations(data.conversations || [])
        
        // Load most recent conversation if available
        if (data.conversations?.length > 0) {
          loadConversation(data.conversations[0])
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  const loadConversation = (conversation: Conversation) => {
    setActiveConversationId(conversation.id)
    

setMessages(conversation.chat_messages?.map(msg => ({
  role: msg.role,
  content: msg.content,
  timestamp: msg.created_at || msg.timestamp || new Date().toISOString()
})) || [])
    setShowConversations(false)
  }

  const startNewConversation = () => {
    setActiveConversationId(null)
    setMessages([])
    setShowConversations(false)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: activeConversationId
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update conversation ID if this is a new conversation
        if (!activeConversationId) {
          setActiveConversationId(data.conversation_id)
        }

        // Add assistant response
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
          responseType: data.responseType
        }
        setMessages(prev => [...prev, assistantMessage])

        // Show alert if coach was notified
        if (data.coachAlertGenerated) {
          // Could add a subtle notification here
        }

        // Refresh conversations list to show updated conversation
        fetchConversations()
      } else {
        throw new Error(data.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message to chat
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date().toISOString(),
        responseType: 'error'
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
    
    // Different styles based on response type
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
      case 'medical_referral': return '🏥'
      case 'coach_escalation': return '👨‍🏫'
      case 'program_guidance': return '📋'
      case 'technique_advice': return '🎯'
      case 'nutrition_guidance': return '🥗'
      case 'recovery_advice': return '💤'
      case 'error': return '⚠️'
      default: return '💪'
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
                  activeConversationId === conv.id ? 'bg-blue-50 text-blue-800' : 'text-gray-700'
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">💬</div>
            <h4 className="font-medium text-gray-900 mb-2">Start a conversation!</h4>
            <p className="text-sm">Ask me about your workouts, form, nutrition, or any training questions.</p>
            
            {/* Suggested questions */}
            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-gray-700">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "How's my squat progression?",
                  "Why was today's workout so hard?",
                  "Should I modify my program?",
                  "How can I improve my recovery?"
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
              
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              <div className="text-xs opacity-75 mt-2">
{new Date(message.timestamp || new Date()).toLocaleTimeString([], {
                  hour: '2-digit', 
                  minute: '2-digit' 
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
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
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
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
        
        <p className="text-xs text-gray-500 mt-2">
          I have access to your complete training history and can provide personalized advice.
        </p>
      </div>
    </div>
  )
}

export default TrainingChatInterface
