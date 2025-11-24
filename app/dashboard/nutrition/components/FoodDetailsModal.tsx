'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FoodDetailsModalProps {
  food: any
  open: boolean
  onClose: () => void
  onLogged: () => void
  userId: number
}

export default function FoodDetailsModal({
  food,
  open,
  onClose,
  onLogged,
  userId,
}: FoodDetailsModalProps) {
  const [loading, setLoading] = useState(false)
  const [foodDetails, setFoodDetails] = useState<any>(null)
  const [selectedServing, setSelectedServing] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [mealType, setMealType] = useState<string>('other')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && food?.food_id) {
      loadFoodDetails()
    }
  }, [open, food?.food_id])

  const loadFoodDetails = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Please sign in')
        return
      }

      const { data, error: invokeError } = await supabase.functions.invoke('nutrition-food', {
        body: { foodId: food.food_id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.success && data?.data?.food) {
        const foodData = data.data.food
        
        // Normalize servings (handle single vs array)
        let servings = []
        if (foodData.servings?.serving) {
          servings = Array.isArray(foodData.servings.serving)
            ? foodData.servings.serving
            : [foodData.servings.serving]
        }

        setFoodDetails({ ...foodData, servings })
        
        // Set default serving (first one or default)
        const defaultServing = servings.find((s: any) => s.is_default === '1') || servings[0]
        if (defaultServing) {
          setSelectedServing(defaultServing)
        }
      }
    } catch (err: any) {
      console.error('Load food details error:', err)
      setError(err.message || 'Failed to load food details')
    } finally {
      setLoading(false)
    }
  }

  const handleLogFood = async () => {
    if (!selectedServing || !foodDetails) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Calculate nutrition for the quantity
      const calories = parseFloat(selectedServing.calories || '0') * quantity
      const protein = parseFloat(selectedServing.protein || '0') * quantity
      const carbohydrate = parseFloat(selectedServing.carbohydrate || '0') * quantity
      const fat = parseFloat(selectedServing.fat || '0') * quantity
      const fiber = parseFloat(selectedServing.fiber || '0') * quantity
      const sugar = parseFloat(selectedServing.sugar || '0') * quantity
      const sodium = parseFloat(selectedServing.sodium || '0') * quantity

      const { error } = await supabase
        .from('food_entries')
        .insert({
          user_id: userId,
          food_id: foodDetails.food_id,
          food_name: foodDetails.food_name,
          serving_id: selectedServing.serving_id,
          serving_description: selectedServing.serving_description,
          number_of_units: quantity,
          calories,
          protein,
          carbohydrate,
          fat,
          fiber,
          sugar,
          sodium,
          meal_type: mealType,
        })

      if (error) throw error

      onLogged()
    } catch (err: any) {
      console.error('Log food error:', err)
      setError(err.message || 'Failed to log food')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {foodDetails?.food_name || food?.food_name || 'Food Details'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            {loading && !foodDetails && (
              <div className="text-sm text-gray-500">Loading food details...</div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            {foodDetails && (
              <>
                {foodDetails.brand_name && (
                  <div className="text-sm text-gray-600">Brand: {foodDetails.brand_name}</div>
                )}

                {/* Serving Selection */}
                {foodDetails.servings && foodDetails.servings.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Serving Size
                    </label>
                    <select
                      value={selectedServing?.serving_id || ''}
                      onChange={(e) => {
                        const serving = foodDetails.servings.find(
                          (s: any) => s.serving_id === e.target.value
                        )
                        setSelectedServing(serving)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {foodDetails.servings.map((serving: any) => (
                        <option key={serving.serving_id} value={serving.serving_id}>
                          {serving.serving_description} ({serving.metric_serving_amount} {serving.metric_serving_unit})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Meal Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meal Type
                  </label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Nutrition Preview */}
                {selectedServing && (
                  <div className="bg-gray-50 rounded-md p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      Nutrition ({quantity} × {selectedServing.serving_description})
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Calories:</span>{' '}
                        <span className="font-medium">
                          {Math.round(parseFloat(selectedServing.calories || '0') * quantity)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Protein:</span>{' '}
                        <span className="font-medium">
                          {Math.round(parseFloat(selectedServing.protein || '0') * quantity)}g
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Carbs:</span>{' '}
                        <span className="font-medium">
                          {Math.round(parseFloat(selectedServing.carbohydrate || '0') * quantity)}g
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Fat:</span>{' '}
                        <span className="font-medium">
                          {Math.round(parseFloat(selectedServing.fat || '0') * quantity)}g
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Log Button */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleLogFood}
                    disabled={loading || !selectedServing}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Logging...' : 'Log Food'}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

