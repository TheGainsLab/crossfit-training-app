'use client'

import React, { useState } from 'react'

interface HRStatisticsPanelProps {
  heatmapData: {
    heatmapCells?: Array<{
      exercise_name: string
      time_range: string | null
      avg_heart_rate?: number | null
      max_heart_rate?: number | null
      session_count: number
      avg_percentile?: number
    }>
    exerciseAverages?: Array<{
      exercise_name: string
      total_sessions: number
    }>
  }
  equipmentFilter?: 'all' | 'barbell' | 'no_barbell' | 'gymnastics' | 'bodyweight'
  onEquipmentFilterChange?: (filter: 'all' | 'barbell' | 'no_barbell' | 'gymnastics' | 'bodyweight') => void
  // For Premium: pass raw workout data to detect equipment
  rawWorkouts?: any[]
}

export default function HRStatisticsPanel({ 
  heatmapData, 
  equipmentFilter = 'all',
  onEquipmentFilterChange,
  rawWorkouts
}: HRStatisticsPanelProps) {
  const [localFilter, setLocalFilter] = useState(equipmentFilter)

  if (!heatmapData?.heatmapCells || heatmapData.heatmapCells.length === 0) {
    return null
  }

  // Filter cells by equipment if needed
  // For BTN: equipment is detected from exercises in workouts
  // For Premium: equipment comes from metcons.required_equipment
  const cells = heatmapData.heatmapCells.filter(cell => {
    if (equipmentFilter === 'all') return true
    
    // Equipment filtering would need workout context
    // For now, return all cells - filtering happens at API level
    return true
  })

  // Calculate HR by Time Domain
  const hrByTimeDomain = calculateHRByTimeDomain(cells)
  
  // Calculate HR by Exercise
  const hrByExercise = calculateHRByExercise(cells)
  
  // Calculate HR by Equipment (if rawWorkouts provided)
  const hrByEquipment = rawWorkouts ? calculateHRByEquipment(rawWorkouts) : []

  const handleFilterChange = (filter: 'all' | 'barbell' | 'no_barbell' | 'gymnastics' | 'bodyweight') => {
    setLocalFilter(filter)
    if (onEquipmentFilterChange) {
      onEquipmentFilterChange(filter)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Heart Rate Statistics</h3>
      
      {/* Equipment Filter Buttons */}
      {onEquipmentFilterChange && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'barbell', 'no_barbell', 'gymnastics', 'bodyweight'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-3 py-1 rounded border text-sm transition-colors ${
                localFilter === filter 
                  ? 'bg-[#FE5858] text-white border-[#FE5858]' 
                  : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      )}

      {/* HR by Time Domain */}
      {hrByTimeDomain.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">HR by Time Domain</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Time Domain</th>
                  <th className="text-right p-2">Avg HR</th>
                  <th className="text-right p-2">Peak HR</th>
                  <th className="text-right p-2">Workouts</th>
                </tr>
              </thead>
              <tbody>
                {hrByTimeDomain.map(domain => (
                  <tr key={domain.time_range} className="border-b">
                    <td className="p-2 font-medium">{domain.time_range}</td>
                    <td className="p-2 text-right">{domain.avg_hr !== null ? `${domain.avg_hr} bpm` : '—'}</td>
                    <td className="p-2 text-right">{domain.max_hr !== null ? `${domain.max_hr} bpm` : '—'}</td>
                    <td className="p-2 text-right">{domain.workout_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HR by Exercise (Top 10) */}
      {hrByExercise.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">HR by Exercise (Top 10)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Exercise</th>
                  <th className="text-right p-2">Avg HR</th>
                  <th className="text-right p-2">Peak HR</th>
                  <th className="text-right p-2">Appearances</th>
                </tr>
              </thead>
              <tbody>
                {hrByExercise.slice(0, 10).map(exercise => (
                  <tr key={exercise.exercise_name} className="border-b">
                    <td className="p-2 font-medium">{exercise.exercise_name}</td>
                    <td className="p-2 text-right">{exercise.avg_hr !== null ? `${exercise.avg_hr} bpm` : '—'}</td>
                    <td className="p-2 text-right">{exercise.max_hr !== null ? `${exercise.max_hr} bpm` : '—'}</td>
                    <td className="p-2 text-right">{exercise.appearances}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HR by Equipment */}
      {hrByEquipment.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3">HR by Equipment</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Equipment</th>
                  <th className="text-right p-2">Avg HR</th>
                  <th className="text-right p-2">Peak HR</th>
                  <th className="text-right p-2">Avg %ile</th>
                  <th className="text-right p-2">Workouts</th>
                </tr>
              </thead>
              <tbody>
                {hrByEquipment.map(eq => (
                  <tr key={eq.type} className="border-b">
                    <td className="p-2 font-medium">{eq.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                    <td className="p-2 text-right">{eq.avg_hr !== null ? `${eq.avg_hr} bpm` : '—'}</td>
                    <td className="p-2 text-right">{eq.max_hr !== null ? `${eq.max_hr} bpm` : '—'}</td>
                    <td className="p-2 text-right">{eq.avg_percentile !== null ? `${eq.avg_percentile}%` : '—'}</td>
                    <td className="p-2 text-right">{eq.workout_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hrByTimeDomain.length === 0 && hrByExercise.length === 0 && hrByEquipment.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No heart rate data available. Log workouts with HR to see statistics.</p>
        </div>
      )}
    </div>
  )
}

// Helper functions
function calculateHRByTimeDomain(cells: any[]) {
  const domainMap = new Map<string, { 
    totalAvgHR: number, 
    totalMaxHR: number, 
    count: number, 
    hrCount: number 
  }>()
  
  cells.forEach(cell => {
    if (!cell.time_range) return
    if (!domainMap.has(cell.time_range)) {
      domainMap.set(cell.time_range, { totalAvgHR: 0, totalMaxHR: 0, count: 0, hrCount: 0 })
    }
    const data = domainMap.get(cell.time_range)!
    data.count += cell.session_count
    if (cell.avg_heart_rate !== null && cell.avg_heart_rate !== undefined) {
      data.totalAvgHR += cell.avg_heart_rate * cell.session_count
      data.hrCount += cell.session_count
    }
    if (cell.max_heart_rate !== null && cell.max_heart_rate !== undefined) {
      data.totalMaxHR += cell.max_heart_rate * cell.session_count
    }
  })
  
  return Array.from(domainMap.entries())
    .map(([time_range, data]) => ({
      time_range,
      avg_hr: data.hrCount > 0 ? Math.round(data.totalAvgHR / data.hrCount) : null,
      max_hr: data.hrCount > 0 ? Math.round(data.totalMaxHR / data.hrCount) : null,
      workout_count: data.count
    }))
    .sort((a, b) => {
      const order: { [key: string]: number } = {
        '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
        '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
      }
      return (order[a.time_range] || 7) - (order[b.time_range] || 7)
    })
}

function calculateHRByExercise(cells: any[]) {
  const exerciseMap = new Map<string, { 
    totalAvgHR: number, 
    totalMaxHR: number, 
    count: number, 
    hrCount: number 
  }>()
  
  cells.forEach(cell => {
    if (!exerciseMap.has(cell.exercise_name)) {
      exerciseMap.set(cell.exercise_name, { totalAvgHR: 0, totalMaxHR: 0, count: 0, hrCount: 0 })
    }
    const data = exerciseMap.get(cell.exercise_name)!
    data.count += cell.session_count
    if (cell.avg_heart_rate !== null && cell.avg_heart_rate !== undefined) {
      data.totalAvgHR += cell.avg_heart_rate * cell.session_count
      data.hrCount += cell.session_count
    }
    if (cell.max_heart_rate !== null && cell.max_heart_rate !== undefined) {
      data.totalMaxHR += cell.max_heart_rate * cell.session_count
    }
  })
  
  return Array.from(exerciseMap.entries())
    .map(([exercise_name, data]) => ({
      exercise_name,
      avg_hr: data.hrCount > 0 ? Math.round(data.totalAvgHR / data.hrCount) : null,
      max_hr: data.hrCount > 0 ? Math.round(data.totalMaxHR / data.hrCount) : null,
      appearances: data.count
    }))
    .filter(ex => ex.avg_hr !== null) // Only show exercises with HR data
    .sort((a, b) => (b.avg_hr || 0) - (a.avg_hr || 0)) // Sort by avg HR descending
}

function calculateHRByEquipment(workouts: any[]) {
  const equipmentMap = new Map<string, {
    totalAvgHR: number
    totalMaxHR: number
    totalPercentile: number
    workoutCount: number
    hrCount: number
  }>()

  workouts.forEach(workout => {
    const reqEq = Array.isArray(workout.required_equipment) 
      ? workout.required_equipment 
      : []
    const avgHR = workout.avg_heart_rate ? parseFloat(workout.avg_heart_rate) : null
    const maxHR = workout.max_heart_rate ? parseFloat(workout.max_heart_rate) : null
    const percentile = workout.percentile ? parseFloat(workout.percentile) : null

    // Categorize by primary equipment
    let category = 'bodyweight'
    if (reqEq.includes('Barbell')) {
      category = 'barbell'
    } else if (reqEq.some((eq: string) => 
      eq === 'Pullup Bar or Rig' || 
      eq === 'High Rings' || 
      eq === 'Climbing Rope'
    )) {
      category = 'gymnastics'
    }

    if (!equipmentMap.has(category)) {
      equipmentMap.set(category, { totalAvgHR: 0, totalMaxHR: 0, totalPercentile: 0, workoutCount: 0, hrCount: 0 })
    }
    const data = equipmentMap.get(category)!
    data.workoutCount++
    if (avgHR !== null) {
      data.totalAvgHR += avgHR
      data.hrCount++
    }
    if (maxHR !== null) {
      data.totalMaxHR += maxHR
    }
    if (percentile !== null) {
      data.totalPercentile += percentile
    }
  })

  return Array.from(equipmentMap.entries())
    .map(([type, data]) => ({
      type,
      avg_hr: data.hrCount > 0 ? Math.round(data.totalAvgHR / data.hrCount) : null,
      max_hr: data.hrCount > 0 ? Math.round(data.totalMaxHR / data.hrCount) : null,
      avg_percentile: data.workoutCount > 0 ? Math.round(data.totalPercentile / data.workoutCount) : null,
      workout_count: data.workoutCount
    }))
    .filter(eq => eq.workout_count > 0)
    .sort((a, b) => b.workout_count - a.workout_count)
}

