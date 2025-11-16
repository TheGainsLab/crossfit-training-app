// /app/api/admin/check-role/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin, getUserIdFromAuth } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (authError || !userId) {
      return NextResponse.json({
        success: false,
        isAdmin: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    // Check if user is admin
    const userIsAdmin = await isAdmin(supabase, userId)
    
    if (userIsAdmin) {
      // Get user details
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', userId)
        .single()
      
      return NextResponse.json({
        success: true,
        isAdmin: true,
        user: userData
      })
    }
    
    return NextResponse.json({
      success: true,
      isAdmin: false,
      user: { id: userId }
    })
  } catch (error) {
    console.error('Unexpected error in admin check-role:', error)
    return NextResponse.json({
      success: false,
      isAdmin: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

