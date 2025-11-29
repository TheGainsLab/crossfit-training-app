import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch user's favorites
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      )
    }

    // Get user's numeric ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    // Fetch favorites
    const { data: favorites, error: favoritesError } = await supabase
      .from('food_favorites')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })

    if (favoritesError) {
      console.error('Favorites fetch error:', favoritesError)
      return NextResponse.json(
        { error: 'Failed to fetch favorites' }, 
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      favorites: favorites || []
    })

  } catch (error: any) {
    console.error('❌ Error fetching favorites:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    )
  }
}

// POST: Add or remove a favorite
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      )
    }

    // Get user's numeric ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    const body = await request.json()
    const { foodId, foodName, servingId, servingDescription, action } = body

    if (!foodId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: foodId, action' }, 
        { status: 400 }
      )
    }

    if (action === 'add') {
      if (!foodName) {
        return NextResponse.json(
          { error: 'foodName required for add action' }, 
          { status: 400 }
        )
      }

      // Add favorite (or update if exists)
      const { data, error: insertError } = await supabase
        .from('food_favorites')
        .upsert({
          user_id: userData.id,
          food_id: foodId,
          food_name: foodName,
          serving_id: servingId || null,
          serving_description: servingDescription || null,
          is_auto_favorite: false, // Manual favorites are not auto
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,food_id'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Add favorite error:', insertError)
        return NextResponse.json(
          { error: 'Failed to add favorite' }, 
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        favorite: data
      })
    } else if (action === 'remove') {
      // Remove favorite
      const { error: deleteError } = await supabase
        .from('food_favorites')
        .delete()
        .eq('user_id', userData.id)
        .eq('food_id', foodId)

      if (deleteError) {
        console.error('Remove favorite error:', deleteError)
        return NextResponse.json(
          { error: 'Failed to remove favorite' }, 
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Favorite removed'
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "add" or "remove"' }, 
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('❌ Error managing favorite:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    )
  }
}

