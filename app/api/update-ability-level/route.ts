import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Create Supabase client with service role key
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

    console.log('🎯 Recalculating ability level for user:', userId)

    // Call determine-user-ability function
    const abilityResponse = await fetch(
      `${supabaseUrl}/functions/v1/determine-user-ability`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      }
    )

    if (!abilityResponse.ok) {
      const errorText = await abilityResponse.text()
      console.error('⚠️ Failed to determine ability:', errorText)
      return NextResponse.json({ 
        error: 'Failed to determine ability',
        details: errorText
      }, { status: 500 })
    }

    const abilityResult = await abilityResponse.json()
    console.log(`✅ Ability determined: ${abilityResult.ability} (${abilityResult.advancedCount} advanced, ${abilityResult.intermediateCount} intermediate)`)

    // Update users table with new ability_level
    const { error: abilityUpdateError } = await supabaseAdmin
      .from('users')
      .update({ 
        ability_level: abilityResult.ability,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (abilityUpdateError) {
      console.error('⚠️ Failed to update ability_level:', abilityUpdateError)
      return NextResponse.json({ 
        error: 'Failed to update ability level',
        details: abilityUpdateError.message
      }, { status: 500 })
    }

    console.log(`✅ Updated ability_level to: ${abilityResult.ability}`)

    return NextResponse.json({
      success: true,
      ability: abilityResult.ability,
      advancedCount: abilityResult.advancedCount,
      intermediateCount: abilityResult.intermediateCount
    })

  } catch (error) {
    console.error('❌ Update ability level error:', error)
    return NextResponse.json({
      error: 'Failed to update ability level',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

