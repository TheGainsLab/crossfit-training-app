// /lib/analytics/dashboard-generator.ts
import { calculateTrend } from './data-processors'

export interface DashboardData {
  overallMetrics: OverallMetrics
  blockPerformance: BlockPerformance
  progressionTrends: ProgressionTrends
  metconAnalysis?: MetConAnalysis
  recentActivity: RecentActivity
  keyInsights: string[]
}

export interface OverallMetrics {
  totalTrainingDays: number
  totalExercises: number
  averageRPE: number
  averageQuality: number
  totalVolume: number
  consistencyScore: number
  currentWeek: number
  trainingPhase: string
}

export interface BlockPerformance {
  [blockName: string]: {
    exercisesCompleted: number
    averageRPE: number
    averageQuality: number
    trend: 'improving' | 'declining' | 'stable'
    overallScore: number
    needsAttention: boolean
    readyForProgression: boolean
    topExercises: string[]
  }
}

export interface ProgressionTrends {
  rpe: 'improving' | 'declining' | 'stable'
  quality: 'improving' | 'declining' | 'stable'
  volume: 'improving' | 'declining' | 'stable'
  consistency: 'improving' | 'declining' | 'stable'
}

export interface MetConAnalysis {
  totalWorkouts: number
  averagePercentile: number
  bestTimeRange: string
  worstTimeRange: string
  trend: 'improving' | 'declining' | 'stable'
  strongestExercises: string[]
}

export interface RecentActivity {
  lastWorkoutDate: string
  daysSinceLastWorkout: number
  recentExercises: Array<{
    name: string
    block: string
    rpe: number
    quality: number
    date: string
  }>
  weeklyFrequency: number
}

export interface DashboardInput {
  performanceData: any[]
  weeklySummaries: any[]
  metconData: any[]
  timeRange: number
  dashboardType: string
}

/**
 * Generate comprehensive analytics dashboard
 */
export function generateOverallDashboard(input: DashboardInput): DashboardData | null {
  try {
    console.log(`📊 Generating dashboard from ${input.performanceData.length} performance logs, ${input.weeklySummaries.length} weekly summaries`)
    
    if (!input.performanceData && !input.weeklySummaries) {
      return null
    }

    // Calculate overall metrics
    const overallMetrics = calculateOverallMetrics(input)
    
    // Analyze block performance
    const blockPerformance = analyzeBlockPerformance(input)
    
    // Calculate progression trends
    const progressionTrends = calculateProgressionTrends(input)
    
    // Analyze MetCons if data available
    const metconAnalysis = input.metconData.length > 0 ? analyzeMetConPerformance(input.metconData) : undefined
    
    // Get recent activity
    const recentActivity = calculateRecentActivity(input.performanceData)
    
    // Generate key insights
    const keyInsights = generateKeyInsights({
      overallMetrics,
      blockPerformance,
      progressionTrends,
      metconAnalysis,
      recentActivity
    })

    console.log(`✅ Dashboard generated with ${Object.keys(blockPerformance).length} blocks analyzed`)

    return {
      overallMetrics,
      blockPerformance,
      progressionTrends,
      metconAnalysis,
      recentActivity,
      keyInsights
    }

  } catch (error) {
    console.error(`❌ Error generating dashboard: ${error.message}`)
    return null
  }
}

/**
 * Calculate overall training metrics
 */
function calculateOverallMetrics(input: DashboardInput): OverallMetrics {
  const { performanceData, weeklySummaries } = input
  
  // Calculate from performance data
  let totalRPE = 0
  let totalQuality = 0
  let totalVolume = 0
  let sessionCount = 0
  const uniqueDays = new Set<string>()

  performanceData.forEach(session => {
    const rpe = parseFloat(session.rpe) || 0
    const quality = parseFloat(session.quality_grade) || 0
    const sets = parseInt(session.sets) || 1
    const reps = parseInt(session.reps) || 1
    
    totalRPE += rpe
    totalQuality += quality
    totalVolume += sets * reps
    sessionCount++
    
    // Track unique training days
    const sessionDate = new Date(session.logged_at).toDateString()
    uniqueDays.add(sessionDate)
  })

  // Calculate consistency score (based on weekly summaries)
  const consistencyScore = calculateConsistencyScore(weeklySummaries)
  
  // Determine current week and training phase
  const currentWeek = weeklySummaries.length > 0 ? 
    Math.max(...weeklySummaries.map(w => w.week)) : 1
  const trainingPhase = determineTrainingPhase(currentWeek, weeklySummaries)

  return {
    totalTrainingDays: uniqueDays.size,
    totalExercises: sessionCount,
    averageRPE: sessionCount > 0 ? Math.round((totalRPE / sessionCount) * 10) / 10 : 0,
    averageQuality: sessionCount > 0 ? Math.round((totalQuality / sessionCount) * 10) / 10 : 0,
    totalVolume,
    consistencyScore,
    currentWeek,
    trainingPhase
  }
}

/**
 * Analyze performance by training block
 */
function analyzeBlockPerformance(input: DashboardInput): BlockPerformance {
  const { performanceData, weeklySummaries } = input
  const blockPerformance: BlockPerformance = {}
  
  // Standard training blocks
  const blocks = ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS']
  
  blocks.forEach(blockName => {
    // Get performance data for this block
    const blockSessions = performanceData.filter(session => session.block === blockName)
    
    // Get weekly summary data for this block
    const blockKey = blockName.toLowerCase().replace(/\s+/g, '_').replace(/&/g, 'and')
    const completedKey = `${blockKey}_completed`
    const rpeKey = `${blockKey}_avg_rpe`
    const qualityKey = `${blockKey}_avg_quality`
    
    let exercisesCompleted = 0
    let totalRPE = 0
    let totalQuality = 0
    let sessionCount = 0
    const rpeValues = []
    const qualityValues = []
    const exercises = new Set<string>()

    // Process performance data
    blockSessions.forEach(session => {
      const rpe = parseFloat(session.rpe) || 0
      const quality = parseFloat(session.quality_grade) || 0
      
      totalRPE += rpe
      totalQuality += quality
      sessionCount++
      
      if (rpe > 0) rpeValues.push(rpe)
      if (quality > 0) qualityValues.push(quality)
      
      exercises.add(session.exercise_name)
    })

    // Also check weekly summaries for additional data
    weeklySummaries.forEach(week => {
      if (week[completedKey]) {
        exercisesCompleted += week[completedKey]
      }
    })

    // Calculate block metrics
    const averageRPE = sessionCount > 0 ? totalRPE / sessionCount : 0
    const averageQuality = sessionCount > 0 ? totalQuality / sessionCount : 0
    const rpeTrend = rpeValues.length > 1 ? calculateTrend(rpeValues) : 'stable'
    const qualityTrend = qualityValues.length > 1 ? calculateTrend(qualityValues) : 'stable'
    
    // Determine overall trend (prioritize quality, then RPE)
    let overallTrend: 'improving' | 'declining' | 'stable' = 'stable'
    if (qualityTrend === 'improving' || (qualityTrend === 'stable' && rpeTrend === 'improving')) {
      overallTrend = 'improving'
    } else if (qualityTrend === 'declining' || (qualityTrend === 'stable' && rpeTrend === 'declining')) {
      overallTrend = 'declining'
    }

    // Calculate overall score (0-100)
    const rpeScore = averageRPE > 0 ? Math.max(0, 100 - (Math.abs(averageRPE - 6.5) * 10)) : 50
    const qualityScore = (averageQuality / 4) * 100
    const consistencyScore = sessionCount > 0 ? Math.min(100, sessionCount * 5) : 0
    const overallScore = Math.round((rpeScore + qualityScore + consistencyScore) / 3)

    // Determine status flags
    const needsAttention = averageQuality < 2.0 || averageRPE > 8.5 || sessionCount < 3
    const readyForProgression = averageQuality >= 3.5 && averageRPE <= 6.5 && overallTrend === 'improving'

    blockPerformance[blockName] = {
      exercisesCompleted: Math.max(exercisesCompleted, sessionCount),
      averageRPE: Math.round(averageRPE * 10) / 10,
      averageQuality: Math.round(averageQuality * 10) / 10,
      trend: overallTrend,
      overallScore,
      needsAttention,
      readyForProgression,
      topExercises: Array.from(exercises).slice(0, 3)
    }
  })

  return blockPerformance
}

/**
 * Calculate progression trends across all metrics
 */
function calculateProgressionTrends(input: DashboardInput): ProgressionTrends {
  const { performanceData, weeklySummaries } = input
  
  // Calculate trends from weekly summaries (more reliable for trends)
  if (weeklySummaries.length > 1) {
    const rpeValues = weeklySummaries
      .map(w => w.overall_avg_rpe)
      .filter(r => r && r > 0)
    
    const qualityValues = weeklySummaries
      .map(w => w.overall_avg_quality)
      .filter(q => q && q > 0)
    
    const volumeValues = weeklySummaries
      .map(w => w.total_exercises_completed)
      .filter(v => v && v > 0)
    
    // Calculate consistency based on completion rates
    const consistencyValues = weeklySummaries.map(week => {
      const blocks = ['skills', 'technical', 'strength', 'accessories']
      let completedBlocks = 0
      
      blocks.forEach(block => {
        const completedKey = `${block}_completed`
        if (week[completedKey] && week[completedKey] > 0) {
          completedBlocks++
        }
      })
      
      return (completedBlocks / blocks.length) * 100
    })

    return {
      rpe: rpeValues.length > 1 ? calculateTrend(rpeValues) : 'stable',
      quality: qualityValues.length > 1 ? calculateTrend(qualityValues) : 'stable',
      volume: volumeValues.length > 1 ? calculateTrend(volumeValues) : 'stable',
      consistency: consistencyValues.length > 1 ? calculateTrend(consistencyValues) : 'stable'
    }
  }

  // Fallback to performance data trends
  if (performanceData.length > 1) {
    const rpeValues = performanceData.map(p => parseFloat(p.rpe)).filter(r => r > 0)
    const qualityValues = performanceData.map(p => parseFloat(p.quality_grade)).filter(q => q > 0)
    
    return {
      rpe: rpeValues.length > 1 ? calculateTrend(rpeValues) : 'stable',
      quality: qualityValues.length > 1 ? calculateTrend(qualityValues) : 'stable',
      volume: 'stable',
      consistency: 'stable'
    }
  }

  return {
    rpe: 'stable',
    quality: 'stable',
    volume: 'stable',
    consistency: 'stable'
  }
}

/**
 * Analyze MetCon performance
 */
function analyzeMetConPerformance(metconData: any[]): MetConAnalysis {
  if (!metconData || metconData.length === 0) {
    return {
      totalWorkouts: 0,
      averagePercentile: 0,
      bestTimeRange: 'Unknown',
      worstTimeRange: 'Unknown',
      trend: 'stable',
      strongestExercises: []
    }
  }

  const percentiles = metconData.map(m => m.percentile).filter(p => p && p > 0)
  const averagePercentile = percentiles.length > 0 ? 
    Math.round(percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length) : 0

  // Group by time range to find best/worst
  const timeRangePerformance: { [key: string]: number[] } = {}
  
  metconData.forEach(workout => {
    const timeRange = workout.metcons?.time_range || 'Unknown'
    const percentile = workout.percentile
    
    if (timeRange && percentile) {
      if (!timeRangePerformance[timeRange]) {
        timeRangePerformance[timeRange] = []
      }
      timeRangePerformance[timeRange].push(percentile)
    }
  })

  // Find best and worst time ranges
  let bestTimeRange = 'Unknown'
  let worstTimeRange = 'Unknown'
  let bestAvg = 0
  let worstAvg = 100

  Object.entries(timeRangePerformance).forEach(([timeRange, percentiles]) => {
    const avg = percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length
    
    if (avg > bestAvg) {
      bestAvg = avg
      bestTimeRange = timeRange
    }
    
    if (avg < worstAvg) {
      worstAvg = avg
      worstTimeRange = timeRange
    }
  })

  // Extract strongest exercises (simplified)
  const exerciseFrequency: { [key: string]: { count: number, totalPercentile: number } } = {}
  
  metconData.forEach(workout => {
    const tasks = workout.metcons?.tasks || []
    if (Array.isArray(tasks)) {
      tasks.forEach((task: string) => {
        const exercise = extractExerciseFromTask(task)
        if (exercise) {
          if (!exerciseFrequency[exercise]) {
            exerciseFrequency[exercise] = { count: 0, totalPercentile: 0 }
          }
          exerciseFrequency[exercise].count++
          exerciseFrequency[exercise].totalPercentile += workout.percentile || 0
        }
      })
    }
  })

  const strongestExercises = Object.entries(exerciseFrequency)
    .filter(([_, data]) => data.count >= 2) // Appear in at least 2 workouts
    .map(([exercise, data]) => ({
      exercise,
      avgPercentile: data.totalPercentile / data.count
    }))
    .sort((a, b) => b.avgPercentile - a.avgPercentile)
    .slice(0, 3)
    .map(item => item.exercise)

  return {
    totalWorkouts: metconData.length,
    averagePercentile,
    bestTimeRange,
    worstTimeRange,
    trend: percentiles.length > 1 ? calculateTrend(percentiles) : 'stable',
    strongestExercises
  }
}

/**
 * Calculate recent activity metrics
 */
function calculateRecentActivity(performanceData: any[]): RecentActivity {
  if (!performanceData || performanceData.length === 0) {
    return {
      lastWorkoutDate: '',
      daysSinceLastWorkout: 0,
      recentExercises: [],
      weeklyFrequency: 0
    }
  }

  // Sort by date to get most recent
  const sortedData = performanceData.sort((a, b) => 
    new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  )

  const lastWorkout = sortedData[0]
  const lastWorkoutDate = lastWorkout.logged_at
  const daysSinceLastWorkout = Math.floor(
    (new Date().getTime() - new Date(lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Get recent exercises (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  const recentExercises = performanceData
    .filter(session => new Date(session.logged_at) >= sevenDaysAgo)
    .slice(0, 10) // Limit to last 10
    .map(session => ({
      name: session.exercise_name,
      block: session.block,
      rpe: parseFloat(session.rpe) || 0,
      quality: parseFloat(session.quality_grade) || 0,
      date: session.logged_at
    }))

  // Calculate weekly frequency (unique training days in last 7 days)
  const uniqueDays = new Set(
    performanceData
      .filter(session => new Date(session.logged_at) >= sevenDaysAgo)
      .map(session => new Date(session.logged_at).toDateString())
  )

  return {
    lastWorkoutDate,
    daysSinceLastWorkout,
    recentExercises,
    weeklyFrequency: uniqueDays.size
  }
}

/**
 * Generate key insights for the dashboard
 */
function generateKeyInsights(data: Partial<DashboardData>): string[] {
  const insights: string[] = []

  try {
    const { overallMetrics, blockPerformance, progressionTrends, metconAnalysis, recentActivity } = data

    // Overall performance insights
    if (overallMetrics) {
      if (overallMetrics.averageQuality >= 3.5) {
        insights.push(`Excellent technique mastery with ${overallMetrics.averageQuality.toFixed(1)}/4.0 average quality`)
      } else if (overallMetrics.averageQuality < 2.5) {
        insights.push(`Focus needed on movement quality (${overallMetrics.averageQuality.toFixed(1)}/4.0 average)`)
      }

      if (overallMetrics.consistencyScore >= 80) {
        insights.push(`Strong training consistency (${overallMetrics.consistencyScore}% consistency score)`)
      } else if (overallMetrics.consistencyScore < 60) {
        insights.push(`Training consistency needs improvement (${overallMetrics.consistencyScore}% score)`)
      }
    }

    // Block performance insights
    if (blockPerformance) {
      const blocks = Object.entries(blockPerformance)
      const topBlock = blocks.reduce((best, [name, data]) => 
        data.overallScore > best.score ? { name, score: data.overallScore } : best,
        { name: '', score: 0 }
      )

      if (topBlock.name) {
        insights.push(`${topBlock.name} is your strongest training area (${topBlock.score}% performance score)`)
      }

      const improvingBlocks = blocks.filter(([_, data]) => data.trend === 'improving')
      if (improvingBlocks.length > 0) {
        insights.push(`${improvingBlocks.length} training block(s) showing improvement trends`)
      }
    }

    // Progression insights
    if (progressionTrends) {
      const improving = Object.values(progressionTrends).filter(t => t === 'improving').length
      const declining = Object.values(progressionTrends).filter(t => t === 'declining').length

      if (improving > declining) {
        insights.push(`Overall positive progression with ${improving} improving metrics`)
      } else if (declining > improving) {
        insights.push(`${declining} metrics declining - review training approach`)
      }
    }

    // MetCon insights
    if (metconAnalysis && metconAnalysis.totalWorkouts > 0) {
      if (metconAnalysis.averagePercentile >= 75) {
        insights.push(`Strong MetCon performance at ${metconAnalysis.averagePercentile}th percentile average`)
      } else if (metconAnalysis.averagePercentile < 50) {
        insights.push(`MetCon conditioning opportunity (${metconAnalysis.averagePercentile}th percentile average)`)
      }

      if (metconAnalysis.bestTimeRange !== 'Unknown') {
        insights.push(`Best MetCon performance in ${metconAnalysis.bestTimeRange} time domain`)
      }
    }

    // Recent activity insights
    if (recentActivity) {
      if (recentActivity.daysSinceLastWorkout <= 2) {
        insights.push(`Active training schedule with recent workout ${recentActivity.daysSinceLastWorkout} day(s) ago`)
      } else if (recentActivity.daysSinceLastWorkout > 7) {
        insights.push(`Training gap detected - ${recentActivity.daysSinceLastWorkout} days since last workout`)
      }

      if (recentActivity.weeklyFrequency >= 4) {
        insights.push(`High training frequency with ${recentActivity.weeklyFrequency} training days this week`)
      }
    }

  } catch (error) {
    console.error('Error generating insights:', error)
    insights.push('Unable to generate insights from current data')
  }

  return insights.slice(0, 6) // Limit to 6 key insights
}

/**
 * Helper functions
 */
function calculateConsistencyScore(weeklySummaries: any[]): number {
  if (weeklySummaries.length === 0) return 0
  
  const completionRates = weeklySummaries.map(week => {
    const blocks = ['skills_completed', 'technical_completed', 'strength_completed', 'accessories_completed']
    const completedBlocks = blocks.filter(block => week[block] && week[block] > 0).length
    return (completedBlocks / blocks.length) * 100
  })
  
  return Math.round(completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length)
}

function determineTrainingPhase(currentWeek: number, weeklySummaries: any[]): string {
  // Simple phase determination based on week number
  if (currentWeek <= 4) return 'Foundation'
  if (currentWeek <= 8) return 'Development'
  if (currentWeek <= 12) return 'Peak'
  return 'Maintenance'
}

function extractExerciseFromTask(task: string): string | null {
  if (!task || typeof task !== 'string') return null
  
  // Remove numbers and common format indicators
  let exercise = task
    .replace(/^\d+\s*x?\s*/i, '') // Remove rep counts
    .replace(/\s*\(.*?\)/g, '') // Remove parenthetical content
    .replace(/\s*@.*$/g, '') // Remove @ specifications
    .trim()

  // Return cleaned exercise name
  return exercise.length > 2 ? exercise : null
}
