import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkSubscriptionAccess } from '@/lib/subscription-check'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ hasAccess: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Get user ID from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      console.error('User not found:', userError)
      return NextResponse.json({ hasAccess: false, error: 'User not found' }, { status: 404 })
    }

    // Check Engine subscription access
    const accessStatus = await checkSubscriptionAccess(userData.id, 'engine')

    return NextResponse.json(accessStatus)
  } catch (error) {
    console.error('Error checking Engine access:', error)
    return NextResponse.json({ hasAccess: false, error: 'Internal server error' }, { status: 500 })
  }
}

