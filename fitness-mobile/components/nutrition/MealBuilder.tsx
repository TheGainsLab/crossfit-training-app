import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createMealTemplate, updateMealTemplate, MealTemplate, MealTemplateItem } from '@/lib/api/mealTemplates'
import FoodSearchView from './FoodSearchView'
import FoodSelectionView from './FoodSelectionView'

interface MealBuilderProps {
  userId: number
  initialTemplate?: MealTemplate | null
  selectedMealType: string | null
  onSave: (template: MealTemplate) => void
  onCancel: () => void
  onAddFood: () => void
}

// Internal view states for swap-out pattern (no nested modals)
type BuilderView = 'main' | 'search' | 'details'

export default function MealBuilder({
  userId,
  initialTemplate,
  selectedMealType,
  onSave,
  onCancel,
  onAddFood
}: MealBuilderProps) {
  const [template, setTemplate] = useState<MealTemplate>(
    initialTemplate || {
      template_name: '',
      meal_type: null,
      items: [],
      total_calories: 0,
      total_protein: 0,
      total_carbohydrate: 0,
      total_fat: 0,
    }
  )
  const [saving, setSaving] = useState(false)

  // View switching state (replaces modal state for swap-out pattern)
  const [currentView, setCurrentView] = useState<BuilderView>('main')
  const [selectedFoodForDetails, setSelectedFoodForDetails] = useState<{ foodId: string | null; foodName: string | null }>({
    foodId: null,
    foodName: null,
  })

  // Update template when initialTemplate changes (for editing)
  useEffect(() => {
    if (initialTemplate) {
      setTemplate(initialTemplate)
    }
  }, [initialTemplate])

  const calculateTotals = (items: MealTemplateItem[]) => {
    return items.reduce(
      (totals, item) => ({
        // Values are already totals from FoodSelectionModal, so add directly
        calories: totals.calories + item.calories,
        protein: totals.protein + item.protein,
        carbohydrate: totals.carbohydrate + item.carbohydrate,
        fat: totals.fat + item.fat,
      }),
      { calories: 0, protein: 0, carbohydrate: 0, fat: 0 }
    )
  }

  const handleSave = async () => {
    if (!template.template_name.trim()) {
      Alert.alert('Error', 'Please enter a favorite name')
      return
    }

    if (template.items.length === 0) {
      Alert.alert('Error', 'Please add at least one food item')
      return
    }

    try {
      setSaving(true)

      // Calculate totals
      const totals = calculateTotals(template.items)
      const templateToSave = {
        ...template,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbohydrate: totals.carbohydrate,
        total_fat: totals.fat,
      }

      if (template.id) {
        // Update existing template
        const { success, error } = await updateMealTemplate(template.id, templateToSave)
        if (success) {
          onSave(templateToSave)
        } else {
          Alert.alert('Error', error || 'Failed to update favorite')
        }
      } else {
        // Create new template
        const result = await createMealTemplate(
          userId,
          templateToSave.template_name,
          null, // Favorites don't need a meal type
          templateToSave.items.map(item => ({
            food_id: item.food_id,
            food_name: item.food_name,
            serving_id: item.serving_id,
            serving_description: item.serving_description,
            number_of_units: item.number_of_units,
            calories: item.calories,
            protein: item.protein,
            carbohydrate: item.carbohydrate,
            fat: item.fat,
            fiber: item.fiber || 0,
            sugar: item.sugar || 0,
            sodium: item.sodium || 0,
            sort_order: 0, // Will be set by database
          }))
        )

        if (result.success) {
          onSave(templateToSave)
        } else {
          Alert.alert('Error', result.error || 'Failed to create favorite')
        }
      }
    } catch (error) {
      console.error('Error saving favorite:', error)
      Alert.alert('Error', 'Failed to save favorite')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFood = (index: number) => {
    const newItems = [...template.items]
    newItems.splice(index, 1)
    setTemplate({ ...template, items: newItems })
  }

  const handleFoodSelectedFromSearch = (food: { food_id: string; food_name: string }) => {
    // Switch to details view (no modal stacking)
    setSelectedFoodForDetails({ foodId: food.food_id, foodName: food.food_name })
    setCurrentView('details')
  }

  const handleFoodAdded = (foodData: {
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
  }) => {
    // Add food to template items
    const newItem: MealTemplateItem = {
      food_id: foodData.food_id,
      food_name: foodData.food_name,
      serving_id: foodData.serving_id,
      serving_description: foodData.serving_description,
      number_of_units: foodData.number_of_units,
      calories: foodData.calories,
      protein: foodData.protein,
      carbohydrate: foodData.carbohydrate,
      fat: foodData.fat,
      fiber: foodData.fiber || 0,
      sugar: foodData.sugar || 0,
      sodium: foodData.sodium || 0,
      sort_order: template.items.length,
    }

    setTemplate({
      ...template,
      items: [...template.items, newItem],
    })

    // Return to main view and reset state (no modal to close)
    setCurrentView('main')
    setSelectedFoodForDetails({ foodId: null, foodName: null })
  }

  const totals = calculateTotals(template.items)

  // Render search view (swap-out pattern - no modal)
  if (currentView === 'search') {
    return (
      <View style={styles.fullScreenContainer}>
        <FoodSearchView
          onClose={() => setCurrentView('main')}
          onFoodSelected={handleFoodSelectedFromSearch}
          filterType="all"
        />
      </View>
    )
  }

  // Render details view (swap-out pattern - no modal)
  if (currentView === 'details' && selectedFoodForDetails.foodId && selectedFoodForDetails.foodName) {
    return (
      <View style={styles.fullScreenContainer}>
        <FoodSelectionView
          foodId={selectedFoodForDetails.foodId}
          foodName={selectedFoodForDetails.foodName}
          onBack={() => {
            setCurrentView('search')
            setSelectedFoodForDetails({ foodId: null, foodName: null })
          }}
          onAdd={handleFoodAdded}
        />
      </View>
    )
  }

  // Main builder view
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Template Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {template.id ? 'Edit Favorite' : 'Create New Favorite'}
        </Text>
      </View>

      {/* Meal Name Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Favorite Name</Text>
        <TextInput
          style={styles.nameInput}
          value={template.template_name}
          onChangeText={(name) => setTemplate({ ...template, template_name: name })}
          placeholder="e.g., Chicken Stir Fry, Protein Shake"
          maxLength={50}
        />
      </View>

      {/* Food Items */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Food Items ({template.items.length})</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setCurrentView('search')}
          >
            <Text style={styles.addButtonText}>+ Add Food</Text>
          </TouchableOpacity>
        </View>

        {template.items.length > 0 && (
          <View style={styles.foodList}>
            {template.items.map((item, index) => (
              <View key={`${item.food_id}-${index}`} style={styles.foodItem}>
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName}>
                    {item.number_of_units}× {item.food_name}
                  </Text>
                  <Text style={styles.foodNutrition}>
                    {Math.round(item.calories)} cal • {Math.round(item.protein)}g protein
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveFood(index)}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Nutrition Summary */}
      {template.items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Total Nutrition</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(totals.calories)}</Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(totals.protein)}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(totals.carbohydrate)}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(totals.fat)}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.cancelButton, saving && styles.disabledButton]}
          onPress={onCancel}
          disabled={saving}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving || !template.template_name.trim() || template.items.length === 0}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>
              {template.id ? 'Update Favorite' : 'Save Favorite'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  addButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  foodList: {
    gap: 8,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  foodNutrition: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  removeButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  removeText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FE5858',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
})
