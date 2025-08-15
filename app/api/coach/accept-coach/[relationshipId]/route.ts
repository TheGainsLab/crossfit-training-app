// /app/api/athlete/accept-coach/[relationshipId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ relationshipId: string }> }
) {
  try {
    const { relationshipId } = await params
    
    // Validate relationshipId
    const relationshipIdNum = parseInt(relationshipId)
    if (isNaN(relationshipIdNum)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid relationship ID' 
        },
        { status: 400 }
      )
    }

    // Get request body
    const body = await request.json()
    const { action, message = '' } = body

    // Validate action
    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Action must be either "accept" or "decline"' 
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

    // Get athlete user from users table
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

    console.log(`🤝 Athlete ${userData.name} ${action}ing coach invitation...`)

    // Get the pending relationship with coach details
    const { data: relationship, error: relationshipError } = await supabase
      .from('coach_athlete_relationships')
      .select(`
        id,
        coach_id,
        athlete_id,
        permission_level,
        status,
        assigned_by,
        primary_coach,
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
      .eq('id', relationshipIdNum)
      .eq('athlete_id', userData.id)
      .eq('status', 'pending')
      .single()

    if (relationshipError || !relationship) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invitation not found or already processed' 
        },
        { status: 404 }
      )
    }

    const coach = relationship.coaches
    if (!coach) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Coach data not found' 
        },
        { status: 404 }
      )
    }

    // Update the relationship status
    const newStatus = action === 'accept' ? 'active' : 'inactive'
    const { data: updatedRelationship, error: updateError } = await supabase
      .from('coach_athlete_relationships')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', relationshipIdNum)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating relationship status:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update invitation status',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    if (action === 'accept') {
      console.log('✅ Coach invitation accepted successfully')
      
      // TODO: In production, send notification email to coach
      // await sendAcceptanceNotificationEmail(coach.users.email, userData.name)

      return NextResponse.json({
        success: true,
        message: 'Coach invitation accepted successfully!',
        relationship: {
          id: updatedRelationship.id,
          status: 'active',
          coach: {
            id: coach.id,
            name: coach.coach_name,
            bio: coach.bio
          },
          athlete: {
            id: userData.id,
            name: userData.name
          },
          permissionLevel: relationship.permission_level,
          isPrimary: relationship.primary_coach,
          acceptedAt: updatedRelationship.updated_at
        }
      })
    } else {
      console.log('❌ Coach invitation declined')
      
      // TODO: In production, send notification email to coach
      // await sendDeclineNotificationEmail(coach.users.email, userData.name, message)

      return NextResponse.json({
        success: true,
        message: 'Coach invitation declined',
        relationship: {
          id: updatedRelationship.id,
          status: 'inactive',
          coach: {
            id: coach.id,
            name: coach.coach_name
          },
          declinedAt: updatedRelationship.updated_at,
          declineMessage: message || null
        }
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error in accept-coach:', error)
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

// GET method to view invitation details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ relationshipId: string }> }
) {
  try {
    const { relationshipId } = await params
    
    // Validate relationshipId
    const relationshipIdNum = parseInt(relationshipId)
    if (isNaN(relationshipIdNum)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid relationship ID' 
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

    // Get athlete user from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
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

    // Get the invitation details
    const { data: relationship, error: relationshipError } = await supabase
      .from('coach_athlete_relationships')
      .select(`
        id,
        permission_level,
        status,
        assigned_by,
        primary_coach,
        invitation_message,
        created_at,
        coaches!coach_athlete_relationships_coach_id_fkey (
          id,
          coach_name,
          bio,
          specialties,
          experience_years
        )
      `)
      .eq('id', relationshipIdNum)
      .eq('athlete_id', userData.id)
      .single()

    if (relationshipError || !relationship) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invitation not found' 
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: relationship.id,
        status: relationship.status,
        permissionLevel: relationship.permission_level,
        isPrimary: relationship.primary_coach,
        message: relationship.invitation_message,
        createdAt: relationship.created_at,
        coach: {
          id: relationship.coaches.id,
          name: relationship.coaches.coach_name,
          bio: relationship.coaches.bio,
          specialties: relationship.coaches.specialties || [],
          experienceYears: relationship.coaches.experience_years
        }
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in get invitation details:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
