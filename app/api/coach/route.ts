// /app/api/coach/apply/route.ts
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

    // Get user from users table
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

    // Get simple application data from request
    const body = await request.json()
    const {
      coachName = userData.name,
      bio = "Experienced CrossFit coach",
      specialties = ["General Fitness"],
      experienceYears = 1
    } = body

    console.log('📝 Creating coach application for user:', userData.id)

    // Check if user already has a pending/approved application
    const { data: existingApp, error: checkError } = await supabase
      .from('coach_applications')
      .select('id, status')
      .eq('user_id', userData.id)
      .single()

    if (existingApp) {
      return NextResponse.json(
        { 
          success: false, 
          error: `You already have a ${existingApp.status} coach application` 
        },
        { status: 400 }
      )
    }

    // Create coach application
    const { data: applicationData, error: applicationError } = await supabase
      .from('coach_applications')
      .insert({
        user_id: userData.id,
        application_data: {
          coachName,
          bio,
          specialties,
          experienceYears
        },
        bio,
        specialties,
        experience_years: experienceYears,
        status: 'pending'
      })
      .select()
      .single()

    if (applicationError) {
      console.error('❌ Error creating coach application:', applicationError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create application',
          details: applicationError.message
        },
        { status: 500 }
      )
    }

    // FOR TESTING: Auto-approve the application and create coach record
    console.log('🚀 Auto-approving application for testing...')

    // Update application to approved
    await supabase
      .from('coach_applications')
      .update({ 
        status: 'approved',
        reviewed_by: userData.id, // Self-approved for testing
        reviewed_at: new Date().toISOString()
      })
      .eq('id', applicationData.id)

    // Create coach record
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .insert({
        user_id: userData.id,
        coach_name: coachName,
        bio,
        specialties,
        experience_years: experienceYears,
        status: 'approved',
        approved_by: userData.id, // Self-approved for testing
        approved_at: new Date().toISOString()
      })
      .select()
      .single()

    if (coachError) {
      console.error('❌ Error creating coach record:', coachError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create coach record',
          details: coachError.message
        },
        { status: 500 }
      )
    }

    console.log('✅ Coach application and approval completed!')

    return NextResponse.json({
      success: true,
      message: 'Coach application submitted and auto-approved for testing!',
      application: {
        id: applicationData.id,
        status: 'approved'
      },
      coach: {
        id: coachData.id,
        name: coachData.coach_name,
        bio: coachData.bio,
        specialties: coachData.specialties
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in coach application:', error)
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
