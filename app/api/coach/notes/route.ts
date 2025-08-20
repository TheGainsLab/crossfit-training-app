// /api/coach/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const athleteId = searchParams.get('athleteId')
    const week = searchParams.get('week')
    const day = searchParams.get('day')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!athleteId) {
      return NextResponse.json({ 
        success: false, 
        error: 'athleteId is required' 
      }, { status: 400 })
    }

    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: any) {
            try { cookieStore.set(name, value, options) } catch (error) {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set(name, '', { ...options, maxAge: 0 }) } catch (error) {}
          },
        },
      }
    )

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get coach user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Verify coach status and permission to view this athlete
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', userData.id)
      .eq('status', 'approved')
      .single()

    if (coachError) {
      return NextResponse.json({ success: false, error: 'Not an approved coach' }, { status: 403 })
    }

    // Check coach-athlete relationship
    const { data: relationship, error: relationshipError } = await supabase
      .from('coach_athlete_relationships')
      .select('permission_level')
      .eq('coach_id', coachData.id)
      .eq('athlete_id', parseInt(athleteId))
      .eq('status', 'active')
      .single()

    if (relationshipError) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active coaching relationship with this athlete' 
      }, { status: 403 })
    }

    // Build query for notes
    let query = supabase
      .from('coach_notes')
      .select(`
        id,
        note_type,
        content,
        exercise_name,
        week,
        day,
        performance_log_id,
        created_at,
        updated_at
      `)
      .eq('coach_id', coachData.id)
      .eq('athlete_id', parseInt(athleteId))
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by session if specified
    if (week && day) {
      query = query.eq('week', parseInt(week)).eq('day', parseInt(day))
    }

    const { data: notes, error: notesError } = await query

    if (notesError) {
      console.error('Error fetching coach notes:', notesError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch notes' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      notes: notes || [],
      metadata: {
        athleteId: parseInt(athleteId),
        totalNotes: notes?.length || 0,
        permissionLevel: relationship.permission_level
      }
    })

  } catch (error) {
    console.error('Unexpected error fetching coach notes:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      athleteId, 
      content, 
      noteType = 'general',
      exerciseName,
      week,
      day,
      performanceLogId 
    } = body

    // Validation
    if (!athleteId || !content?.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'athleteId and content are required' 
      }, { status: 400 })
    }

    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: any) {
            try { cookieStore.set(name, value, options) } catch (error) {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set(name, '', { ...options, maxAge: 0 }) } catch (error) {}
          },
        },
      }
    )

    // Verify authentication and coach status (same as GET)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('id, coach_name')
      .eq('user_id', userData.id)
      .eq('status', 'approved')
      .single()

    if (coachError) {
      return NextResponse.json({ success: false, error: 'Not an approved coach' }, { status: 403 })
    }

    // Verify coaching relationship with edit permissions
    const { data: relationship, error: relationshipError } = await supabase
      .from('coach_athlete_relationships')
      .select('permission_level')
      .eq('coach_id', coachData.id)
      .eq('athlete_id', parseInt(athleteId))
      .eq('status', 'active')
      .single()

    if (relationshipError) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active coaching relationship with this athlete' 
      }, { status: 403 })
    }

    // Check permission level (view-only coaches can't add notes)
    if (relationship.permission_level === 'view') {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions. Edit or full access required to add notes.' 
      }, { status: 403 })
    }

    // Create the note
    const { data: newNote, error: insertError } = await supabase
      .from('coach_notes')
      .insert({
        coach_id: coachData.id,
        athlete_id: parseInt(athleteId),
        note_type: noteType,
        content: content.trim(),
        exercise_name: exerciseName || null,
        week: week ? parseInt(week) : null,
        day: day ? parseInt(day) : null,
        performance_log_id: performanceLogId ? parseInt(performanceLogId) : null
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating coach note:', insertError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create note' 
      }, { status: 500 })
    }

    console.log(`✅ Coach ${coachData.coach_name} added note for athlete ${athleteId}`)

    return NextResponse.json({
      success: true,
      note: newNote,
      message: 'Note added successfully'
    })

  } catch (error) {
    console.error('Unexpected error creating coach note:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// DELETE endpoint for removing notes
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('noteId')

    if (!noteId) {
      return NextResponse.json({ 
        success: false, 
        error: 'noteId is required' 
      }, { status: 400 })
    }

    // Initialize Supabase client and verify coach ownership
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: any) {
            try { cookieStore.set(name, value, options) } catch (error) {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set(name, '', { ...options, maxAge: 0 }) } catch (error) {}
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', userData.id)
      .eq('status', 'approved')
      .single()

    if (coachError) {
      return NextResponse.json({ success: false, error: 'Not an approved coach' }, { status: 403 })
    }

    // Delete note (only if owned by this coach)
    const { error: deleteError } = await supabase
      .from('coach_notes')
      .delete()
      .eq('id', parseInt(noteId))
      .eq('coach_id', coachData.id)

    if (deleteError) {
      console.error('Error deleting coach note:', deleteError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete note or note not found' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    })

  } catch (error) {
    console.error('Unexpected error deleting coach note:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
