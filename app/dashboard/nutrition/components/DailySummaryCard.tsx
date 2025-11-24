'use client'

interface DailySummaryCardProps {
  summary: any
}

export default function DailySummaryCard({ summary }: DailySummaryCardProps) {
  if (!summary) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h2>
        <div className="text-sm text-gray-500">No data for today yet. Log some foods to get started!</div>
      </div>
    )
  }

  const calories = summary.total_calories || 0
  const protein = summary.total_protein || 0
  const carbs = summary.total_carbohydrate || 0
  const fat = summary.total_fat || 0
  const surplusDeficit = summary.surplus_deficit || 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-sm text-gray-600">Calories</div>
          <div className="text-2xl font-bold text-gray-900">{Math.round(calories)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Protein</div>
          <div className="text-2xl font-bold text-gray-900">{Math.round(protein)}g</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Carbs</div>
          <div className="text-2xl font-bold text-gray-900">{Math.round(carbs)}g</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Fat</div>
          <div className="text-2xl font-bold text-gray-900">{Math.round(fat)}g</div>
        </div>
      </div>

      {summary.tdee_estimate && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">TDEE Estimate</span>
            <span className="text-sm font-medium text-gray-900">{Math.round(summary.tdee_estimate)} kcal</span>
          </div>
          {surplusDeficit !== 0 && (
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600">Surplus/Deficit</span>
              <span className={`text-sm font-medium ${surplusDeficit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {surplusDeficit > 0 ? '+' : ''}{Math.round(surplusDeficit)} kcal
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

