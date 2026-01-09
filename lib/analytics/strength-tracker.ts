// /lib/analytics/strength-tracker.ts
import { calculateTrend } from './data-processors'

export interface StrengthAnalysisData {
  movements: { [movementName: string]: MovementData }
  weeklyProgression: WeeklyProgressionData[]
  strengthRatios: StrengthRatio[]
  periodization: PeriodizationData
}

export interface MovementData {
  name: string
  sessions: StrengthSession[]
  maxWeight: number
  averageWeight: number  // ADD THIS LINE
  currentWeight: number
  avgRPE: number
  avgQuality: number
  totalVolume: number // sets x reps x weight
  progressionTrend: 'improving' | 'declining' | 'stable'
  lastPerformed: string
  weeksActive: number
}

export interface StrengthSession {
  week: number
  date: string
  weight: number
  sets: number
  reps: number
  rpe: number
  quality: number
  notes?: string
}

export interface WeeklyProgressionData {
  week: number
  totalVolume: number
  avgIntensity: number // avg % of max
  avgRPE: number
  avgQuality: number
  movementsPerformed: number
}

export interface StrengthRatio {
  ratio_name: string
  current_ratio: number
  target_ratio: number
  status: 'good' | 'needs_work' | 'excellent'
}

export interface PeriodizationData {
  current_phase: string
  week_in_phase: number
  intensity_trend: 'building' | 'peaking' | 'deload'
  volume_trend: 'building' | 'maintaining' | 'reducing'
  recommended_focus: string
}

/**
 * Process strength and power performance data
 */
export function processStrengthData(
  performanceData: any[],
  weeklySummaries: any[],
  movementFilter: string = 'all'
): StrengthAnalysisData | null {
  try {
    console.log(`💪 Processing ${performanceData.length} strength sessions`)
    
    if (!performanceData || performanceData.length === 0) {
      return null
    }

    // Group data by movement
    const movements: { [key: string]: MovementData } = {}
    
    performanceData.forEach(session => {
      const movementName = standardizeMovementName(session.exercise_name)
      
      // Apply movement filter
      if (movementFilter !== 'all' && !movementName.toLowerCase().includes(movementFilter.toLowerCase())) {
        return
      }

      if (!movements[movementName]) {
        movements[movementName] = {
          name: movementName,
          sessions: [],
          maxWeight: 0,
          averageWeight: 0,  // ADD THIS LINE
          currentWeight: 0,
          avgRPE: 0,
          avgQuality: 0,
          totalVolume: 0,
          progressionTrend: 'stable',
          lastPerformed: '',
          weeksActive: 0
        }
      }

      const weight = parseWeight(session.weight_time) || 0
      const sets = parseInt(session.sets) || 1
      const reps = parseInt(session.reps) || 1
      const sessionVolume = weight * sets * reps

      const strengthSession: StrengthSession = {
        week: session.week,
        date: session.logged_at,
        weight,
        sets,
        reps,
        rpe: parseFloat(session.rpe) || 0,
        quality: parseFloat(session.quality_grade) || 0,
        notes: session.notes
      }

      movements[movementName].sessions.push(strengthSession)
      movements[movementName].totalVolume += sessionVolume
      movements[movementName].lastPerformed = session.logged_at

      // Track max weight
      if (weight > movements[movementName].maxWeight) {
        movements[movementName].maxWeight = weight
      }
    })

    // Calculate movement statistics
    Object.keys(movements).forEach(movementName => {
      const movement = movements[movementName]
      const sessions = movement.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      if (sessions.length > 0) {
        // Calculate averages
        movement.avgRPE = sessions.reduce((sum, s) => sum + s.rpe, 0) / sessions.length
        movement.avgQuality = sessions.reduce((sum, s) => sum + s.quality, 0) / sessions.length
        movement.currentWeight = sessions[sessions.length - 1].weight
        movement.weeksActive = new Set(sessions.map(s => s.week)).size
        
        // ADD THIS: Calculate average weight
        
// Volume-weighted average calculation
let totalWeightedWork = 0
let totalReps = 0

sessions.forEach(session => {
  if (session.weight > 0 && session.reps > 0) {
    const workDone = session.weight * session.reps
    totalWeightedWork += workDone
    totalReps += session.reps
  }
})

movement.averageWeight = totalReps > 0 
  ? Math.round(totalWeightedWork / totalReps)
  : 0
   
        // Calculate progression trend
        const weights_for_trend = sessions.map(s => s.weight).filter(w => w > 0)
        movement.progressionTrend = calculateTrend(weights_for_trend)
      }
    })

    // Calculate weekly progression
    const weeklyProgression = calculateWeeklyProgression(performanceData)

    // Calculate strength ratios
    const strengthRatios = calculateStrengthRatios(movements)

    // Determine periodization phase
    const periodization = determinePeriodizationPhase(weeklySummaries, weeklyProgression)

    console.log(`✅ Processed ${Object.keys(movements).length} movements, ${weeklyProgression.length} weeks`)

    return {
      movements,
      weeklyProgression,
      strengthRatios,
      periodization
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`❌ Error processing strength data: ${errorMessage}`)
    return null
  }
}

/**
 * Standardize movement names for consistency
 */
function standardizeMovementName(exerciseName: string): string {
  const movementMap: { [key: string]: string } = {
    'back squat': 'Back Squat',
    'backsquat': 'Back Squat',
    'back-squat': 'Back Squat',
    'front squat': 'Front Squat',
    'frontsquat': 'Front Squat',
    'front-squat': 'Front Squat',
    'overhead squat': 'Overhead Squat',
    'overhead-squat': 'Overhead Squat',
    'ohs': 'Overhead Squat',
    'deadlift': 'Deadlift',
    'dead lift': 'Deadlift',
    'dl': 'Deadlift',
    'clean': 'Clean',
    'power clean': 'Power Clean',
    'hang clean': 'Hang Clean',
    'clean & jerk': 'Clean & Jerk',
    'clean and jerk': 'Clean & Jerk',
    'c&j': 'Clean & Jerk',
    'snatch': 'Snatch',
    'power snatch': 'Power Snatch',
    'hang snatch': 'Hang Power Snatch',
    'hang power snatch': 'Hang Power Snatch',
    'strict press': 'Strict Press',
    'overhead press': 'Strict Press',
    'press': 'Strict Press',
    'push press': 'Push Press',
    'push jerk': 'Push Jerk',
    'split jerk': 'Split Jerk',
    'jerk': 'Jerk',
    'bench press': 'Bench Press',
    'bp': 'Bench Press'
  }

  const exerciseLower = exerciseName.toLowerCase().trim()
  return movementMap[exerciseLower] || exerciseName
}

/**
 * Parse weight from weight/time string
 */
function parseWeight(weightTime: string): number | null {
  if (!weightTime || typeof weightTime !== 'string') {
    return null
  }

  // Extract numeric weight (handles formats like "225 lbs", "100kg", "185", etc.)
  const weightMatch = weightTime.match(/(\d+(?:\.\d+)?)/);
  if (weightMatch) {
    const weight = parseFloat(weightMatch[1])
    
    // Convert kg to lbs if needed (simple heuristic: if weight is low and contains 'kg')
    if (weightTime.toLowerCase().includes('kg') && weight < 200) {
      return Math.round(weight * 2.205) // Convert kg to lbs
    }
    
    return weight
  }

  return null
}

/**
 * Calculate weekly progression data
 */
function calculateWeeklyProgression(performanceData: any[]): WeeklyProgressionData[] {
  const weeklyData: { [week: number]: any } = {}

  performanceData.forEach(session => {
    const week = session.week
    const weight = parseWeight(session.weight_time) || 0
    const sets = parseInt(session.sets) || 1
    const reps = parseInt(session.reps) || 1
    const volume = weight * sets * reps

    if (!weeklyData[week]) {
      weeklyData[week] = {
        week,
        totalVolume: 0,
        totalIntensity: 0,
        totalRPE: 0,
        totalQuality: 0,
        sessionCount: 0,
        maxWeights: []
      }
    }

    weeklyData[week].totalVolume += volume
    weeklyData[week].totalRPE += parseFloat(session.rpe) || 0
    weeklyData[week].totalQuality += parseFloat(session.quality_grade) || 0
    weeklyData[week].sessionCount += 1
    weeklyData[week].maxWeights.push(weight)
  })

  return Object.values(weeklyData).map((week: any) => ({
    week: week.week,
    totalVolume: week.totalVolume,
    avgIntensity: week.maxWeights.length > 0 ? 
      Math.max(...week.maxWeights) / Math.max(...week.maxWeights) * 100 : 0, // Simplified intensity calculation
    avgRPE: week.sessionCount > 0 ? week.totalRPE / week.sessionCount : 0,
    avgQuality: week.sessionCount > 0 ? week.totalQuality / week.sessionCount : 0,
    movementsPerformed: week.sessionCount
  })).sort((a, b) => a.week - b.week)
}

/**
 * Calculate strength ratios between movements
 */
function calculateStrengthRatios(movements: { [key: string]: MovementData }): StrengthRatio[] {
  const ratios: StrengthRatio[] = []
  
  // Common strength ratios
  const backSquat = movements['Back Squat']?.maxWeight || 0
  const frontSquat = movements['Front Squat']?.maxWeight || 0
  const deadlift = movements['Deadlift']?.maxWeight || 0
  const clean = movements['Clean']?.maxWeight || movements['Power Clean']?.maxWeight || 0
  const snatch = movements['Snatch']?.maxWeight || movements['Power Snatch']?.maxWeight || 0
  const cleanJerk = movements['Clean & Jerk']?.maxWeight || 0

  if (backSquat > 0 && frontSquat > 0) {
    const ratio = (frontSquat / backSquat) * 100
    ratios.push({
      ratio_name: 'Front Squat / Back Squat',
      current_ratio: Math.round(ratio),
      target_ratio: 85, // Target: 85% of back squat
      status: ratio >= 80 ? 'good' : ratio >= 90 ? 'excellent' : 'needs_work'
    })
  }

  if (backSquat > 0 && clean > 0) {
    const ratio = (clean / backSquat) * 100
    ratios.push({
      ratio_name: 'Clean / Back Squat',
      current_ratio: Math.round(ratio),
      target_ratio: 80, // Target: 80% of back squat
      status: ratio >= 75 ? 'good' : ratio >= 85 ? 'excellent' : 'needs_work'
    })
  }

  if (clean > 0 && snatch > 0) {
    const ratio = (snatch / clean) * 100
    ratios.push({
      ratio_name: 'Snatch / Clean',
      current_ratio: Math.round(ratio),
      target_ratio: 80, // Target: 80% of clean
      status: ratio >= 75 ? 'good' : ratio >= 85 ? 'excellent' : 'needs_work'
    })
  }

  if (deadlift > 0 && backSquat > 0) {
    const ratio = (deadlift / backSquat) * 100
    ratios.push({
      ratio_name: 'Deadlift / Back Squat',
      current_ratio: Math.round(ratio),
      target_ratio: 120, // Target: 120% of back squat
      status: ratio >= 115 ? 'good' : ratio >= 125 ? 'excellent' : 'needs_work'
    })
  }

  return ratios
}

/**
 * Determine current periodization phase
 */
function determinePeriodizationPhase(
  weeklySummaries: any[],
  weeklyProgression: WeeklyProgressionData[]
): PeriodizationData {
  // Default phase data
  let periodization: PeriodizationData = {
    current_phase: 'Build',
    week_in_phase: 1,
    intensity_trend: 'building',
    volume_trend: 'building',
    recommended_focus: 'Progressive overload with quality movement'
  }

  if (weeklySummaries.length === 0 || weeklyProgression.length === 0) {
    return periodization
  }

  const currentWeek = Math.max(...weeklySummaries.map(w => w.week))
  const recentWeeks = weeklyProgression.slice(-4) // Last 4 weeks

  if (recentWeeks.length >= 3) {
    const volumeTrend = calculateTrend(recentWeeks.map(w => w.totalVolume))
    const intensityTrend = calculateTrend(recentWeeks.map(w => w.avgRPE))

    // Determine phase based on trends and week patterns
    if (currentWeek % 4 === 0) {
      // Deload week (every 4th week)
      periodization.current_phase = 'Deload'
      periodization.intensity_trend = 'building'
      periodization.volume_trend = 'reducing'
      periodization.recommended_focus = 'Recovery and movement quality'
    } else if (intensityTrend === 'improving' && volumeTrend === 'improving') {
      periodization.current_phase = 'Build'
      periodization.intensity_trend = 'building'
      periodization.volume_trend = 'building'
      periodization.recommended_focus = 'Progressive overload'
    } else if (intensityTrend === 'improving' && volumeTrend === 'declining') {
      periodization.current_phase = 'Intensification'
      periodization.intensity_trend = 'peaking'
      periodization.volume_trend = 'reducing'
      periodization.recommended_focus = 'High intensity, low volume'
    } else {
      periodization.current_phase = 'Maintenance'
      periodization.intensity_trend = 'building'
      periodization.volume_trend = 'maintaining'
      periodization.recommended_focus = 'Consistent quality training'
    }

    periodization.week_in_phase = (currentWeek % 4) || 4
  }

  return periodization
}

/**
 * Get movement progression data for charting
 */
export function getMovementProgressionData(movement: MovementData) {
  const sessions = movement.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  return {
    weeks: sessions.map(s => s.week),
    weights: sessions.map(s => s.weight),
    rpe: sessions.map(s => s.rpe),
    quality: sessions.map(s => s.quality),
    volume: sessions.map(s => s.weight * s.sets * s.reps)
  }
}

/**
 * Calculate 1RM estimates using Epley formula
 */
export function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

/**
 * Get top performing movements
 */
export function getTopMovements(
  movements: { [key: string]: MovementData },
  sortBy: 'weight' | 'progression' | 'volume' = 'weight'
): MovementData[] {
  const movementList = Object.values(movements)
  
  switch (sortBy) {
    case 'weight':
      return movementList.sort((a, b) => b.maxWeight - a.maxWeight)
    case 'progression':
      const progressionOrder = { improving: 3, stable: 2, declining: 1 }
      return movementList.sort((a, b) => 
        progressionOrder[b.progressionTrend] - progressionOrder[a.progressionTrend]
      )
    case 'volume':
      return movementList.sort((a, b) => b.totalVolume - a.totalVolume)
    default:
      return movementList
  }
}
