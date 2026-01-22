import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import FoodSearchView from './FoodSearchView'
import FoodSelectionView from './FoodSelectionView'

interface FoodLoggingScreenProps {
  onBack: () => void
  onFoodAdded: (foodData: {
    food_id: string
    food_name: string
    serving_id: string
    serving_description: string
    number_of_units: number
    calories: number
    protein: number
    carbohydrate: number
    fat: number
    fiber: number
    sugar: number
    sodium: number
  }) => void
  preselectedMealType?: string | null
  filterType?: 'generic' | 'brand' | 'all'
}

type ScreenView = 'search' | 'details'

/**
 * FoodLoggingScreen - Full-screen food logging flow
 *
 * This is a swap-out screen component (not a modal) that replaces the main view
 * when active. This prevents iOS modal stacking issues by avoiding native modals
 * entirely for this navigation flow.
 *
 * Uses internal view switching (search -> details) instead of nested modals.
 */
export default function FoodLoggingScreen({
  onBack,
  onFoodAdded,
  preselectedMealType,
  filterType = 'all',
}: FoodLoggingScreenProps) {
  const [currentView, setCurrentView] = useState<ScreenView>('search')
  const [selectedFood, setSelectedFood] = useState<{ foodId: string; foodName: string } | null>(null)

  const handleBack = () => {
    if (currentView === 'details') {
      // Go back to search view
      setCurrentView('search')
      setSelectedFood(null)
    } else {
      // Exit the screen entirely
      onBack()
    }
  }

  const handleFoodSelected = (food: { food_id: string; food_name: string }) => {
    setSelectedFood({ foodId: food.food_id, foodName: food.food_name })
    setCurrentView('details')
  }

  const handleFoodAdded = (foodData: any) => {
    onFoodAdded(foodData)
    // Reset state and exit
    setCurrentView('search')
    setSelectedFood(null)
    onBack()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {currentView === 'search' ? (
        <FoodSearchView
          onClose={handleBack}
          onFoodSelected={handleFoodSelected}
          filterType={filterType}
        />
      ) : (
        <FoodSelectionView
          foodId={selectedFood?.foodId || null}
          foodName={selectedFood?.foodName || null}
          onBack={() => {
            setCurrentView('search')
            setSelectedFood(null)
          }}
          onAdd={handleFoodAdded}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
})
