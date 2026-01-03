import { createClient } from '../supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'

export interface ChatAttachment {
  type: 'image' | 'video'
  url: string
  thumbnail_url?: string
  filename: string
  size_bytes: number
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_type: 'user' | 'admin'
  sender_id: number | null
  content: string
  created_at: string
  is_auto_reply: boolean
  attachments?: ChatAttachment[] | null
}

export interface ChatConversation {
  id: string
  user_id: number
  status: string
  created_at: string
  updated_at: string
  last_message_at: string | null
  unread_by_user: boolean
}

/**
 * Get or create the user's support conversation
 */
export async function getOrCreateConversation(
  userId: number
): Promise<{ success: boolean; conversation?: ChatConversation; isNew?: boolean; error?: string }> {
  try {
    const supabase = createClient()

    // Try to get existing conversation
    const { data: existing, error: fetchError } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Mark as read by user
      if (existing.unread_by_user) {
        await supabase
          .from('support_conversations')
          .update({ unread_by_user: false })
          .eq('id', existing.id)
      }

      return {
        success: true,
        conversation: {
          ...existing,
          unread_by_user: false
        }
      }
    }

    // No conversation exists - create one
    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected
      console.error('Error fetching conversation:', fetchError)
      return { success: false, error: fetchError.message }
    }

    const { data: newConversation, error: createError } = await supabase
      .from('support_conversations')
      .insert({
        user_id: userId,
        status: 'open'
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating conversation:', createError)
      return { success: false, error: createError.message }
    }

    return {
      success: true,
      conversation: newConversation,
      isNew: true
    }

  } catch (error: any) {
    console.error('Error in getOrCreateConversation:', error)
    return { success: false, error: error.message || 'Failed to get conversation' }
  }
}

/**
 * Check if user has unread messages
 */
export async function hasUnreadMessages(userId: number): Promise<boolean> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('support_conversations')
      .select('unread_by_user')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return false
    }

    return data.unread_by_user === true
  } catch (error) {
    console.error('Error checking unread messages:', error)
    return false
  }
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string
): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }> {
  try {
    const supabase = createClient()

    const { data: messages, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return { success: false, error: error.message }
    }

    // Mark conversation as read
    await supabase
      .from('support_conversations')
      .update({ unread_by_user: false })
      .eq('id', conversationId)

    return {
      success: true,
      messages: messages || []
    }

  } catch (error: any) {
    console.error('Error in getMessages:', error)
    return { success: false, error: error.message || 'Failed to get messages' }
  }
}

/**
 * Send a message as the user (with optional attachments)
 */
export async function sendMessage(
  userId: number,
  conversationId: string,
  content: string,
  attachments?: ChatAttachment[]
): Promise<{ success: boolean; message?: ChatMessage; autoReply?: ChatMessage; error?: string }> {
  try {
    const supabase = createClient()

    const now = new Date().toISOString()

    // Insert user message
    const { data: message, error: msgError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'user',
        sender_id: userId,
        content: content.trim(),
        attachments: attachments && attachments.length > 0 ? attachments : null
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error creating message:', msgError)
      return { success: false, error: msgError.message }
    }

    // Check if this is the first message (to send auto-reply)
    const { count } = await supabase
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    const isFirstMessage = count === 1

    // Update conversation
    await supabase
      .from('support_conversations')
      .update({
        last_message_at: now,
        updated_at: now,
        unread_by_admin: true,
        unread_by_user: false,
        status: 'open'
      })
      .eq('id', conversationId)

    // If first message, create auto-reply
    let autoReply: ChatMessage | undefined
    if (isFirstMessage) {
      const { data: autoReplyData } = await supabase
        .from('support_messages')
        .insert({
          conversation_id: conversationId,
          sender_type: 'admin',
          sender_id: null,
          content: "Thanks for reaching out! We typically respond within a few hours during business hours. We'll get back to you as soon as possible.",
          is_auto_reply: true
        })
        .select()
        .single()

      autoReply = autoReplyData || undefined
    }

    return {
      success: true,
      message,
      autoReply
    }

  } catch (error: any) {
    console.error('Error in sendMessage:', error)
    return { success: false, error: error.message || 'Failed to send message' }
  }
}

/**
 * Subscribe to new messages in a conversation using Supabase Realtime
 */
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: ChatMessage) => void
): RealtimeChannel {
  const supabase = createClient()

  const channel = supabase
    .channel(`support_messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        const newMessage = payload.new as ChatMessage
        // Only trigger callback for admin messages (user's own messages are added optimistically)
        if (newMessage.sender_type === 'admin') {
          onNewMessage(newMessage)
        }
      }
    )
    .subscribe()

  return channel
}

/**
 * Unsubscribe from message updates
 */
export function unsubscribeFromMessages(channel: RealtimeChannel) {
  const supabase = createClient()
  supabase.removeChannel(channel)
}

/**
 * Upload an attachment to Supabase Storage
 */
export async function uploadAttachment(
  userId: number,
  fileUri: string,
  fileType: 'image' | 'video'
): Promise<{ success: boolean; attachment?: ChatAttachment; error?: string }> {
  try {
    const supabase = createClient()

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri)
    if (!fileInfo.exists) {
      return { success: false, error: 'File not found' }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = fileType === 'image' ? 'jpg' : 'mp4'
    const filename = `${timestamp}.${extension}`
    const storagePath = `${userId}/${filename}`

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // Determine content type
    const contentType = fileType === 'image' ? 'image/jpeg' : 'video/mp4'

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(storagePath, decode(base64), {
        contentType,
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading attachment:', uploadError)
      return { success: false, error: uploadError.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(storagePath)

    const attachment: ChatAttachment = {
      type: fileType,
      url: urlData.publicUrl,
      filename,
      size_bytes: fileInfo.size || 0
    }

    return { success: true, attachment }

  } catch (error: any) {
    console.error('Error in uploadAttachment:', error)
    return { success: false, error: error.message || 'Failed to upload attachment' }
  }
}

/**
 * Max file sizes for uploads
 */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024 // 50MB
