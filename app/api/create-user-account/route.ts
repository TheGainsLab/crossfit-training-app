import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, password, productType, userData } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Create Supabase client with service role key for admin operations
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔧 Creating auth account for:', email)

    // Create auth account with admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Skip email confirmation for paid users
    })

    if (authError) {
      console.error('❌ Auth creation error:', authError)
      
      // Handle specific error cases
      if (authError.code === 'email_exists') {
        return NextResponse.json({ 
          error: 'An account with this email already exists. Please log in instead.' 
        }, { status: 409 })
      }
      
      // Generic error for other cases
      return NextResponse.json({ 
        error: 'Account creation failed', 
        details: authError.message 
      }, { status: 400 })
    } // ← THIS CLOSING BRACE WAS MISSING

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
    }

    console.log('✅ Auth account created:', authData.user.id)

    // Find or create user record
    // Check if user record exists (may have been created by webhook)
    const { data: existingUser, error: userFindError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (userFindError) {
      console.error('❌ User lookup error:', userFindError)
      return NextResponse.json({ 
        error: 'Database error while checking user account', 
        details: userFindError.message 
      }, { status: 500 })
    }

    let userId: number

    if (existingUser) {
      // User record exists (shouldn't happen with Option B, but handle gracefully)
      userId = existingUser.id
      console.log('✅ Found existing user record:', userId)
    } else {
      // Create user record (Option B: API is the primary creator)
      console.log('📝 Creating new user record with subscription tier:', productType || 'PREMIUM')
      
      // Determine subscription tier from productType
      // Convert 'btn' -> 'BTN', 'premium' -> 'PREMIUM', 'applied_power' -> 'APPLIED_POWER'
      const subscriptionTier = productType ? productType.toUpperCase() : 'PREMIUM'
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email: email,
          name: userData.name || email.split('@')[0],
          subscription_status: 'PENDING', // Webhook will update this if it processes later
          subscription_tier: subscriptionTier,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (createError || !newUser) {
        console.error('❌ User creation error:', createError)
        return NextResponse.json({ 
          error: 'Failed to create user record', 
          details: createError?.message 
        }, { status: 500 })
      }

      userId = newUser.id
      console.log('✅ Created user record:', userId)
    }

    // Update user record with auth ID and intake data
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        auth_id: authData.user.id,
        name: userData.name,
        gender: userData.gender,
        body_weight: userData.bodyWeight ? parseFloat(userData.bodyWeight) : null,
        units: userData.units,
        ability_level: 'Beginner',
        conditioning_benchmarks: userData.conditioningBenchmarks,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ User update error:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update user data', 
        details: updateError.message 
      }, { status: 500 })
    }

    console.log('✅ User record updated with auth ID')

    // Return success with user data
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        userId: userId
      }
    })

  } catch (error) {
    console.error('❌ Account creation error:', error)
    return NextResponse.json({
      error: 'Account creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
