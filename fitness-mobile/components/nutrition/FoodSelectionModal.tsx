import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { createClient } from '@/lib/supabase/client'

interface FoodSelectionModalProps {
  visible: boolean
  foodId: string | null
  foodName: string | null
  onClose: () => void
  onAdd: (foodData: {
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
}

interface Serving {
  serving_id: string
  serving_description: string
  calories: string
  protein: string
  carbohydrate: string
  fat: string
  fiber?: string
  sugar?: string
  sodium?: string
  is_default?: string
}

interface FoodDetails {
  food_id: string
  food_name: string
  servings: Serving[]
}

export default function FoodSelectionModal({
  visible,
  foodId,
  foodName,
  onClose,
  onAdd,
  preselectedMealType,
}: FoodSelectionModalProps) {
  const [loading, setLoading] = useState(false)
  const [foodDetails, setFoodDetails] = useState<FoodDetails | null>(null)
  const [selectedServing, setSelectedServing] = useState<Serving | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible && foodId) {
      loadFoodDetails()
    } else {
      // Reset state when modal closes
      setFoodDetails(null)
      setSelectedServing(null)
      setQuantity('1')
      setError(null)
    }
  }, [visible, foodId])

  const loadFoodDetails = async () => {
    if (!foodId) return

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
        body: { foodId },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.success && data?.data?.food) {
        const foodData = data.data.food

        // Normalize servings
        let servings = []
        if (foodData.servings?.serving) {
          servings = Array.isArray(foodData.servings.serving)
            ? foodData.servings.serving
            : [foodData.servings.serving]
        }

        setFoodDetails({
          food_id: foodData.food_id,
          food_name: foodData.food_name,
          servings,
        })

        // Set default serving
        const defaultServing = servings.find((s: Serving) => s.is_default === '1') || servings[0]
        if (defaultServing) {
          setSelectedServing(defaultServing)
        }
      } else {
        setError('Food details not found')
      }
    } catch (err: any) {
      console.error('Load food details error:', err)
      setError(err.message || 'Failed to load food details')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    if (!selectedServing || !foodDetails) return

    const quantityNum = parseFloat(quantity) || 1
    if (quantityNum <= 0) {
      setError('Quantity must be greater than 0')
      return
    }

    // Calculate nutrition for the quantity
    const calories = parseFloat(selectedServing.calories || '0') * quantityNum
    const protein = parseFloat(selectedServing.protein || '0') * quantityNum
    const carbohydrate = parseFloat(selectedServing.carbohydrate || '0') * quantityNum
    const fat = parseFloat(selectedServing.fat || '0') * quantityNum
    const fiber = parseFloat(selectedServing.fiber || '0') * quantityNum
    const sugar = parseFloat(selectedServing.sugar || '0') * quantityNum
    const sodium = parseFloat(selectedServing.sodium || '0') * quantityNum

    onAdd({
      food_id: foodDetails.food_id,
      food_name: foodDetails.food_name,
      serving_id: selectedServing.serving_id,
      serving_description: selectedServing.serving_description,
      number_of_units: quantityNum,
      calories,
      protein,
      carbohydrate,
      fat,
      fiber,
      sugar,
      sodium,
    })

    onClose()
  }

  const incrementQuantity = () => {
    const current = parseFloat(quantity) || 1
    setQuantity((current + 1).toString())
  }

  const decrementQuantity = () => {
    const current = parseFloat(quantity) || 1
    if (current > 1) {
      setQuantity((current - 1).toString())
    }
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{foodName || 'Select Food'}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#FE5858" />
              <Text style={styles.modalLoadingText}>Loading food details...</Text>
            </View>
          ) : error ? (
            <View style={styles.modalError}>
              <Text style={styles.modalErrorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadFoodDetails}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : foodDetails ? (
            <ScrollView 
              style={styles.modalBody} 
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Serving Selection */}
              {foodDetails.servings && foodDetails.servings.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Serving Size</Text>
                  {foodDetails.servings.map((serving) => (
                    <TouchableOpacity
                      key={serving.serving_id}
                      onPress={() => setSelectedServing(serving)}
                      style={[
                        styles.servingOption,
                        selectedServing?.serving_id === serving.serving_id && styles.servingOptionActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.servingOptionText,
                          selectedServing?.serving_id === serving.serving_id && styles.servingOptionTextActive,
                        ]}
                      >
                        {serving.serving_description}
                      </Text>
                      <Text
                        style={[
                          styles.servingOptionCalories,
                          selectedServing?.serving_id === serving.serving_id && styles.servingOptionCaloriesActive,
                        ]}
                      >
                        {serving.calories} kcal
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Quantity Input */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Quantity</Text>
                <View style={styles.quantityContainer}>
                  <TouchableOpacity style={styles.quantityButton} onPress={decrementQuantity}>
                    <Text style={styles.quantityButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholder="1"
                  />
                  <TouchableOpacity style={styles.quantityButton} onPress={incrementQuantity}>
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nutrition Info Preview */}
              {selectedServing && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Nutrition ({quantity || 1} × serving)
                  </Text>
                  <View style={styles.nutritionPreview}>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Calories:</Text>
                      <Text style={styles.nutritionValue}>
                        {Math.round(parseFloat(selectedServing.calories || '0') * (parseFloat(quantity) || 1))}
                      </Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Protein:</Text>
                      <Text style={styles.nutritionValue}>
                        {Math.round(parseFloat(selectedServing.protein || '0') * (parseFloat(quantity) || 1))}g
                      </Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Carbs:</Text>
                      <Text style={styles.nutritionValue}>
                        {Math.round(parseFloat(selectedServing.carbohydrate || '0') * (parseFloat(quantity) || 1))}g
                      </Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Fat:</Text>
                      <Text style={styles.nutritionValue}>
                        {Math.round(parseFloat(selectedServing.fat || '0') * (parseFloat(quantity) || 1))}g
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Add Button */}
              <TouchableOpacity
                style={[styles.addButton, (!selectedServing || loading) && styles.addButtonDisabled]}
                onPress={handleAdd}
                disabled={!selectedServing || loading}
                activeOpacity={0.8}
              >
                <Text style={styles.addButtonText}>Add to Meal</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    flex: 1,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    flex: 1,
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '300',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  modalError: {
    padding: 20,
  },
  modalErrorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  servingOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FBFE',
    marginBottom: 8,
  },
  servingOptionActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  servingOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#282B34',
    flex: 1,
  },
  servingOptionTextActive: {
    color: '#FE5858',
    fontWeight: '600',
  },
  servingOptionCalories: {
    fontSize: 14,
    color: '#6B7280',
  },
  servingOptionCaloriesActive: {
    color: '#FE5858',
    fontWeight: '600',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quantityButtonText: {
    fontSize: 24,
    color: '#282B34',
    fontWeight: '600',
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#282B34',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  nutritionPreview: {
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  addButton: {
    backgroundColor: '#FE5858',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
})

