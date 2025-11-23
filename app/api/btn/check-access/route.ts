import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkBTNFeatureAccess } from '@/lib/subscription-check'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ hasAccess: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Get user ID from database using auth_id (more reliable than email)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, subscription_tier, subscription_status')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      console.error('User not found:', userError)
      return NextResponse.json({ hasAccess: false, error: 'User not found' }, { status: 404 })
    }

    console.log(`Checking BTN access for user ${userData.id}, tier: ${userData.subscription_tier}, status: ${userData.subscription_status}`)

    // Check BTN feature access (BTN or Premium subscription)
    const accessStatus = await checkBTNFeatureAccess(userData.id)

    console.log(`Access check result:`, accessStatus)

    return NextResponse.json(accessStatus)
  } catch (error) {
    console.error('Error checking BTN access:', error)
    return NextResponse.json({ hasAccess: false, error: 'Internal server error' }, { status: 500 })
  }
}
