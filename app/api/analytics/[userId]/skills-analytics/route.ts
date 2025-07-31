// /api/analytics/[userId]/skills-analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { processSkillsData } from '@/lib/analytics/skills-analyzer'
import { formatSkillsCharts } from '@/lib/analytics/chart-formatters'
import { generateSkillsInsights } from '@/lib/analytics/insights-generator'
import { Recommendation } from '@/lib/analytics/types' 

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
    const skillType = searchParams.get('skillType') || 'all' // skills, technical
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

    console.log(`🎯 Generating skills analysis for User ${userIdNum}, Type: ${skillType}`)

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeRange)

    // Query performance data for skills and technical work
    const skillBlocks = skillType === 'all' 
      ? ['SKILLS', 'TECHNICAL WORK'] 
      : [skillType.toUpperCase()]

    const { data: performanceData, error: perfError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userIdNum)
      .in('block', skillBlocks)
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
        { error: 'No skills data found for the specified time range' },
        { status: 404 }
      )
    }

    // Get weekly summaries for skills context
    const { data: weeklySummaries, error: summaryError } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userIdNum)
      .order('week', { ascending: true })

    // Process the skills data
    const skillsAnalysis = processSkillsData(performanceData, weeklySummaries || [], skillType)
    
    if (!skillsAnalysis) {
      return NextResponse.json(
        { error: 'Failed to process skills data' },
        { status: 500 }
      )
    }

    // Generate insights
    const insights = generateSkillsInsights(skillsAnalysis)

    // Format chart data
    const charts = formatSkillsCharts(skillsAnalysis, analysisType)

    // Calculate summary statistics
    const summary = calculateSkillsSummary(skillsAnalysis)

    const response = {
      success: true,
      data: {
        skillsAnalysis: {
          ...skillsAnalysis,
          skillTypeFilter: skillType,
          analysisType
        },
        summary,
        charts,
        insights,
        recommendations: generateSkillsRecommendations(skillsAnalysis)
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataRange: `${timeRange} days`,
        totalSessions: performanceData.length,
        skillTypeFilter: skillType,
        analysisType
      }
    }

    console.log(`✅ Skills analysis generated: ${performanceData.length} sessions analyzed`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Unexpected error in skills analytics:', error)
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
 * Calculate skills summary statistics
 */
function calculateSkillsSummary(skillsAnalysis: any) {
  const summary = {
    totalSkills: 0,
    totalSessions: 0,
    averageRPE: 0,
    averageQuality: 0,
    masteredSkills: 0, // Grade A skills
    developingSkills: 0, // Grade B & C skills
    strugglingSkills: 0, // Grade D skills
    totalReps: 0,
    consistencyRate: 0 // % of skills practiced regularly
  }

  if (!skillsAnalysis.skills) {
    return summary
  }

  const skills = Object.values(skillsAnalysis.skills) as any[]
  summary.totalSkills = skills.length

  let totalRPE = 0
  let totalQuality = 0
  let totalSessions = 0
  let totalReps = 0
  let regularSkills = 0

  skills.forEach(skill => {
    const sessions = skill.sessions || []
    totalSessions += sessions.length

    // Count as "regular" if practiced in last 2 weeks
    const recentSessions = sessions.filter((s: any) => {
      const sessionDate = new Date(s.date)
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      return sessionDate >= twoWeeksAgo
    })

    if (recentSessions.length > 0) {
      regularSkills++
    }

    sessions.forEach((session: any) => {
      totalRPE += session.rpe || 0
      totalQuality += session.quality || 0
      totalReps += (session.sets || 1) * (session.reps || 1)
    })

    // Categorize skills by quality grade
    const avgQuality = skill.avgQuality || 0
    if (avgQuality >= 3.5) {
      summary.masteredSkills++
    } else if (avgQuality >= 2.0) {
      summary.developingSkills++
    } else {
      summary.strugglingSkills++
    }
  })

  if (totalSessions > 0) {
    summary.totalSessions = totalSessions
    summary.averageRPE = Math.round((totalRPE / totalSessions) * 10) / 10
    summary.averageQuality = Math.round((totalQuality / totalSessions) * 10) / 10
    summary.totalReps = totalReps
    summary.consistencyRate = Math.round((regularSkills / skills.length) * 100)
  }

  return summary
}

/**
 * Generate skills-specific recommendations
 */

function generateSkillsRecommendations(skillsAnalysis: any): Recommendation[] {  // ← Add return type
  const recommendations: Recommendation[] = []  // ← Add array type
  const rpeTarget = { min: 3.5, max: 6.5 } // Skills RPE targets

  if (!skillsAnalysis.skills) {
    return recommendations
  }


  const skills = Object.values(skillsAnalysis.skills) as any[]

  // Analyze each skill for recommendations
  skills.forEach(skill => {
    const avgRPE = skill.avgRPE || 0
    const avgQuality = skill.avgQuality || 0
    const daysSinceLast = skill.daysSinceLast || 0

    // Quality-based recommendations
    if (avgQuality >= 3.5 && avgRPE <= rpeTarget.max) {
      recommendations.push({
        type: 'progression',
        priority: 'high',
        text: `${skill.name}: Mastery achieved! Ready for advanced variations or higher volume`,
        icon: '🎯'
      })
    } else if (avgQuality < 2.0) {
      recommendations.push({
        type: 'focus',
        priority: 'high',
        text: `${skill.name}: Needs consistent practice - focus on quality over quantity`,
        icon: '📚'
      })
    }

    // Frequency recommendations
    if (daysSinceLast > 14) {
      recommendations.push({
        type: 'frequency',
        priority: 'medium',
        text: `${skill.name}: ${daysSinceLast} days since last practice - consider adding back to routine`,
        icon: '📅'
      })
    }

    // RPE-based recommendations
    if (avgRPE > rpeTarget.max) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        text: `${skill.name}: High effort (RPE ${avgRPE}) - consider scaling or improving efficiency`,
        icon: '⚖️'
      })
    } else if (avgRPE < rpeTarget.min && avgQuality >= 3.0) {
      recommendations.push({
        type: 'challenge',
        priority: 'low',
        text: `${skill.name}: Low effort with good quality - ready for increased challenge`,
        icon: '📈'
      })
    }
  })

  // Overall recommendations
  const masteredCount = skills.filter(s => (s.avgQuality || 0) >= 3.5).length
  const totalSkills = skills.length

  if (masteredCount / totalSkills >= 0.7) {
    recommendations.push({
      type: 'expansion',
      priority: 'medium',
      text: `Strong skill development! Consider adding new skills to continue growth`,
      icon: '🌟'
    })
  } else if (masteredCount / totalSkills < 0.3) {
    recommendations.push({
      type: 'focus',
      priority: 'high',
      text: `Focus on mastering current skills before adding new ones`,
      icon: '🎯'
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
  })
}
