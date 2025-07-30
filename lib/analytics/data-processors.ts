// /lib/analytics/data-processors.ts
import { ExerciseMetrics } from './types'

export function qualityGradeToNumeric(grade: string): number {
  const mapping = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }
  return mapping[grade as keyof typeof mapping] || 0
}

export function numericToQualityGrade(average: number): string {
  if (average >= 3.5) return 'A'
  if (average >= 2.5) return 'B'
  if (average >= 1.5) return 'C'
  return 'D'
}

export function calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' {
  if (values.length < 2) return 'stable'
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2))
  const secondHalf = values.slice(Math.floor(values.length / 2))
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length
  
  const diff = secondAvg - firstAvg
  const threshold = 0.3
  
  if (diff > threshold) return 'improving'
  if (diff < -threshold) return 'declining'
  return 'stable'
}

export function calculateDaysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function processExerciseData(
  performanceData: any[], 
  metconData: any[] = []
): ExerciseMetrics | null {
  if (!performanceData || performanceData.length === 0) {
    return null
  }

  // Sort by date
  const sortedData = performanceData.sort((a, b) => 
    new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  )

  const exerciseName = sortedData[0].exercise_name
  const block = sortedData[0].block

  // Convert quality grades to numeric
  const qualityValues = sortedData
    .filter(d => d.quality_grade)
    .map(d => qualityGradeToNumeric(d.quality_grade))

  const rpeValues = sortedData
    .filter(d => d.rpe && d.rpe > 0)
    .map(d => d.rpe)

  const setValues = sortedData
    .filter(d => d.sets && d.sets > 0)
    .map(d => parseInt(d.sets) || 0)

  const repsData = sortedData.map(d => {
    const sets = parseInt(d.sets) || 0
    const reps = parseInt(d.reps) || 0
    return sets * reps
  }).filter(r => r > 0)

  // Calculate metrics
  const totalSets = setValues.reduce((sum, sets) => sum + sets, 0)
  const totalReps = repsData.reduce((sum, reps) => sum + reps, 0)

  const avgRPE = rpeValues.length > 0 ? 
    rpeValues.reduce((sum, r) => sum + r, 0) / rpeValues.length : 0

  const avgQuality = qualityValues.length > 0 ? 
    qualityValues.reduce((sum, q) => sum + q, 0) / qualityValues.length : 0

  // Get unique weeks
  const weeks = [...new Set(sortedData.map(d => d.week))].sort((a, b) => a - b)

  // Build progression data
  const progressionData = {
    weeks: sortedData.map(d => d.week),
    dates: sortedData.map(d => d.logged_at.split('T')[0]),
    rpe: sortedData.map(d => d.rpe || 0),
    quality: sortedData.map(d => d.quality_grade ? qualityGradeToNumeric(d.quality_grade) : 0),
    sets: sortedData.map(d => parseInt(d.sets) || 0),
    reps: sortedData.map(d => parseInt(d.reps) || 0),
    volume: sortedData.map(d => (parseInt(d.sets) || 0) * (parseInt(d.reps) || 0))
  }

  // Process MetCon data if available
  let metconMetrics = undefined
  if (metconData && metconData.length > 0) {
    const percentiles = metconData.map(m => m.percentile).filter(p => p > 0)
    if (percentiles.length > 0) {
      metconMetrics = {
        appearances: metconData.length,
        avgPercentile: Math.round(percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length),
        bestPercentile: Math.max(...percentiles),
        worstPercentile: Math.min(...percentiles),
        trend: calculateTrend(percentiles)
      }
    }
  }

  const firstSession = sortedData[0]
  const lastSession = sortedData[sortedData.length - 1]

  return {
    exerciseName,
    block,
    timesPerformed: sortedData.length,
    weeksActive: weeks.length,

    rpe: {
      current: lastSession.rpe || 0,
      average: avgRPE,
      best: rpeValues.length > 0 ? Math.min(...rpeValues) : 0,
      worst: rpeValues.length > 0 ? Math.max(...rpeValues) : 0,
      trend: calculateTrend(rpeValues)
    },

    quality: {
      current: lastSession.quality_grade ? qualityGradeToNumeric(lastSession.quality_grade) : 0,
      average: avgQuality,
      currentGrade: lastSession.quality_grade || 'D',
      averageGrade: numericToQualityGrade(avgQuality),
      trend: calculateTrend(qualityValues)
    },

    volume: {
      totalSets,
      totalReps,
      avgSetsPerSession: totalSets / sortedData.length,
      avgRepsPerSession: totalReps / sortedData.length,
      maxSetsInSession: setValues.length > 0 ? Math.max(...setValues) : 0,
      maxRepsInSession: repsData.length > 0 ? Math.max(...repsData) : 0
    },

    timing: {
      firstPerformed: firstSession.logged_at,
      lastPerformed: lastSession.logged_at,
      daysSinceFirst: calculateDaysBetween(firstSession.logged_at, new Date()),
      daysSinceLast: calculateDaysBetween(lastSession.logged_at, new Date())
    },

    metcon: metconMetrics,
    progressionData
  }
}
