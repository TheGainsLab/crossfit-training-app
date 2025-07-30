import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { processExerciseData } from '@/lib/analytics/data-processors'
import { formatTrendsChart, formatVolumeChart, formatMetConChart } from '@/lib/analytics/chart-formatters'
import { generateDataReflectiveInsights, generateCoachCollaborativeRecommendations } from '@/lib/analytics/insights-generator'
import { ExerciseDeepDiveResponse } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
    const exercise = searchParams.get('exercise')
    const block = searchParams.get('block')
    const timeRange = parseInt(searchParams.get('timeRange') || '90')

    // Validate required parameters
    if (!exercise || !block) {
      return NextResponse.json(
        { error: 'Exercise and block parameters are required' },
        { status: 400 }
      )
    }

    const userIdNum = parseInt(userId)
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    console.log(`📊 Processing analytics request for User ${userIdNum}: ${exercise} in ${block}`)

    // Initialize Supabase client with proper SSR cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Use ANON key for client-side auth
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    )

    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('❌ Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required - please log in' },
        { status: 401 }
      )
    }

    console.log(`✅ Authenticated user: ${user.email}`)

    // Verify user owns this data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('auth_id', user.id)
      .eq('id', userIdNum)
      .single()

    if (userError) {
      console.error('❌ User verification error:', userError)
      return NextResponse.json(
        { error: 'User verification failed', details: userError.message },
        { status: 500 }
      )
    }

    if (!userData) {
      return NextResponse.json(
        { error: 'Access denied - you can only view your own analytics' },
        { status: 403 }
      )
    }

    console.log(`✅ User verified: ${userData.email} (ID: ${userData.id})`)

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeRange)

    // Query performance data using SERVICE_ROLE_KEY for database access
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for database queries
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    )

    const { data: performanceData, error: perfError } = await serviceSupabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userIdNum)
      .eq('exercise_name', exercise)
      .eq('block', block)
      .gte('logged_at', startDate.toISOString())
      .order('logged_at', { ascending: true })

    if (perfError) {
      console.error('❌ Failed to fetch performance data:', perfError)
      return NextResponse.json(
        { error: 'Failed to fetch performance data', details: perfError.message },
        { status: 500 }
      )
    }

    if (!performanceData || performanceData.length === 0) {
      return NextResponse.json(
        { 
          error: 'No performance data found', 
          message: `No data found for "${exercise}" in "${block}" block within the last ${timeRange} days.`,
          suggestion: 'Try a different exercise, block, or extend the time range.'
        },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${performanceData.length} performance records`)

    // Query MetCon data if this is a MetCon exercise
    let metconData = []
    if (block === 'METCONS') {
      const { data: metconResults, error: metconError } = await serviceSupabase
        .from('program_metcons')
        .select(`
          *,
          metcons!inner(
            workout_id,
            time_range,
            tasks
          )
        `)
        .eq('user_id', userIdNum)
        .gte('completed_at', startDate.toISOString())

      if (!metconError && metconResults) {
        // Filter MetCons that contain this exercise
        metconData = metconResults.filter(result => {
          const tasks = result.metcons?.tasks
          if (Array.isArray(tasks)) {
            return tasks.some((task: any) => 
              typeof task === 'string' && task.toLowerCase().includes(exercise.toLowerCase())
            )
          }
          return false
        })
        console.log(`✅ Found ${metconData.length} MetCon records`)
      }
    }

    // Process the data
    const metrics = processExerciseData(performanceData, metconData)
    if (!metrics) {
      return NextResponse.json(
        { error: 'Failed to process exercise data' },
        { status: 500 }
      )
    }

    // Generate insights and recommendations
    const insights = generateDataReflectiveInsights(metrics)
    const recommendations = generateCoachCollaborativeRecommendations(metrics)

    // Format chart data
    const trendsChart = formatTrendsChart(metrics)
    const volumeChart = formatVolumeChart(metrics)
    const metconChart = metrics.metcon ? formatMetConChart(metrics) : undefined

    // Get exercise category (optional)
    const { data: exerciseInfo } = await serviceSupabase
      .from('exercises')
      .select('accessory_category, difficulty_level')
      .eq('name', exercise)
      .single()

    const response: ExerciseDeepDiveResponse = {
      success: true,
      data: {
        exerciseInfo: {
          name: metrics.exerciseName,
          block: metrics.block,
          category: exerciseInfo?.accessory_category || 'Unknown',
          timesPerformed: metrics.timesPerformed
        },
        summary: {
          avgRPE: Math.round(metrics.rpe.average * 10) / 10,
          avgQuality: metrics.quality.average,
          avgQualityGrade: metrics.quality.averageGrade,
          totalVolume: `${metrics.volume.totalSets} sets • ${metrics.volume.totalReps} reps`,
          lastPerformed: `Week ${performanceData[performanceData.length - 1].week}`,
          daysSinceLast: metrics.timing.daysSinceLast
        },
        trends: {
          rpe: {
            direction: metrics.rpe.trend,
            current: metrics.rpe.current,
            best: metrics.rpe.best,
            worst: metrics.rpe.worst,
            change: metrics.rpe.current - metrics.rpe.best
          },
          quality: {
            direction: metrics.quality.trend,
            current: metrics.quality.current,
            best: 4,
            worst: 1,
            change: metrics.quality.current - 1
          }
        },
        volume: {
          totalSets: metrics.volume.totalSets,
          totalReps: metrics.volume.totalReps,
          volumeDisplay: `${metrics.volume.totalSets} sets • ${metrics.volume.totalReps} reps`,
          avgSetsPerSession: Math.round(metrics.volume.avgSetsPerSession * 10) / 10,
          avgRepsPerSession: Math.round(metrics.volume.avgRepsPerSession * 10) / 10,
          maxSetsInSession: metrics.volume.maxSetsInSession,
          maxRepsInSession: metrics.volume.maxRepsInSession
        },
        metcon: metrics.metcon ? {
          appearances: metrics.metcon.appearances,
          avgPercentile: metrics.metcon.avgPercentile,
          bestPercentile: metrics.metcon.bestPercentile,
          worstPercentile: metrics.metcon.worstPercentile,
          trend: metrics.metcon.trend
        } : undefined,
        charts: {
          trendsChart,
          volumeChart,
          metconChart
        },
        insights,
        recommendations
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataRange: `${timeRange} days`,
        totalSessions: performanceData.length,
        blockContext: `${exercise} in ${block} block`
      }
    }

    console.log(`✅ Analytics generated successfully: ${performanceData.length} sessions, ${insights.length} insights`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Unexpected error in exercise deep dive:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
