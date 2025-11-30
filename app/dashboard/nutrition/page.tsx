'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DailySummaryCard from './components/DailySummaryCard'
import FoodSearch from './components/FoodSearch'
import FoodLogList from './components/FoodLogList'
import FoodDetailsModal from './components/FoodDetailsModal'

export default function NutritionPage() {
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [dailySummary, setDailySummary] = useState<any>(null)
  const [todayLogs, setTodayLogs] = useState<any[]>([])
  const [selectedFood, setSelectedFood] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (userData?.id) {
          setUserId(userData.id)
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!userId) return

    const loadDailyData = async () => {
      try {
        const supabase = createClient()
        const today = new Date().toISOString().split('T')[0]

        // Load daily summary
        const { data: summary } = await supabase
          .from('daily_nutrition')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle() // Use maybeSingle() - returns null if no row exists

        setDailySummary(summary || null)

        // Load today's food entries
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)

        const { data: logs } = await supabase
          .from('food_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('logged_at', startOfDay.toISOString())
          .lte('logged_at', endOfDay.toISOString())
          .order('logged_at', { ascending: false })

        setTodayLogs(logs || [])
      } catch (error) {
        console.error('Error loading daily data:', error)
      }
    }

    loadDailyData()
  }, [userId, refreshKey])

  const handleFoodSelected = (food: any) => {
    setSelectedFood(food)
    setModalOpen(true)
  }

  const handleFoodLogged = () => {
    setModalOpen(false)
    setSelectedFood(null)
    setRefreshKey(prev => prev + 1) // Trigger refresh
    // Reset the log flow after logging
    handleResetLogFlow()
  }

  const handleMealTypeSelected = (mealType: string) => {
    setSelectedMealType(mealType)
    setShowMealTypeSelection(false)
    setShowSearch(true)
  }

  const handleResetLogFlow = () => {
    setShowMealTypeSelection(false)
    setShowSearch(false)
    setSelectedMealType(null)
  }

  const handleDeleteEntry = async (entryId: number) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error
      setRefreshKey(prev => prev + 1) // Trigger refresh
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('Failed to delete entry')
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-sm text-gray-500">Please sign in to access nutrition tracking.</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>

      {/* Daily Summary Card */}
      <DailySummaryCard summary={dailySummary} />

      {/* Log Foods Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {!showMealTypeSelection && !showSearch && (
          <button
            onClick={() => setShowMealTypeSelection(true)}
            className="w-full px-6 py-4 bg-[#FE5858] text-white rounded-lg font-semibold text-lg hover:bg-[#ff6b6b] transition-colors"
          >
            Log Foods
          </button>
        )}

        {showMealTypeSelection && !showSearch && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Select Meal Type</h2>
              <button
                onClick={handleResetLogFlow}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'breakfast', label: 'Breakfast' },
                { value: 'lunch', label: 'Lunch' },
                { value: 'dinner', label: 'Dinner' },
                { value: 'pre_workout', label: 'Pre-Workout' },
                { value: 'post_workout', label: 'Post-Workout' },
                { value: 'snack', label: 'Snack' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleMealTypeSelected(option.value)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-[#F8FBFE] text-[#282B34] border border-[#FE5858] hover:bg-[#FE5858] hover:text-white"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showSearch && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Search Foods
                {selectedMealType && (
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({['breakfast', 'lunch', 'dinner', 'pre_workout', 'post_workout', 'snack'].includes(selectedMealType) 
                      ? ['Breakfast', 'Lunch', 'Dinner', 'Pre-Workout', 'Post-Workout', 'Snack'][['breakfast', 'lunch', 'dinner', 'pre_workout', 'post_workout', 'snack'].indexOf(selectedMealType)]
                      : selectedMealType})
                  </span>
                )}
              </h2>
              <button
                onClick={handleResetLogFlow}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Start Over
              </button>
            </div>
            <FoodSearch 
              onFoodSelected={(food) => {
                handleFoodSelected(food)
              }} 
              userId={userId} 
            />
          </div>
        )}
      </div>

      {/* Today's Food Log */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Food Log</h2>
        <FoodLogList logs={todayLogs} onDelete={handleDeleteEntry} />
      </div>

      {/* Food Details Modal */}
      {selectedFood && (
        <FoodDetailsModal
          food={selectedFood}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setSelectedFood(null)
          }}
          onLogged={handleFoodLogged}
          userId={userId}
          preselectedMealType={selectedMealType}
        />
      )}
    </div>
  )
}

