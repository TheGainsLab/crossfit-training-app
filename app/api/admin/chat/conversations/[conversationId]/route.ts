import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

// GET - Get a single conversation with all messages
export async function GET(
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

    // Get conversation with user info
    const { data: conversation, error: convError } = await supabase
      .from('support_conversations')
      .select(`
        id,
        user_id,
        status,
        created_at,
        updated_at,
        last_message_at,
        unread_by_admin,
        user:users!support_conversations_user_id_fkey(id, name, email, subscription_tier, subscription_status)
      `)
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get all messages
    const { data: messages, error: msgError } = await supabase
      .from('support_messages')
      .select(`
        id,
        sender_type,
        sender_id,
        content,
        created_at,
        is_auto_reply
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('Error fetching messages:', msgError)
      throw msgError
    }

    // Mark as read by admin
    if (conversation.unread_by_admin) {
      await supabase
        .from('support_conversations')
        .update({ unread_by_admin: false, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        user_id: conversation.user_id,
        user_name: (conversation.user as any)?.name || 'Unknown',
        user_email: (conversation.user as any)?.email || '',
        user_tier: (conversation.user as any)?.subscription_tier || null,
        user_status: (conversation.user as any)?.subscription_status || null,
        status: conversation.status,
        created_at: conversation.created_at,
        last_message_at: conversation.last_message_at
      },
      messages: messages || []
    })

  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update conversation status (resolve/reopen)
export async function PATCH(
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
    const { status } = body

    if (!status || !['open', 'resolved'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('support_conversations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    if (error) {
      console.error('Error updating conversation:', error)
      throw error
    }

    return NextResponse.json({ success: true, status })

  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
