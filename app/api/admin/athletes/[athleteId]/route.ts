// /app/api/admin/athletes/[athleteId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin, getUserIdFromAuth } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const supabase = await createClient()
    const { athleteId } = await params
    const athleteIdNum = parseInt(athleteId)
    
    if (isNaN(athleteIdNum)) {
      return NextResponse.json({ error: 'Invalid athlete ID' }, { status: 400 })
    }
    
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
    
    // Get athlete data
    const { data: athlete, error: athleteError } = await supabase
      .from('users')
      .select('*')
      .eq('id', athleteIdNum)
      .eq('role', 'athlete')
      .single()
    
    if (athleteError || !athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 })
    }
    
    // Get related data in parallel
    const [
      { data: programs },
      { data: performanceLogs },
      { data: equipment },
      { data: skills },
      { data: oneRMs },
      { data: relationships }
    ] = await Promise.all([
      supabase
        .from('programs')
        .select('id, program_number, generated_at, weeks_generated')
        .eq('user_id', athleteIdNum)
        .order('generated_at', { ascending: false }),
      supabase
        .from('performance_logs')
        .select('id, logged_at, exercise_name, rpe, completion_quality')
        .eq('user_id', athleteIdNum)
        .order('logged_at', { ascending: false })
        .limit(10),
      supabase
        .from('user_equipment')
        .select('equipment_name')
        .eq('user_id', athleteIdNum),
      supabase
        .from('user_skills')
        .select('skill_name, skill_level')
        .eq('user_id', athleteIdNum),
      supabase
        .from('user_one_rms')
        .select('one_rm_index, one_rm_value')
        .eq('user_id', athleteIdNum),
      supabase
        .from('coach_athlete_relationships')
        .select(`
          id,
          permission_level,
          status,
          coaches!inner(
            id,
            coach_name,
            status
          )
        `)
        .eq('athlete_id', athleteIdNum)
        .eq('status', 'active')
    ])
    
    return NextResponse.json({
      success: true,
      athlete: {
        id: athlete.id,
        email: athlete.email,
        name: athlete.name,
        role: athlete.role,
        abilityLevel: athlete.ability_level,
        subscriptionTier: athlete.subscription_tier,
        subscriptionStatus: athlete.subscription_status,
        gender: athlete.gender,
        bodyWeight: athlete.body_weight,
        units: athlete.units,
        createdAt: athlete.created_at
      },
      programs: programs || [],
      recentActivity: {
        totalLogs: performanceLogs?.length || 0,
        recentLogs: performanceLogs || []
      },
      equipment: (equipment || []).map((e: any) => e.equipment_name),
      skills: skills || [],
      oneRMs: oneRMs || [],
      coaches: (relationships || []).map((r: any) => ({
        coachId: r.coaches.id,
        coachName: r.coaches.coach_name,
        permissionLevel: r.permission_level,
        status: r.status
      }))
    })
  } catch (error) {
    console.error('Unexpected error in admin athlete detail route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

