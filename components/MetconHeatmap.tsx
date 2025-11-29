'use client'

import React from 'react'

type MetricType = 'percentile' | 'rpe' | 'quality' | 'heartrate'

// Medal SVG components
const GoldMedal = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" fill="#FFD700" stroke="#FFA500" strokeWidth="1.5"/>
    <path d="M10 6L11.5 9L15 9.5L12.5 12L13 15.5L10 14L7 15.5L7.5 12L5 9.5L8.5 9L10 6Z" fill="#FFA500"/>
  </svg>
)

const SilverMedal = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" fill="#C0C0C0" stroke="#808080" strokeWidth="1.5"/>
    <path d="M10 6L11.5 9L15 9.5L12.5 12L13 15.5L10 14L7 15.5L7.5 12L5 9.5L8.5 9L10 6Z" fill="#808080"/>
  </svg>
)

const BronzeMedal = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" fill="#CD7F32" stroke="#8B4513" strokeWidth="1.5"/>
    <path d="M10 6L11.5 9L15 9.5L12.5 12L13 15.5L10 14L7 15.5L7.5 12L5 9.5L8.5 9L10 6Z" fill="#8B4513"/>
  </svg>
)

export default function MetconHeatmap({ 
  data, 
  visibleTimeDomains,
  metric = 'percentile',
  hideTitle = false
}: { 
  data: any, 
  visibleTimeDomains?: string[],
  metric?: MetricType,
  hideTitle?: boolean
}) {
  // Get medal based on percentile (persists across all metric views)
  const getMedal = (percentile: number | null): 'gold' | 'silver' | 'bronze' | null => {
    if (percentile === null) return null
    if (percentile >= 90) return 'gold'
    if (percentile >= 80) return 'silver'
    if (percentile >= 70) return 'bronze'
    return null
  }

  // Render medal icon
  const renderMedal = (percentile: number | null) => {
    const medal = getMedal(percentile)
    if (!medal) return null
    
    return (
      <div className="absolute top-1 right-1">
        {medal === 'gold' && <GoldMedal />}
        {medal === 'silver' && <SilverMedal />}
        {medal === 'bronze' && <BronzeMedal />}
      </div>
    )
  }

  // New cell styling - consistent across all metrics
  const getCellStyle = (hasData: boolean) => {
    if (!hasData) {
      return 'bg-gray-100 text-gray-400 border border-gray-300'
    }
    return 'bg-[#F8FBFE] text-[#282B34] border border-[#FE5858]'
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
        {!hideTitle && (
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{getMetricTitle(metric)}</h3>
        )}
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
      {!hideTitle && (
        <>
          <h3 className="text-lg font-semibold text-[#282B34] mb-4">{getMetricTitle(metric)}</h3>
          <p className="text-sm text-[#282B34] mb-6">{getMetricSubtitle(metric)}</p>
        </>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-3 font-medium text-[#282B34]">Exercise</th>
              {shownDomains.map((domain: string) => (
                <th key={domain} className="text-center p-3 font-medium text-[#282B34] min-w-[100px]">{domain}</th>
              ))}
              <th className="text-center p-3 font-bold text-[#282B34] min-w-[100px] bg-[#F8FBFE] border-l-2 border-[#282B34]">Exercise Avg</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise: string) => (
              <tr key={exercise} className="border-t">
                <td className="p-3 font-medium text-[#282B34] bg-[#DAE2EA]">{exercise}</td>
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
                  
                  // Build tooltip text with all metrics
                  let tooltipText = `Exercise: ${exercise}\nTime Domain: ${domain}`
                  const percentile = getPercentile(exercise, domain)
                  if (percentile !== null) {
                    tooltipText += `\nPercentile: ${percentile}%\nWorkouts: ${sessions}`
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
                        className={`${getCellStyle(cellValue !== null)} rounded p-3 text-center font-semibold transition-all hover:scale-105 cursor-pointer relative ${cellValue !== null ? 'shadow-sm' : ''}`}
                        style={{ minHeight: '60px' }}
                        title={tooltipText}
                      >
                        {renderMedal(percentile)}
                        {cellValue !== null ? (
                          <div>
                            <div className="text-lg">{formatCellValue(cellValue, metric)}</div>
                            {sessions > 0 && (<div className="text-xs opacity-75">{sessions} {sessions === 1 ? 'workout' : 'workouts'}</div>)}
                          </div>
                        ) : (
                          <div className="text-lg">—</div>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="p-1 border-l-2 border-[#282B34] bg-[#F8FBFE]">
                  {(() => {
                    const avgValue = calculateExerciseAverage(exercise, metric)
                    const exerciseData = data.exerciseAverages.find((avg: any) => avg.exercise_name === exercise)
                    const totalSessions = exerciseData?.total_sessions || 0
                    // Get percentile for medal (from exercise average)
                    const exercisePercentile = exerciseData?.overall_avg_percentile || null
                    return (
                      <div className={`${getCellStyle(avgValue !== null)} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md relative`} style={{ minHeight: '60px' }}>
                        {renderMedal(exercisePercentile)}
                        {avgValue !== null ? (
                          <div style={{ color: '#FE5858' }}>
                            <div className="text-lg font-bold">{formatAverageValue(avgValue, metric)}</div>
                            <div className="text-xs opacity-75 font-medium">{totalSessions} {totalSessions === 1 ? 'workout' : 'workouts'}</div>
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
            <tr className="border-t-2 border-[#282B34] bg-[#F8FBFE]">
              <td className="p-3 font-bold text-[#282B34] bg-[#DAE2EA] border-r-2 border-[#282B34]">Time Domain Avg</td>
              {shownDomains.map((domain: string) => {
                const avgValue = calculateTimeDomainAverage(domain, metric)
                // Use backend-provided time domain workout count (unique workouts per time domain)
                const totalWorkouts = data.timeDomainWorkoutCounts?.[domain] || 0
                // Calculate average percentile for this time domain to determine medal
                const domainCells = data.heatmapCells?.filter((cell: any) => 
                  cell.time_range === domain
                ) || []
                const domainPercentile = domainCells.length > 0
                  ? Math.round(domainCells.reduce((sum: number, cell: any) => 
                      sum + (cell.avg_percentile * cell.session_count), 0) / 
                      domainCells.reduce((sum: number, cell: any) => sum + cell.session_count, 0))
                  : null
                return (
                  <td key={domain} className="p-1">
                    <div className={`${getCellStyle(avgValue !== null)} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md relative`} style={{ minHeight: '60px' }}>
                      {renderMedal(domainPercentile)}
                      {avgValue !== null ? (
                        <div style={{ color: '#FE5858' }}>
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
              <td className="p-1 border-l-2 border-[#282B34] bg-[#DAE2EA]">
                {(() => {
                  const globalAvg = metric === 'percentile' ? globalFitnessScore : getGlobalAverage(metric)
                  const label = metric === 'percentile' ? 'FITNESS' : 
                                metric === 'rpe' ? 'AVG RPE' :
                                metric === 'quality' ? 'AVG QUALITY' : 'AVG HR'
                  return (
                    <div className="rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-lg relative" style={{ minHeight: '60px', backgroundColor: '#FE5858', color: '#F8FBFE', border: '1px solid #FE5858' }}>
                      {renderMedal(globalFitnessScore)}
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
      <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-[#282B34]">Performance Medals:</span>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <GoldMedal />
              <span className="text-xs text-[#282B34]">90%+</span>
            </div>
            <div className="flex items-center space-x-1">
              <SilverMedal />
              <span className="text-xs text-[#282B34]">80-89%</span>
            </div>
            <div className="flex items-center space-x-1">
              <BronzeMedal />
              <span className="text-xs text-[#282B34]">70-79%</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-[#282B34]">
          <span className="font-medium">Bold cells</span> show weighted averages
        </div>
      </div>
    </div>
  )
}

