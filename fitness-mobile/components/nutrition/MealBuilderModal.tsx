import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import FoodSearchModal from './FoodSearchModal'
import PortionAdjustInput from './PortionAdjustInput'

interface MealItem {
  id: string // Temporary ID for UI
  food_id: string
  food_name: string
  amount: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  serving_id?: string
  serving_description?: string
}

interface MealBuilderModalProps {
  visible: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function MealBuilderModal({
  visible,
  onClose,
  onSaved,
}: MealBuilderModalProps) {
  const [mealName, setMealName] = useState('')
  const [mealItems, setMealItems] = useState<MealItem[]>([])
  const [showFoodSearch, setShowFoodSearch] = useState(false)
  const [selectedFood, setSelectedFood] = useState<any>(null)
  const [showPortionInput, setShowPortionInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSavedFoodsModal, setShowSavedFoodsModal] = useState(false)
  const [savedFoodsMode, setSavedFoodsMode] = useState<'ingredients' | 'restaurants' | 'brands' | null>(null)
  
  const supabase = createClient()

  const resetModal = () => {
    setMealName('')
    setMealItems([])
    setShowFoodSearch(false)
    setSelectedFood(null)
    setShowPortionInput(false)
  }

  const handleClose = () => {
    if (mealItems.length > 0 && !saving) {
      Alert.alert(
        'Discard Meal?',
        'You have unsaved items in this meal.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              resetModal()
              onClose()
            }
          }
        ]
      )
    } else {
      resetModal()
      onClose()
    }
  }

  const handleFoodSelect = async (foodItem: any) => {
    try {
      // Fetch full food details
      const { data, error } = await supabase.functions.invoke('nutrition-food', {
        body: {
          foodId: foodItem.food_id,
          normalize: true,
        },
      })

      if (error) throw error
      
      const foodData = data?.data?.food
      if (!foodData) {
        throw new Error('Failed to load food details')
      }

      // Prepare food object with normalization
      const servings = foodData.servings?.serving || []
      const firstServing = Array.isArray(servings) ? servings[0] : servings

      const GRAMS_PER_OZ = 28.35
      let normalizedData: any = null
      
      if (firstServing) {
        let grams: number | null = null
        
        if (firstServing.metric_serving_amount && firstServing.metric_serving_unit === 'g') {
          grams = parseFloat(firstServing.metric_serving_amount)
        } else if (firstServing.serving_description) {
          const desc = firstServing.serving_description.toLowerCase()
          const ozMatch = desc.match(/([\d.]+)\s*oz/)
          const gMatch = desc.match(/([\d.]+)\s*g/)
          
          if (ozMatch) {
            grams = parseFloat(ozMatch[1]) * GRAMS_PER_OZ
          } else if (gMatch) {
            grams = parseFloat(gMatch[1])
          }
        }
        
        if (grams && grams > 0) {
          normalizedData = {
            caloriesPerGram: parseFloat(firstServing.calories || '0') / grams,
            proteinPerGram: parseFloat(firstServing.protein || '0') / grams,
            carbsPerGram: parseFloat(firstServing.carbohydrate || '0') / grams,
            fatPerGram: parseFloat(firstServing.fat || '0') / grams,
            fiberPerGram: parseFloat(firstServing.fiber || '0') / grams,
            sodiumPerGram: parseFloat(firstServing.sodium || '0') / grams,
          }
        }
      }

      const preparedFood = {
        food_id: foodData.food_id,
        food_name: foodData.food_name,
        name: foodData.food_name,
        brand_name: foodData.brand_name || null,
        servings: servings,
        selectedServing: firstServing,
        normalized_nutrition: normalizedData ? {
          calories_per_gram: normalizedData.caloriesPerGram,
          protein_per_gram: normalizedData.proteinPerGram,
          carbs_per_gram: normalizedData.carbsPerGram,
          fat_per_gram: normalizedData.fatPerGram,
          fiber_per_gram: normalizedData.fiberPerGram,
          sodium_per_gram: normalizedData.sodiumPerGram,
        } : undefined,
        raw_serving: normalizedData ? undefined : {
          serving_id: firstServing?.serving_id || '0',
          serving_description: firstServing?.serving_description || '',
          calories: parseFloat(firstServing?.calories || '0'),
          protein: parseFloat(firstServing?.protein || '0'),
          carbohydrate: parseFloat(firstServing?.carbohydrate || '0'),
          fat: parseFloat(firstServing?.fat || '0'),
        },
      }

      setSelectedFood(preparedFood)
      setShowFoodSearch(false)
      setShowPortionInput(true)
    } catch (error: any) {
      console.error('Error loading food details:', error)
      Alert.alert('Error', error.message || 'Failed to load food details')
    }
  }

  const handleAddFoodToMeal = (amount: number, unit: string) => {
    if (!selectedFood) return

    // Calculate macros
    const GRAMS_PER_OZ = 28.35
    let macros = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
    }

    if (selectedFood.normalized_nutrition) {
      const grams = unit === 'oz' ? amount * GRAMS_PER_OZ : amount
      const n = selectedFood.normalized_nutrition
      
      macros = {
        calories: Math.round(n.calories_per_gram * grams),
        protein: Math.round(n.protein_per_gram * grams * 10) / 10,
        carbs: Math.round(n.carbs_per_gram * grams * 10) / 10,
        fat: Math.round(n.fat_per_gram * grams * 10) / 10,
        fiber: n.fiber_per_gram ? Math.round(n.fiber_per_gram * grams * 10) / 10 : 0,
        sodium: n.sodium_per_gram ? Math.round(n.sodium_per_gram * grams) : 0,
      }
    } else if (selectedFood.raw_serving) {
      macros = {
        calories: Math.round(selectedFood.raw_serving.calories * amount),
        protein: Math.round(selectedFood.raw_serving.protein * amount * 10) / 10,
        carbs: Math.round(selectedFood.raw_serving.carbohydrate * amount * 10) / 10,
        fat: Math.round(selectedFood.raw_serving.fat * amount * 10) / 10,
        fiber: 0,
        sodium: 0,
      }
    }

    const newItem: MealItem = {
      id: Date.now().toString() + Math.random(),
      food_id: selectedFood.food_id,
      food_name: selectedFood.food_name,
      amount,
      unit,
      ...macros,
      serving_id: selectedFood.selectedServing?.serving_id,
      serving_description: selectedFood.selectedServing?.serving_description,
    }

    setMealItems([...mealItems, newItem])
    setSelectedFood(null)
    setShowPortionInput(false)
  }

  const handleAddSavedFood = (savedFood: any) => {
    // Add saved food with its default portion directly to meal
    const amount = savedFood.default_amount || 1
    const unit = savedFood.default_unit || 'serving'
    const GRAMS_PER_OZ = 28.35

    let macros = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
    }

    // Calculate from per-gram nutrition if available
    if (savedFood.calories_per_gram) {
      const grams = unit === 'oz' ? amount * GRAMS_PER_OZ : amount
      
      macros = {
        calories: Math.round(savedFood.calories_per_gram * grams),
        protein: Math.round(savedFood.protein_per_gram * grams * 10) / 10,
        carbs: Math.round(savedFood.carbs_per_gram * grams * 10) / 10,
        fat: Math.round(savedFood.fat_per_gram * grams * 10) / 10,
        fiber: savedFood.fiber_per_gram ? Math.round(savedFood.fiber_per_gram * grams * 10) / 10 : 0,
        sodium: savedFood.sodium_per_gram ? Math.round(savedFood.sodium_per_gram * grams) : 0,
      }
    } else if (savedFood.raw_serving_calories) {
      macros = {
        calories: Math.round(savedFood.raw_serving_calories * amount),
        protein: Math.round(savedFood.raw_serving_protein * amount * 10) / 10,
        carbs: Math.round(savedFood.raw_serving_carbs * amount * 10) / 10,
        fat: Math.round(savedFood.raw_serving_fat * amount * 10) / 10,
        fiber: 0,
        sodium: 0,
      }
    }

    const newItem: MealItem = {
      id: Date.now().toString() + Math.random(),
      food_id: savedFood.food_id,
      food_name: savedFood.food_name,
      amount,
      unit,
      ...macros,
      serving_id: savedFood.serving_id,
      serving_description: savedFood.serving_description || `${amount} ${unit}`,
    }

    setMealItems([...mealItems, newItem])
    setShowSavedFoodsModal(false)
  }

  const removeItem = (itemId: string) => {
    setMealItems(mealItems.filter(item => item.id !== itemId))
  }

  const calculateTotals = () => {
    return mealItems.reduce(
      (totals, item) => ({
        calories: totals.calories + item.calories,
        protein: totals.protein + item.protein,
        carbs: totals.carbs + item.carbs,
        fat: totals.fat + item.fat,
        fiber: totals.fiber + item.fiber,
        sodium: totals.sodium + item.sodium,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
    )
  }

  const saveMeal = async () => {
    if (!mealName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for this meal')
      return
    }

    if (mealItems.length === 0) {
      Alert.alert('No Items', 'Please add at least one food item to this meal')
      return
    }

    try {
      setSaving(true)
      
      const totals = calculateTotals()
      
      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: {
          action: 'add_meal_template',
          template_name: mealName.trim(),
          items: mealItems.map(item => ({
            food_id: item.food_id,
            food_name: item.food_name,
            serving_id: item.serving_id || '0',
            serving_description: item.serving_description || `${item.amount} ${item.unit}`,
            number_of_units: item.amount,
            calories: item.calories,
            protein: item.protein,
            carbohydrate: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            sodium: item.sodium,
          })),
          totals: {
            calories: totals.calories,
            protein: totals.protein,
            carbohydrate: totals.carbs,
            fat: totals.fat,
            fiber: totals.fiber,
            sodium: totals.sodium,
          },
        },
      })

      if (error) throw error

      Alert.alert('Success', 'Meal template saved!')
      resetModal()
      if (onSaved) onSaved()
      onClose()
    } catch (error: any) {
      console.error('Error saving meal template:', error)
      Alert.alert('Error', error.message || 'Failed to save meal template')
    } finally {
      setSaving(false)
    }
  }

  const totals = calculateTotals()

  // Show portion input screen
  if (showPortionInput && selectedFood) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => {
                setShowPortionInput(false)
                setSelectedFood(null)
              }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#282B34" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Set Portion</Text>
          </View>
          
          <ScrollView>
            <Card style={{ margin: 16 }}>
              <PortionAdjustInput
                food={selectedFood}
                defaultAmount={1}
                defaultUnit="oz"
                showSaveButton={true}
                onSave={handleAddFoodToMeal}
                onCancel={() => {
                  setShowPortionInput(false)
                  setSelectedFood(null)
                }}
              />
            </Card>
          </ScrollView>
        </View>
      </Modal>
    )
  }

  // Show food search
  if (showFoodSearch) {
    return (
      <FoodSearchModal
        visible={visible}
        onClose={() => setShowFoodSearch(false)}
        filterType="all"
        onFoodSelected={handleFoodSelect}
      />
    )
  }

  // Main meal builder screen
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#282B34" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Meal Template</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Meal Name Input */}
          <Card style={styles.section}>
            <Text style={styles.label}>Meal Name</Text>
            <TextInput
              style={styles.input}
              value={mealName}
              onChangeText={setMealName}
              placeholder="e.g., Post-Workout Meal, Chipotle Bowl"
              autoFocus
            />
          </Card>

          {/* Add Items Buttons */}
          <View style={styles.addButtonsContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowFoodSearch(true)}
            >
              <Ionicons name="search" size={20} color="#3B82F6" />
              <Text style={styles.addButtonText}>Search Foods</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.addButton, styles.addButtonSecondary]}
              onPress={() => {
                setSavedFoodsMode('ingredients')
                setShowSavedFoodsModal(true)
              }}
            >
              <Ionicons name="nutrition" size={20} color="#10B981" />
              <Text style={[styles.addButtonText, styles.addButtonTextSecondary]}>Add from Ingredients</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.addButton, styles.addButtonSecondary]}
              onPress={() => {
                setSavedFoodsMode('restaurants')
                setShowSavedFoodsModal(true)
              }}
            >
              <Ionicons name="restaurant" size={20} color="#F59E0B" />
              <Text style={[styles.addButtonText, styles.addButtonTextSecondary]}>Add from Restaurants</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.addButton, styles.addButtonSecondary]}
              onPress={() => {
                setSavedFoodsMode('brands')
                setShowSavedFoodsModal(true)
              }}
            >
              <Ionicons name="pricetag" size={20} color="#8B5CF6" />
              <Text style={[styles.addButtonText, styles.addButtonTextSecondary]}>Add from Brands</Text>
            </TouchableOpacity>
          </View>

          {/* Items in Meal */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Items in This Meal ({mealItems.length})</Text>
            
            {mealItems.length === 0 ? (
              <Text style={styles.emptyText}>
                No items yet. Search and add foods to build your meal.
              </Text>
            ) : (
              <View style={styles.itemsList}>
                {mealItems.map((item) => (
                  <View key={item.id} style={styles.mealItem}>
                    <View style={styles.mealItemInfo}>
                      <Text style={styles.mealItemName}>{item.food_name}</Text>
                      <Text style={styles.mealItemDetails}>
                        {item.amount} {item.unit} • {item.calories} cal
                      </Text>
                      <Text style={styles.mealItemMacros}>
                        {item.protein}g P • {item.carbs}g C • {item.fat}g F
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeItem(item.id)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Totals */}
          {mealItems.length > 0 && (
            <Card style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Total Nutrition</Text>
              <Text style={styles.totalsCalories}>{totals.calories} calories</Text>
              <Text style={styles.totalsMacros}>
                {Math.round(totals.protein * 10) / 10}g Protein • {' '}
                {Math.round(totals.carbs * 10) / 10}g Carbs • {' '}
                {Math.round(totals.fat * 10) / 10}g Fat
              </Text>
            </Card>
          )}
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, (saving || !mealName.trim() || mealItems.length === 0) && styles.saveButtonDisabled]}
            onPress={saveMeal}
            disabled={saving || !mealName.trim() || mealItems.length === 0}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Meal Template</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Saved Foods Picker Modal */}
      <SavedFoodsPicker
        visible={showSavedFoodsModal}
        mode={savedFoodsMode}
        onClose={() => {
          setShowSavedFoodsModal(false)
          setSavedFoodsMode(null)
        }}
        onFoodSelected={handleAddSavedFood}
      />
    </Modal>
  )
}

// Saved Foods Picker Component
interface SavedFoodsPickerProps {
  visible: boolean
  mode: 'ingredients' | 'restaurants' | 'brands' | null
  onClose: () => void
  onFoodSelected: (food: any) => void
}

function SavedFoodsPicker({ visible, mode, onClose, onFoodSelected }: SavedFoodsPickerProps) {
  const [foods, setFoods] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (visible && mode) {
      loadFoods()
    }
  }, [visible, mode])

  const loadFoods = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: { action: 'get_all' },
      })

      if (error) throw error

      if (data?.favorites) {
        if (mode === 'ingredients') {
          setFoods(data.favorites.foods.filter((f: any) => !f.restaurant_id && !f.brand_id))
        } else if (mode === 'restaurants') {
          // Get all foods from saved restaurants
          const restaurantFoods: any[] = []
          for (const restaurant of data.favorites.restaurants) {
            const { data: foods, error } = await supabase
              .from('food_favorites')
              .select('*')
              .eq('restaurant_id', restaurant.id)
            
            if (!error && foods) {
              restaurantFoods.push(...foods.map((f: any) => ({
                ...f,
                restaurant_name: restaurant.restaurant_name,
              })))
            }
          }
          setFoods(restaurantFoods)
        } else if (mode === 'brands') {
          // Get all foods from saved brands
          const brandFoods: any[] = []
          for (const brand of data.favorites.brands) {
            const { data: foods, error } = await supabase
              .from('food_favorites')
              .select('*')
              .eq('brand_id', brand.id)
            
            if (!error && foods) {
              brandFoods.push(...foods.map((f: any) => ({
                ...f,
                brand_name: brand.brand_name,
              })))
            }
          }
          setFoods(brandFoods)
        }
      }
    } catch (error) {
      console.error('Error loading saved foods:', error)
      Alert.alert('Error', 'Failed to load saved foods')
    } finally {
      setLoading(false)
    }
  }

  const getModeTitle = () => {
    if (mode === 'ingredients') return '🥬 Your Ingredients'
    if (mode === 'restaurants') return '🏪 Restaurant Items'
    if (mode === 'brands') return '🏷️ Brand Items'
    return 'Select Food'
  }

  const getModeIcon = () => {
    if (mode === 'ingredients') return 'nutrition'
    if (mode === 'restaurants') return 'restaurant'
    if (mode === 'brands') return 'pricetag'
    return 'list'
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#282B34" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getModeTitle()}</Text>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#FE5858" />
            </View>
          ) : foods.length === 0 ? (
            <Card style={{ margin: 16, padding: 24 }}>
              <Text style={styles.emptyText}>
                {mode === 'ingredients' && 'No ingredients saved yet'}
                {mode === 'restaurants' && 'No restaurant items saved yet'}
                {mode === 'brands' && 'No brand items saved yet'}
              </Text>
            </Card>
          ) : (
            <View style={{ padding: 16 }}>
              {foods.map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={styles.savedFoodPickerItem}
                  onPress={() => onFoodSelected(food)}
                >
                  <View style={styles.savedFoodInfo}>
                    <Text style={styles.savedFoodName}>{food.food_name}</Text>
                    <Text style={styles.savedFoodDetails}>
                      {food.default_amount} {food.default_unit}
                      {(food.restaurant_name || food.brand_name) && (
                        <Text style={{ color: '#9CA3AF' }}>
                          {' • '}{food.restaurant_name || food.brand_name}
                        </Text>
                      )}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={28} color="#FE5858" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  addButtonsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  addButtonSecondary: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    marginTop: 8,
  },
  addButtonTextSecondary: {
    color: '#374151',
  },
  savedFoodPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  savedFoodInfo: {
    flex: 1,
  },
  savedFoodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  savedFoodDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  itemsList: {
    gap: 12,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
  },
  mealItemInfo: {
    flex: 1,
  },
  mealItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  mealItemDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  mealItemMacros: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  removeButton: {
    marginLeft: 12,
  },
  totalsCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  totalsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  totalsCalories: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 4,
  },
  totalsMacros: {
    fontSize: 14,
    color: '#6B7280',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})




