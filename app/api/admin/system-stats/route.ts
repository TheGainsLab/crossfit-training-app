// /app/api/admin/system-stats/route.ts
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
    
    // Get recent activity date ranges
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const oneDayAgo = new Date()
    oneDayAgo.setHours(oneDayAgo.getHours() - 24)
    
    // Get all stats in parallel
    const [
      { data: users, count: userCount },
      { data: athletes, count: athleteCount },
      { data: coaches, count: coachCount },
      { data: admins, count: adminCount },
      { data: premiumUsers, count: premiumCount },
      { data: freeUsers, count: freeCount },
      { data: btnUsers, count: btnCount },
      { data: appliedPowerUsers, count: appliedPowerCount },
      { data: nullTierUsers, count: nullTierCount },
      { data: approvedCoaches },
      { data: programs, count: programCount },
      { data: usersWithProgramsData },
      { data: performanceLogs, count: logCount },
      { data: activeUsersData },
      { data: relationships, count: relationshipCount },
      { data: activeRelationships, count: activeRelationshipCount },
      { count: recentLogs }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'PREMIUM'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'FREE'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'BTN'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'APPLIED_POWER'),
      supabase.from('users').select('*', { count: 'exact', head: true }).is('subscription_tier', null),
      supabase.from('coaches').select('id').eq('status', 'approved'),
      supabase.from('programs').select('*', { count: 'exact', head: true }),
      supabase.from('programs').select('user_id'), // Get all user_ids to count distinct
      supabase.from('performance_logs').select('*', { count: 'exact', head: true }),
      supabase.from('performance_logs').select('user_id').gte('logged_at', oneDayAgo.toISOString()), // Active users in last 24h
      supabase.from('coach_athlete_relationships').select('*', { count: 'exact', head: true }),
      supabase.from('coach_athlete_relationships').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('performance_logs').select('*', { count: 'exact', head: true }).gte('logged_at', sevenDaysAgo.toISOString())
    ])
    
    // Count distinct users with programs
    const uniqueUsersWithPrograms = new Set(
      (usersWithProgramsData || []).map((p: any) => p.user_id)
    )
    
    // Count distinct active users (last 24 hours)
    const uniqueActiveUsers = new Set(
      (activeUsersData || []).map((log: any) => log.user_id)
    )
    
    const { count: recentPrograms } = await supabase
      .from('programs')
      .select('*', { count: 'exact', head: true })
      .gte('generated_at', sevenDaysAgo.toISOString())
    
    return NextResponse.json({
      success: true,
      stats: {
        users: {
          total: userCount || 0,
          athletes: athleteCount || 0,
          coaches: coachCount || 0,
          admins: adminCount || 0
        },
        subscriptions: {
          premium: premiumCount || 0,
          free: freeCount || 0,
          btn: btnCount || 0,
          appliedPower: appliedPowerCount || 0,
          null: nullTierCount || 0,
          total: (premiumCount || 0) + (freeCount || 0) + (btnCount || 0) + (appliedPowerCount || 0) + (nullTierCount || 0)
        },
        coaches: {
          total: (approvedCoaches || []).length,
          approved: (approvedCoaches || []).length
        },
        programs: {
          total: programCount || 0,
          usersWithPrograms: uniqueUsersWithPrograms.size || 0
        },
        activity: {
          totalPerformanceLogs: logCount || 0,
          activeUsers: uniqueActiveUsers.size || 0,
          recentLogs: recentLogs || 0,
          recentPrograms: recentPrograms || 0
        },
        relationships: {
          total: relationshipCount || 0,
          active: activeRelationshipCount || 0
        }
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Unexpected error in admin system-stats route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

