import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

// POST - Send a message as admin
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
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
    const { content, attachments } = body

    // Allow messages with just attachments (no text content)
    const hasContent = content && typeof content === 'string' && content.trim().length > 0
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0

    if (!hasContent && !hasAttachments) {
      return NextResponse.json(
        { success: false, error: 'Message content or attachment is required' },
        { status: 400 }
      )
    }

    // Verify conversation exists
    const { data: conversation, error: convError } = await supabase
      .from('support_conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    // Insert message
    const { data: message, error: msgError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'admin',
        sender_id: userId,
        content: hasContent ? content.trim() : '',
        attachments: hasAttachments ? attachments : null
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error creating message:', msgError)
      throw msgError
    }

    // Update conversation
    await supabase
      .from('support_conversations')
      .update({
        last_message_at: now,
        updated_at: now,
        unread_by_user: true,
        unread_by_admin: false,
        status: 'open' // Reopen if it was resolved
      })
      .eq('id', conversationId)

    // Send push notification to athlete
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('push_token, name')
        .eq('id', conversation.user_id)
        .single()

      if (userData?.push_token) {
        // Truncate message for notification preview
        let previewContent = ''
        if (hasContent) {
          previewContent = content.trim().length > 100
            ? content.trim().slice(0, 100) + '...'
            : content.trim()
        } else if (hasAttachments) {
          const attachmentType = attachments[0]?.type === 'video' ? 'video' : 'image'
          previewContent = `Sent ${attachmentType === 'video' ? 'a video' : 'an image'}`
        }

        const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
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

        const pushResult = await pushResponse.json()
        console.log('Push notification result:', JSON.stringify(pushResult))

        // Check for errors in Expo response
        if (pushResult.data?.[0]?.status === 'error') {
          console.error('Push notification error:', pushResult.data[0].message)
        }
      } else {
        console.log('No push token found for user:', conversation.user_id)
      }
    } catch (pushError) {
      // Log but don't fail the request if push notification fails
      console.error('Error sending push notification:', pushError)
    }

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        sender_type: message.sender_type,
        sender_id: message.sender_id,
        content: message.content,
        created_at: message.created_at,
        is_auto_reply: false,
        attachments: message.attachments
      }
    })

  } catch (error) {
    console.error('Error sending admin message:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
