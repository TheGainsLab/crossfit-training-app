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
      .eq('email', user.email)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ hasAccess: false, error: 'User not found' }, { status: 404 })
    }

    // Check Applied Power subscription access
    const accessStatus = await checkSubscriptionAccess(userData.id, 'applied_power')

    return NextResponse.json(accessStatus)
  } catch (error) {
    console.error('Error checking Applied Power access:', error)
    return NextResponse.json({ hasAccess: false, error: 'Internal server error' }, { status: 500 })
  }
}
