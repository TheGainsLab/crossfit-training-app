'use client'

interface FoodLogListProps {
  logs: any[]
  onDelete: (id: number) => void
}

export default function FoodLogList({ logs, onDelete }: FoodLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        No foods logged today. Search and log foods above to get started!
      </div>
    )
  }

  // Group by meal type
  const grouped = logs.reduce((acc, log) => {
    const mealType = log.meal_type || 'other'
    if (!acc[mealType]) acc[mealType] = []
    acc[mealType].push(log)
    return acc
  }, {} as Record<string, any[]>)

  const mealTypeLabels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    other: 'Other',
  }

  return (
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
  )
}

