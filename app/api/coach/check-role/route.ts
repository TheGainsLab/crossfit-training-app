// /app/api/coach/check-role/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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
          isCoach: false,
          error: 'Unauthorized' 
        },
        { status: 401 }
      )
    }

    console.log('🔍 Checking coach role for user:', user.id)

    // Get user from users table to get the internal user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      console.log('❌ User not found in users table:', userError)
      return NextResponse.json(
        { 
          success: false, 
          isCoach: false,
          error: 'User not found' 
        },
        { status: 404 }
      )
    }

    // Check if user is an approved coach
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select(`
        id,
        coach_name,
        bio,
        specialties,
        certifications,
        experience_years,
        status,
        max_athletes,
        approved_at,
        created_at
      `)
      .eq('user_id', userData.id)
      .eq('status', 'approved')
      .single()

    if (coachError) {
      // Coach not found or not approved - this is normal for regular users
      console.log('👤 User is not an approved coach')
      return NextResponse.json({
        success: true,
        isCoach: false,
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email
        }
      })
    }

    // User is an approved coach
    console.log('✅ User is an approved coach:', coachData.coach_name)
    return NextResponse.json({
      success: true,
      isCoach: true,
      coach: {
        id: coachData.id,
        userId: userData.id,
        name: coachData.coach_name,
        bio: coachData.bio,
        specialties: coachData.specialties || [],
        certifications: coachData.certifications || [],
        experienceYears: coachData.experience_years,
        maxAthletes: coachData.max_athletes,
        approvedAt: coachData.approved_at,
        createdAt: coachData.created_at
      },
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in check-role:', error)
    return NextResponse.json(
      { 
        success: false, 
        isCoach: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
