// /app/api/athlete/coach-invitations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending' // pending, active, inactive, all

    // Validate status parameter
    if (!['pending', 'active', 'inactive', 'all'].includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid status. Must be: pending, active, inactive, or all' 
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

    console.log(`📋 Getting ${status} coach invitations for athlete:`, userData.name)

    // Build query based on status filter
    let query = supabase
      .from('coach_athlete_relationships')
      .select(`
        id,
        coach_id,
        permission_level,
        status,
        assigned_by,
        primary_coach,
        invitation_message,
        assigned_at,
        created_at,
        updated_at,
        coaches!coach_athlete_relationships_coach_id_fkey (
          id,
          coach_name,
          bio,
          specialties,
          certifications,
          experience_years,
          users!coaches_user_id_fkey (
            name,
            email
          )
        )
      `)
      .eq('athlete_id', userData.id)

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false })

    const { data: relationships, error: relationshipsError } = await query

    if (relationshipsError) {
      console.error('❌ Error fetching coach invitations:', relationshipsError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch invitations',
          details: relationshipsError.message
        },
        { status: 500 }
      )
    }

    if (!relationships || relationships.length === 0) {
      return NextResponse.json({
        success: true,
        invitations: [],
        summary: {
          total: 0,
          pending: 0,
          active: 0,
          inactive: 0
        },
        message: status === 'all' ? 'No coach relationships found' : `No ${status} invitations found`
      })
    }

    // Process and format the relationships
    const processedInvitations = relationships.map(rel => {
      const coach = rel.coaches
      if (!coach) return null

      return {
        relationshipId: rel.id,
        status: rel.status,
        permissionLevel: rel.permission_level,
        isPrimary: rel.primary_coach,
        assignedBy: rel.assigned_by,
        invitationMessage: rel.invitation_message,
        createdAt: rel.created_at,
        updatedAt: rel.updated_at,
        assignedAt: rel.assigned_at,
        coach: {
          id: coach[0].id,
          name: coach[0].coach_name,
          bio: coach[0].bio,
          specialties: coach[0].specialties || [],
          certifications: coach[0].certifications || [],
          experienceYears: coach[0].experience_years,
          contactName: coach[0].users?.[0].name,
          // Email only for active relationships
          email: rel.status === 'active' ? coach[0].users?.[0].email : null
        },
        // Helper properties for UI
        isPending: rel.status === 'pending',
        isActive: rel.status === 'active',
        canAccept: rel.status === 'pending',
        daysAgo: Math.floor((Date.now() - new Date(rel.created_at).getTime()) / (1000 * 60 * 60 * 24))
      }
    }).filter(Boolean)

    // Calculate summary statistics
    const summary = {
      total: processedInvitations.length,
      pending: processedInvitations.filter(inv => inv.status === 'pending').length,
      active: processedInvitations.filter(inv => inv.status === 'active').length,
      inactive: processedInvitations.filter(inv => inv.status === 'inactive').length
    }

    // Group by status for easier frontend handling
    const groupedInvitations = {
      pending: processedInvitations.filter(inv => inv.status === 'pending'),
      active: processedInvitations.filter(inv => inv.status === 'active'),
      inactive: processedInvitations.filter(inv => inv.status === 'inactive')
    }

    console.log(`✅ Retrieved ${processedInvitations.length} invitations (${summary.pending} pending, ${summary.active} active)`)

    return NextResponse.json({
      success: true,
      invitations: status === 'all' ? processedInvitations : processedInvitations.filter(inv => inv.status === status),
      groupedInvitations: status === 'all' ? groupedInvitations : undefined,
      summary,
      athlete: {
        id: userData.id,
        name: userData.name
      },
      metadata: {
        statusFilter: status,
        totalFound: processedInvitations.length,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in coach-invitations:', error)
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

// POST method to bulk update invitations (optional feature)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, relationshipIds, message = '' } = body

    // Validate input
    if (!['accept_all', 'decline_all'].includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Action must be either "accept_all" or "decline_all"' 
        },
        { status: 400 }
      )
    }

    if (!Array.isArray(relationshipIds) || relationshipIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'relationshipIds must be a non-empty array' 
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

    console.log(`🔄 Bulk ${action} for ${relationshipIds.length} invitations`)

    // Update all specified relationships
    const newStatus = action === 'accept_all' ? 'active' : 'inactive'
    const { data: updatedRelationships, error: updateError } = await supabase
      .from('coach_athlete_relationships')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('athlete_id', userData.id)
      .eq('status', 'pending')
      .in('id', relationshipIds)
      .select()

    if (updateError) {
      console.error('❌ Error bulk updating relationships:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update invitations',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    console.log(`✅ Bulk ${action} completed: ${updatedRelationships?.length || 0} invitations processed`)

    return NextResponse.json({
      success: true,
      message: `${action === 'accept_all' ? 'Accepted' : 'Declined'} ${updatedRelationships?.length || 0} invitations`,
      updatedCount: updatedRelationships?.length || 0,
      action,
      processedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Unexpected error in bulk invitation update:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
