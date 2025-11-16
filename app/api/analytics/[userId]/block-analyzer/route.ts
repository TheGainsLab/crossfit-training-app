// /api/analytics/[userId]/block-analyzer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { processBlockAnalysisData } from '@/lib/analytics/block-analyzer'
import { formatBlockCharts } from '@/lib/analytics/chart-formatters'
import { generateBlockInsights } from '@/lib/analytics/insights-generator'
import { canAccessAthleteData, getUserIdFromAuth } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
    const blockName = searchParams.get('block') || 'all'
    const timeRange = parseInt(searchParams.get('timeRange') || '12') // weeks
    const analysisType = searchParams.get('analysisType') || 'rpe-trends'

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

    console.log(`📊 Generating block analysis for User ${userIdNum}, Block: ${blockName} (${isCoach ? `Coach access - ${permissionLevel}` : 'Self access'})`)

    // Query weekly summaries for block analysis
    const { data: weeklySummaries, error: summaryError } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userIdNum)
      .gte('week', Math.max(1, 13 - timeRange)) // Get last N weeks
      .lte('week', 12)
      .order('week', { ascending: true })

    if (summaryError) {
      console.error('❌ Failed to fetch weekly summaries:', summaryError)
      return NextResponse.json(
        { error: 'Failed to fetch weekly summaries', details: summaryError.message },
        { status: 500 }
      )
    }

    if (!weeklySummaries || weeklySummaries.length === 0) {
      return NextResponse.json(
        { error: 'No weekly summary data found' },
        { status: 404 }
      )
    }

    // Process the block analysis data
    const blockAnalysis = processBlockAnalysisData(weeklySummaries, blockName)
    
    if (!blockAnalysis) {
      return NextResponse.json(
        { error: 'Failed to process block analysis data' },
        { status: 500 }
      )
    }

    // Generate insights
    const insights = generateBlockInsights(blockAnalysis, blockName)

    // Format chart data based on analysis type
    const charts = formatBlockCharts(blockAnalysis, analysisType)

    // Calculate summary statistics
    const summary = calculateBlockSummary(blockAnalysis, blockName)

    const response = {
      success: true,
      data: {
        blockAnalysis: {
          ...blockAnalysis,
          blockName,
          analysisType
        },
        summary,
        charts,
        insights,
        recommendations: generateBlockRecommendations(blockAnalysis, blockName)
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        timeRange: `${timeRange} weeks`,
        totalWeeks: weeklySummaries.length,
        blockFilter: blockName,
        analysisType
      }
    }

    console.log(`✅ Block analysis generated: ${weeklySummaries.length} weeks analyzed`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Unexpected error in block analyzer:', error)
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
 * Calculate block summary statistics
 */
function calculateBlockSummary(blockAnalysis: any, blockName: string) {
  const summary = {
    totalWeeks: 0,
    averageRPE: 0,
    averageQuality: 0,
    totalVolume: 0,
    completionRate: 0,
    trendDirection: 'stable' as 'improving' | 'declining' | 'stable'
  }

  // Calculate based on block type
  if (blockName === 'all') {
    // Aggregate across all blocks
    const blocks = ['skills', 'technical', 'strength', 'accessories']
    let totalRPE = 0
    let totalQuality = 0
    let weekCount = 0

    blocks.forEach(block => {
      const blockKey = `${block}_avg_rpe`
      const qualityKey = `${block}_avg_quality`
      const completedKey = `${block}_completed`

      blockAnalysis.weeklyData?.forEach((week: any) => {
        if (week[blockKey] && week[qualityKey]) {
          totalRPE += week[blockKey]
          totalQuality += week[qualityKey]
          weekCount++
        }
      })
    })

    if (weekCount > 0) {
      summary.averageRPE = Math.round((totalRPE / weekCount) * 10) / 10
      summary.averageQuality = Math.round((totalQuality / weekCount) * 10) / 10
    }
  } else {
    // Block-specific calculations
    const blockKey = `${blockName.toLowerCase()}_avg_rpe`
    const qualityKey = `${blockName.toLowerCase()}_avg_quality`
    const completedKey = `${blockName.toLowerCase()}_completed`

    const validWeeks = blockAnalysis.weeklyData?.filter((week: any) => 
      week[blockKey] && week[qualityKey]
    ) || []

    if (validWeeks.length > 0) {
      summary.totalWeeks = validWeeks.length
      summary.averageRPE = Math.round(
        (validWeeks.reduce((sum: number, week: any) => sum + week[blockKey], 0) / validWeeks.length) * 10
      ) / 10
      summary.averageQuality = Math.round(
        (validWeeks.reduce((sum: number, week: any) => sum + week[qualityKey], 0) / validWeeks.length) * 10
      ) / 10
      summary.totalVolume = validWeeks.reduce((sum: number, week: any) => sum + (week[completedKey] || 0), 0)
      summary.completionRate = Math.round((summary.totalVolume / (validWeeks.length * 5)) * 100) // Assuming ~5 exercises per week per block
    }
  }

  return summary
}

/**
 * Generate block-specific recommendations
 */
function generateBlockRecommendations(blockAnalysis: any, blockName: string) {
  const recommendations = []

  // RPE target ranges for different blocks
  const rpeTargets = {
    'skills': { min: 3.5, max: 6.5 },
    'technical': { min: 2.5, max: 5.5 },
    'strength': { min: 5.5, max: 8.0 },
    'accessories': { min: 4.5, max: 7.0 },
    'metcons': { min: 6.0, max: 8.5 }
  }

  const summary = calculateBlockSummary(blockAnalysis, blockName)
  const targetRange = rpeTargets[blockName.toLowerCase() as keyof typeof rpeTargets]

  if (targetRange && summary.averageRPE > 0) {
    if (summary.averageRPE < targetRange.min) {
      recommendations.push({
        type: 'intensity',
        priority: 'medium',
        text: `${blockName} intensity below target range (${summary.averageRPE} vs ${targetRange.min}-${targetRange.max}). Consider increasing difficulty.`,
        icon: '📈'
      })
    } else if (summary.averageRPE > targetRange.max) {
      recommendations.push({
        type: 'intensity',
        priority: 'high',
        text: `${blockName} intensity above target range (${summary.averageRPE} vs ${targetRange.min}-${targetRange.max}). Consider scaling back.`,
        icon: '⚠️'
      })
    } else {
      recommendations.push({
        type: 'intensity',
        priority: 'low',
        text: `${blockName} intensity on target (${summary.averageRPE} in ${targetRange.min}-${targetRange.max} range). Maintain current approach.`,
        icon: '✅'
      })
    }
  }

  if (summary.averageQuality > 0) {
    if (summary.averageQuality >= 3.5) {
      recommendations.push({
        type: 'quality',
        priority: 'low',
        text: `Excellent quality scores (${summary.averageQuality}/4.0). Ready for progression challenges.`,
        icon: '🎯'
      })
    } else if (summary.averageQuality < 2.5) {
      recommendations.push({
        type: 'quality',
        priority: 'medium',
        text: `Quality scores need attention (${summary.averageQuality}/4.0). Focus on technique refinement.`,
        icon: '🔧'
      })
    }
  }

  if (summary.completionRate < 70) {
    recommendations.push({
      type: 'consistency',
      priority: 'medium',
      text: `Completion rate at ${summary.completionRate}%. Work on consistency to maximize training benefits.`,
      icon: '📅'
    })
  }

  return recommendations
}
