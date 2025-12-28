import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth } from '@/lib/permissions'

// GET - Get messages for the user's conversation
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's conversation
    const { data: conversation, error: convError } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (convError || !conversation) {
      // No conversation exists yet - return empty messages
      return NextResponse.json({
        success: true,
        messages: []
      })
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('support_messages')
      .select('id, sender_type, content, created_at, is_auto_reply')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('Error fetching messages:', msgError)
      throw msgError
    }

    // Mark conversation as read by user
    await supabase
      .from('support_conversations')
      .update({ unread_by_user: false })
      .eq('id', conversation.id)

    return NextResponse.json({
      success: true,
      messages: messages || []
    })

  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Send a message as the user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Get or create conversation
    let conversationId: string

    const { data: existing } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      conversationId = existing.id
    } else {
      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('support_conversations')
        .insert({
          user_id: userId,
          status: 'open'
        })
        .select('id')
        .single()

      if (createError || !newConv) {
        console.error('Error creating conversation:', createError)
        throw createError
      }

      conversationId = newConv.id
    }

    const now = new Date().toISOString()

    // Insert user message
    const { data: message, error: msgError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'user',
        sender_id: userId,
        content: content.trim()
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error creating message:', msgError)
      throw msgError
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

    // If first message, send auto-reply
    let autoReply = null
    if (isFirstMessage) {
      const { data: autoReplyData } = await supabase
        .from('support_messages')
        .insert({
          conversation_id: conversationId,
          sender_type: 'admin',
          sender_id: null, // System message
          content: "Thanks for reaching out! We typically respond within a few hours during business hours. We'll get back to you as soon as possible.",
          is_auto_reply: true
        })
        .select()
        .single()

      autoReply = autoReplyData
    }

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        sender_type: message.sender_type,
        content: message.content,
        created_at: message.created_at,
        is_auto_reply: false
      },
      autoReply: autoReply ? {
        id: autoReply.id,
        sender_type: autoReply.sender_type,
        content: autoReply.content,
        created_at: autoReply.created_at,
        is_auto_reply: true
      } : null
    })

  } catch (error) {
    console.error('Error sending chat message:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
