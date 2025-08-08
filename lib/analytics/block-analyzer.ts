// /lib/analytics/block-analyzer.ts
import { calculateTrend } from './data-processors'

export interface BlockAnalysisData {
  weeklyData: WeeklyBlockData[]
  blockTrends: BlockTrends
  exerciseBreakdown: ExerciseBreakdown
  blockSummaries: BlockSummary[]
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

export interface BlockSummary {
  blockName: string
  exercisesCompleted: number
  percentageOfTotal: number
  avgRPE: number | null
  avgQuality: number | null
  qualityGrade: string
  qualityTrend: 'improving' | 'declining' | 'stable'
  rpeTrend: 'improving' | 'declining' | 'stable'
  volumeTrend: 'improving' | 'declining' | 'stable'
  weeksActive: number
  lastActiveWeek: number | null
}

// Quality grade conversion utilities
export function convertQualityToGrade(numericQuality: number): string {
  if (numericQuality >= 3.5) return 'A'
  if (numericQuality >= 2.5) return 'B'  
  if (numericQuality >= 1.5) return 'C'
  return 'D'
}

export function convertQualityToGradeDetailed(numericQuality: number): string {
  if (numericQuality >= 3.7) return 'A'
  if (numericQuality >= 3.3) return 'A-'
  if (numericQuality >= 2.7) return 'B+'
  if (numericQuality >= 2.3) return 'B'
  if (numericQuality >= 1.7) return 'B-'
  if (numericQuality >= 1.3) return 'C+'
  if (numericQuality >= 1.0) return 'C'
  return 'D'
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

    // Generate clean block summaries
    const blockSummaries = generateBlockSummaries(weeklyData, blockTrends, exerciseBreakdown)

    console.log(`✅ Block analysis processed: ${weeklyData.length} weeks, ${Object.keys(exerciseBreakdown).length} blocks`)

    return {
      weeklyData,
      blockTrends,
      exerciseBreakdown,
      blockSummaries
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
 * Generate clean block summaries for display
 */
function generateBlockSummaries(
  weeklyData: WeeklyBlockData[],
  blockTrends: BlockTrends,
  exerciseBreakdown: ExerciseBreakdown
): BlockSummary[] {
  const blockNames: { [key: string]: string } = {
    'skills': 'Skills',
    'technical': 'Technical',
    'strength': 'Strength',
    'accessories': 'Accessories',
    'metcons': 'MetCons'
  }

  const summaries: BlockSummary[] = []
  
  // Calculate total exercises across all blocks
  const totalExercises = Object.values(exerciseBreakdown).reduce(
    (sum, block) => sum + block.total_exercises, 0
  )

  // Process each block
  Object.keys(blockNames).forEach(blockKey => {
    const blockName = blockNames[blockKey]
    const breakdown = exerciseBreakdown[blockKey]
    const trends = blockTrends[blockKey as keyof BlockTrends]

    if (breakdown) {
      // Find the most recent week with activity for this block
      const completedKey = `${blockKey}_completed` as keyof WeeklyBlockData
      const activeWeeks = weeklyData.filter(week => (week[completedKey] as number) > 0)
      const lastActiveWeek = activeWeeks.length > 0 
        ? Math.max(...activeWeeks.map(week => week.week))
        : null

      const exercisesCompleted = breakdown.total_exercises
      const percentageOfTotal = totalExercises > 0 
        ? Math.round((exercisesCompleted / totalExercises) * 100) 
        : 0

      let avgRPE: number | null = null
      let avgQuality: number | null = null
      let qualityGrade = 'N/A'

      if (blockKey === 'metcons') {
        // For MetCons, use percentile data
        avgQuality = breakdown.avg_quality
        qualityGrade = avgQuality ? `${Math.round(avgQuality)}th %ile` : 'N/A'
      } else {
        // For other blocks, use RPE and quality grades
        avgRPE = breakdown.avg_rpe > 0 ? breakdown.avg_rpe : null
        avgQuality = breakdown.avg_quality > 0 ? breakdown.avg_quality : null
        qualityGrade = avgQuality ? convertQualityToGradeDetailed(avgQuality) : 'N/A'
      }

      summaries.push({
        blockName,
        exercisesCompleted,
        percentageOfTotal,
        avgRPE,
        avgQuality,
        qualityGrade,
        qualityTrend: trends ? (trends as BlockTrendData).quality_trend || 'stable' : 'stable',
        rpeTrend: trends ? (trends as BlockTrendData).rpe_trend || 'stable' : 'stable',
        volumeTrend: trends ? (trends as BlockTrendData).volume_trend || 'stable' : 'stable',
        weeksActive: trends ? trends.weeks_active || 0 : 0,
        lastActiveWeek
      })
    }
  })

  // Sort by exercise count (most active first)
  return summaries.sort((a, b) => b.exercisesCompleted - a.exercisesCompleted)
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

/**
 * Get summary statistics for overview
 */
export function getBlockAnalyticsSummary(blockSummaries: BlockSummary[]) {
  const totalExercises = blockSummaries.reduce((sum, block) => sum + block.exercisesCompleted, 0)
  const activeBlocks = blockSummaries.filter(block => block.exercisesCompleted > 0).length
  const totalWeekBlocks = blockSummaries.reduce((sum, block) => sum + block.weeksActive, 0)
  
  const mostActiveBlock = blockSummaries.reduce((max, block) => 
    block.exercisesCompleted > max.exercisesCompleted ? block : max
  )

  const qualityDistribution = blockSummaries
    .filter(block => block.qualityGrade !== 'N/A' && !block.qualityGrade.includes('%ile'))
    .map(block => ({ name: block.blockName, grade: block.qualityGrade }))

  return {
    totalExercises,
    activeBlocks,
    totalWeekBlocks,
    mostActiveBlock,
    qualityDistribution
  }
}
