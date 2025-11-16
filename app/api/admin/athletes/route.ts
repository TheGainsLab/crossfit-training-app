// /app/api/admin/athletes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin, getUserIdFromAuth } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { userId, error: authError } = await getUserIdFromAuth(supabase)
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin
    const userIsAdmin = await isAdmin(supabase, userId)
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') // search by name or email
    const hasProgram = searchParams.get('hasProgram') === 'true' // filter by program existence
    
    const offset = (page - 1) * limit
    
    // Build base query for athletes
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        ability_level,
        subscription_tier,
        subscription_status,
        created_at,
        programs!programs_user_id_fkey(id, generated_at)
      `, { count: 'exact' })
      .eq('role', 'athlete')
      .order('created_at', { ascending: false })
    
    // Apply hasProgram filter
    if (hasProgram) {
      // Use inner join to filter to users with programs
      query = supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          ability_level,
          subscription_tier,
          subscription_status,
          created_at,
          programs!programs_user_id_fkey!inner(id, generated_at)
        `, { count: 'exact' })
        .eq('role', 'athlete')
        .order('created_at', { ascending: false })
    }
    
    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }
    
    // Apply pagination
    const { data: users, error, count } = await query.range(offset, offset + limit - 1)
    
    if (error) {
      console.error('Error fetching athletes:', error)
      return NextResponse.json({ error: 'Failed to fetch athletes' }, { status: 500 })
    }
    
    // Transform data to include program summary
    const athletes = (users || []).map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      abilityLevel: user.ability_level,
      subscriptionTier: user.subscription_tier,
      subscriptionStatus: user.subscription_status,
      createdAt: user.created_at,
      hasProgram: Array.isArray(user.programs) && user.programs.length > 0,
      programCount: Array.isArray(user.programs) ? user.programs.length : 0,
      latestProgramDate: Array.isArray(user.programs) && user.programs.length > 0
        ? user.programs.sort((a: any, b: any) => 
            new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
          )[0].generated_at
        : null
    }))
    
    return NextResponse.json({
      success: true,
      athletes,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Unexpected error in admin athletes route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

