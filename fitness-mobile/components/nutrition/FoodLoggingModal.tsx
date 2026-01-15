import React, { useState } from 'react'
import { Modal } from 'react-native'
import FoodSearchModal from './FoodSearchModal'
import FoodSelectionModal from './FoodSelectionModal'

interface FoodLoggingModalProps {
  visible: boolean
  onClose: () => void
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

type ModalView = 'search' | 'details'

export default function FoodLoggingModal({
  visible,
  onClose,
  onFoodAdded,
  preselectedMealType,
  filterType = 'all',
}: FoodLoggingModalProps) {
  const [currentView, setCurrentView] = useState<ModalView>('search')
  const [selectedFood, setSelectedFood] = useState<{ foodId: string; foodName: string } | null>(null)

  const handleClose = () => {
    // Reset to search view when closing
    setCurrentView('search')
    setSelectedFood(null)
    onClose()
  }

  const handleFoodSelected = (food: { food_id: string; food_name: string }) => {
    console.log('🔄 FoodLoggingModal: Food selected, switching to details view')
    setSelectedFood({ foodId: food.food_id, foodName: food.food_name })
    setCurrentView('details')
  }

  const handleBackToSearch = () => {
    console.log('⬅️ FoodLoggingModal: Back to search')
    setCurrentView('search')
    setSelectedFood(null)
  }

  const handleFoodAdded = (foodData: any) => {
    console.log('✅ FoodLoggingModal: Food logged, closing modal')
    onFoodAdded(foodData)
    handleClose()
  }

  // Render the appropriate view based on state
  // Both modals are actually rendered but only one is visible at a time
  // This prevents the iOS modal stacking issue
  return (
    <>
      <FoodSearchModal
        visible={visible && currentView === 'search'}
        onClose={handleClose}
        onFoodSelected={handleFoodSelected}
        preselectedMealType={preselectedMealType}
        filterType={filterType}
      />
      <FoodSelectionModal
        visible={visible && currentView === 'details'}
        foodId={selectedFood?.foodId || null}
        foodName={selectedFood?.foodName || null}
        onClose={handleBackToSearch}
        onAdd={handleFoodAdded}
        preselectedMealType={preselectedMealType}
      />
    </>
  )
}
