'use client'

import { useState } from 'react'

interface FoodLogListProps {
  logs: any[]
  onDelete: (id: number) => void
}

export default function FoodLogList({ logs, onDelete }: FoodLogListProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all')

  const mealTypeLabels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    pre_workout: 'Pre-Workout',
    post_workout: 'Post-Workout',
    snack: 'Snack',
    other: 'Other',
  }

  // Filter logs by selected meal type
  const filteredLogs = selectedFilter === 'all' 
    ? logs 
    : logs.filter(log => (log.meal_type || 'other') === selectedFilter)

  // Group filtered logs by meal type
  const grouped = filteredLogs.reduce((acc, log) => {
    const mealType = log.meal_type || 'other'
    if (!acc[mealType]) acc[mealType] = []
    acc[mealType].push(log)
    return acc
  }, {} as Record<string, any[]>)

  if (logs.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        No foods logged today. Search and log foods above to get started!
      </div>
    )
  }

  const mealTypes = ['all', 'breakfast', 'lunch', 'dinner', 'pre_workout', 'post_workout', 'snack', 'other']

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-200">
        {mealTypes.map((mealType) => (
          <button
            key={mealType}
            onClick={() => setSelectedFilter(mealType)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedFilter === mealType
                ? 'bg-[#FE5858] text-white'
                : 'bg-[#F8FBFE] text-[#282B34] border border-[#FE5858] hover:bg-[#FE5858] hover:text-white'
            }`}
          >
            {mealType === 'all' ? 'All' : mealTypeLabels[mealType] || mealType}
          </button>
        ))}
      </div>

      {/* Filtered Results */}
      {filteredLogs.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-8">
          No foods found for this filter.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([mealType, mealLogs]) => {
            const typedMealLogs = mealLogs as any[]
            return (
              <div key={mealType}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {mealTypeLabels[mealType] || mealType}
                </h3>
                <div className="space-y-2">
                  {typedMealLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{log.food_name}</div>
                        <div className="text-sm text-gray-600">
                          {log.serving_description && `${log.number_of_units} × ${log.serving_description}`}
                          {log.calories && ` • ${Math.round(log.calories)} kcal`}
                          {log.protein && ` • ${Math.round(log.protein)}g protein`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(log.logged_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Delete this food entry?')) {
                            onDelete(log.id)
                          }
                        }}
                        className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

