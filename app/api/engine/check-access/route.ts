import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkSubscriptionAccess, checkPremiumAccess } from '@/lib/subscription-check'

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

    // Check for Engine subscription (standalone Engine users)
    const engineAccess = await checkSubscriptionAccess(userData.id, 'engine')
    if (engineAccess.hasAccess) {
      return NextResponse.json(engineAccess)
    }
    
    // Check for Premium subscription (Premium users get Engine as part of their program)
    const premiumAccess = await checkPremiumAccess(userData.id)
    if (premiumAccess.hasAccess) {
      return NextResponse.json(premiumAccess)
    }
    
    // Also check for 'full-program' - these are Premium users (8900 price) with wrong plan name
    const fullProgramAccess = await checkSubscriptionAccess(userData.id, 'full-program')
    if (fullProgramAccess.hasAccess) {
      return NextResponse.json(fullProgramAccess)
    }

    return NextResponse.json({ hasAccess: false })
  } catch (error) {
    console.error('Error checking Engine access:', error)
    return NextResponse.json({ hasAccess: false, error: 'Internal server error' }, { status: 500 })
  }
}

