import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import AddToFavoritesView from './AddToFavoritesView'
import MealBuilderView from './MealBuilderView'
import RestaurantMenuBrowser from './RestaurantMenuBrowser'
import BrandMenuBrowser from './BrandMenuBrowser'
import PortionAdjustInput from './PortionAdjustInput'

interface FrequentFoodsData {
  restaurants: any[]
  brands: any[]
  foods: any[]
  meals: any[]
}

interface FrequentFoodsScreenProps {
  onBack?: () => void
  mealType?: string | null
  onFoodLogged?: () => void
}

export default function FrequentFoodsScreen({ onBack, mealType, onFoodLogged }: FrequentFoodsScreenProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FrequentFoodsData>({
    restaurants: [],
    brands: [],
    foods: [],
    meals: [],
  })
  const [restaurantFoods, setRestaurantFoods] = useState<Record<number, any[]>>({})
  const [brandFoods, setBrandFoods] = useState<Record<number, any[]>>({})
  const [loadingRestaurantFoods, setLoadingRestaurantFoods] = useState<Record<number, boolean>>({})
  const [loadingBrandFoods, setLoadingBrandFoods] = useState<Record<number, boolean>>({})
  // View switching state (no more modals)
  const [showAddToFavorites, setShowAddToFavorites] = useState(false)
  const [addFavoritesMode, setAddFavoritesMode] = useState<'meal' | 'restaurant' | 'brand' | 'food' | undefined>(undefined)
  const [showMealBuilder, setShowMealBuilder] = useState(false)
  const [editingMeal, setEditingMeal] = useState<any>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null)
  const [selectedBrand, setSelectedBrand] = useState<any>(null)
  const [selectedFood, setSelectedFood] = useState<any>(null)
  const [expandedSections, setExpandedSections] = useState({
    meals: false,
    restaurants: false,
    brands: false,
    foods: false,
  })
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    visible: boolean
    type: string
    id: number
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loggedFoodToast, setLoggedFoodToast] = useState<{
    visible: boolean
    food: any
    amount: number
    unit: string
    macros: any
    entryId?: number
  } | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    try {
      setLoading(true)
      const { data: favData, error } = await supabase.functions.invoke('favorites-manage', {
        body: { action: 'get_all' },
      })

      if (error) throw error
      
      setData(favData?.data || {
        restaurants: [],
        brands: [],
        foods: [],
        meals: [],
      })
    } catch (error) {
      console.error('Error loading favorites:', error)
      Alert.alert('Error', 'Failed to load frequent foods')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const loadRestaurantFoods = async (restaurantId: number) => {
    if (restaurantFoods[restaurantId] || loadingRestaurantFoods[restaurantId]) {
      return // Already loaded or loading
    }

    try {
      setLoadingRestaurantFoods(prev => ({ ...prev, [restaurantId]: true }))
      
      const { data: foods, error } = await supabase
        .from('food_favorites')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('log_count', { ascending: false })

      if (error) throw error

      setRestaurantFoods(prev => ({ ...prev, [restaurantId]: foods || [] }))
    } catch (error) {
      console.error('Error loading restaurant foods:', error)
    } finally {
      setLoadingRestaurantFoods(prev => ({ ...prev, [restaurantId]: false }))
    }
  }

  const loadBrandFoods = async (brandId: number) => {
    if (brandFoods[brandId] || loadingBrandFoods[brandId]) {
      return // Already loaded or loading
    }

    try {
      setLoadingBrandFoods(prev => ({ ...prev, [brandId]: true }))
      
      const { data: foods, error } = await supabase
        .from('food_favorites')
        .select('*')
        .eq('brand_id', brandId)
        .order('log_count', { ascending: false })

      if (error) throw error

      setBrandFoods(prev => ({ ...prev, [brandId]: foods || [] }))
    } catch (error) {
      console.error('Error loading brand foods:', error)
    } finally {
      setLoadingBrandFoods(prev => ({ ...prev, [brandId]: false }))
    }
  }

  // Load foods when restaurant/brand section is expanded
  useEffect(() => {
    if (expandedSections.restaurants) {
      data.restaurants.forEach(restaurant => loadRestaurantFoods(restaurant.id))
    }
  }, [expandedSections.restaurants, data.restaurants])

  useEffect(() => {
    if (expandedSections.brands) {
      data.brands.forEach(brand => loadBrandFoods(brand.id))
    }
  }, [expandedSections.brands, data.brands])

  const handleLogFood = async (food: any, amount: number, unit: string, macros: any) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('food-log', {
        body: {
          food_id: food.fatsecret_id || food.food_id,
          food_name: food.name || food.food_name,
          favorite_food_id: food.id,
          serving_id: food.serving_id || '0',
          serving_description: food.serving_description || `${amount} ${unit}`,
          number_of_units: amount,
          calories: macros.calories,
          protein: macros.protein,
          carbohydrate: macros.carbs,
          fat: macros.fat,
          fiber: macros.fiber || 0,
          sodium: macros.sodium || 0,
          source: 'favorite',
          meal_type: mealType,
        },
      })

      if (error) throw error

      if (onFoodLogged) onFoodLogged()

      // Show toast with undo/edit options
      setLoggedFoodToast({
        visible: true,
        food,
        amount,
        unit,
        macros,
        entryId: result?.data?.id,
      })
      
      // Close food edit screen if open
      setSelectedFood(null)
      
      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setLoggedFoodToast(null)
      }, 5000)
    } catch (error) {
      console.error('Error logging food:', error)
      Alert.alert('Error', 'Failed to log food')
    }
  }

  const quickLogFood = async (food: any) => {
    try {
      // Calculate macros based on default amount
      const amount = food.default_amount || 1
      const unit = food.default_unit || 'serving'
      
      let macros = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sodium: 0,
      }

      // Calculate from per-gram nutrition if available
      if (food.calories_per_gram) {
        const GRAMS_PER_OZ = 28.35
        const grams = unit === 'oz' ? amount * GRAMS_PER_OZ : amount
        
        macros = {
          calories: Math.round(food.calories_per_gram * grams),
          protein: Math.round(food.protein_per_gram * grams * 10) / 10,
          carbs: Math.round(food.carbs_per_gram * grams * 10) / 10,
          fat: Math.round(food.fat_per_gram * grams * 10) / 10,
          fiber: food.fiber_per_gram ? Math.round(food.fiber_per_gram * grams * 10) / 10 : 0,
          sodium: food.sodium_per_gram ? Math.round(food.sodium_per_gram * grams) : 0,
        }
      } else if (food.raw_serving_calories) {
        // Use raw serving with multiplier
        macros = {
          calories: Math.round(food.raw_serving_calories * amount),
          protein: Math.round(food.raw_serving_protein * amount * 10) / 10,
          carbs: Math.round(food.raw_serving_carbs * amount * 10) / 10,
          fat: Math.round(food.raw_serving_fat * amount * 10) / 10,
          fiber: 0,
          sodium: 0,
        }
      }

      await handleLogFood(food, amount, unit, macros)
    } catch (error) {
      console.error('Error quick logging food:', error)
      Alert.alert('Error', 'Failed to log food')
    }
  }

  const quickLogMeal = async (meal: any) => {
    try {
      // Fetch meal items
      const { data: items, error } = await supabase
        .from('meal_template_items')
        .select('*')
        .eq('meal_template_id', meal.id)
        .order('sort_order')

      if (error) throw error

      if (!items || items.length === 0) {
        throw new Error('No items found in meal template')
      }

      // Log each item in the meal
      const logPromises = items.map(item =>
        supabase.functions.invoke('food-log', {
          body: {
            food_id: item.food_id,
            food_name: item.food_name,
            serving_id: item.serving_id || '0',
            serving_description: item.serving_description || '',
            number_of_units: item.number_of_units,
            calories: item.calories,
            protein: item.protein,
            carbohydrate: item.carbohydrate,
            fat: item.fat,
            fiber: item.fiber || 0,
            sodium: item.sodium || 0,
            source: 'meal_template',
            meal_template_id: meal.id,
            meal_type: mealType,
          },
        })
      )

      const results = await Promise.all(logPromises)
      
      // Check for errors
      const hasError = results.some(r => r.error)
      if (hasError) {
        throw new Error('Failed to log some meal items')
      }

      // Update meal template log count
      await supabase
        .from('meal_templates')
        .update({
          log_count: (meal.log_count || 0) + 1,
          last_logged_at: new Date().toISOString(),
        })
        .eq('id', meal.id)

      if (onFoodLogged) onFoodLogged()
      Alert.alert('Success', `Logged: ${meal.template_name} (${items.length} items)`)
    } catch (error) {
      console.error('Error quick logging meal:', error)
      Alert.alert('Error', 'Failed to log meal')
    }
  }

  const undoLogFood = async () => {
    if (!loggedFoodToast?.entryId) return

    try {
      const { error } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', loggedFoodToast.entryId)

      if (error) throw error

      setLoggedFoodToast(null)
      Alert.alert('Undone', 'Food entry removed')
    } catch (error) {
      console.error('Error undoing food log:', error)
      Alert.alert('Error', 'Failed to undo')
    }
  }

  const editLoggedFood = () => {
    if (loggedFoodToast) {
      setSelectedFood(loggedFoodToast.food)
      setLoggedFoodToast(null)
    }
  }

  const handleDeleteItem = (type: string, id: number, name: string) => {
    console.log('🗑️ Delete button tapped:', { type, id, name })
    setDeleteConfirmation({ visible: true, type, id, name })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmation) return
    
    const { type, id, name } = deleteConfirmation
    console.log('Delete confirmed, calling edge function...')
    
    try {
      setDeleting(true)
      const action = type === 'restaurant' ? 'delete_restaurant' 
        : type === 'brand' ? 'delete_brand'
        : 'delete_food'
      
      console.log('Calling favorites-manage with:', { action, id })
      
      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: { action, id },
      })

      console.log('Edge function response:', { data, error })

      if (error) {
        console.error('Edge function returned error:', error)
        throw error
      }
      
      console.log('Delete successful, reloading favorites...')
      setDeleteConfirmation(null)
      await loadFavorites()
      console.log('Favorites reloaded')
    } catch (error: any) {
      console.error('Error deleting item:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      Alert.alert('Error', `Failed to delete item: ${error.message || 'Unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    console.log('Delete cancelled')
    setDeleteConfirmation(null)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
      </View>
    )
  }

  // View switching - render full-screen views instead of modals (prevents iOS freezing)
  if (showAddToFavorites) {
    return (
      <AddToFavoritesView
        onClose={() => {
          setShowAddToFavorites(false)
          setAddFavoritesMode(undefined)
        }}
        onAdded={() => {
          setShowAddToFavorites(false)
          setAddFavoritesMode(undefined)
          loadFavorites()
        }}
        initialMode={addFavoritesMode}
      />
    )
  }

  if (showMealBuilder) {
    return (
      <MealBuilderView
        onClose={() => {
          setShowMealBuilder(false)
          setEditingMeal(null)
        }}
        onSaved={() => {
          setShowMealBuilder(false)
          setEditingMeal(null)
          loadFavorites()
        }}
        editingMeal={editingMeal}
      />
    )
  }

  if (selectedRestaurant) {
    return (
      <RestaurantMenuBrowser
        restaurant={selectedRestaurant}
        onBack={() => setSelectedRestaurant(null)}
        onFoodLogged={() => {
          setSelectedRestaurant(null)
          loadFavorites()
        }}
        mealType={mealType}
      />
    )
  }

  if (selectedBrand) {
    return (
      <BrandMenuBrowser
        brand={selectedBrand}
        onBack={() => setSelectedBrand(null)}
        onFoodLogged={() => {
          setSelectedBrand(null)
          loadFavorites()
        }}
      />
    )
  }

  if (selectedFood) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedFood(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#282B34" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Food</Text>
        </View>
        
        <Card>
          <PortionAdjustInput
            food={{
              name: selectedFood.food_name,
              brand_name: selectedFood.brand_name,
              normalized_nutrition: selectedFood.calories_per_gram ? {
                calories_per_gram: selectedFood.calories_per_gram,
                protein_per_gram: selectedFood.protein_per_gram,
                carbs_per_gram: selectedFood.carbs_per_gram,
                fat_per_gram: selectedFood.fat_per_gram,
              } : undefined,
              raw_serving: selectedFood.raw_serving_calories ? {
                calories: selectedFood.raw_serving_calories,
                protein: selectedFood.raw_serving_protein,
                carbohydrate: selectedFood.raw_serving_carbs,
                fat: selectedFood.raw_serving_fat,
                serving_description: selectedFood.serving_description,
              } : undefined,
            }}
            defaultAmount={selectedFood.default_amount || 1}
            defaultUnit={selectedFood.default_unit || 'oz'}
            onAmountChange={(amount, unit, macros) => {
              // Live update
            }}
            showSaveButton
            onSave={(amount, unit) => {
              const macros = {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
              } // Calculate from food data
              handleLogFood(selectedFood, amount, unit, macros)
            }}
            onCancel={() => setSelectedFood(null)}
          />
        </Card>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView style={{ flex: 1 }}>
      {/* Header */}
      {onBack && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#282B34" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Frequent Foods</Text>
        </View>
      )}

      {/* Purpose explanation - always visible */}
      <View style={styles.purposeCard}>
        <Text style={styles.purposeTitle}>Skip the search</Text>
        <Text style={styles.purposeText}>
          Add your regular meals and favorite foods here for instant one-tap logging.
        </Text>
      </View>

      {/* Favorite Meals */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity 
            style={styles.sectionHeaderLeft}
            onPress={() => toggleSection('meals')}
          >
            <Text style={styles.sectionTitle}>
              🍽️ Favorite Meals ({data.meals.length})
            </Text>
            <Ionicons 
              name={expandedSections.meals ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addSectionButton}
            onPress={() => {
              setShowMealBuilder(true)
            }}
          >
            <Ionicons name="add-circle" size={20} color="#FE5858" />
            <Text style={styles.addSectionButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {expandedSections.meals && data.meals.length > 0 && (
          <View style={styles.itemsList}>
            {data.meals.map((meal) => (
              <View key={meal.id} style={styles.mealItemRow}>
                <TouchableOpacity
                  style={styles.mealItemTouchable}
                  onPress={() => quickLogMeal(meal)}
                  activeOpacity={0.7}
                >
                  <View style={styles.savedFoodInfo}>
                    <Text style={styles.savedFoodName}>{meal.template_name}</Text>
                    <Text style={styles.savedFoodDetails}>
                      {Math.round(meal.total_calories)} cal
                      {meal.log_count > 0 && ` • Logged ${meal.log_count}x`}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMeal(meal)
                    setShowMealBuilder(true)
                  }}
                  style={styles.editMealButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="create-outline" size={20} color="#3B82F6" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            ))}
          </View>
        )}
        
        {expandedSections.meals && data.meals.length === 0 && (
          <Text style={styles.emptyText}>No favorite meals yet</Text>
        )}
      </View>

      {/* Restaurants */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity 
            style={styles.sectionHeaderLeft}
            onPress={() => toggleSection('restaurants')}
          >
            <Text style={styles.sectionTitle}>
              🏪 Restaurants ({data.restaurants.length})
            </Text>
            <Ionicons 
              name={expandedSections.restaurants ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addSectionButton}
            onPress={() => {
              setAddFavoritesMode('restaurant')
              setShowAddToFavorites(true)
            }}
          >
            <Ionicons name="add-circle" size={20} color="#FE5858" />
            <Text style={styles.addSectionButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        
        {expandedSections.restaurants && data.restaurants.length > 0 && (
          <View style={styles.itemsList}>
            {data.restaurants.map((restaurant) => {
              const foods = restaurantFoods[restaurant.id] || []
              const isLoadingFoods = loadingRestaurantFoods[restaurant.id]
              
              return (
                <View key={restaurant.id} style={styles.restaurantGroup}>
                  {/* Restaurant Header */}
                  <View style={styles.restaurantHeader}>
                    <Text style={styles.restaurantName}>🥖 {restaurant.restaurant_name}</Text>
                    <View style={styles.restaurantActions}>
                      <TouchableOpacity 
                        onPress={() => setSelectedRestaurant(restaurant)}
                        style={styles.browseButton}
                      >
                        <Text style={styles.browseButtonText}>Browse Menu</Text>
                        <Ionicons name="search" size={16} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteItem('restaurant', restaurant.id, restaurant.restaurant_name)}
                        style={styles.deleteIconButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Saved Items from this Restaurant */}
                  {isLoadingFoods ? (
                    <View style={styles.loadingFoods}>
                      <ActivityIndicator size="small" color="#FE5858" />
                    </View>
                  ) : foods.length > 0 ? (
                    <View style={styles.savedFoodsList}>
                      {foods.map((food) => (
                        <TouchableOpacity
                          key={food.id}
                          style={styles.savedFoodItem}
                          onPress={() => quickLogFood(food)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.savedFoodInfo}>
                            <Text style={styles.savedFoodName}>⭐ {food.food_name}</Text>
                            <Text style={styles.savedFoodDetails}>
                              {food.default_amount} {food.default_unit}
                              {food.log_count > 0 && ` • Logged ${food.log_count}x`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              setSelectedFood(food)
                            }}
                            style={styles.editFoodButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="create-outline" size={20} color="#6B7280" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noSavedItems}>No saved items yet</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}
        
        {expandedSections.restaurants && data.restaurants.length === 0 && (
          <Text style={styles.emptyText}>No restaurants added yet</Text>
        )}
      </View>

      {/* Brands */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity 
            style={styles.sectionHeaderLeft}
            onPress={() => toggleSection('brands')}
          >
            <Text style={styles.sectionTitle}>
              🏷️ Brands ({data.brands.length})
            </Text>
            <Ionicons 
              name={expandedSections.brands ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addSectionButton}
            onPress={() => {
              setAddFavoritesMode('brand')
              setShowAddToFavorites(true)
            }}
          >
            <Ionicons name="add-circle" size={20} color="#FE5858" />
            <Text style={styles.addSectionButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        
        {expandedSections.brands && data.brands.length > 0 && (
          <View style={styles.itemsList}>
            {data.brands.map((brand) => {
              const foods = brandFoods[brand.id] || []
              const isLoadingFoods = loadingBrandFoods[brand.id]
              
              return (
                <View key={brand.id} style={styles.restaurantGroup}>
                  {/* Brand Header */}
                  <View style={styles.restaurantHeader}>
                    <Text style={styles.restaurantName}>🏷️ {brand.brand_name}</Text>
                    <View style={styles.restaurantActions}>
                      <TouchableOpacity 
                        onPress={() => setSelectedBrand(brand)}
                        style={styles.browseButton}
                      >
                        <Text style={styles.browseButtonText}>Browse Products</Text>
                        <Ionicons name="search" size={16} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteItem('brand', brand.id, brand.brand_name)}
                        style={styles.deleteIconButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Saved Items from this Brand */}
                  {isLoadingFoods ? (
                    <View style={styles.loadingFoods}>
                      <ActivityIndicator size="small" color="#FE5858" />
                    </View>
                  ) : foods.length > 0 ? (
                    <View style={styles.savedFoodsList}>
                      {foods.map((food) => (
                        <TouchableOpacity
                          key={food.id}
                          style={styles.savedFoodItem}
                          onPress={() => quickLogFood(food)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.savedFoodInfo}>
                            <Text style={styles.savedFoodName}>⭐ {food.food_name}</Text>
                            <Text style={styles.savedFoodDetails}>
                              {food.default_amount} {food.default_unit}
                              {food.log_count > 0 && ` • Logged ${food.log_count}x`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              setSelectedFood(food)
                            }}
                            style={styles.editFoodButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="create-outline" size={20} color="#6B7280" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noSavedItems}>No saved items yet</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {expandedSections.brands && data.brands.length === 0 && (
          <Text style={styles.emptyText}>No brands added yet</Text>
        )}
      </View>

      {/* Empty state */}

      {/* Delete confirmation modal - keep as Modal since it's a small overlay */}
      {deleteConfirmation && (
        <Modal
          visible={deleteConfirmation.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={cancelDelete}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmationModal}>
              <View style={styles.confirmationHeader}>
                <Ionicons name="warning" size={48} color="#EF4444" />
                <Text style={styles.confirmationTitle}>Delete Item</Text>
                <Text style={styles.confirmationMessage}>
                  Remove "{deleteConfirmation.name}" from Frequent Foods?
                </Text>
              </View>
              
              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.cancelButton]}
                  onPress={cancelDelete}
                  disabled={deleting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.deleteButtonConfirm]}
                  onPress={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Success Toast for Logged Food */}
      {loggedFoodToast?.visible && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <View style={styles.toastHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.toastTitle}>Logged!</Text>
              <TouchableOpacity 
                onPress={() => setLoggedFoodToast(null)}
                style={styles.toastClose}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.toastFoodName}>
              {loggedFoodToast.food.food_name || loggedFoodToast.food.name}
            </Text>
            <Text style={styles.toastDetails}>
              {loggedFoodToast.amount} {loggedFoodToast.unit} • {loggedFoodToast.macros.calories} cal
            </Text>
            <Text style={styles.toastMacros}>
              {loggedFoodToast.macros.protein}g P • {loggedFoodToast.macros.carbs}g C • {loggedFoodToast.macros.fat}g F
            </Text>
            
            <View style={styles.toastActions}>
              <TouchableOpacity 
                style={styles.toastButton}
                onPress={undoLogFood}
              >
                <Ionicons name="arrow-undo" size={16} color="#EF4444" />
                <Text style={styles.toastButtonTextUndo}>Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.toastButton}
                onPress={editLoggedFood}
              >
                <Ionicons name="create-outline" size={16} color="#3B82F6" />
                <Text style={styles.toastButtonTextEdit}>Edit Portion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  purposeCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FE5858',
  },
  purposeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  purposeText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
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
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    marginRight: 12,
  },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  addSectionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  itemsList: {
    padding: 16,
    gap: 8,
  },
  itemCard: {
    padding: 12,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTouchable: {
    flex: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: '#6B7280',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 24,
    fontStyle: 'italic',
  },
  emptyState: {
    margin: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  confirmationModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmationHeader: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
  },
  confirmationMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  deleteButtonConfirm: {
    backgroundColor: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  restaurantGroup: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  restaurantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  restaurantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  browseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  deleteIconButton: {
    padding: 4,
  },
  loadingFoods: {
    padding: 20,
    alignItems: 'center',
  },
  savedFoodsList: {
    gap: 4,
  },
  savedFoodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F6FBFE',
  },
  mealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F6FBFE',
  },
  mealItemTouchable: {
    flex: 1,
  },
  editMealButton: {
    padding: 8,
    marginRight: 8,
  },
  savedFoodInfo: {
    flex: 1,
  },
  savedFoodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  savedFoodDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  editFoodButton: {
    padding: 4,
    marginLeft: 8,
  },
  noSavedItems: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  toastTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginLeft: 8,
    flex: 1,
  },
  toastClose: {
    padding: 4,
  },
  toastFoodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  toastDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  toastMacros: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  toastActions: {
    flexDirection: 'row',
    gap: 12,
  },
  toastButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  toastButtonTextUndo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  toastButtonTextEdit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
})






