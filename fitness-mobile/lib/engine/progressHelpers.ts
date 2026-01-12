/**
 * Helper functions for Workout Progress Card
 * Ported from web app TrainingDayComponent.tsx
 */

export interface FluxPeriod {
  index: number
  type: 'base' | 'flux'
  duration: number
  startTime: number
  intensity: number
}

export interface BurstTime {
  start: number
  end: number
}

/**
 * Calculate flux periods for a flux interval
 * Alternates between base and flux segments
 */
export function calculateFluxPeriods(
  baseDuration: number,
  fluxDuration: number,
  totalDuration: number,
  fluxStartIntensity: number = 0.75,
  fluxIncrement: number = 0.05
): FluxPeriod[] {
  const periods: FluxPeriod[] = []
  let currentTime = 0
  let fluxIndex = 0
  
  while (currentTime < totalDuration) {
    // Base period
    const baseEnd = Math.min(currentTime + baseDuration, totalDuration)
    periods.push({
      index: fluxIndex,
      type: 'base',
      duration: baseEnd - currentTime,
      startTime: currentTime,
      intensity: 1.0 // Not used for base, but included for consistency
    })
    currentTime = baseEnd
    
    if (currentTime >= totalDuration) break
    
    // Flux period
    const fluxEnd = Math.min(currentTime + fluxDuration, totalDuration)
    periods.push({
      index: fluxIndex,
      type: 'flux',
      duration: fluxEnd - currentTime,
      startTime: currentTime,
      intensity: fluxStartIntensity + (fluxIndex * fluxIncrement)
    })
    currentTime = fluxEnd
    fluxIndex++
  }
  
  return periods
}

/**
 * Calculate burst times for polarized workouts
 * Parses burst timing string and returns array of burst windows
 */
export function calculateBurstTimes(
  burstTiming: string,
  totalDuration: number,
  burstDuration: number = 7
): BurstTime[] {
  if (!burstTiming) return []
  
  const bursts: BurstTime[] = []
  
  if (burstTiming.startsWith('every_')) {
    // Pattern: "every_3_min" or "every_180"
    const intervalMatch = burstTiming.match(/every_(\d+)(?:_min)?/)
    if (intervalMatch) {
      let interval = parseInt(intervalMatch[1])
      if (burstTiming.includes('_min')) {
        interval = interval * 60
      }
      
      for (let time = interval; time < totalDuration; time += interval) {
        bursts.push({
          start: time,
          end: time + burstDuration
        })
      }
    }
  } else {
    // Pattern: "2_4_6" (specific minutes)
    const times = burstTiming.split('_').map(t => parseInt(t) * 60)
    times.forEach(time => {
      if (time < totalDuration) {
        bursts.push({
          start: time,
          end: time + burstDuration
        })
      }
    })
  }
  
  return bursts
}

/**
 * Format seconds into MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Normalize bar width based on maximum duration
 */
export function normalizeBarWidth(
  duration: number,
  maxDuration: number
): number {
  if (maxDuration === 0) return 0
  return Math.min((duration / maxDuration) * 100, 100)
}
