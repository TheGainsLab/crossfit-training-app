import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

// POST - Send a note to a user (creates conversation if needed)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate
    const { userId: adminId, error: authError } = await getUserIdFromAuth(supabase)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permission
    const userIsAdmin = await isAdmin(supabase, adminId)
    if (!userIsAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, content, context } = body

    // Validate inputs
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Check if conversation already exists for this user
    let conversationId: string

    const { data: existingConv } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existingConv) {
      conversationId = existingConv.id
    } else {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('support_conversations')
        .insert({
          user_id: userId,
          status: 'open',
          unread_by_user: true,
          unread_by_admin: false
        })
        .select('id')
        .single()

      if (convError || !newConv) {
        console.error('Error creating conversation:', convError)
        return NextResponse.json(
          { success: false, error: 'Failed to create conversation' },
          { status: 500 }
        )
      }

      conversationId = newConv.id
    }

    // Build message content (optionally include context)
    let messageContent = content.trim()
    if (context) {
      // Context could be like "Re: SKILLS: Push-ups, Pull-ups"
      messageContent = `${messageContent}`
    }

    const now = new Date().toISOString()

    // Insert message
    const { data: message, error: msgError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'admin',
        sender_id: adminId,
        content: messageContent
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error creating message:', msgError)
      return NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      )
    }

    // Update conversation
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
        .select('push_token, name')
        .eq('id', userId)
        .single()

      if (userData?.push_token) {
        const previewContent = messageContent.length > 100
          ? messageContent.slice(0, 100) + '...'
          : messageContent

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
      // Log but don't fail if push notification fails
      console.error('Error sending push notification:', pushError)
    }

    return NextResponse.json({
      success: true,
      conversationId,
      message: {
        id: message.id,
        content: message.content,
        created_at: message.created_at
      }
    })

  } catch (error) {
    console.error('Error sending note:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
