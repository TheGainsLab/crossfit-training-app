// /app/api/athlete/chat/route.ts
// Athlete-facing chat API - fetch/create conversation and send messages

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Get user token from Authorization header
    const authHeader = request.headers.get('authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    
    if (!userToken) {
      return NextResponse.json(
        { success: false, error: 'Missing Authorization header' },
        { status: 401 }
      )
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create user-bound Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } }
    })

    // Verify authentication and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get or create conversation for this user
    let { data: conversation, error: convError } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('user_id', userData.id)
      .single()

    // If no conversation exists, create one
    if (convError && convError.code === 'PGRST116') {
      const { data: newConv, error: createError } = await supabase
        .from('support_conversations')
        .insert({
          user_id: userData.id,
          status: 'open',
          unread_by_admin: false,
          unread_by_user: false
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating conversation:', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create conversation' },
          { status: 500 }
        )
      }

      conversation = newConv
    } else if (convError) {
      console.error('Error fetching conversation:', convError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch conversation' },
        { status: 500 }
      )
    }

    // Fetch messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Mark messages as read by user
    if (conversation.unread_by_user) {
      await supabase
        .from('support_conversations')
        .update({ unread_by_user: false })
        .eq('id', conversation.id)
    }

    return NextResponse.json({
      success: true,
      conversation,
      messages: messages || []
    })

  } catch (error) {
    console.error('Error in GET /api/athlete/chat:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user token from Authorization header
    const authHeader = request.headers.get('authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    
    if (!userToken) {
      return NextResponse.json(
        { success: false, error: 'Missing Authorization header' },
        { status: 401 }
      )
    }

    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message content is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create user-bound Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } }
    })

    // Verify authentication and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', userData.id)
      .single()

    if (convError && convError.code === 'PGRST116') {
      const { data: newConv, error: createError } = await supabase
        .from('support_conversations')
        .insert({
          user_id: userData.id,
          status: 'open',
          unread_by_admin: false,
          unread_by_user: false
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating conversation:', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create conversation' },
          { status: 500 }
        )
      }

      conversation = newConv
    } else if (convError) {
      console.error('Error fetching conversation:', convError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch conversation' },
        { status: 500 }
      )
    }

    // Ensure conversation exists
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Failed to create or fetch conversation' },
        { status: 500 }
      )
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'user',
        sender_id: userData.id,
        content: content.trim(),
        is_auto_reply: false
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      )
    }

    // Update conversation metadata
    await supabase
      .from('support_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_by_admin: true,
        unread_by_user: false
      })
      .eq('id', conversation.id)

    return NextResponse.json({
      success: true,
      message,
      conversation_id: conversation.id
    })

  } catch (error) {
    console.error('Error in POST /api/athlete/chat:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

