// /lib/analytics/metcon-analyzer.ts
import { calculateTrend } from './data-processors'

export interface MetConTimeDomainData {
  timeDomains: {
    [timeRange: string]: {
      count: number
      percentiles: number[]
      avgPercentile: number
    }
  }
  exercises: {
    [exerciseName: string]: {
      [timeRange: string]: {
        count: number
        percentiles: number[]
        avgPercentile: number
      }
    }
  }
  overallAverages: {
    [timeRange: string]: number
  }
  equipmentAnalysis?: {
    [equipmentType: string]: {
      with: { [timeRange: string]: { count: number; percentiles: number[]; avgPercentile: number } }
      without: { [timeRange: string]: { count: number; percentiles: number[]; avgPercentile: number } }
    }
  }
}

/**
 * Process MetCon data by time domain (mirrors Google Script logic)
 */
export function processMetConTimeDomainData(
  metconData: any[], 
  timeDomainFilter: string = 'all'
): MetConTimeDomainData | null {
  try {
    console.log(`📊 Processing ${metconData.length} MetCon records for time domain analysis`)
    
    if (!metconData || metconData.length === 0) {
      return null
    }

    const timeDomains: { [key: string]: { count: number; percentiles: number[] } } = {}
    const exercises: { [key: string]: { [key: string]: { count: number; percentiles: number[] } } } = {}
    const overallAverages: { [key: string]: number } = {}

    // Process each MetCon record
    metconData.forEach(record => {
      const timeRange = record.metcons?.time_range || 'Unknown'
      const percentile = record.percentile
      const tasks = record.metcons?.tasks || []

      // Skip records without valid data
      if (!timeRange || !percentile || timeRange === 'Unknown') {
        return
      }

      // Filter by time domain if specified
      if (timeDomainFilter !== 'all' && !timeRange.includes(timeDomainFilter)) {
        return
      }

      // Initialize time domain data
      if (!timeDomains[timeRange]) {
        timeDomains[timeRange] = { count: 0, percentiles: [] }
      }

      // Add to time domain aggregation
      timeDomains[timeRange].count++
      timeDomains[timeRange].percentiles.push(percentile)

      // Process exercises within this MetCon
      if (Array.isArray(tasks)) {
        tasks.forEach((task: string) => {
          // Extract exercise name from task description
          const exerciseName = extractExerciseFromTask(task)
          
          if (exerciseName) {
            if (!exercises[exerciseName]) {
              exercises[exerciseName] = {}
            }
            
            if (!exercises[exerciseName][timeRange]) {
              exercises[exerciseName][timeRange] = { count: 0, percentiles: [] }
            }
            
            exercises[exerciseName][timeRange].count++
            exercises[exerciseName][timeRange].percentiles.push(percentile)
          }
        })
      }
    })

    // Calculate averages for time domains
    Object.keys(timeDomains).forEach(timeRange => {
      const domain = timeDomains[timeRange]
      const avgPercentile = Math.round(
        domain.percentiles.reduce((sum, p) => sum + p, 0) / domain.percentiles.length
      )
      ;(domain as any).avgPercentile = avgPercentile
      overallAverages[timeRange] = avgPercentile
    })

    // Calculate averages for exercises
    Object.keys(exercises).forEach(exerciseName => {
      Object.keys(exercises[exerciseName]).forEach(timeRange => {
        const exerciseTimeData = exercises[exerciseName][timeRange]
        ;(exerciseTimeData as any).avgPercentile = Math.round(
          exerciseTimeData.percentiles.reduce((sum, p) => sum + p, 0) / exerciseTimeData.percentiles.length
        )
      })
    })

    console.log(`✅ Processed ${Object.keys(timeDomains).length} time domains, ${Object.keys(exercises).length} exercises`)

    return {
      timeDomains: timeDomains as any,
      exercises: exercises as any,
      overallAverages
    }

  } catch (error) {
    console.error(`❌ Error processing MetCon time domain data: ${error.message}`)
    return null
  }
}

/**
 * Extract exercise name from MetCon task description
 */
function extractExerciseFromTask(task: string): string | null {
  if (!task || typeof task !== 'string') {
    return null
  }

  // Remove common MetCon format indicators
  let exercise = task
    .replace(/^\d+\s*x?\s*/i, '') // Remove rep counts like "21 " or "21x "
    .replace(/\s*\(.*?\)/g, '') // Remove parenthetical content
    .replace(/\s*@.*$/g, '') // Remove @ weight specifications
    .replace(/\s*#.*$/g, '') // Remove # weight specifications
    .replace(/\s*-.*$/g, '') // Remove - specifications
    .trim()

  // Common exercise name mappings
  const exerciseMap: { [key: string]: string } = {
    'double unders': 'Double Unders',
    'du': 'Double Unders',
    'pull-ups': 'Pull-ups',
    'pullups': 'Pull-ups',
    'pull ups': 'Pull-ups',
    'push-ups': 'Push-ups',
    'pushups': 'Push-ups',
    'push ups': 'Push-ups',
    'air squats': 'Air Squats',
    'squats': 'Air Squats',
    'burpees': 'Burpees',
    'sit-ups': 'Sit-ups',
    'situps': 'Sit-ups',
    'sit ups': 'Sit-ups',
    'kb swings': 'Kettlebell Swings',
    'kettlebell swings': 'Kettlebell Swings',
    'box jumps': 'Box Jumps',
    'wall balls': 'Wall Balls',
    'thrusters': 'Thrusters',
    'deadlifts': 'Deadlifts',
    'muscle ups': 'Muscle Ups',
    'handstand push ups': 'Handstand Push-ups',
    'hspu': 'Handstand Push-ups',
    'toes to bar': 'Toes to Bar',
    't2b': 'Toes to Bar'
  }

  const exerciseLower = exercise.toLowerCase()
  
  // Check for exact matches first
  if (exerciseMap[exerciseLower]) {
    return exerciseMap[exerciseLower]
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(exerciseMap)) {
    if (exerciseLower.includes(key) || key.includes(exerciseLower)) {
      return value
    }
  }

  // Return cleaned exercise name if no mapping found
  return exercise.length > 0 ? exercise : null
}

/**
 * Calculate MetCon progression trends
 */
export function calculateMetConProgression(timeDomainData: MetConTimeDomainData) {
  const progressionData: { [key: string]: string } = {}

  Object.entries(timeDomainData.timeDomains).forEach(([timeRange, data]) => {
    if (data.percentiles.length > 1) {
      progressionData[timeRange] = calculateTrend(data.percentiles)
    } else {
      progressionData[timeRange] = 'stable'
    }
  })

  return progressionData
}

/**
 * Get top performing time domains
 */
export function getTopTimeDomains(
  timeDomainData: MetConTimeDomainData, 
  limit: number = 3
): Array<{ timeRange: string; avgPercentile: number; count: number }> {
  return Object.entries(timeDomainData.overallAverages)
    .map(([timeRange, avgPercentile]) => ({
      timeRange,
      avgPercentile,
      count: timeDomainData.timeDomains[timeRange]?.count || 0
    }))
    .sort((a, b) => b.avgPercentile - a.avgPercentile)
    .slice(0, limit)
}

/**
 * Get exercises that appear across multiple time domains
 */
export function getCrossTimeDomainExercises(timeDomainData: MetConTimeDomainData) {
  const crossDomainExercises: Array<{
    exercise: string
    timeDomains: string[]
    avgPercentile: number
  }> = []

  Object.entries(timeDomainData.exercises).forEach(([exerciseName, timeRanges]) => {
    const domains = Object.keys(timeRanges)
    
    if (domains.length > 1) {
      // Calculate overall average percentile for this exercise
      let totalPercentile = 0
      let totalCount = 0
      
      domains.forEach(domain => {
        const domainData = timeRanges[domain]
        totalPercentile += domainData.avgPercentile * domainData.count
        totalCount += domainData.count
      })
      
      const avgPercentile = totalCount > 0 ? Math.round(totalPercentile / totalCount) : 0
      
      crossDomainExercises.push({
        exercise: exerciseName,
        timeDomains: domains,
        avgPercentile
      })
    }
  })

  return crossDomainExercises.sort((a, b) => b.avgPercentile - a.avgPercentile)
}
