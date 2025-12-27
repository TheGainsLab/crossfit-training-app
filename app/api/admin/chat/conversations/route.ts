import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

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
