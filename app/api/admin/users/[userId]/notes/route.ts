import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserIdFromAuth, isAdmin } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params
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

    const targetId = parseInt(targetUserId)
    if (isNaN(targetId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const { data: notes, error } = await supabase
      .from('admin_notes')
      .select(`
        id,
        content,
        created_at,
        admin:users!admin_notes_admin_id_fkey(name)
      `)
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notes:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      notes: notes?.map(n => ({
        id: n.id,
        content: n.content,
        created_at: n.created_at,
        admin_name: (n.admin as any)?.name || null
      })) || []
    })

  } catch (error) {
    console.error('Error fetching admin notes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params
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

    const targetId = parseInt(targetUserId)
    if (isNaN(targetId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      )
    }

    // Verify target user exists
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetId)
      .single()

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Create the note
    const { data: note, error: insertError } = await supabase
      .from('admin_notes')
      .insert({
        user_id: targetId,
        admin_id: userId,
        content: content.trim()
      })
      .select(`
        id,
        content,
        created_at,
        admin:users!admin_notes_admin_id_fkey(name)
      `)
      .single()

    if (insertError) {
      console.error('Error creating note:', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        content: note.content,
        created_at: note.created_at,
        admin_name: (note.admin as any)?.name || null
      }
    })

  } catch (error) {
    console.error('Error creating admin note:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
