// /lib/analytics/block-analyzer.ts
import { calculateTrend } from './data-processors'

export interface BlockAnalysisData {
  weeklyData: WeeklyBlockData[]
  blockTrends: BlockTrends
  exerciseBreakdown: ExerciseBreakdown
  progressionSignals: ProgressionSignal[]
}

export interface WeeklyBlockData {
  week: number
  skills_completed: number
  skills_avg_rpe: number
  skills_avg_quality: number
  technical_completed: number
  technical_avg_rpe: number
  technical_avg_quality: number
  strength_completed: number
  strength_avg_rpe: number
  strength_avg_quality: number
  accessories_completed: number
  accessories_avg_rpe: number
  accessories_avg_quality: number
  metcons_completed: number
  metcons_avg_percentile: number
  total_exercises_completed: number
  overall_avg_rpe: number
  overall_avg_quality: number
}

export interface BlockTrends {
  skills: BlockTrendData
  technical: BlockTrendData
  strength: BlockTrendData
  accessories: BlockTrendData
  metcons: MetConTrendData
}

export interface BlockTrendData {
  rpe_trend: 'improving' | 'declining' | 'stable'
  quality_trend: 'improving' | 'declining' | 'stable'
  volume_trend: 'improving' | 'declining' | 'stable'
  current_avg_rpe: number
  current_avg_quality: number
  weeks_active: number
}

export interface MetConTrendData {
  percentile_trend: 'improving' | 'declining' | 'stable'
  volume_trend: 'improving' | 'declining' | 'stable'
  current_avg_percentile: number
  weeks_active: number
}

export interface ExerciseBreakdown {
  [blockName: string]: {
    total_exercises: number
    avg_rpe: number
    avg_quality: number
    completion_rate: number
  }
}

export interface ProgressionSignal {
  block: string
  signal_type: 'progression_ready' | 'needs_attention' | 'on_track'
  message: string
  priority: 'high' | 'medium' | 'low'
  week: number
}

/**
 * Process weekly summaries data for block analysis
 */
export function processBlockAnalysisData(
  weeklySummaries: any[], 
  blockFilter: string = 'all'
): BlockAnalysisData | null {
  try {
    console.log(`📊 Processing ${weeklySummaries.length} weekly summaries for block analysis`)
    
    if (!weeklySummaries || weeklySummaries.length === 0) {
      return null
    }

    // Convert weekly summaries to standardized format
    const weeklyData: WeeklyBlockData[] = weeklySummaries.map(summary => ({
      week: summary.week,
      skills_completed: summary.skills_completed || 0,
      skills_avg_rpe: summary.skills_avg_rpe || 0,
      skills_avg_quality: summary.skills_avg_quality || 0,
      technical_completed: summary.technical_completed || 0,
      technical_avg_rpe: summary.technical_avg_rpe || 0,
      technical_avg_quality: summary.technical_avg_quality || 0,
      strength_completed: summary.strength_completed || 0,
      strength_avg_rpe: summary.strength_avg_rpe || 0,
      strength_avg_quality: summary.strength_avg_quality || 0,
      accessories_completed: summary.accessories_completed || 0,
      accessories_avg_rpe: summary.accessories_avg_rpe || 0,
      accessories_avg_quality: summary.accessories_avg_quality || 0,
      metcons_completed: summary.metcons_completed || 0,
      metcons_avg_percentile: summary.metcons_avg_percentile || 0,
      total_exercises_completed: summary.total_exercises_completed || 0,
      overall_avg_rpe: summary.overall_avg_rpe || 0,
      overall_avg_quality: summary.overall_avg_quality || 0
    }))

    // Calculate block trends
    const blockTrends = calculateBlockTrends(weeklyData)

    // Calculate exercise breakdown
    const exerciseBreakdown = calculateExerciseBreakdown(weeklyData, blockFilter)

    // Generate progression signals
    const progressionSignals = generateProgressionSignals(weeklyData, blockTrends)

    console.log(`✅ Block analysis processed: ${weeklyData.length} weeks, ${Object.keys(exerciseBreakdown).length} blocks`)

    return {
      weeklyData,
      blockTrends,
      exerciseBreakdown,
      progressionSignals
    }

} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.error(`❌ Error processing block analysis data: ${errorMessage}`)
  return null
}

}

/**
 * Calculate trends for each training block
 */
function calculateBlockTrends(weeklyData: WeeklyBlockData[]): BlockTrends {
  const blocks = ['skills', 'technical', 'strength', 'accessories']
  const blockTrends: any = {}

  blocks.forEach(block => {
    const rpeKey = `${block}_avg_rpe` as keyof WeeklyBlockData
    const qualityKey = `${block}_avg_quality` as keyof WeeklyBlockData
    const completedKey = `${block}_completed` as keyof WeeklyBlockData

    // Filter out weeks with no data for this block
    const validWeeks = weeklyData.filter(week => 
      (week[rpeKey] as number) > 0 && (week[qualityKey] as number) > 0
    )

    if (validWeeks.length > 0) {
      const rpeValues = validWeeks.map(week => week[rpeKey] as number)
      const qualityValues = validWeeks.map(week => week[qualityKey] as number)
      const volumeValues = validWeeks.map(week => week[completedKey] as number)

      blockTrends[block] = {
        rpe_trend: calculateTrend(rpeValues),
        quality_trend: calculateTrend(qualityValues),
        volume_trend: calculateTrend(volumeValues),
        current_avg_rpe: rpeValues[rpeValues.length - 1] || 0,
        current_avg_quality: qualityValues[qualityValues.length - 1] || 0,
        weeks_active: validWeeks.length
      }
    } else {
      blockTrends[block] = {
        rpe_trend: 'stable' as const,
        quality_trend: 'stable' as const,
        volume_trend: 'stable' as const,
        current_avg_rpe: 0,
        current_avg_quality: 0,
        weeks_active: 0
      }
    }
  })

  // Handle MetCons separately
  const metconWeeks = weeklyData.filter(week => week.metcons_completed > 0)
  if (metconWeeks.length > 0) {
    const percentileValues = metconWeeks.map(week => week.metcons_avg_percentile)
    const volumeValues = metconWeeks.map(week => week.metcons_completed)

    blockTrends.metcons = {
      percentile_trend: calculateTrend(percentileValues),
      volume_trend: calculateTrend(volumeValues),
      current_avg_percentile: percentileValues[percentileValues.length - 1] || 0,
      weeks_active: metconWeeks.length
    }
  } else {
    blockTrends.metcons = {
      percentile_trend: 'stable' as const,
      volume_trend: 'stable' as const,
      current_avg_percentile: 0,
      weeks_active: 0
    }
  }

  return blockTrends
}

/**
 * Calculate exercise breakdown by block
 */
function calculateExerciseBreakdown(
  weeklyData: WeeklyBlockData[], 
  blockFilter: string
): ExerciseBreakdown {
  const breakdown: ExerciseBreakdown = {}
  const blocks = blockFilter === 'all' 
    ? ['skills', 'technical', 'strength', 'accessories', 'metcons']
    : [blockFilter.toLowerCase()]

  blocks.forEach(block => {
    if (block === 'metcons') {
      // Handle MetCons differently (use percentile instead of RPE/quality)
      const validWeeks = weeklyData.filter(week => week.metcons_completed > 0)
      
      if (validWeeks.length > 0) {
        breakdown[block] = {
          total_exercises: validWeeks.reduce((sum, week) => sum + week.metcons_completed, 0),
          avg_rpe: 0, // Not applicable for MetCons
          avg_quality: validWeeks.reduce((sum, week) => sum + week.metcons_avg_percentile, 0) / validWeeks.length,
          completion_rate: Math.round((validWeeks.length / weeklyData.length) * 100)
        }
      }
    } else {
      const completedKey = `${block}_completed` as keyof WeeklyBlockData
      const rpeKey = `${block}_avg_rpe` as keyof WeeklyBlockData
      const qualityKey = `${block}_avg_quality` as keyof WeeklyBlockData

      const validWeeks = weeklyData.filter(week => 
        (week[completedKey] as number) > 0
      )

      if (validWeeks.length > 0) {
        const totalExercises = validWeeks.reduce((sum, week) => sum + (week[completedKey] as number), 0)
        const avgRPE = validWeeks
          .filter(week => (week[rpeKey] as number) > 0)
          .reduce((sum, week) => sum + (week[rpeKey] as number), 0) / validWeeks.length
        const avgQuality = validWeeks
          .filter(week => (week[qualityKey] as number) > 0)
          .reduce((sum, week) => sum + (week[qualityKey] as number), 0) / validWeeks.length

        breakdown[block] = {
          total_exercises: totalExercises,
          avg_rpe: Math.round(avgRPE * 10) / 10,
          avg_quality: Math.round(avgQuality * 10) / 10,
          completion_rate: Math.round((validWeeks.length / weeklyData.length) * 100)
        }
      }
    }
  })

  return breakdown
}

/**
 * Generate progression signals based on trends and targets
 */
function generateProgressionSignals(
  weeklyData: WeeklyBlockData[], 
  blockTrends: BlockTrends
): ProgressionSignal[] {
  const signals: ProgressionSignal[] = []
  const latestWeek = Math.max(...weeklyData.map(w => w.week))

  // RPE target ranges by block
  const rpeTargets = {
    skills: { min: 3.5, max: 6.5 },
    technical: { min: 2.5, max: 5.5 },
    strength: { min: 5.5, max: 8.0 },
    accessories: { min: 4.5, max: 7.0 }
  }

  // Check each block for progression signals
  Object.entries(blockTrends).forEach(([blockName, trends]) => {
    if (blockName === 'metcons') {
      // MetCon-specific signals
      const metconTrends = trends as MetConTrendData
      if (metconTrends.weeks_active > 0) {
        if (metconTrends.current_avg_percentile >= 80) {
          signals.push({
            block: blockName,
            signal_type: 'progression_ready',
            message: `Strong MetCon performance (${metconTrends.current_avg_percentile}th percentile avg)`,
            priority: 'medium',
            week: latestWeek
          })
        } else if (metconTrends.current_avg_percentile < 40) {
          signals.push({
            block: blockName,
            signal_type: 'needs_attention',
            message: `MetCon performance below average (${metconTrends.current_avg_percentile}th percentile)`,
            priority: 'medium',
            week: latestWeek
          })
        }
      }
    } else {
      // Regular block signals
      const blockTrendData = trends as BlockTrendData
      const targetRange = rpeTargets[blockName as keyof typeof rpeTargets]

      if (blockTrendData.weeks_active > 0 && targetRange) {
        // Check RPE vs targets
        if (blockTrendData.current_avg_rpe < targetRange.min && blockTrendData.current_avg_quality >= 3.5) {
          signals.push({
            block: blockName,
            signal_type: 'progression_ready',
            message: `Low RPE (${blockTrendData.current_avg_rpe}) with high quality - ready for progression`,
            priority: 'high',
            week: latestWeek
          })
        } else if (blockTrendData.current_avg_rpe > targetRange.max) {
          signals.push({
            block: blockName,
            signal_type: 'needs_attention',
            message: `High RPE (${blockTrendData.current_avg_rpe}) - consider scaling back intensity`,
            priority: 'high',
            week: latestWeek
          })
        }

        // Check quality trends
        if (blockTrendData.quality_trend === 'declining' && blockTrendData.current_avg_quality < 2.5) {
          signals.push({
            block: blockName,
            signal_type: 'needs_attention',
            message: `Declining quality scores - focus on technique`,
            priority: 'medium',
            week: latestWeek
          })
        }

        // Check improvement trends
        if (blockTrendData.rpe_trend === 'improving' && blockTrendData.quality_trend === 'improving') {
          signals.push({
            block: blockName,
            signal_type: 'on_track',
            message: `Positive trends in both effort and quality`,
            priority: 'low',
            week: latestWeek
          })
        }
      }
    }
  })

  return signals.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })
}

/**
 * Get weekly RPE data for charting
 */
export function getWeeklyRPEData(weeklyData: WeeklyBlockData[], blockName?: string) {
  const weeks = weeklyData.map(w => w.week).sort((a, b) => a - b)
  
  if (blockName && blockName !== 'all') {
    const rpeKey = `${blockName.toLowerCase()}_avg_rpe` as keyof WeeklyBlockData
    return {
      weeks,
      data: weeklyData.map(w => w[rpeKey] as number || null)
    }
  }

  // Return all blocks
  return {
    weeks,
    skills: weeklyData.map(w => w.skills_avg_rpe || null),
    technical: weeklyData.map(w => w.technical_avg_rpe || null),
    strength: weeklyData.map(w => w.strength_avg_rpe || null),
    accessories: weeklyData.map(w => w.accessories_avg_rpe || null)
  }
}

/**
 * Get weekly quality data for charting
 */
export function getWeeklyQualityData(weeklyData: WeeklyBlockData[], blockName?: string) {
  const weeks = weeklyData.map(w => w.week).sort((a, b) => a - b)
  
  if (blockName && blockName !== 'all') {
    const qualityKey = `${blockName.toLowerCase()}_avg_quality` as keyof WeeklyBlockData
    return {
      weeks,
      data: weeklyData.map(w => w[qualityKey] as number || null)
    }
  }

  // Return all blocks
  return {
    weeks,
    skills: weeklyData.map(w => w.skills_avg_quality || null),
    technical: weeklyData.map(w => w.technical_avg_quality || null),
    strength: weeklyData.map(w => w.strength_avg_quality || null),
    accessories: weeklyData.map(w => w.accessories_avg_quality || null)
  }
}
