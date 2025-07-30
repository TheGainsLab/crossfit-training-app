// /lib/analytics/chart-formatters.ts
import { ExerciseMetrics, ChartDataset } from './types'

export function formatTrendsChart(metrics: ExerciseMetrics): ChartDataset {
  const labels = metrics.progressionData.dates.map((date, index) => 
    `Week ${metrics.progressionData.weeks[index]}`
  )

  return {
    labels,
    datasets: [
      {
        label: 'RPE',
        data: metrics.progressionData.rpe,
        borderColor: '#ea4335',
        backgroundColor: 'rgba(234, 67, 53, 0.1)',
        tension: 0.3,
        pointRadius: 4,
        yAxisID: 'y'
      },
      {
        label: 'Quality',
        data: metrics.progressionData.quality,
        borderColor: '#34a853',
        backgroundColor: 'rgba(52, 168, 83, 0.1)',
        tension: 0.3,
        pointRadius: 4,
        yAxisID: 'y1'
      }
    ]
  }
}

export function formatVolumeChart(metrics: ExerciseMetrics): ChartDataset {
  const labels = metrics.progressionData.dates.map((date, index) => 
    `Week ${metrics.progressionData.weeks[index]}`
  )

  return {
    labels,
    datasets: [
      {
        label: 'Total Volume (Sets × Reps)',
        data: metrics.progressionData.volume,
        borderColor: '#4285f4',
        backgroundColor: 'rgba(66, 133, 244, 0.2)',
        type: 'bar'
      }
    ]
  }
}

export function formatMetConChart(metrics: ExerciseMetrics): ChartDataset | undefined {
  if (!metrics.metcon) return undefined

  // For MetCon chart, we'd need the individual percentile data over time
  // This would require additional data from the MetCon processing
  return {
    labels: ['MetCon Performance'],
    datasets: [
      {
        label: 'Average Percentile',
        data: [metrics.metcon.avgPercentile],
        borderColor: '#9c27b0',
        backgroundColor: 'rgba(156, 39, 176, 0.2)'
      }
    ]
  }
}
