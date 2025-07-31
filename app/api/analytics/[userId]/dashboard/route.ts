// /api/analytics/[userId]/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateOverallDashboard } from '@/lib/analytics/dashboard-generator'
import { formatDashboardCharts } from '@/lib/analytics/chart-formatters'
import { generateDashboardInsights } from '@/lib/analytics/insights-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
    const timeRange = parseInt(searchParams.get('timeRange') || '30')
    const includeMetCons = searchParams.get('includeMetCons') !== 'false'
    const dashboardType = searchParams.get('type') || 'overview' // overview, detailed, summary

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

    console.log(`📊 Generating analytics dashboard for User ${userIdNum}`)

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeRange)

    // Fetch all required data concurrently
    const [
      performanceData,
      weeklySummaries,
      metconData
    ] = await Promise.all([
      // Performance logs
      supabase
        .from('performance_logs')
        .select('*')
        .eq('user_id', userIdNum)
        .gte('logged_at', startDate.toISOString())
        .order('logged_at', { ascending: true }),
      
      // Weekly summaries
      supabase
        .from('weekly_summaries')
        .select('*')
        .eq('user_id', userIdNum)
        .order('week', { ascending: true }),
      
      // MetCon data (if requested)
      includeMetCons ? supabase
        .from('program_metcons')
        .select(`
          *,
          metcons!inner(
            workout_id,
            time_range,
            tasks,
            workout_format
          )
        `)
        .eq('user_id', userIdNum)
        .gte('completed_at', startDate.toISOString())
        .order('completed_at', { ascending: true }) : Promise.resolve({ data: [], error: null })
    ])

    // Check for errors
    if (performanceData.error) {
      console.error('❌ Failed to fetch performance data:', performanceData.error)
      return NextResponse.json(
        { error: 'Failed to fetch performance data', details: performanceData.error.message },
        { status: 500 }
      )
    }

    if (weeklySummaries.error) {
      console.error('❌ Failed to fetch weekly summaries:', weeklySummaries.error)
      return NextResponse.json(
        { error: 'Failed to fetch weekly summaries', details: weeklySummaries.error.message },
        { status: 500 }
      )
    }

    if (includeMetCons && metconData.error) {
      console.error('❌ Failed to fetch MetCon data:', metconData.error)
      return NextResponse.json(
        { error: 'Failed to fetch MetCon data', details: metconData.error.message },
        { status: 500 }
      )
    }

    // Generate comprehensive dashboard
    const dashboardData = generateOverallDashboard({
      performanceData: performanceData.data || [],
      weeklySummaries: weeklySummaries.data || [],
      metconData: includeMetCons ? (metconData.data || []) : [],
      timeRange,
      dashboardType
    })
    
    if (!dashboardData) {
      return NextResponse.json(
        { error: 'Failed to generate dashboard data' },
        { status: 500 }
      )
    }

    // Generate insights
    const insights = generateDashboardInsights(dashboardData)

    // Format chart data
    const charts = formatDashboardCharts(dashboardData)

    const response = {
      success: true,
      data: {
        dashboard: {
          ...dashboardData,
          dashboardType,
          includeMetCons
        },
        charts,
        insights,
        summary: generateDashboardSummary(dashboardData),
        recommendations: generateDashboardRecommendations(dashboardData)
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataRange: `${timeRange} days`,
        totalPerformanceLogs: performanceData.data?.length || 0,
        totalWeeklySummaries: weeklySummaries.data?.length || 0,
        totalMetCons: includeMetCons ? (metconData.data?.length || 0) : 0,
        dashboardType,
        includeMetCons
      }
    }

    console.log(`✅ Dashboard generated successfully`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Unexpected error in dashboard generator:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * Generate high-level dashboard summary
 */
function generateDashboardSummary(dashboardData: any) {
  const summary = {
    trainingDays: 0,
    totalExercises: 0,
    averageRPE: 0,
    averageQuality: 0,
    strongestBlock: '',
    weakestBlock: '',
    overallProgress: 'stable' as 'improving' | 'declining' | 'stable',
    nextFocus: ''
  }

  try {
    // Calculate from dashboard data
    if (dashboardData.overallMetrics) {
      summary.trainingDays = dashboardData.overallMetrics.totalTrainingDays || 0
      summary.totalExercises = dashboardData.overallMetrics.totalExercises || 0
      summary.averageRPE = dashboardData.overallMetrics.averageRPE || 0
      summary.averageQuality = dashboardData.overallMetrics.averageQuality || 0
    }

    // Determine strongest and weakest blocks
    if (dashboardData.blockPerformance) {
      const blocks = Object.entries(dashboardData.blockPerformance)
      if (blocks.length > 0) {
        const sortedBlocks = blocks.sort((a: any, b: any) => 
          (b[1].overallScore || 0) - (a[1].overallScore || 0)
        )
        summary.strongestBlock = sortedBlocks[0][0]
        summary.weakestBlock = sortedBlocks[sortedBlocks.length - 1][0]
      }
    }

    // Determine overall progress trend
    if (dashboardData.progressionTrends) {
      const trends = Object.values(dashboardData.progressionTrends)
      const improvingCount = trends.filter(t => t === 'improving').length
      const decliningCount = trends.filter(t => t === 'declining').length
      
      if (improvingCount > decliningCount) {
        summary.overallProgress = 'improving'
      } else if (decliningCount > improvingCount) {
        summary.overallProgress = 'declining'
      }
    }

    // Suggest next focus area
    if (summary.weakestBlock) {
      summary.nextFocus = `Focus on ${summary.weakestBlock.toLowerCase()} development`
    } else if (summary.averageQuality < 2.5) {
      summary.nextFocus = 'Improve movement quality across all blocks'
    } else if (summary.averageRPE > 8) {
      summary.nextFocus = 'Work on recovery and pacing'
    } else {
      summary.nextFocus = 'Continue progressive development'
    }

  } catch (error) {
    console.error('Error generating dashboard summary:', error)
  }

  return summary
}

/**
 * Generate dashboard-level recommendations
 */
function generateDashboardRecommendations(dashboardData: any) {
  const recommendations = []

  try {
    // Overall training recommendations
    if (dashboardData.overallMetrics) {
      const metrics = dashboardData.overallMetrics
      
      if (metrics.totalTrainingDays < 15) {
        recommendations.push({
          type: 'frequency',
          priority: 'high',
          text: 'Increase training frequency for better adaptations',
          icon: '📅'
        })
      }

      if (metrics.averageRPE > 8.5) {
        recommendations.push({
          type: 'intensity',
          priority: 'high',
          text: 'Consider reducing overall training intensity for better recovery',
          icon: '⚠️'
        })
      } else if (metrics.averageRPE < 5) {
        recommendations.push({
          type: 'intensity',
          priority: 'medium',
          text: 'Training intensity is conservative - consider progressive challenges',
          icon: '📈'
        })
      }

      if (metrics.averageQuality < 2.5) {
        recommendations.push({
          type: 'quality',
          priority: 'high',
          text: 'Focus on movement quality and technique refinement',
          icon: '🎯'
        })
      }
    }

    // Block-specific recommendations
    if (dashboardData.blockPerformance) {
      Object.entries(dashboardData.blockPerformance).forEach(([block, data]: [string, any]) => {
        if (data.needsAttention) {
          recommendations.push({
            type: 'block_focus',
            priority: 'medium',
            text: `${block} performance needs attention - review programming and technique`,
            icon: '🔧'
          })
        } else if (data.readyForProgression) {
          recommendations.push({
            type: 'progression',
            priority: 'low',
            text: `${block} showing strong progress - ready for increased challenges`,
            icon: '🚀'
          })
        }
      })
    }

    // MetCon recommendations
    if (dashboardData.metconAnalysis && dashboardData.metconAnalysis.averagePercentile < 50) {
      recommendations.push({
        type: 'conditioning',
        priority: 'medium',
        text: 'MetCon performance below average - focus on conditioning and pacing',
        icon: '🏃‍♂️'
      })
    }

  } catch (error) {
    console.error('Error generating dashboard recommendations:', error)
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
  })
}
