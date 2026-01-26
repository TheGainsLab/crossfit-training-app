import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '@/lib/supabase/client'
import FoodSearchView from './FoodSearchView'

interface FoodItem {
  id: string
  food_name: string
  description?: string
  amount: number
  unit: string
  options: number[]
  aiEstimate: number
  confidence: 'high' | 'medium' | 'low'
  nutritionPerUnit: {
    calories: number
    protein: number
    carbohydrate: number
    fat: number
  }
  cache_data?: any
  entry_data?: any
  matched_serving?: any
  available_servings?: any[]
  alternatives?: any[]
}

interface PhotoResultSliderProps {
  foods: FoodItem[]
  userUnits: string // 'lbs/in' or 'kg/cm'
  onConfirm: (adjustedFoods: FoodItem[]) => void
  onRetake: () => void
  onCancel: () => void
}

export default function PhotoResultSlider({
  foods: initialFoods,
  userUnits,
  onConfirm,
  onRetake,
  onCancel,
}: PhotoResultSliderProps) {
  const [foods, setFoods] = useState<FoodItem[]>(initialFoods)
  const [saveAsFavorite, setSaveAsFavorite] = useState(false)
  const [replacingFoodId, setReplacingFoodId] = useState<string | null>(null)
  const [loadingReplacement, setLoadingReplacement] = useState(false)
  const usesImperial = userUnits?.includes('lbs')
  const supabase = createClient()

  // Handle tapping food name to replace it
  const handleFoodNameTap = (foodId: string) => {
    setReplacingFoodId(foodId)
  }

  // Handle selecting a replacement food from search
  const handleReplacementSelect = async (selectedFood: { food_id: string; food_name: string }) => {
    if (!replacingFoodId) return

    setLoadingReplacement(true)
    try {
      // Fetch full food details
      const { data, error } = await supabase.functions.invoke('nutrition-food', {
        body: { foodId: selectedFood.food_id, normalize: true },
      })

      if (error) throw error

      const foodData = data?.data?.food
      if (!foodData) throw new Error('Failed to load food details')

      // Get the serving and extract nutrition per oz (or per 100g)
      const servings = foodData.servings?.serving || []
      const serving = Array.isArray(servings) ? servings[0] : servings

      // Extract serving weight
      let servingWeightInGrams: number | null = null
      if (serving?.metric_serving_amount && serving?.metric_serving_unit === 'g') {
        servingWeightInGrams = parseFloat(serving.metric_serving_amount)
      } else if (serving?.serving_description) {
        const desc = serving.serving_description.toLowerCase()
        const ozMatch = desc.match(/([\d.]+)\s*oz/)
        const gMatch = desc.match(/([\d.]+)\s*g\b/)
        if (ozMatch) servingWeightInGrams = parseFloat(ozMatch[1]) * 28.35
        else if (gMatch) servingWeightInGrams = parseFloat(gMatch[1])
      }

      const baseCalories = parseFloat(serving?.calories || '0')
      const baseProtein = parseFloat(serving?.protein || '0')
      const baseCarbs = parseFloat(serving?.carbohydrate || '0')
      const baseFat = parseFloat(serving?.fat || '0')

      // Find the food being replaced to keep its portion
      const foodBeingReplaced = foods.find(f => f.id === replacingFoodId)
      if (!foodBeingReplaced) throw new Error('Food not found')

      // Calculate nutrition per unit (per oz or per 100g)
      let nutritionPerUnit
      const GRAMS_PER_OZ = 28.35

      if (servingWeightInGrams && servingWeightInGrams > 0) {
        if (foodBeingReplaced.unit === 'oz') {
          const servingWeightInOz = servingWeightInGrams / GRAMS_PER_OZ
          nutritionPerUnit = {
            calories: baseCalories / servingWeightInOz,
            protein: baseProtein / servingWeightInOz,
            carbohydrate: baseCarbs / servingWeightInOz,
            fat: baseFat / servingWeightInOz,
          }
        } else {
          // Per 100g
          nutritionPerUnit = {
            calories: (baseCalories / servingWeightInGrams) * 100,
            protein: (baseProtein / servingWeightInGrams) * 100,
            carbohydrate: (baseCarbs / servingWeightInGrams) * 100,
            fat: (baseFat / servingWeightInGrams) * 100,
          }
        }
      } else {
        // Fallback
        nutritionPerUnit = {
          calories: baseCalories,
          protein: baseProtein,
          carbohydrate: baseCarbs,
          fat: baseFat,
        }
      }

      // Update the food item, keeping the portion
      setFoods(prev => prev.map(food =>
        food.id === replacingFoodId
          ? {
              ...food,
              food_name: foodData.food_name,
              entry_data: { ...food.entry_data, food_id: foodData.food_id, food_name: foodData.food_name },
              nutritionPerUnit,
              confidence: 'high' as const, // User manually selected, so high confidence
            }
          : food
      ))

      setReplacingFoodId(null)
    } catch (error) {
      console.error('Error replacing food:', error)
      Alert.alert('Error', 'Failed to load food details. Please try again.')
    } finally {
      setLoadingReplacement(false)
    }
  }

  const updateAmount = (id: string, newAmount: number) => {
    setFoods(prev => prev.map(food => 
      food.id === id ? { ...food, amount: newAmount } : food
    ))
  }

  const toggleUnit = (id: string) => {
    setFoods(prev => prev.map(food => {
      if (food.id !== id) return food

      const isCurrentlyOz = food.unit === 'oz'
      const newUnit = isCurrentlyOz ? '×100g' : 'oz'

      // Convert amount: oz to 100g multiples or vice versa
      // 1 oz ≈ 28.35g, so X oz ≈ X * 0.2835 × 100g portions
      // Reverse: X × 100g = X * 3.527 oz
      const newAmount = isCurrentlyOz
        ? Math.round(food.amount * 0.2835) || 1 // oz to 100g multiples
        : Math.round(food.amount * 3.527) || 1  // 100g multiples to oz

      // Generate new options
      const newOptions = isCurrentlyOz
        ? [1, 2, 3, 4, 5, 6, 7, 8] // 100g multiples
        : [1, 2, 3, 4, 6, 8, 12, 16] // oz

      // Find closest option
      const closestOption = newOptions.reduce((prev, curr) =>
        Math.abs(curr - newAmount) < Math.abs(prev - newAmount) ? curr : prev
      )

      // Convert nutrition per unit
      // oz → 100g: multiply by (28.35 / 100) ≈ 0.2835... wait no
      // If nutritionPerUnit is per 1oz, and we want per 100g:
      // per 100g = per oz * (100 / 28.35) = per oz * 3.527
      // If nutritionPerUnit is per 100g, and we want per oz:
      // per oz = per 100g * (28.35 / 100) = per 100g * 0.2835
      const conversionFactor = isCurrentlyOz ? 3.527 : 0.2835
      const newNutritionPerUnit = {
        calories: food.nutritionPerUnit.calories * conversionFactor,
        protein: food.nutritionPerUnit.protein * conversionFactor,
        carbohydrate: food.nutritionPerUnit.carbohydrate * conversionFactor,
        fat: food.nutritionPerUnit.fat * conversionFactor,
      }

      return {
        ...food,
        amount: closestOption,
        unit: newUnit,
        options: newOptions,
        nutritionPerUnit: newNutritionPerUnit,
      }
    }))
  }

  const removeFood = (id: string) => {
    if (foods.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one food item.')
      return
    }
    Alert.alert(
      'Remove Item',
      'Remove this food from the meal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
          setFoods(prev => prev.filter(f => f.id !== id))
        }},
      ]
    )
  }

  const getSliderPosition = (food: FoodItem) => {
    const index = food.options.indexOf(food.amount)
    return index >= 0 ? (index / (food.options.length - 1)) * 100 : 50
  }

  const totals = foods.reduce((acc, food) => ({
    calories: acc.calories + Math.round(food.nutritionPerUnit.calories * food.amount),
    protein: acc.protein + food.nutritionPerUnit.protein * food.amount,
    carbs: acc.carbs + food.nutritionPerUnit.carbohydrate * food.amount,
    fat: acc.fat + food.nutritionPerUnit.fat * food.amount,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const handleConfirm = () => {
    if (saveAsFavorite) {
      // For now, just log - actual save functionality can be added later
      console.log('Saving meal as favorite:', foods)
      Alert.alert('Favorite Saved', 'This meal has been added to your favorites!', [
        { text: 'OK', onPress: () => onConfirm(foods) }
      ])
    } else {
      onConfirm(foods)
    }
  }

  // Show search view when replacing a food
  if (replacingFoodId) {
    const foodBeingReplaced = foods.find(f => f.id === replacingFoodId)
    return (
      <View style={styles.container}>
        {loadingReplacement ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FE5858" />
            <Text style={styles.loadingText}>Loading food details...</Text>
          </View>
        ) : (
          <FoodSearchView
            onClose={() => setReplacingFoodId(null)}
            onFoodSelected={handleReplacementSelect}
            filterType="generic"
            initialQuery={foodBeingReplaced?.food_name}
          />
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onRetake} style={styles.retakeButton}>
            <Ionicons name="camera-reverse" size={20} color="#FE5858" />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>We found {foods.length} {foods.length === 1 ? 'item' : 'items'}</Text>
            <Text style={styles.headerSubtitle}>Adjust portions if needed</Text>
          </View>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Ionicons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Food Items with Sliders */}
        <View style={styles.foodsList}>
          {foods.map((food) => (
            <View 
              key={food.id}
              style={[
                styles.foodCard,
                food.confidence === 'medium' && styles.foodCardWarning,
                food.confidence === 'low' && styles.foodCardLowConfidence,
              ]}
            >
              {/* Food Header */}
              <View style={styles.foodHeader}>
                <TouchableOpacity
                  style={styles.foodNameContainer}
                  onPress={() => handleFoodNameTap(food.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.foodNameRow}>
                    <Text style={styles.foodName}>{food.food_name}</Text>
                    <Ionicons name="pencil" size={14} color="#9CA3AF" style={{ marginLeft: 6 }} />
                  </View>
                  {food.description && (
                    <Text style={styles.foodDescription}>{food.description}</Text>
                  )}
                  {/* AI Estimate */}
                  <Text style={styles.aiEstimate}>
                    AI suggested: {food.aiEstimate} {food.unit}
                  </Text>
                  <Text style={styles.tapToChange}>Tap to change food</Text>
                </TouchableOpacity>
                <View style={styles.caloriesContainer}>
                  <Text style={styles.caloriesValue}>
                    {Math.round(food.nutritionPerUnit.calories * food.amount)}
                  </Text>
                  <Text style={styles.caloriesLabel}>cal</Text>
                </View>
              </View>

              {/* Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderTrack}>
                  {/* Background Track */}
                  <View style={styles.sliderTrackBackground} />
                  
                  {/* Active Track */}
                  <View 
                    style={[
                      styles.sliderTrackActive,
                      { width: `${getSliderPosition(food) * 0.88}%` }
                    ]} 
                  />

                  {/* Option Buttons */}
                  <View style={styles.sliderOptions}>
                    {food.options.map((opt) => {
                      const isSelected = food.amount === opt
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => updateAmount(food.id, opt)}
                          style={[
                            styles.sliderOption,
                            isSelected && styles.sliderOptionSelected,
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.sliderOptionText,
                            isSelected && styles.sliderOptionTextSelected,
                          ]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
                
                {/* Unit Toggle */}
                <View style={styles.unitRow}>
                  <Text style={styles.unitLabel}>{food.unit}</Text>
                  <TouchableOpacity 
                    onPress={() => toggleUnit(food.id)}
                    style={styles.unitToggle}
                  >
                    <Text style={styles.unitToggleText}>
                      Switch to {food.unit === 'oz' ? 'g' : 'oz'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Macros Row */}
              <View style={styles.macrosRow}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValue}>
                    {Math.round(food.nutritionPerUnit.protein * food.amount)}g
                  </Text>
                  <Text style={styles.macroLabel}>protein</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValue}>
                    {Math.round(food.nutritionPerUnit.carbohydrate * food.amount)}g
                  </Text>
                  <Text style={styles.macroLabel}>carbs</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValue}>
                    {Math.round(food.nutritionPerUnit.fat * food.amount)}g
                  </Text>
                  <Text style={styles.macroLabel}>fat</Text>
                </View>
              </View>

              {/* Confidence Warning */}
              {food.confidence !== 'high' && (
                <View style={[
                  styles.confidenceWarning,
                  food.confidence === 'low' && styles.confidenceWarningLow
                ]}>
                  <Ionicons 
                    name="alert-circle" 
                    size={16} 
                    color={food.confidence === 'low' ? '#EF4444' : '#F59E0B'} 
                  />
                  <Text style={[
                    styles.confidenceWarningText,
                    food.confidence === 'low' && styles.confidenceWarningTextLow
                  ]}>
                    {food.confidence === 'low' 
                      ? 'Low confidence - please verify carefully' 
                      : 'Please verify portion size'}
                  </Text>
                </View>
              )}

              {/* Remove Button */}
              {foods.length > 1 && (
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeFood(food.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.removeButtonText}>Remove item</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Totals Summary */}
        <View style={styles.totalsCard}>
          <View style={styles.totalsHeader}>
            <Text style={styles.totalsLabel}>Meal Total</Text>
            <View style={styles.totalsCalories}>
              <Text style={styles.totalsCaloriesValue}>{totals.calories}</Text>
              <Text style={styles.totalsCaloriesLabel}>cal</Text>
            </View>
          </View>
          <View style={styles.totalsMacros}>
            <View style={styles.totalsMacroItem}>
              <Text style={styles.totalsMacroValue}>{Math.round(totals.protein)}g</Text>
              <Text style={styles.totalsMacroLabel}>protein</Text>
            </View>
            <View style={styles.totalsMacroItem}>
              <Text style={styles.totalsMacroValue}>{Math.round(totals.carbs)}g</Text>
              <Text style={styles.totalsMacroLabel}>carbs</Text>
            </View>
            <View style={styles.totalsMacroItem}>
              <Text style={styles.totalsMacroValue}>{Math.round(totals.fat)}g</Text>
              <Text style={styles.totalsMacroLabel}>fat</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={handleConfirm}
            style={styles.confirmButton}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Log Meal</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setSaveAsFavorite(!saveAsFavorite)}
            style={[styles.favoriteButton, saveAsFavorite && styles.favoriteButtonActive]}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={saveAsFavorite ? "star" : "star-outline"} 
              size={18} 
              color={saveAsFavorite ? "#FE5858" : "#FE5858"} 
            />
            <Text style={[styles.favoriteButtonText, saveAsFavorite && styles.favoriteButtonTextActive]}>
              {saveAsFavorite ? 'Will save as favorite' : 'Save as Favorite'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          Tap circles to adjust portions • Totals update live
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDFBFE',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retakeText: {
    color: '#FE5858',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cancelButton: {
    padding: 4,
  },
  foodsList: {
    gap: 12,
  },
  foodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDFBFE',
  },
  foodCardWarning: {
    borderColor: '#F59E0B',
  },
  foodCardLowConfidence: {
    borderColor: '#EF4444',
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  foodNameContainer: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 2,
  },
  foodDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  aiEstimate: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tapToChange: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
  caloriesContainer: {
    alignItems: 'flex-end',
  },
  caloriesValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FE5858',
  },
  caloriesLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderTrack: {
    position: 'relative',
    height: 44,
    backgroundColor: '#C4E2EA',
    borderRadius: 22,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  sliderTrackBackground: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: '#C4E2EA',
    borderRadius: 2,
  },
  sliderTrackActive: {
    position: 'absolute',
    left: 20,
    height: 4,
    backgroundColor: '#FE5858',
    borderRadius: 2,
  },
  sliderOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 2,
  },
  sliderOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C4E2EA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDFBFE',
  },
  sliderOptionSelected: {
    width: 44,
    height: 44,
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
    shadowColor: '#FE5858',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sliderOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  sliderOptionTextSelected: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  unitLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  unitToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  unitToggleText: {
    fontSize: 12,
    color: '#FE5858',
    fontWeight: '500',
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDFBFE',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#282B34',
  },
  macroLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  confidenceWarning: {
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceWarningLow: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  confidenceWarningText: {
    fontSize: 12,
    color: '#F59E0B',
    flex: 1,
  },
  confidenceWarningTextLow: {
    color: '#EF4444',
  },
  removeButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  removeButtonText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  totalsCard: {
    marginTop: 12,
    backgroundColor: 'rgba(254, 88, 88, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 88, 88, 0.3)',
  },
  totalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalsLabel: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  totalsCalories: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalsCaloriesValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FE5858',
  },
  totalsCaloriesLabel: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  totalsMacros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalsMacroItem: {
    alignItems: 'center',
    flex: 1,
  },
  totalsMacroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
  },
  totalsMacroLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  actionsContainer: {
    marginTop: 20,
    gap: 10,
  },
  confirmButton: {
    paddingVertical: 16,
    backgroundColor: '#FE5858',
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  favoriteButton: {
    paddingVertical: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FE5858',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(254, 88, 88, 0.1)',
  },
  favoriteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FE5858',
  },
  favoriteButtonTextActive: {
    color: '#FE5858',
  },
  helperText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    color: '#6B7280',
  },
})



