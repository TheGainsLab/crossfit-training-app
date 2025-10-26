'use client'

import { useState, useEffect } from 'react'
import MetconHeatmap from '@/components/MetconHeatmap'

export default function BTNExerciseHeatMap() {
  const [heatMapData, setHeatMapData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadHeatMapData()
  }, [])

  const loadHeatMapData = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('🔥 BTN Heatmap: Fetching data from /api/btn/exercise-heatmap...')
      const response = await fetch('/api/btn/exercise-heatmap')
      console.log('📡 BTN Heatmap: Response status:', response.status, response.ok ? 'OK' : 'ERROR')
      
      if (response.ok) {
        const result = await response.json()
        console.log('📊 BTN Heatmap: API Response:', result)
        
        if (result.success && result.data) {
          console.log('✅ BTN Heatmap: Data loaded successfully')
          console.log('  - Exercises:', result.data.exercises?.length || 0)
          console.log('  - Time Domains:', result.data.timeDomains?.length || 0)
          console.log('  - Cells:', result.data.heatmapCells?.length || 0)
          console.log('  - Total Completed:', result.data.totalCompletedWorkouts || 0)
          console.log('  - Raw data:', JSON.stringify(result.data, null, 2))
          
          // API now returns data in SAME format as Premium - no transformation needed!
          setHeatMapData(result.data)
        } else {
          console.error('❌ BTN Heatmap: API returned success=false or no data')
          setError('Failed to load heat map data')
        }
      } else {
        console.error('❌ BTN Heatmap: API request failed')
        setError('Failed to fetch heat map data')
      }
    } catch (err) {
      console.error('❌ BTN Heatmap: Exception:', err)
      setError('Error loading heat map')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858]"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Exercise Distribution Heat Map</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-800 font-medium mb-2">Failed to Load Heat Map</p>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadHeatMapData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!heatMapData || heatMapData.exercises.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Exercise Performance Heat Map</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-blue-800 font-medium mb-2">No Completed Workouts Yet</p>
          <p className="text-blue-600">Complete workouts and log your results to see your performance across exercises and time domains!</p>
        </div>
      </div>
    )
  }

  // Use the Premium MetconHeatmap component directly - data format is now identical!
  return <MetconHeatmap data={heatMapData} />
}

// OLD CODE BELOW - NO LONGER NEEDED, USING PREMIUM COMPONENT NOW
// (Keeping for reference, but can be deleted)

/*
function BTNHeatMapWrapper({ data }: { data: any }) {
  // DISABLED - Using Premium component now
  const getCountColor = (count: number | null) => {
    if (count === null || count === 0) return 'bg-gray-100 text-gray-400'
    if (count >= 10) return 'bg-blue-700 text-white'
    if (count >= 7) return 'bg-blue-600 text-white'
    if (count >= 5) return 'bg-blue-500 text-white'
    if (count >= 3) return 'bg-blue-400 text-white'
    if (count >= 2) return 'bg-blue-300 text-gray-900'
    return 'bg-blue-200 text-gray-900'
  }

  const getSessionCount = (exercise: string, timeDomain: string): number => {
    if (!data?.heatmapCells) return 0
    const cell = data.heatmapCells.find((cell: any) => 
      cell.exercise_name === exercise && cell.time_range === timeDomain
    )
    return cell ? cell.session_count : 0
  }

  const calculateExerciseTotal = (exercise: string): number => {
    if (!data?.exerciseAverages) return 0
    const exerciseData = data.exerciseAverages.find((avg: any) => 
      avg.exercise_name === exercise
    )
    return exerciseData ? exerciseData.total_sessions : 0
  }

  const calculateTimeDomainTotal = (timeDomain: string): number => {
    if (!data?.heatmapCells) return 0
    const domainCells = data.heatmapCells.filter((cell: any) => 
      cell.time_range === timeDomain
    )
    return domainCells.reduce((sum: number, cell: any) => sum + cell.session_count, 0)
  }

  const { exercises, timeDomains, totalCompletedWorkouts } = data

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Exercise Distribution Heat Map</h3>
      <p className="text-sm text-gray-600 mb-6">Number of times each exercise appears in workouts across time domains</p>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-3 font-medium text-gray-900">Exercise</th>
              {timeDomains.map((domain: string) => (
                <th key={domain} className="text-center p-3 font-medium text-gray-900 min-w-[100px]">{domain}</th>
              ))}
              <th className="text-center p-3 font-bold text-gray-900 min-w-[100px] bg-blue-50 border-l-2 border-blue-200">Total</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise: string) => (
              <tr key={exercise} className="border-t">
                <td className="p-3 font-medium text-gray-900 bg-gray-50">{exercise}</td>
                {timeDomains.map((domain: string) => {
                  const count = getSessionCount(exercise, domain)
                  const colorClass = getCountColor(count)
                  return (
                    <td key={domain} className="p-1">
                      <div className={`${colorClass} rounded p-3 text-center font-semibold transition-all hover:scale-105 cursor-pointer ${count > 0 ? 'shadow-sm' : ''}`}>
                        {count > 0 ? (
                          <div>
                            <div className="text-2xl">{count}</div>
                            <div className="text-xs opacity-75">workouts</div>
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
                    const total = calculateExerciseTotal(exercise)
                    const colorClass = getCountColor(total)
                    return (
                      <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md border-2 border-white ${total > 0 ? 'ring-1 ring-blue-300' : ''}`} style={{ minHeight: '60px' }}>
                        {total > 0 ? (
                          <div>
                            <div className="text-2xl font-bold">{total}</div>
                            <div className="text-xs opacity-75 font-medium">total</div>
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
              <td className="p-3 font-bold text-gray-900 bg-blue-100 border-r-2 border-blue-200">Time Domain Total</td>
              {timeDomains.map((domain: string) => {
                const total = calculateTimeDomainTotal(domain)
                const colorClass = getCountColor(total)
                return (
                  <td key={domain} className="p-1">
                    <div className={`${colorClass} rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer shadow-md border-2 border-white ${total > 0 ? 'ring-1 ring-blue-300' : ''}`} style={{ minHeight: '60px' }}>
                      {total > 0 ? (
                        <div>
                          <div className="text-2xl font-bold">{total}</div>
                          <div className="text-xs opacity-75 font-medium">exercises</div>
                        </div>
                      ) : (
                        <div className="text-lg font-bold">—</div>
                      )}
                    </div>
                  </td>
                )
              })}
              <td className="p-1 border-l-2 border-blue-200 bg-blue-100">
                <div className="bg-blue-600 text-white rounded p-3 text-center font-bold shadow-lg border-4 border-white ring-2 ring-blue-400" style={{ minHeight: '60px' }}>
                  <div>
                    <div className="text-2xl font-bold">{totalCompletedWorkouts}</div>
                    <div className="text-xs opacity-75 font-bold">WORKOUTS</div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Frequency:</span>
          <div className="flex items-center space-x-2">
            <div className="bg-gray-100 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">None</span>
            <div className="bg-blue-200 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">1-2</span>
            <div className="bg-blue-400 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">3-6</span>
            <div className="bg-blue-600 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">7-9</span>
            <div className="bg-blue-700 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">10+</span>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-medium">Counts</span> show number of workouts
        </div>
      </div>
    </div>
  )
}
*/
