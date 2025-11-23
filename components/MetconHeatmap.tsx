'use client'

import React from 'react'

type MetricType = 'percentile' | 'rpe' | 'quality' | 'heartrate'

export default function MetconHeatmap({ 
  data, 
  visibleTimeDomains,
  metric = 'percentile'
}: { 
  data: any, 
  visibleTimeDomains?: string[],
  metric?: MetricType
}) {
  const getHeatMapColor = (value: number | null, metricType: MetricType) => {
    if (value === null) return 'bg-gray-100 text-gray-400'
    
    switch (metricType) {
      case 'percentile':
        if (value >= 80) return 'bg-green-600 text-white'
        if (value >= 70) return 'bg-green-500 text-white'
        if (value >= 60) return 'bg-green-400 text-white'
        if (value >= 50) return 'bg-yellow-400 text-black'
        if (value >= 40) return 'bg-orange-400 text-white'
        if (value >= 30) return 'bg-orange-500 text-white'
        return 'bg-red-500 text-white'
      
      case 'rpe':
        // RPE: Red (high) to Green (low) - inverted from percentile
        if (value >= 9) return 'bg-red-600 text-white'
        if (value >= 8) return 'bg-red-500 text-white'
        if (value >= 7) return 'bg-orange-500 text-white'
        if (value >= 6) return 'bg-orange-400 text-white'
        if (value >= 5) return 'bg-yellow-400 text-black'
        if (value >= 4) return 'bg-green-400 text-white'
        return 'bg-green-500 text-white'
      
      case 'quality':
        // Quality: Green (A) to Red (D)
        if (value >= 3.5) return 'bg-green-600 text-white' // A
        if (value >= 2.5) return 'bg-yellow-400 text-black' // B
        if (value >= 1.5) return 'bg-orange-400 text-white' // C
        return 'bg-red-500 text-white' // D
      
      case 'heartrate':
        // HR: Red (high) to Green (low) - similar to RPE
        if (value >= 180) return 'bg-red-600 text-white'
        if (value >= 170) return 'bg-red-500 text-white'
        if (value >= 160) return 'bg-orange-500 text-white'
        if (value >= 150) return 'bg-orange-400 text-white'
        if (value >= 140) return 'bg-yellow-400 text-black'
        if (value >= 130) return 'bg-green-400 text-white'
        return 'bg-green-500 text-white'
      
      default:
        return 'bg-gray-100 text-gray-400'
    }
  }

  const getPercentile = (exercise: string, timeDomain: string): number | null => {
    if (!data?.heatmapCells) return null
    const cell = data.heatmapCells.find((cell: any) => 
      cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? cell.avg_percentile : null
  }

  const getSessionCount = (exercise: string, timeDomain: string): number => {
    if (!data?.heatmapCells) return 0
    const cell = data.heatmapCells.find((cell: any) => 
      cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? cell.session_count : 0
  }

  const getHRData = (exercise: string, timeDomain: string): { avgHR: number | null, maxHR: number | null } | null => {
    if (!data?.heatmapCells) return null
    const cell = data.heatmapCells.find((cell: any) => 
      cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? {
      avgHR: cell.avg_heart_rate ?? null,
      maxHR: cell.max_heart_rate ?? null
    } : null
  }

  const getRPEData = (exercise: string, timeDomain: string): { avgRpe: number | null, avgQuality: number | null } | null => {
    if (!data?.heatmapCells) return null
    const cell = data.heatmapCells.find((cell: any) => 
      cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? {
      avgRpe: cell.avg_rpe ?? null,
      avgQuality: cell.avg_quality ?? null
    } : null
  }

  const getQualityGrade = (quality: number | null): string => {
    if (quality === null) return '—'
    if (quality >= 3.5) return 'A'
    if (quality >= 2.5) return 'B'
    if (quality >= 1.5) return 'C'
    return 'D'
  }

  const calculateExerciseAverage = (exercise: string, metricType: MetricType): number | null => {
    if (!data?.heatmapCells) return null
    const exerciseCells = data.heatmapCells.filter((cell: any) => 
      cell.exercise_name === exercise
    )
    if (exerciseCells.length === 0) return null
    
    let totalWeighted = 0
    let totalSessions = 0
    
    exerciseCells.forEach((cell: any) => {
      let value: number | null = null
      switch (metricType) {
        case 'percentile':
          value = cell.avg_percentile
          break
        case 'rpe':
          value = cell.avg_rpe
          break
        case 'quality':
          value = cell.avg_quality
          break
        case 'heartrate':
          value = cell.avg_heart_rate
          break
      }
      
      if (value !== null && value !== undefined) {
        totalWeighted += value * cell.session_count
        totalSessions += cell.session_count
      }
    })
    
    return totalSessions > 0 ? Math.round((totalWeighted / totalSessions) * 10) / 10 : null
  }

  const calculateTimeDomainAverage = (timeDomain: string, metricType: MetricType): number | null => {
    if (!data?.heatmapCells) return null
    const domainCells = data.heatmapCells.filter((cell: any) => 
      cell.time_range === timeDomain
    )
    if (domainCells.length === 0) return null
    
    let totalWeighted = 0
    let totalSessions = 0
    
    domainCells.forEach((cell: any) => {
      let value: number | null = null
      switch (metricType) {
        case 'percentile':
          value = cell.avg_percentile
          break
        case 'rpe':
          value = cell.avg_rpe
          break
        case 'quality':
          value = cell.avg_quality
          break
        case 'heartrate':
          value = cell.avg_heart_rate
          break
      }
      
      if (value !== null && value !== undefined) {
        totalWeighted += value * cell.session_count
        totalSessions += cell.session_count
      }
    })
    
    return totalSessions > 0 ? Math.round((totalWeighted / totalSessions) * 10) / 10 : null
  }
  
  const getGlobalAverage = (metricType: MetricType): number | null => {
    if (!data?.heatmapCells) return null
    const cells = data.heatmapCells
    let totalWeighted = 0
    let totalSessions = 0
    
    cells.forEach((cell: any) => {
      let value: number | null = null
      switch (metricType) {
        case 'percentile':
          value = cell.avg_percentile
          break
        case 'rpe':
          value = cell.avg_rpe
          break
        case 'quality':
          value = cell.avg_quality
          break
        case 'heartrate':
          value = cell.avg_heart_rate
          break
      }
      
      if (value !== null && value !== undefined) {
        totalWeighted += value * cell.session_count
        totalSessions += cell.session_count
      }
    })
    
    return totalSessions > 0 ? Math.round((totalWeighted / totalSessions) * 10) / 10 : null
  }
  
  const getMetricTitle = (metricType: MetricType): string => {
    switch (metricType) {
      case 'percentile': return 'Percentile Heatmap'
      case 'rpe': return 'RPE Heatmap'
      case 'quality': return 'Quality Heatmap'
      case 'heartrate': return 'Heart Rate Heatmap'
      default: return 'MetCon Heat Map'
    }
  }
  
  const getMetricSubtitle = (metricType: MetricType): string => {
    switch (metricType) {
      case 'percentile': return 'Task Level Percentile Analysis'
      case 'rpe': return 'Rate of Perceived Exertion'
      case 'quality': return 'Movement Quality Grades'
      case 'heartrate': return 'Average Heart Rate (bpm)'
      default: return 'Task Level Analysis'
    }
  }
  
  const formatCellValue = (value: number | null, metricType: MetricType): string => {
    if (value === null) return '—'
    
    switch (metricType) {
      case 'percentile':
        return `${value}%`
      case 'rpe':
        return value.toFixed(1)
      case 'quality':
        return getQualityGrade(value)
      case 'heartrate':
        return Math.round(value).toString()
      default:
        return value.toString()
    }
  }
  
  const formatAverageValue = (value: number | null, metricType: MetricType): string => {
    if (value === null) return '—'
    
    switch (metricType) {
      case 'percentile':
        return `Avg: ${value}%`
      case 'rpe':
        return `Avg: ${value.toFixed(1)}`
      case 'quality':
        return `Avg: ${getQualityGrade(value)}`
      case 'heartrate':
        return `Avg: ${Math.round(value)}`
      default:
        return `Avg: ${value}`
    }
  }

  if (!data || !data.exercises || data.exercises.length === 0) {
    const emptyMessage = metric === 'percentile' 
      ? 'Complete more MetCon workouts to see exercise-specific performance data!'
      : metric === 'rpe'
      ? 'Log workouts with RPE to see effort statistics!'
      : metric === 'quality'
      ? 'Log workouts with Quality ratings to see statistics!'
      : 'Log workouts with Heart Rate to see statistics!'
    
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{getMetricTitle(metric)}</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-blue-800 font-medium mb-2">No {getMetricTitle(metric)} Data Yet</p>
          <p className="text-blue-600">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  const { exercises, timeDomains, globalFitnessScore } = data
  const mapChipToDomains = (chip: string, all: string[]): string[] => {
    switch (chip) {
      case '1-5': return all.filter(d => /(^|\s)1:00–5:00$/.test(d))
      case '5-10': return all.filter(d => /(^|\s)5:00–10:00$/.test(d))
      case '10-15': return all.filter(d => /(^|\s)10:00–15:00$/.test(d))
      case '15-20': return all.filter(d => /(^|\s)15:00–20:00$/.test(d))
      case '20+': return all.filter(d => /(^|\s)20:00–30:00$/.test(d) || /(^|\s)30:00\+$/.test(d))
      default: return []
    }
  }
  const shownDomains = Array.isArray(visibleTimeDomains) && visibleTimeDomains.length > 0
    ? Array.from(new Set(visibleTimeDomains.flatMap(c => mapChipToDomains(c, timeDomains))))
    : timeDomains

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{getMetricTitle(metric)}</h3>
      <p className="text-sm text-gray-600 mb-6">{getMetricSubtitle(metric)}</p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-3 font-medium text-gray-900">Exercise</th>
              {shownDomains.map((domain: string) => (
                <th key={domain} className="text-center p-3 font-medium text-gray-900 min-w-[100px]">{domain}</th>
              ))}
              <th className="text-center p-3 font-bold text-gray-900 min-w-[100px] bg-blue-50 border-l-2 border-blue-200">Exercise Avg</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise: string) => (
              <tr key={exercise} className="border-t">
                <td className="p-3 font-medium text-gray-900 bg-gray-50">{exercise}</td>
                {shownDomains.map((domain: string) => {
                  const sessions = getSessionCount(exercise, domain)
                  const hrData = getHRData(exercise, domain)
                  const rpeData = getRPEData(exercise, domain)
                  
                  // Get value based on metric
                  let cellValue: number | null = null
                  switch (metric) {
                    case 'percentile':
                      cellValue = getPercentile(exercise, domain)
                      break
                    case 'rpe':
                      cellValue = rpeData?.avgRpe ?? null
                      break
                    case 'quality':
                      cellValue = rpeData?.avgQuality ?? null
                      break
                    case 'heartrate':
                      cellValue = hrData?.avgHR ?? null
                      break
                  }
                  
                  const colorClass = getHeatMapColor(cellValue, metric)
                  
                  // Build tooltip text with all metrics
                  let tooltipText = `Exercise: ${exercise}\nTime Domain: ${domain}`
                  const percentile = getPercentile(exercise, domain)
                  if (percentile !== null) {
                    tooltipText += `\nPercentile: ${percentile}%\nSessions: ${sessions}`
                    if (hrData?.avgHR) {
                      tooltipText += `\nAvg HR: ${hrData.avgHR} bpm${hrData.maxHR ? `\nPeak HR: ${hrData.maxHR} bpm` : ''}`
                    }
                    if (rpeData && rpeData.avgRpe !== null) {
                      tooltipText += `\nAvg RPE: ${rpeData.avgRpe}/10`
                    }
                    if (rpeData && rpeData.avgQuality !== null) {
                      tooltipText += `\nAvg Quality: ${getQualityGrade(rpeData.avgQuality)}`
                    }
                  } else {
                    tooltipText += `\nNo data`
                  }
                  
                  return (
                    <td key={domain} className="p-1">
                      <div 
                        className={`${colorClass} rounded p-3 text-center font-semibold transition-all hover:scale-105 cursor-pointer ${cellValue !== null ? 'shadow-sm' : ''}`}
                        title={tooltipText}
                      >
                        {cellValue !== null ? (
                          <div>
                            <div className="text-lg">{formatCellValue(cellValue, metric)}</div>
                            {sessions > 0 && (<div className="text-xs opacity-75">{sessions} sessions</div>)}
                          </div>
                        ) : (
                          <div className="text-lg">—</div>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="p-1 border-l-2 border-blue-200 bg-blue-50">
                  {(() => {
                    const avgValue = calculateExerciseAverage(exercise, metric)
                    const colorClass = getHeatMapColor(avgValue, metric)
                    const exerciseData = data.exerciseAverages.find((avg: any) => avg.exercise_name === exercise)
                    const totalSessions = exerciseData?.total_sessions || 0
                    return (
                      <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md border-2 border-white ${avgValue !== null ? 'ring-1 ring-blue-300' : ''}`} style={{ minHeight: '60px' }}>
                        {avgValue !== null ? (
                          <div>
                            <div className="text-lg font-bold">{formatAverageValue(avgValue, metric)}</div>
                            <div className="text-xs opacity-75 font-medium">{totalSessions} total</div>
                          </div>
                        ) : (
                          <div className="text-lg font-bold">—</div>
                        )}
                      </div>
                    )
                  })()}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-blue-200 bg-blue-50">
              <td className="p-3 font-bold text-gray-900 bg-blue-100 border-r-2 border-blue-200">Time Domain Avg</td>
              {shownDomains.map((domain: string) => {
                const avgValue = calculateTimeDomainAverage(domain, metric)
                const colorClass = getHeatMapColor(avgValue, metric)
                // Calculate total workout count for this time domain
                const domainCells = data.heatmapCells?.filter((cell: any) => 
                  cell.time_range === domain
                ) || []
                const totalWorkouts = domainCells.reduce((sum: number, cell: any) => 
                  sum + (cell.session_count || 0), 0
                )
                return (
                  <td key={domain} className="p-1">
                    <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md border-2 border-white ${avgValue !== null ? 'ring-1 ring-blue-300' : ''}`} style={{ minHeight: '60px' }}>
                      {avgValue !== null ? (
                        <div>
                          <div className="text-lg font-bold">{formatAverageValue(avgValue, metric)}</div>
                          <div className="text-xs opacity-75 font-medium">{totalWorkouts} {totalWorkouts === 1 ? 'workout' : 'workouts'}</div>
                        </div>
                      ) : (
                        <div className="text-lg font-bold">—</div>
                      )}
                    </div>
                  </td>
                )
              })}
              <td className="p-1 border-l-2 border-blue-200 bg-blue-100">
                {(() => {
                  const globalAvg = metric === 'percentile' ? globalFitnessScore : getGlobalAverage(metric)
                  const colorClass = getHeatMapColor(globalAvg, metric)
                  const label = metric === 'percentile' ? 'FITNESS' : 
                                metric === 'rpe' ? 'AVG RPE' :
                                metric === 'quality' ? 'AVG QUALITY' : 'AVG HR'
                  return (
                    <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-lg border-4 border-white ${globalAvg !== null ? 'ring-2 ring-blue-400' : ''}`} style={{ minHeight: '60px' }}>
                      {globalAvg !== null ? (
                        <div>
                          <div className="text-xl font-bold">{formatCellValue(globalAvg, metric)}</div>
                          <div className="text-xs opacity-75 font-bold">{label}</div>
                        </div>
                      ) : (
                        <div className="text-xl font-bold">—</div>
                      )}
                    </div>
                  )
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">
            {metric === 'percentile' ? 'Performance:' :
             metric === 'rpe' ? 'Effort:' :
             metric === 'quality' ? 'Quality:' : 'Heart Rate:'}
          </span>
          <div className="flex items-center space-x-2">
            {metric === 'percentile' && (
              <>
                <div className="bg-red-500 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Poor</span>
                <div className="bg-orange-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Below Avg</span>
                <div className="bg-yellow-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Average</span>
                <div className="bg-green-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Good</span>
                <div className="bg-green-600 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Excellent</span>
              </>
            )}
            {metric === 'rpe' && (
              <>
                <div className="bg-green-500 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Low (1-4)</span>
                <div className="bg-yellow-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Moderate (5-6)</span>
                <div className="bg-orange-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">High (7-8)</span>
                <div className="bg-red-500 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Very High (9-10)</span>
              </>
            )}
            {metric === 'quality' && (
              <>
                <div className="bg-green-600 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">A</span>
                <div className="bg-yellow-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">B</span>
                <div className="bg-orange-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">C</span>
                <div className="bg-red-500 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">D</span>
              </>
            )}
            {metric === 'heartrate' && (
              <>
                <div className="bg-green-500 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Low (&lt;130)</span>
                <div className="bg-yellow-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Moderate (130-150)</span>
                <div className="bg-orange-400 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">High (150-170)</span>
                <div className="bg-red-500 w-4 h-4 rounded"></div>
                <span className="text-xs text-gray-600">Very High (&gt;170)</span>
              </>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-medium">Bold cells</span> show weighted averages
        </div>
      </div>
    </div>
  )
}

