'use client'

import React from 'react'
import MetconHeatmap from '@/components/MetconHeatmap'
import HRStatisticsPanel from '@/components/HRStatisticsPanel'

interface MetConAnalyticsViewsProps {
  heatmapData: any
  baselineHeatmap?: any
  selection: string[]
  searchParams: URLSearchParams
  router?: any
  onEquipmentFilterChange?: (filter: 'all' | 'barbell' | 'no_barbell' | 'gymnastics') => void
  activeTab: 'performance' | 'effort' | 'quality' | 'heartrate'
}

export function PerformanceView({ heatmapData, baselineHeatmap, selection, searchParams }: MetConAnalyticsViewsProps) {
  const equip = (searchParams.get('equip') || '').toLowerCase()
  
  // Calculate summary stats
  const cells = heatmapData?.heatmapCells || []
  const completions = heatmapData?.totalCompletedWorkouts || 0
  const avgPercentile = heatmapData?.globalFitnessScore || null

  // Calculate by time domain
  const timeDomainStats = calculateTimeDomainStats(cells)
  
  // Calculate by exercise (top 10)
  const exerciseStats = calculateExerciseStats(cells).slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Performance Summary</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-600">Total Workouts</div>
            <div className="text-2xl font-bold" style={{ color: '#FE5858' }}>{completions}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Avg Percentile</div>
            <div className="text-2xl font-bold" style={{ color: '#FE5858' }}>{avgPercentile ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Percentile Heatmap</h3>
        {equip && baselineHeatmap ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Filtered ({equip})</div>
              <MetconHeatmap data={heatmapData} visibleTimeDomains={selection} />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">All equipment</div>
              <MetconHeatmap data={baselineHeatmap} visibleTimeDomains={selection} />
            </div>
          </div>
        ) : (
          <MetconHeatmap data={heatmapData} visibleTimeDomains={selection} />
        )}
      </div>

      {/* By Time Domain */}
      {timeDomainStats.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Time Domain</h3>
          <div className="space-y-2">
            {timeDomainStats.map((stat) => (
              <div key={stat.time_range} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{stat.time_range}</div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Avg Percentile</div>
                    <div className="text-lg font-bold" style={{ color: '#FE5858' }}>{stat.avg_percentile ?? '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Workouts</div>
                    <div className="text-lg font-semibold">{stat.workout_count}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Exercise (Top 10) */}
      {exerciseStats.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Exercise (Top 10)</h3>
          <div className="space-y-2">
            {exerciseStats.map((stat) => (
              <div key={stat.exercise_name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{stat.exercise_name}</div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Avg Percentile</div>
                    <div className="text-lg font-bold" style={{ color: '#FE5858' }}>{stat.avg_percentile ?? '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Frequency</div>
                    <div className="text-lg font-semibold">{stat.frequency}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function EffortView({ heatmapData }: MetConAnalyticsViewsProps) {
  const cells = heatmapData?.heatmapCells || []
  
  // Calculate global RPE
  const validRpe = cells.filter((c: any) => c.avg_rpe !== null && c.avg_rpe !== undefined)
  const avgRpe = validRpe.length > 0 
    ? Math.round((validRpe.reduce((sum: number, c: any) => sum + (c.avg_rpe * c.session_count), 0) / 
                 validRpe.reduce((sum: number, c: any) => sum + c.session_count, 0)) * 10) / 10
    : null

  // Calculate by time domain
  const rpeByTimeDomain = calculateRPEByTimeDomain(cells)
  
  // Calculate by exercise (top 10)
  const rpeByExercise = calculateRPEByExercise(cells).slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Effort Summary</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-600">Avg RPE</div>
            <div className="text-2xl font-bold" style={{ color: '#FE5858' }}>{avgRpe ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">/ 10</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Workouts</div>
            <div className="text-2xl font-bold" style={{ color: '#FE5858' }}>{validRpe.reduce((sum: number, c: any) => sum + c.session_count, 0)}</div>
            <div className="text-xs text-gray-500 mt-1">with RPE data</div>
          </div>
        </div>
      </div>

      {/* By Time Domain */}
      {rpeByTimeDomain.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Time Domain</h3>
          <div className="space-y-2">
            {rpeByTimeDomain.map((stat) => (
              <div key={stat.time_range} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{stat.time_range}</div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Avg RPE</div>
                    <div className="text-lg font-bold" style={{ color: '#FE5858' }}>{stat.avg_rpe ?? '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Frequency</div>
                    <div className="text-lg font-semibold">{stat.workout_count}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Exercise (Top 10) */}
      {rpeByExercise.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Exercise (Top 10)</h3>
          <div className="space-y-2">
            {rpeByExercise.map((stat) => (
              <div key={stat.exercise_name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{stat.exercise_name}</div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Avg RPE</div>
                    <div className="text-lg font-bold" style={{ color: '#FE5858' }}>{stat.avg_rpe ?? '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Frequency</div>
                    <div className="text-lg font-semibold">{stat.appearances}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rpeByTimeDomain.length === 0 && rpeByExercise.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200 text-center">
          <p className="text-gray-500">No RPE data available. Log workouts with RPE to see effort statistics.</p>
        </div>
      )}
    </div>
  )
}

export function QualityView({ heatmapData }: MetConAnalyticsViewsProps) {
  const cells = heatmapData?.heatmapCells || []
  
  // Calculate global Quality
  const validQuality = cells.filter((c: any) => c.avg_quality !== null && c.avg_quality !== undefined)
  const avgQuality = validQuality.length > 0
    ? Math.round((validQuality.reduce((sum: number, c: any) => sum + (c.avg_quality * c.session_count), 0) / 
                 validQuality.reduce((sum: number, c: any) => sum + c.session_count, 0)) * 10) / 10
    : null

  const getQualityGrade = (quality: number | null): string => {
    if (quality === null) return '—'
    if (quality >= 3.5) return 'A'
    if (quality >= 2.5) return 'B'
    if (quality >= 1.5) return 'C'
    return 'D'
  }

  // Calculate by time domain
  const qualityByTimeDomain = calculateQualityByTimeDomain(cells)
  
  // Calculate by exercise (top 10)
  const qualityByExercise = calculateQualityByExercise(cells).slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Quality Summary</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-600">Avg Quality</div>
            <div className="text-2xl font-bold" style={{ color: '#FE5858' }}>{getQualityGrade(avgQuality)}</div>
            <div className="text-xs text-gray-500 mt-1">Grade</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Workouts</div>
            <div className="text-2xl font-bold" style={{ color: '#FE5858' }}>{validQuality.reduce((sum: number, c: any) => sum + c.session_count, 0)}</div>
            <div className="text-xs text-gray-500 mt-1">with Quality data</div>
          </div>
        </div>
      </div>

      {/* By Time Domain */}
      {qualityByTimeDomain.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Time Domain</h3>
          <div className="space-y-2">
            {qualityByTimeDomain.map((stat) => (
              <div key={stat.time_range} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{stat.time_range}</div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Avg Quality</div>
                    <div className="text-lg font-bold" style={{ color: '#FE5858' }}>{getQualityGrade(stat.avg_quality)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Frequency</div>
                    <div className="text-lg font-semibold">{stat.workout_count}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Exercise (Top 10) */}
      {qualityByExercise.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Exercise (Top 10)</h3>
          <div className="space-y-2">
            {qualityByExercise.map((stat) => (
              <div key={stat.exercise_name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{stat.exercise_name}</div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Avg Quality</div>
                    <div className="text-lg font-bold" style={{ color: '#FE5858' }}>{getQualityGrade(stat.avg_quality)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Frequency</div>
                    <div className="text-lg font-semibold">{stat.appearances}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {qualityByTimeDomain.length === 0 && qualityByExercise.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200 text-center">
          <p className="text-gray-500">No Quality data available. Log workouts with Quality ratings to see statistics.</p>
        </div>
      )}
    </div>
  )
}

export function HeartRateView({ heatmapData, searchParams, router, onEquipmentFilterChange }: MetConAnalyticsViewsProps) {
  const equipmentFilter = (searchParams.get('equip') || 'all').toLowerCase() as 'all' | 'barbell' | 'no_barbell' | 'gymnastics'
  
  return (
    <div className="space-y-6">
      <HRStatisticsPanel 
        heatmapData={heatmapData} 
        equipmentFilter={equipmentFilter}
        onEquipmentFilterChange={onEquipmentFilterChange}
      />
    </div>
  )
}

// Helper functions
function calculateTimeDomainStats(cells: any[]) {
  const domainMap = new Map<string, { totalPercentile: number, totalSessions: number }>()
  
  cells.forEach(cell => {
    if (!cell.time_range) return
    if (!domainMap.has(cell.time_range)) {
      domainMap.set(cell.time_range, { totalPercentile: 0, totalSessions: 0 })
    }
    const data = domainMap.get(cell.time_range)!
    if (cell.avg_percentile !== null && cell.avg_percentile !== undefined) {
      data.totalPercentile += cell.avg_percentile * cell.session_count
      data.totalSessions += cell.session_count
    }
  })
  
  return Array.from(domainMap.entries())
    .map(([time_range, data]) => ({
      time_range,
      avg_percentile: data.totalSessions > 0 ? Math.round((data.totalPercentile / data.totalSessions) * 10) / 10 : null,
      workout_count: data.totalSessions
    }))
    .sort((a, b) => {
      const order: { [key: string]: number } = {
        '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
        '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
      }
      return (order[a.time_range] || 7) - (order[b.time_range] || 7)
    })
}

function calculateExerciseStats(cells: any[]) {
  const exerciseMap = new Map<string, { totalPercentile: number, totalSessions: number }>()
  
  cells.forEach(cell => {
    if (!exerciseMap.has(cell.exercise_name)) {
      exerciseMap.set(cell.exercise_name, { totalPercentile: 0, totalSessions: 0 })
    }
    const data = exerciseMap.get(cell.exercise_name)!
    if (cell.avg_percentile !== null && cell.avg_percentile !== undefined) {
      data.totalPercentile += cell.avg_percentile * cell.session_count
      data.totalSessions += cell.session_count
    }
  })
  
  return Array.from(exerciseMap.entries())
    .map(([exercise_name, data]) => ({
      exercise_name,
      avg_percentile: data.totalSessions > 0 ? Math.round((data.totalPercentile / data.totalSessions) * 10) / 10 : null,
      frequency: data.totalSessions
    }))
    .filter(ex => ex.avg_percentile !== null)
    .sort((a, b) => (b.avg_percentile || 0) - (a.avg_percentile || 0))
}

function calculateRPEByTimeDomain(cells: any[]) {
  const domainMap = new Map<string, { totalRpe: number, rpeCount: number }>()
  
  cells.forEach(cell => {
    if (!cell.time_range) return
    if (!domainMap.has(cell.time_range)) {
      domainMap.set(cell.time_range, { totalRpe: 0, rpeCount: 0 })
    }
    const data = domainMap.get(cell.time_range)!
    if (cell.avg_rpe !== null && cell.avg_rpe !== undefined) {
      data.totalRpe += cell.avg_rpe * cell.session_count
      data.rpeCount += cell.session_count
    }
  })
  
  return Array.from(domainMap.entries())
    .map(([time_range, data]) => ({
      time_range,
      avg_rpe: data.rpeCount > 0 ? Math.round((data.totalRpe / data.rpeCount) * 10) / 10 : null,
      workout_count: data.rpeCount
    }))
    .sort((a, b) => {
      const order: { [key: string]: number } = {
        '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
        '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
      }
      return (order[a.time_range] || 7) - (order[b.time_range] || 7)
    })
}

function calculateRPEByExercise(cells: any[]) {
  const exerciseMap = new Map<string, { totalRpe: number, rpeCount: number }>()
  
  cells.forEach(cell => {
    if (!exerciseMap.has(cell.exercise_name)) {
      exerciseMap.set(cell.exercise_name, { totalRpe: 0, rpeCount: 0 })
    }
    const data = exerciseMap.get(cell.exercise_name)!
    if (cell.avg_rpe !== null && cell.avg_rpe !== undefined) {
      data.totalRpe += cell.avg_rpe * cell.session_count
      data.rpeCount += cell.session_count
    }
  })
  
  return Array.from(exerciseMap.entries())
    .map(([exercise_name, data]) => ({
      exercise_name,
      avg_rpe: data.rpeCount > 0 ? Math.round((data.totalRpe / data.rpeCount) * 10) / 10 : null,
      appearances: data.rpeCount
    }))
    .filter(ex => ex.avg_rpe !== null)
    .sort((a, b) => b.appearances - a.appearances)
}

function calculateQualityByTimeDomain(cells: any[]) {
  const domainMap = new Map<string, { totalQuality: number, qualityCount: number }>()
  
  cells.forEach(cell => {
    if (!cell.time_range) return
    if (!domainMap.has(cell.time_range)) {
      domainMap.set(cell.time_range, { totalQuality: 0, qualityCount: 0 })
    }
    const data = domainMap.get(cell.time_range)!
    if (cell.avg_quality !== null && cell.avg_quality !== undefined) {
      data.totalQuality += cell.avg_quality * cell.session_count
      data.qualityCount += cell.session_count
    }
  })
  
  return Array.from(domainMap.entries())
    .map(([time_range, data]) => ({
      time_range,
      avg_quality: data.qualityCount > 0 ? Math.round((data.totalQuality / data.qualityCount) * 10) / 10 : null,
      workout_count: data.qualityCount
    }))
    .sort((a, b) => {
      const order: { [key: string]: number } = {
        '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
        '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
      }
      return (order[a.time_range] || 7) - (order[b.time_range] || 7)
    })
}

function calculateQualityByExercise(cells: any[]) {
  const exerciseMap = new Map<string, { totalQuality: number, qualityCount: number }>()
  
  cells.forEach(cell => {
    if (!exerciseMap.has(cell.exercise_name)) {
      exerciseMap.set(cell.exercise_name, { totalQuality: 0, qualityCount: 0 })
    }
    const data = exerciseMap.get(cell.exercise_name)!
    if (cell.avg_quality !== null && cell.avg_quality !== undefined) {
      data.totalQuality += cell.avg_quality * cell.session_count
      data.qualityCount += cell.session_count
    }
  })
  
  return Array.from(exerciseMap.entries())
    .map(([exercise_name, data]) => ({
      exercise_name,
      avg_quality: data.qualityCount > 0 ? Math.round((data.totalQuality / data.qualityCount) * 10) / 10 : null,
      appearances: data.qualityCount
    }))
    .filter(ex => ex.avg_quality !== null)
    .sort((a, b) => b.appearances - a.appearances)
}

