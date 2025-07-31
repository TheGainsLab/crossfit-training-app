// /lib/analytics/types.ts
export interface ExerciseMetrics {
  exerciseName: string
  block: string
  timesPerformed: number
  weeksActive: number
  
  rpe: {
    current: number
    average: number
    best: number
    worst: number
    trend: 'improving' | 'declining' | 'stable'
  }
  
  quality: {
    current: number
    average: number
    currentGrade: string
    averageGrade: string
    trend: 'improving' | 'declining' | 'stable'
  }
  
  volume: {
    totalSets: number
    totalReps: number
    avgSetsPerSession: number
    avgRepsPerSession: number
    maxSetsInSession: number
    maxRepsInSession: number
  }
  
  timing: {
    firstPerformed: string
    lastPerformed: string
    daysSinceFirst: number
    daysSinceLast: number
  }
  
  metcon?: {
    appearances: number
    avgPercentile: number
    bestPercentile: number
    worstPercentile: number
    trend: 'improving' | 'declining' | 'stable'
  }
  
  progressionData: {
    weeks: number[]
    dates: string[]
    rpe: number[]
    quality: number[]
    sets: number[]
    reps: number[]
    volume: number[]
  }
}

export interface ChartDataset {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    borderColor: string
    backgroundColor: string
    tension?: number
    pointRadius?: number
    yAxisID?: string
    type?: string
  }[]
}


export interface ExerciseDeepDiveResponse {
  success: boolean
  data: {
    exerciseInfo: {
      name: string
      block: string
      category: string
      timesPerformed: number
    }
    summary: {
      avgRPE: number
      avgQuality: number
      avgQualityGrade: string
      totalVolume: string
      lastPerformed: string
      daysSinceLast: number
    }
    trends: {
      rpe: {
        direction: string
        current: number
        best: number
        worst: number
        change: number
      }
      quality: {
        direction: string
        current: number
        best: number
        worst: number
        change: number
      }
    }
    volume: {
      totalSets: number
      totalReps: number
      volumeDisplay: string
      avgSetsPerSession: number
      avgRepsPerSession: number
      maxSetsInSession: number
      maxRepsInSession: number
    }
    metcon?: {
      appearances: number
      avgPercentile: number
      bestPercentile: number
      worstPercentile: number
      trend: string
    }
    charts: {
      trendsChart: ChartDataset
      volumeChart?: ChartDataset
      metconChart?: ChartDataset
    }
    insights: string[]
    recommendations: Recommendation[]
  }
  metadata: {
    generatedAt: string
    dataRange: string
    totalSessions: number
    blockContext: string
  }
}

// ADD THIS AT THE END:
export interface Recommendation {
  type: string
  priority: 'high' | 'medium' | 'low'
  text: string
  icon: string
}
