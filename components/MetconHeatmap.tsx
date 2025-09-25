'use client'

import React from 'react'

export default function MetconHeatmap({ data }: { data: any }) {
  const getHeatMapColor = (percentile: number | null) => {
    if (percentile === null) return 'bg-gray-100 text-gray-400'
    if (percentile >= 80) return 'bg-green-600 text-white'
    if (percentile >= 70) return 'bg-green-500 text-white'
    if (percentile >= 60) return 'bg-green-400 text-white'
    if (percentile >= 50) return 'bg-yellow-400 text-black'
    if (percentile >= 40) return 'bg-orange-400 text-white'
    if (percentile >= 30) return 'bg-orange-500 text-white'
    return 'bg-red-500 text-white'
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

  const calculateExerciseAverage = (exercise: string): number | null => {
    if (!data?.exerciseAverages) return null
    const exerciseAvg = data.exerciseAverages.find((avg: any) => 
      avg.exercise_name === exercise
    )
    return exerciseAvg ? exerciseAvg.overall_avg_percentile : null
  }

  const calculateTimeDomainAverage = (timeDomain: string): number | null => {
    if (!data?.heatmapCells) return null
    const domainCells = data.heatmapCells.filter((cell: any) => 
      cell.time_range === timeDomain
    )
    if (domainCells.length === 0) return null
    let totalWeightedScore = 0
    let totalSessions = 0
    domainCells.forEach((cell: any) => {
      totalWeightedScore += cell.avg_percentile * cell.session_count
      totalSessions += cell.session_count
    })
    return totalSessions > 0 ? Math.round(totalWeightedScore / totalSessions) : null
  }

  if (!data || !data.exercises || data.exercises.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Exercise Performance Heat Map</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-blue-800 font-medium mb-2">No MetCon Data Yet</p>
          <p className="text-blue-600">Complete more MetCon workouts to see exercise-specific performance data!</p>
        </div>
      </div>
    )
  }

  const { exercises, timeDomains, globalFitnessScore } = data

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Exercise Performance Heat Map</h3>
      <p className="text-sm text-gray-600 mb-6">Performance percentiles for each exercise across different time domains</p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-3 font-medium text-gray-900">Exercise</th>
              {timeDomains.map((domain: string) => (
                <th key={domain} className="text-center p-3 font-medium text-gray-900 min-w-[100px]">{domain}</th>
              ))}
              <th className="text-center p-3 font-bold text-gray-900 min-w-[100px] bg-blue-50 border-l-2 border-blue-200">Exercise Avg</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise: string) => (
              <tr key={exercise} className="border-t">
                <td className="p-3 font-medium text-gray-900 bg-gray-50">{exercise}</td>
                {timeDomains.map((domain: string) => {
                  const percentile = getPercentile(exercise, domain)
                  const sessions = getSessionCount(exercise, domain)
                  const colorClass = getHeatMapColor(percentile)
                  return (
                    <td key={domain} className="p-1">
                      <div className={`${colorClass} rounded p-3 text-center font-semibold transition-all hover:scale-105 cursor-pointer ${percentile ? 'shadow-sm' : ''}`}>
                        {percentile ? (
                          <div>
                            <div className="text-lg">{percentile}%</div>
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
                    const avgPercentile = calculateExerciseAverage(exercise)
                    const colorClass = getHeatMapColor(avgPercentile)
                    const exerciseData = data.exerciseAverages.find((avg: any) => avg.exercise_name === exercise)
                    const totalSessions = exerciseData?.total_sessions || 0
                    return (
                      <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md border-2 border-white ${avgPercentile ? 'ring-1 ring-blue-300' : ''}`} style={{ minHeight: '60px' }}>
                        {avgPercentile ? (
                          <div>
                            <div className="text-lg font-bold">Avg: {avgPercentile}%</div>
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
              {timeDomains.map((domain: string) => {
                const avgPercentile = calculateTimeDomainAverage(domain)
                const colorClass = getHeatMapColor(avgPercentile)
                return (
                  <td key={domain} className="p-1">
                    <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md border-2 border-white ${avgPercentile ? 'ring-1 ring-blue-300' : ''}`} style={{ minHeight: '60px' }}>
                      {avgPercentile ? (
                        <div>
                          <div className="text-lg font-bold">Avg: {avgPercentile}%</div>
                          <div className="text-xs opacity-75 font-medium">Domain</div>
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
                  const colorClass = getHeatMapColor(globalFitnessScore)
                  return (
                    <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-lg border-4 border-white ${globalFitnessScore ? 'ring-2 ring-blue-400' : ''}`} style={{ minHeight: '60px' }}>
                      {globalFitnessScore ? (
                        <div>
                          <div className="text-xl font-bold">{globalFitnessScore}%</div>
                          <div className="text-xs opacity-75 font-bold">FITNESS</div>
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
          <span className="text-sm font-medium text-gray-700">Performance:</span>
          <div className="flex items-center space-x-2">
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
          </div>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-medium">Bold cells</span> show weighted averages
        </div>
      </div>
    </div>
  )
}

