import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

// POST - Create a new conversation (admin initiating chat with user)
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

    // Check admin permission
    const userIsAdmin = await isAdmin(supabase, userId)
    if (!userIsAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { targetUserId, message } = body

    if (!targetUserId || typeof targetUserId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Target user ID is required' },
        { status: 400 }
      )
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Initial message is required' },
        { status: 400 }
      )
    }

    // Verify target user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', targetUserId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    // Check if conversation already exists for this user
    const { data: existingConv } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', targetUserId)
      .single()

    let conversationId: string

    if (existingConv) {
      // Use existing conversation
      conversationId = existingConv.id
    } else {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('support_conversations')
        .insert({
          user_id: targetUserId,
          status: 'open',
          last_message_at: now,
          unread_by_user: true,
          unread_by_admin: false
        })
        .select()
        .single()

      if (convError || !newConv) {
        console.error('Error creating conversation:', convError)
        throw convError
      }

      conversationId = newConv.id
    }

    // Insert the first message from admin
    const { data: newMessage, error: msgError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'admin',
        sender_id: userId,
        content: message.trim()
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error creating message:', msgError)
      throw msgError
    }

    // Update conversation timestamps
    await supabase
      .from('support_conversations')
      .update({
        last_message_at: now,
        updated_at: now,
        unread_by_user: true,
        unread_by_admin: false,
        status: 'open'
      })
      .eq('id', conversationId)

    // Send push notification to user
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('push_token')
        .eq('id', targetUserId)
        .single()

      if (userData?.push_token) {
        const previewContent = message.trim().length > 100
          ? message.trim().slice(0, 100) + '...'
          : message.trim()

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: userData.push_token,
            title: '💬 New message from your coach',
            body: previewContent,
            sound: 'default',
            badge: 1,
            data: {
              conversationId: conversationId,
              type: 'coach_message',
              screen: 'coach',
            },
            channelId: 'default',
            priority: 'high',
          }),
        })
      }
    } catch (pushError) {
      console.error('Error sending push notification:', pushError)
    }

    return NextResponse.json({
      success: true,
      conversationId,
      message: {
        id: newMessage.id,
        sender_type: newMessage.sender_type,
        content: newMessage.content,
        created_at: newMessage.created_at
      }
    })

  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List all support conversations (admin inbox)
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

    // Check admin permission
    const userIsAdmin = await isAdmin(supabase, userId)
    if (!userIsAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || '' // 'open', 'resolved', or '' for all
    const unreadOnly = searchParams.get('unread') === 'true'

    // Build query
    let query = supabase
      .from('support_conversations')
      .select(`
        id,
        user_id,
        status,
        created_at,
        updated_at,
        last_message_at,
        unread_by_admin,
        user:users!support_conversations_user_id_fkey(id, name, email, subscription_tier)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (unreadOnly) {
      query = query.eq('unread_by_admin', true)
    }

    const { data: conversations, error } = await query

    if (error) {
      console.error('Error fetching conversations:', error)
      throw error
    }

    // Get last message preview for each conversation
    const conversationIds = conversations?.map(c => c.id) || []
    let lastMessages: Record<string, string> = {}

    if (conversationIds.length > 0) {
      const { data: messages } = await supabase
        .from('support_messages')
        .select('conversation_id, content')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })

      // Get first (most recent) message per conversation
      messages?.forEach(m => {
        if (!lastMessages[m.conversation_id]) {
          lastMessages[m.conversation_id] = m.content.substring(0, 100)
        }
      })
    }

    // Format response
    const formattedConversations = conversations?.map(c => ({
      id: c.id,
      user_id: c.user_id,
      user_name: (c.user as any)?.name || 'Unknown',
      user_email: (c.user as any)?.email || '',
      user_tier: (c.user as any)?.subscription_tier || null,
      status: c.status,
      unread: c.unread_by_admin,
      last_message_preview: lastMessages[c.id] || '',
      last_message_at: c.last_message_at,
      created_at: c.created_at
    })) || []

    // Count unread
    const unreadCount = formattedConversations.filter(c => c.unread).length

    return NextResponse.json({
      success: true,
      conversations: formattedConversations,
      unreadCount
    })

  } catch (error) {
    console.error('Error in admin chat conversations:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
