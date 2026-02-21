// /app/api/coach/assign-athlete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Handle cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Handle cookie removal errors
            }
          },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized' 
        },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json()
    const { 
      athleteEmail, 
      athleteId, 
      permissionLevel = 'view', 
      message = '',
      setPrimary = false 
    } = body

    // Validate required fields
    if (!athleteEmail && !athleteId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Either athleteEmail or athleteId is required' 
        },
        { status: 400 }
      )
    }

    // Validate permission level
    if (!['view', 'edit', 'full'].includes(permissionLevel)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid permission level. Must be: view, edit, or full' 
        },
        { status: 400 }
      )
    }

    // Get coach user from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found' 
        },
        { status: 404 }
      )
    }

    // Verify user is an approved coach
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('id, coach_name, max_athletes')
      .eq('user_id', userData.id)
      .eq('status', 'approved')
      .single()

    if (coachError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not an approved coach' 
        },
        { status: 403 }
      )
    }

    // Find the athlete by email or ID
    let athleteData
    if (athleteId) {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', athleteId)
        .single()
      
      if (error || !data) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Athlete not found by ID' 
          },
          { status: 404 }
        )
      }
      athleteData = data
    } else {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('email', athleteEmail)
        .single()
      
      if (error || !data) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Athlete not found by email. They may need to create an account first.' 
          },
          { status: 404 }
        )
      }
      athleteData = data
    }

    // Check if coach is trying to assign themselves
    if (athleteData.id === userData.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You cannot assign yourself as an athlete' 
        },
        { status: 400 }
      )
    }

    // Check current athlete count for coach
    const { data: currentAthletes, error: countError } = await supabase
      .from('coach_athlete_relationships')
      .select('id')
      .eq('coach_id', coachData.id)
      .eq('status', 'active')

    if (countError) {
      console.error('Error checking athlete count:', countError)
    } else if (currentAthletes && currentAthletes.length >= (coachData.max_athletes || 50)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Maximum athlete limit reached (${coachData.max_athletes || 50} athletes)` 
        },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const { data: existingRelationship, error: existingError } = await supabase
      .from('coach_athlete_relationships')
      .select('id, status')
      .eq('coach_id', coachData.id)
      .eq('athlete_id', athleteData.id)
      .single()

    if (existingRelationship) {
      if (existingRelationship.status === 'active') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'This athlete is already assigned to you' 
          },
          { status: 400 }
        )
      } else if (existingRelationship.status === 'pending') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'You already have a pending invitation with this athlete' 
          },
          { status: 400 }
        )
      }
    }

    // Create the coach-athlete relationship (pending status)
    const { data: relationshipData, error: relationshipError } = await supabase
      .from('coach_athlete_relationships')
      .insert({
        coach_id: coachData.id,
        athlete_id: athleteData.id,
        permission_level: permissionLevel,
        status: 'pending',
        assigned_by: 'coach',
        primary_coach: setPrimary,
        invitation_message: message
      })
      .select()
      .single()

    if (relationshipError) {
      console.error('❌ Error creating coach-athlete relationship:', relationshipError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create invitation',
          details: relationshipError.message
        },
        { status: 500 }
      )
    }

    // TODO: In production, send email notification to athlete
    // await sendInvitationEmail(athleteData.email, coachData.coach_name, message)

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully!',
      invitation: {
        id: relationshipData.id,
        athlete: {
          id: athleteData.id,
          name: athleteData.name,
          email: athleteData.email
        },
        coach: {
          id: coachData.id,
          name: coachData.coach_name
        },
        permissionLevel,
        isPrimary: setPrimary,
        status: 'pending',
        message: message || null,
        createdAt: relationshipData.created_at
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in assign-athlete:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET method to search for athletes (optional)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    if (!search || search.length < 3) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Search query must be at least 3 characters' 
        },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Handle cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Handle cookie removal errors
            }
          },
        },
      }
    )

    // Verify user is authenticated coach
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized' 
        },
        { status: 401 }
      )
    }

    // Search for users by name or email
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(20)

    if (searchError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Search failed',
          details: searchError.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      athletes: users || [],
      searchQuery: search
    })

  } catch (error) {
    console.error('❌ Unexpected error in athlete search:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
