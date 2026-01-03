import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Video, ResizeMode } from 'expo-av'
import { createClient } from '@/lib/supabase/client'
import {
  ChatMessage,
  ChatConversation,
  ChatAttachment,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  subscribeToMessages,
  unsubscribeFromMessages,
  uploadAttachment,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES
} from '@/lib/api/chat'
import { RealtimeChannel } from '@supabase/supabase-js'

export default function SupportChatScreen() {
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)
  const realtimeChannel = useRef<RealtimeChannel | null>(null)

  const [userId, setUserId] = useState<number | null>(null)
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<{uri: string, type: 'image' | 'video'} | null>(null)
  const [uploading, setUploading] = useState(false)

  // Initialize chat
  useEffect(() => {
    async function initChat() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Please sign in to use support chat')
          setLoading(false)
          return
        }

        // Get user ID from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (userError || !userData) {
          setError('Could not find user profile')
          setLoading(false)
          return
        }

        setUserId(userData.id)

        // Get or create conversation
        const convResult = await getOrCreateConversation(userData.id)
        if (!convResult.success || !convResult.conversation) {
          setError(convResult.error || 'Could not load conversation')
          setLoading(false)
          return
        }

        setConversation(convResult.conversation)

        // Get messages
        const msgResult = await getMessages(convResult.conversation.id)
        if (msgResult.success && msgResult.messages) {
          setMessages(msgResult.messages)
        }

        // Subscribe to realtime updates
        realtimeChannel.current = subscribeToMessages(
          convResult.conversation.id,
          (newMsg) => {
            setMessages(prev => [...prev, newMsg])
          }
        )

        setLoading(false)
      } catch (err: any) {
        console.error('Error initializing chat:', err)
        setError(err.message || 'Failed to load chat')
        setLoading(false)
      }
    }

    initChat()

    // Cleanup on unmount
    return () => {
      if (realtimeChannel.current) {
        unsubscribeFromMessages(realtimeChannel.current)
      }
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages])

  // Pick image or video
  const handlePickMedia = useCallback(async () => {
    Alert.alert(
      'Add Attachment',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync()
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Camera access is required to take photos')
              return
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
            })
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0]
              if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
                Alert.alert('File too large', 'Please choose an image under 10MB')
                return
              }
              setPendingAttachment({ uri: asset.uri, type: 'image' })
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Photo library access is required')
              return
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              quality: 0.8,
              allowsEditing: true,
            })
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0]
              const isVideo = asset.type === 'video'
              const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES
              if (asset.fileSize && asset.fileSize > maxSize) {
                Alert.alert('File too large', `Please choose a file under ${isVideo ? '50MB' : '10MB'}`)
                return
              }
              setPendingAttachment({ uri: asset.uri, type: isVideo ? 'video' : 'image' })
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    )
  }, [])

  const handleSend = useCallback(async () => {
    if ((!newMessage.trim() && !pendingAttachment) || !userId || !conversation || sending || uploading) return

    const messageContent = newMessage.trim() || (pendingAttachment ? `[${pendingAttachment.type === 'image' ? 'Photo' : 'Video'}]` : '')
    setNewMessage('')
    setSending(true)

    let attachments: ChatAttachment[] | undefined

    // Upload attachment if present
    if (pendingAttachment) {
      setUploading(true)
      const uploadResult = await uploadAttachment(userId, pendingAttachment.uri, pendingAttachment.type)
      setUploading(false)

      if (uploadResult.success && uploadResult.attachment) {
        attachments = [uploadResult.attachment]
      } else {
        Alert.alert('Upload failed', uploadResult.error || 'Could not upload attachment')
        setSending(false)
        return
      }
      setPendingAttachment(null)
    }

    // Optimistically add the message
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      sender_type: 'user',
      sender_id: userId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_auto_reply: false,
      attachments: attachments
    }
    setMessages(prev => [...prev, optimisticMessage])

    try {
      const result = await sendMessage(userId, conversation.id, messageContent, attachments)

      if (result.success && result.message) {
        // Replace optimistic message with real one
        setMessages(prev =>
          prev.map(m => m.id === optimisticMessage.id ? result.message! : m)
        )

        // Add auto-reply if present
        if (result.autoReply) {
          setMessages(prev => [...prev, result.autoReply!])
        }
      } else {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
        console.error('Failed to send message:', result.error)
      }
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }, [newMessage, userId, conversation, sending, uploading, pendingAttachment])

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender_type === 'user'
    const isAutoReply = item.is_auto_reply
    const hasAttachments = item.attachments && item.attachments.length > 0

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.adminMessage
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser
              ? styles.userBubble
              : isAutoReply
                ? styles.autoReplyBubble
                : styles.adminBubble
          ]}
        >
          {/* Render attachments */}
          {hasAttachments && item.attachments!.map((attachment, index) => (
            <View key={index} style={styles.attachmentContainer}>
              {attachment.type === 'image' ? (
                <Image
                  source={{ uri: attachment.url }}
                  style={styles.attachmentImage}
                  resizeMode="cover"
                />
              ) : (
                <Video
                  source={{ uri: attachment.url }}
                  style={styles.attachmentVideo}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                />
              )}
            </View>
          ))}
          {/* Message text (hide if just "[Photo]" or "[Video]" placeholder) */}
          {item.content && !item.content.match(/^\[(Photo|Video)\]$/) && (
            <Text
              style={[
                styles.messageText,
                isUser
                  ? styles.userMessageText
                  : isAutoReply
                    ? styles.autoReplyText
                    : styles.adminMessageText
              ]}
            >
              {item.content}
            </Text>
          )}
          <Text
            style={[
              styles.messageTime,
              isUser ? styles.userTimeText : styles.adminTimeText
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
            {isAutoReply && ' • Auto'}
          </Text>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FE5858" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color="#374151" />
            <Text style={styles.emptyTitle}>Start a conversation</Text>
            <Text style={styles.emptySubtitle}>
              Send us a message and we'll get back to you as soon as possible.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false })
            }}
          />
        )}

        {/* Pending Attachment Preview */}
        {pendingAttachment && (
          <View style={styles.attachmentPreviewContainer}>
            <Image
              source={{ uri: pendingAttachment.uri }}
              style={styles.attachmentPreview}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeAttachmentButton}
              onPress={() => setPendingAttachment(null)}
            >
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
            {pendingAttachment.type === 'video' && (
              <View style={styles.videoIndicator}>
                <Ionicons name="videocam" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickMedia}
            disabled={sending || uploading}
          >
            <Ionicons name="attach" size={24} color={sending || uploading ? '#4B5563' : '#9CA3AF'} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#6B7280"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() && !pendingAttachment || sending || uploading) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={(!newMessage.trim() && !pendingAttachment) || sending || uploading}
          >
            {sending || uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 32,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 280,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  adminMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#FE5858',
    borderBottomRightRadius: 4,
  },
  adminBubble: {
    backgroundColor: '#374151',
    borderBottomLeftRadius: 4,
  },
  autoReplyBubble: {
    backgroundColor: '#1F2937',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  adminMessageText: {
    color: '#FFFFFF',
  },
  autoReplyText: {
    color: '#9CA3AF',
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  adminTimeText: {
    color: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    backgroundColor: '#111827',
  },
  input: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FE5858',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  attachmentVideo: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  attachmentPreviewContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    backgroundColor: '#111827',
  },
  attachmentPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#111827',
    borderRadius: 12,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
})
