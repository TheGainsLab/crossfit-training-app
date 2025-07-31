// /api/analytics/[userId]/strength-tracker/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { processStrengthData } from '@/lib/analytics/strength-tracker'
import { formatStrengthCharts } from '@/lib/analytics/chart-formatters'
import { generateStrengthInsights } from '@/lib/analytics/insights-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
    const movement = searchParams.get('movement') || 'all'
    const timeRange = parseInt(searchParams.get('timeRange') || '90')
    const analysisType = searchParams.get('analysisType') || 'progression'

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

    console.log(`💪 Generating strength analysis for User ${userIdNum}, Movement: ${movement}`)

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeRange)

    // Query performance data for strength and power exercises
    const { data: performanceData, error: perfError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userIdNum)
      .eq('block', 'STRENGTH AND POWER')
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
        { error: 'No strength and power data found for the specified time range' },
        { status: 404 }
      )
    }

    // Get weekly summaries for strength context
    const { data: weeklySummaries, error: summaryError } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userIdNum)
      .order('week', { ascending: true })

    // Process the strength data
    const strengthAnalysis = processStrengthData(performanceData, weeklySummaries || [], movement)
    
    if (!strengthAnalysis) {
      return NextResponse.json(
        { error: 'Failed to process strength data' },
        { status: 500 }
      )
    }

    // Generate insights
    const insights = generateStrengthInsights(strengthAnalysis)

    // Format chart data
    const charts = formatStrengthCharts(strengthAnalysis, analysisType)

    // Calculate summary statistics
    const summary = calculateStrengthSummary(strengthAnalysis)

    const response = {
      success: true,
      data: {
        strengthAnalysis: {
          ...strengthAnalysis,
          movementFilter: movement,
          analysisType
        },
        summary,
        charts,
        insights,
        recommendations: generateStrengthRecommendations(strengthAnalysis)
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataRange: `${timeRange} days`,
        totalSessions: performanceData.length,
        movementFilter: movement,
        analysisType
      }
    }

    console.log(`✅ Strength analysis generated: ${performanceData.length} sessions analyzed`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Unexpected error in strength tracker:', error)
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
 * Calculate strength summary statistics
 */
function calculateStrengthSummary(strengthAnalysis: any) {
  const summary = {
    totalMovements: 0,
    totalSessions: 0,
    averageRPE: 0,
    averageQuality: 0,
    strongestMovement: '',
    maxWeightLifted: 0,
    progressionRate: 0, // percentage improvement
    volumeLoad: 0 // total weight moved
  }

  if (!strengthAnalysis.movements) {
    return summary
  }

  const movements = Object.values(strengthAnalysis.movements) as any[]
  summary.totalMovements = movements.length

  let totalRPE = 0
  let totalQuality = 0
  let totalSessions = 0
  let maxWeight = 0
  let strongestMovement = ''
  let totalVolume = 0

  movements.forEach(movement => {
    const sessions = movement.sessions || []
    totalSessions += sessions.length

    sessions.forEach((session: any) => {
      totalRPE += session.rpe || 0
      totalQuality += session.quality || 0
      totalVolume += (session.weight || 0) * (session.sets || 1) * (session.reps || 1)

      if ((session.weight || 0) > maxWeight) {
        maxWeight = session.weight || 0
        strongestMovement = movement.name || ''
      }
    })
  })

  if (totalSessions > 0) {
    summary.totalSessions = totalSessions
    summary.averageRPE = Math.round((totalRPE / totalSessions) * 10) / 10
    summary.averageQuality = Math.round((totalQuality / totalSessions) * 10) / 10
    summary.strongestMovement = strongestMovement
    summary.maxWeightLifted = maxWeight
    summary.volumeLoad = totalVolume
    
    // Calculate progression rate (simplified)
    const firstWeekAvg = movements.reduce((sum, m) => {
      const earlySession = m.sessions?.[0]
      return sum + (earlySession?.weight || 0)
    }, 0) / movements.length

    const lastWeekAvg = movements.reduce((sum, m) => {
      const latestSession = m.sessions?.[m.sessions.length - 1]
      return sum + (latestSession?.weight || 0)
    }, 0) / movements.length

    if (firstWeekAvg > 0) {
      summary.progressionRate = Math.round(((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100)
    }
  }

  return summary
}

/**
 * Generate strength-specific recommendations
 */
function generateStrengthRecommendations(strengthAnalysis: any) {
  const recommendations = []
  const rpeTarget = { min: 5.5, max: 8.0 } // Strength RPE targets

  if (!strengthAnalysis.movements) {
    return recommendations
  }

  const movements = Object.values(strengthAnalysis.movements) as any[]

  movements.forEach(movement => {
    const avgRPE = movement.avgRPE || 0
    const avgQuality = movement.avgQuality || 0
    const trend = movement.progressionTrend || 'stable'

    if (avgRPE < rpeTarget.min && avgQuality >= 3.5) {
      recommendations.push({
        type: 'progression',
        priority: 'high',
        text: `${movement.name}: Ready for load increase (RPE ${avgRPE}, Quality ${avgQuality.toFixed(1)})`,
        icon: '📈'
      })
    } else if (avgRPE > rpeTarget.max) {
      recommendations.push({
        type: 'deload',
        priority: 'medium',
        text: `${movement.name}: Consider reducing load (RPE ${avgRPE} above target)`,
        icon: '⚠️'
      })
    }

    if (avgQuality < 2.5) {
      recommendations.push({
        type: 'technique',
        priority: 'high',
        text: `${movement.name}: Focus on technique improvement (Quality ${avgQuality.toFixed(1)}/4.0)`,
        icon: '🎯'
      })
    }

    if (trend === 'declining') {
      recommendations.push({
        type: 'recovery',
        priority: 'medium',
        text: `${movement.name}: Performance declining - check recovery and programming`,
        icon: '😴'
      })
    }
  })

  // Add general recommendations
  const totalSessions = movements.reduce((sum, m) => sum + (m.sessions?.length || 0), 0)
  
  if (totalSessions < 8) {
    recommendations.push({
      type: 'consistency',
      priority: 'medium',
      text: 'Increase training frequency for better strength development',
      icon: '📅'
    })
  }

  return recommendations
}
