// /api/analytics/[userId]/metcon-analyzer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { processMetConTimeDomainData } from '@/lib/analytics/metcon-analyzer'
import { formatMetConCharts } from '@/lib/analytics/chart-formatters'
import { generateMetConInsights } from '@/lib/analytics/insights-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
    const timeDomain = searchParams.get('timeDomain') || 'all'
    const timeRange = parseInt(searchParams.get('timeRange') || '90')

    const userIdNum = parseInt(userId)
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Handle cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // Handle cookie removal errors
            }
          },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user ownership
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('id', userIdNum)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Unauthorized access to user data' },
        { status: 403 }
      )
    }

    console.log(`📊 Generating MetCon time domain analysis for User ${userIdNum}`)

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeRange)

    // Query MetCon performance data - FIXED: Join through programs table to get user data
    const { data: metconData, error: metconError } = await supabase
      .from('program_metcons')
      .select(`
        *,
        metcons!inner(
          workout_id,
          time_range,
          tasks
        ),
        programs(
          user_id
        )
      `)
      .eq('programs.user_id', userIdNum)
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: true })

    if (metconError) {
      console.error('❌ Failed to fetch MetCon data:', metconError)
      return NextResponse.json(
        { error: 'Failed to fetch MetCon data', details: metconError.message },
        { status: 500 }
      )
    }

    if (!metconData || metconData.length === 0) {
      return NextResponse.json(
        { error: 'No MetCon data found for the specified time range' },
        { status: 404 }
      )
    }

    // Process the MetCon data by time domain
    
// Get the user's actual MetCon exercises from performance_logs
const { data: actualPerformanceData } = await supabase
  .from('performance_logs')
  .select('exercise_name')
  .eq('user_id', userIdNum)
  .eq('block', 'METCONS');

const actualExercises = new Set(
  (actualPerformanceData || [])
    .map((record: any) => record.exercise_name)
    .filter((name: string) => name && name.trim().length > 0)
);

console.log('User actual MetCon exercises:', Array.from(actualExercises));

const timeDomainAnalysis = processMetConTimeDomainData(metconData, timeDomain, actualExercises)


    
    if (!timeDomainAnalysis) {
      return NextResponse.json(
        { error: 'Failed to process MetCon time domain data' },
        { status: 500 }
      )
    }

    // Generate insights
    const insights = generateMetConInsights(timeDomainAnalysis)

    // Format chart data
    const charts = formatMetConCharts(timeDomainAnalysis)

    const response = {
      success: true,
      data: {
        timeDomainAnalysis: {
          timeDomains: timeDomainAnalysis.timeDomains,
          exercises: timeDomainAnalysis.exercises,
          overallAverages: timeDomainAnalysis.overallAverages,
          equipmentAnalysis: timeDomainAnalysis.equipmentAnalysis || {}
        },
        summary: {
          totalWorkouts: metconData.length,
          timeDomainsCovered: Object.keys(timeDomainAnalysis.timeDomains).length,
          averagePercentile: Math.round(
            Object.values(timeDomainAnalysis.timeDomains)
              .reduce((sum: number, domain: any) => sum + domain.avgPercentile, 0) / 
            Object.keys(timeDomainAnalysis.timeDomains).length
          ),
          strongestDomain: Object.entries(timeDomainAnalysis.overallAverages)
            .reduce((best: any, [domain, avg]: [string, any]) => 
              avg > best.average ? { domain, average: avg } : best, 
              { domain: 'None', average: 0 }
            ).domain,
          analysisRange: `${timeRange} days`
        },
        charts,
        insights
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataRange: `${timeRange} days`,
        totalMetCons: metconData.length,
        timeDomainFilter: timeDomain,
        analysisType: 'MetCon Time Domain Analysis'
      }
    }

    console.log(`✅ MetCon analysis generated: ${metconData.length} workouts analyzed`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Unexpected error in MetCon analyzer:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
