import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { createClient } from '@/lib/supabase/client'
import { createMealTemplate, MealTemplateItem } from '@/lib/api/mealTemplates'
import {
  getCommonFoodsByMealType,
  getCategoryNames,
  CommonFood,
} from '@/lib/nutrition/commonFoods'
import FoodSelectionModal from './FoodSelectionModal'

interface MealSetupWizardProps {
  userId: number
  onComplete: () => void
  onSkip: () => void
}

type SetupStep = 'intro' | 'breakfast' | 'lunch' | 'dinner' | 'other' | 'complete'

interface TempFoodItem extends Omit<MealTemplateItem, 'id' | 'meal_template_id'> {
  tempId: string
}

export default function MealSetupWizard({ userId, onComplete, onSkip }: MealSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('intro')
  const [currentItems, setCurrentItems] = useState<TempFoodItem[]>([])
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [completedMeals, setCompletedMeals] = useState<string[]>([])
  const [searchModalVisible, setSearchModalVisible] = useState(false)
  const [selectedFoodForModal, setSelectedFoodForModal] = useState<{
    foodId: string
    foodName: string
  } | null>(null)

  const getMealTypeLabel = (step: SetupStep): string => {
    const labels: Record<string, string> = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      other: 'Snacks/Other',
    }
    return labels[step] || ''
  }

  const getDefaultTemplateName = (step: SetupStep): string => {
    const names: Record<string, string> = {
      breakfast: 'My Regular Breakfast',
      lunch: 'My Regular Lunch',
      dinner: 'My Regular Dinner',
      other: 'My Snack',
    }
    return names[step] || 'My Meal'
  }

  const handleAddCommonFood = async (food: CommonFood) => {
    // Search for the food in FatSecret API
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert('Error', 'Please sign in')
        return
      }

      const { data, error } = await supabase.functions.invoke('nutrition-search', {
        body: { query: food.searchTerm, pageNumber: 0, maxResults: 5 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error || !data?.success || !data?.data?.foods || data.data.foods.length === 0) {
        Alert.alert('Not Found', `Could not find "${food.label}". Try searching manually.`)
        return
      }

      // Get the first result and open modal
      const foundFood = data.data.foods[0]
      setSelectedFoodForModal({
        foodId: foundFood.food_id,
        foodName: foundFood.food_name,
      })
    } catch (error) {
      console.error('Error adding common food:', error)
      Alert.alert('Error', 'Failed to add food')
    }
  }

  const handleFoodSelected = (foodData: any) => {
    // Add food to current items
    const tempId = Date.now().toString() + Math.random().toString()
    const newItem: TempFoodItem = {
      tempId,
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
      sort_order: currentItems.length,
    }
    setCurrentItems([...currentItems, newItem])
    setSelectedFoodForModal(null)
  }

  const handleSaveMeal = async () => {
    if (currentItems.length === 0) {
      Alert.alert('No items', 'Please add at least one food item')
      return
    }

    if (!templateName.trim()) {
      Alert.alert('Missing name', 'Please enter a name for this meal')
      return
    }

    setSaving(true)
    try {
      const items = currentItems.map((item, index) => ({
        food_id: item.food_id,
        food_name: item.food_name,
        serving_id: item.serving_id,
        serving_description: item.serving_description,
        number_of_units: item.number_of_units,
        calories: item.calories,
        protein: item.protein,
        carbohydrate: item.carbohydrate,
        fat: item.fat,
        fiber: item.fiber,
        sugar: item.sugar,
        sodium: item.sodium,
        sort_order: index,
      }))

      const result = await createMealTemplate(
        userId,
        templateName,
        currentStep as string,
        items
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to save meal')
      }

      // Mark this meal as completed
      setCompletedMeals([...completedMeals, currentStep])

      // Clear current items and move to next step
      setCurrentItems([])
      setTemplateName('')
      
      // Move to next meal or complete
      const nextStep = getNextStep(currentStep)
      if (nextStep === 'complete') {
        setCurrentStep('complete')
      } else {
        setCurrentStep(nextStep)
        setTemplateName(getDefaultTemplateName(nextStep))
      }
    } catch (error: any) {
      console.error('Error saving meal:', error)
      Alert.alert('Error', error.message || 'Failed to save meal')
    } finally {
      setSaving(false)
    }
  }

  const handleSkipMeal = () => {
    setCurrentItems([])
    setTemplateName('')
    
    const nextStep = getNextStep(currentStep)
    if (nextStep === 'complete') {
      setCurrentStep('complete')
    } else {
      setCurrentStep(nextStep)
      setTemplateName(getDefaultTemplateName(nextStep))
    }
  }

  const getNextStep = (current: SetupStep): SetupStep => {
    const steps: SetupStep[] = ['breakfast', 'lunch', 'dinner', 'other']
    const currentIndex = steps.indexOf(current)
    if (currentIndex === -1 || currentIndex === steps.length - 1) {
      return 'complete'
    }
    return steps[currentIndex + 1]
  }

  const calculateTotals = () => {
    return currentItems.reduce(
      (acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbohydrate: acc.carbohydrate + (item.carbohydrate || 0),
        fat: acc.fat + (item.fat || 0),
      }),
      { calories: 0, protein: 0, carbohydrate: 0, fat: 0 }
    )
  }

  // Intro Screen
  if (currentStep === 'intro') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>🍽️ Your Favorite Meals</Text>
          <Text style={styles.description}>
            You can skip this and add meals later from your Profile.
          </Text>

          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Why set up meals?</Text>
            <Text style={styles.benefitItem}>✓ Log your day in seconds</Text>
            <Text style={styles.benefitItem}>✓ Track nutrition consistently</Text>
            <Text style={styles.benefitItem}>✓ Hit your training targets</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setCurrentStep('breakfast')
              setTemplateName(getDefaultTemplateName('breakfast'))
            }}
          >
            <Text style={styles.primaryButtonText}>Add Favorites</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onSkip}>
            <Text style={styles.secondaryButtonText}>Skip for Now</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // Complete Screen
  if (currentStep === 'complete') {
    const mealCount = completedMeals.length
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.title}>Great Work!</Text>
          <Text style={styles.subtitle}>
            You've set up {mealCount} meal{mealCount !== 1 ? 's' : ''}.
          </Text>
          <Text style={styles.description}>
            You can log these in one tap from the Nutrition tab.
          </Text>

          {mealCount < 3 && (
            <Text style={styles.tipText}>
              💡 Tip: Most people set up 3-5 meals for best results. You can add more from your Profile later.
            </Text>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={onComplete}>
            <Text style={styles.primaryButtonText}>Finish Setup</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // Meal Setup Screen (breakfast, lunch, dinner, other)
  const commonFoodGroups = getCommonFoodsByMealType(currentStep)
  const categoryNames = getCategoryNames(currentStep)
  const totals = calculateTotals()

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.mealTypeTitle}>
          {currentStep === 'breakfast' ? '☀️' : currentStep === 'lunch' ? '🌮' : currentStep === 'dinner' ? '🍽️' : '🥤'}{' '}
          {getMealTypeLabel(currentStep)}
        </Text>
        <Text style={styles.subtitle}>What do you usually eat?</Text>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {completedMeals.length} of 4 meals set up
          </Text>
        </View>

        {/* Added Items */}
        {currentItems.length > 0 && (
          <View style={styles.addedItemsContainer}>
            <Text style={styles.sectionTitle}>Added ({currentItems.length} items)</Text>
            {currentItems.map((item) => (
              <View key={item.tempId} style={styles.addedItem}>
                <View style={styles.addedItemInfo}>
                  <Text style={styles.addedItemName}>
                    {item.number_of_units}× {item.food_name}
                  </Text>
                  <Text style={styles.addedItemDetails}>
                    {Math.round(item.calories)} cal • {Math.round(item.protein)}g protein
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setCurrentItems(currentItems.filter((i) => i.tempId !== item.tempId))
                  }}
                >
                  <Text style={styles.removeButton}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            <View style={styles.totalsContainer}>
              <Text style={styles.totalsTitle}>Total:</Text>
              <Text style={styles.totalsValue}>
                {Math.round(totals.calories)} cal • {Math.round(totals.protein)}g protein
              </Text>
            </View>
          </View>
        )}

        {/* Common Foods */}
        {commonFoodGroups.map((group, groupIndex) => (
          <View key={groupIndex} style={styles.foodGroupContainer}>
            <Text style={styles.categoryTitle}>{categoryNames[groupIndex]}</Text>
            {group.map((food, foodIndex) => (
              <TouchableOpacity
                key={foodIndex}
                style={styles.foodItem}
                onPress={() => handleAddCommonFood(food)}
              >
                <Text style={styles.foodEmoji}>{food.emoji}</Text>
                <Text style={styles.foodLabel}>{food.label}</Text>
                <Text style={styles.addButton}>+ Add</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Search/Photo/Barcode Options */}
        <View style={styles.alternativesContainer}>
          <Text style={styles.alternativesTitle}>Don't see what you eat?</Text>
          <View style={styles.alternativeButtons}>
            <TouchableOpacity style={styles.alternativeButton} onPress={() => setSearchModalVisible(true)}>
              <Text style={styles.alternativeButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.alternativeButton} onPress={() => setSearchModalVisible(true)}>
              <Text style={styles.alternativeButtonText}>🔍 Scan Barcode</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={() => setSearchModalVisible(true)}>
            <Text style={styles.searchButtonText}>🔍 Search Foods</Text>
          </TouchableOpacity>
        </View>

        {/* Save Template */}
        {currentItems.length > 0 && (
          <View style={styles.saveContainer}>
            <Text style={styles.saveLabel}>Save this meal as:</Text>
            <TextInput
              style={styles.templateNameInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="My Regular Breakfast"
            />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={handleSaveMeal}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save & Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkipMeal}>
          <Text style={styles.skipButtonText}>
            Skip {getMealTypeLabel(currentStep)} →
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Food Selection Modal */}
      <FoodSelectionModal
        visible={selectedFoodForModal !== null}
        foodId={selectedFoodForModal?.foodId || null}
        foodName={selectedFoodForModal?.foodName || null}
        onClose={() => setSelectedFoodForModal(null)}
        onAdd={handleFoodSelected}
        preselectedMealType={currentStep}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  benefitsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  benefitItem: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#FE5858',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  successEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  tipText: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  mealTypeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  progressContainer: {
    backgroundColor: '#E0F2FE',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#0369A1',
    textAlign: 'center',
    fontWeight: '600',
  },
  addedItemsContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 12,
  },
  addedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  addedItemInfo: {
    flex: 1,
  },
  addedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  addedItemDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  removeButton: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  totalsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#10B981',
  },
  totalsTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  totalsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  foodGroupContainer: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  foodEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  foodLabel: {
    flex: 1,
    fontSize: 16,
    color: '#282B34',
  },
  addButton: {
    fontSize: 14,
    color: '#FE5858',
    fontWeight: '600',
  },
  alternativesContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  alternativesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    textAlign: 'center',
    marginBottom: 12,
  },
  alternativeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  alternativeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  alternativeButtonText: {
    fontSize: 14,
    color: '#282B34',
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchButtonText: {
    fontSize: 16,
    color: '#282B34',
    fontWeight: '600',
  },
  saveContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  saveLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  templateNameInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#282B34',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '600',
  },
})

