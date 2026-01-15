import React, { useState } from 'react'
import { Modal, View, StyleSheet } from 'react-native'
import FoodSearchView from './FoodSearchView'
import FoodSelectionView from './FoodSelectionView'

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
    // Reset to search view when fully closing modal
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {currentView === 'search' ? (
            <FoodSearchView
              onClose={handleClose}
              onFoodSelected={handleFoodSelected}
              filterType={filterType}
            />
          ) : (
            <FoodSelectionView
              foodId={selectedFood?.foodId || null}
              foodName={selectedFood?.foodName || null}
              onBack={handleBackToSearch}
              onAdd={handleFoodAdded}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    flex: 1,
    paddingTop: 20,
  },
})
