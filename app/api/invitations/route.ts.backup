import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Get user data
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (userDataError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Get pending invitations
    const { data: invitations, error: inviteError } = await supabase
      .from('coach_athlete_relationships')
      .select(`
        id,
        permission_level,
        invitation_message,
        created_at,
        coaches!coach_athlete_relationships_coach_id_fkey (
          id,
          coach_name,
          bio,
          users!coaches_user_id_fkey (
            name,
            email
          )
        )
      `)
      .eq('athlete_id', userData.id)
      .eq('status', 'pending')

    if (inviteError) {
      return NextResponse.json({ success: false, error: inviteError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      invitations: invitations || [] 
    })

  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
