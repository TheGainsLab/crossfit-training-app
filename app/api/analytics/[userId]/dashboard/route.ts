// /api/analytics/[userId]/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateOverallDashboard } from '@/lib/analytics/dashboard-generator'
import { formatDashboardCharts } from '@/lib/analytics/chart-formatters'
import { canAccessAthleteData, getUserIdFromAuth } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
    // New: optional range parameter (e.g., "30d"). Defaults to all-time.
    const rangeParam = (searchParams.get('range') || '').trim().toLowerCase()
    // Back-compat: legacy timeRange param in days (number)
    const legacyTimeRange = searchParams.get('timeRange')
    const parsedLegacyDays = legacyTimeRange ? parseInt(legacyTimeRange) : NaN
    const rangeDays = (() => {
      if (rangeParam) {
        const match = rangeParam.match(/^(\d+)\s*([dwmy])$/)
        if (match) {
          const value = parseInt(match[1])
          const unit = match[2]
          if (!isNaN(value) && value > 0) {
            if (unit === 'd') return value
            if (unit === 'w') return value * 7
            if (unit === 'm') return value * 30
            if (unit === 'y') return value * 365
          }
        }
        // If malformed, ignore and treat as all-time
        return null
      }
      if (!isNaN(parsedLegacyDays) && parsedLegacyDays > 0) {
        return parsedLegacyDays
      }
      return null
    })()

    const includeMetCons = false  // Temporarily disable MetCons
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

    // Get requesting user ID from authentication
    const { userId: requestingUserId, error: authError } = await getUserIdFromAuth(supabase)
    if (authError || !requestingUserId) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to access this athlete's data
    const { hasAccess, permissionLevel, isCoach } = await canAccessAthleteData(
      supabase, 
      requestingUserId, 
      userIdNum
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to user data' },
        { status: 403 }
      )
    }

    // Calculate optional date range (all-time if rangeDays is null)
    const startDate = rangeDays ? new Date() : null
    if (startDate && rangeDays) {
      startDate.setDate(startDate.getDate() - rangeDays)
    }

    // Fetch all required data concurrently
    const [
      performanceData,
      weeklySummaries,
      metconData
    ] = await Promise.all([
      // Performance logs
      (async () => {
        const query = supabase
          .from('performance_logs')
          .select('*')
          .eq('user_id', userIdNum)
          .order('logged_at', { ascending: true })
        if (startDate) {
          // Apply time window only when specified
          // @ts-ignore - query builder chaining
          query.gte('logged_at', startDate.toISOString())
        }
        return query
      })(),
      
      // Weekly summaries
      supabase
        .from('weekly_summaries')
        .select('*')
        .eq('user_id', userIdNum)
        .order('week', { ascending: true }),
      
      // MetCon data (if requested)
      includeMetCons ? (async () => {
        const query = supabase
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
          .order('completed_at', { ascending: true })
        if (startDate) {
          // @ts-ignore - query builder chaining
          query.gte('completed_at', startDate.toISOString())
        }
        return query
      })() : Promise.resolve({ data: [], error: null })
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
      timeRange: (rangeDays || 0),
      dashboardType
    })
    
    if (!dashboardData) {
      return NextResponse.json(
        { error: 'Failed to generate dashboard data' },
        { status: 500 }
      )
    }

    // Generate insights
    const insights = dashboardData.keyInsights || []
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
        dataRange: rangeDays ? `${rangeDays} days` : 'all-time',
        totalPerformanceLogs: performanceData.data?.length || 0,
        totalWeeklySummaries: weeklySummaries.data?.length || 0,
        totalMetCons: includeMetCons ? (metconData.data?.length || 0) : 0,
        dashboardType,
        range: rangeDays ? `${rangeDays}d` : 'all-time',
        includeMetCons,
        accessType: isCoach ? 'coach' : 'self',
        permissionLevel
      }
    }

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
