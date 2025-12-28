import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth } from '@/lib/permissions'

// GET - Get or create the user's support conversation
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

    // Try to get existing conversation
    const { data: existing, error: fetchError } = await supabase
      .from('support_conversations')
      .select('id, status, created_at, updated_at, last_message_at, unread_by_user')
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

      return NextResponse.json({
        success: true,
        conversation: {
          ...existing,
          unread_by_user: false
        }
      })
    }

    // No conversation exists - create one
    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected
      console.error('Error fetching conversation:', fetchError)
      throw fetchError
    }

    const { data: newConversation, error: createError } = await supabase
      .from('support_conversations')
      .insert({
        user_id: userId,
        status: 'open'
      })
      .select('id, status, created_at, updated_at, last_message_at, unread_by_user')
      .single()

    if (createError) {
      console.error('Error creating conversation:', createError)
      throw createError
    }

    return NextResponse.json({
      success: true,
      conversation: newConversation,
      isNew: true
    })

  } catch (error) {
    console.error('Error in chat conversation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
