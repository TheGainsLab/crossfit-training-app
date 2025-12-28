import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import FoodSearchModal from './FoodSearchModal'
import PortionAdjustInput from './PortionAdjustInput'
import { 
  POPULAR_RESTAURANTS, 
  POPULAR_BRANDS,
  searchFoodSources,
  normalizeRestaurantName,
  normalizeBrandName,
  FoodSource 
} from '@/lib/nutrition/foodSourceMappings'

interface AddToFavoritesModalProps {
  visible: boolean
  onClose: () => void
  onAdded?: () => void
  initialMode?: 'meal' | 'restaurant' | 'brand' | 'food'
}

type ModalView = 'main' | 'restaurant-list' | 'brand-list' | 'restaurant-custom' | 'brand-custom' | 'restaurant-confirm' | 'brand-confirm' | 'generic-search'

export default function AddToFavoritesModal({
  visible,
  onClose,
  onAdded,
  initialMode,
}: AddToFavoritesModalProps) {
  const [currentView, setCurrentView] = useState<ModalView>('main')
  const [searchQuery, setSearchQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [normalizedName, setNormalizedName] = useState('')
  const [loading, setLoading] = useState(false)
  const [userFavorites, setUserFavorites] = useState<string[]>([])
  const [userHidden, setUserHidden] = useState<string[]>([])
  const [selectedFood, setSelectedFood] = useState<any>(null)
  const [showPortionInput, setShowPortionInput] = useState(false)
  
  const supabase = createClient()
  
  // Set initial view based on initialMode prop
  React.useEffect(() => {
    if (visible && initialMode) {
      switch (initialMode) {
        case 'restaurant':
          setCurrentView('restaurant-list')
          loadUserData('restaurant')
          break
        case 'brand':
          setCurrentView('brand-list')
          loadUserData('brand')
          break
        case 'food':
          setCurrentView('generic-search')
          break
        case 'meal':
          // For meals, we'll still show main menu since meal creation is more complex
          setCurrentView('main')
          break
        default:
          setCurrentView('main')
      }
    } else if (visible) {
      setCurrentView('main')
    }
  }, [visible, initialMode])
  
  const loadUserData = async (type: 'restaurant' | 'brand') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) return

      if (type === 'restaurant') {
        const [favs, hidden] = await Promise.all([
          supabase.from('favorite_restaurants')
            .select('restaurant_name')
            .eq('user_id', userData.id),
          supabase.from('hidden_restaurants')
            .select('restaurant_name')
            .eq('user_id', userData.id),
        ])
        setUserFavorites(favs.data?.map(r => r.restaurant_name) || [])
        setUserHidden(hidden.data?.map(r => r.restaurant_name) || [])
      } else {
        const [favs, hidden] = await Promise.all([
          supabase.from('favorite_brands')
            .select('brand_name')
            .eq('user_id', userData.id),
          supabase.from('hidden_brands')
            .select('brand_name')
            .eq('user_id', userData.id),
        ])
        setUserFavorites(favs.data?.map(b => b.brand_name) || [])
        setUserHidden(hidden.data?.map(b => b.brand_name) || [])
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }
  
  const resetModal = () => {
    setCurrentView('main')
    setSearchQuery('')
    setCustomName('')
    setNormalizedName('')
    setUserFavorites([])
    setUserHidden([])
    setSelectedFood(null)
    setShowPortionInput(false)
  }
  
  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handleSelectRestaurant = (source: FoodSource) => {
    addRestaurant(source.display, source.fatsecret)
  }

  const handleSelectBrand = (source: FoodSource) => {
    addBrand(source.display, source.fatsecret)
  }

  const handleCustomRestaurantSubmit = () => {
    if (!customName.trim()) {
      Alert.alert('Error', 'Please enter a restaurant name')
      return
    }
    
    // Try to normalize
    const normalized = normalizeRestaurantName(customName)
    
    if (normalized) {
      // Found a match - show confirmation
      setNormalizedName(normalized)
      setCurrentView('restaurant-confirm')
    } else {
      // No match - use as-is
      addRestaurant(customName.trim(), customName.trim())
    }
  }

  const handleCustomBrandSubmit = () => {
    if (!customName.trim()) {
      Alert.alert('Error', 'Please enter a brand name')
      return
    }
    
    // Try to normalize
    const normalized = normalizeBrandName(customName)
    
    if (normalized) {
      // Found a match - show confirmation
      setNormalizedName(normalized)
      setCurrentView('brand-confirm')
    } else {
      // No match - use as-is
      addBrand(customName.trim(), customName.trim())
    }
  }

  const addRestaurant = async (displayName: string, fatsecretName: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: {
          action: 'add_restaurant',
          restaurant_name: displayName,
          fatsecret_brand_filter: fatsecretName,
        },
      })

      if (error) throw error
      
      Alert.alert('Success', `${displayName} added to Frequent Foods`)
      if (onAdded) onAdded()
      handleClose()
    } catch (error: any) {
      console.error('Error adding restaurant:', error)
      Alert.alert('Error', error.message || 'Failed to add restaurant')
    } finally {
      setLoading(false)
    }
  }

  const addBrand = async (displayName: string, fatsecretName: string) => {
    try {
      setLoading(true)
      const { data, error} = await supabase.functions.invoke('favorites-manage', {
        body: {
          action: 'add_brand',
          brand_name: displayName,
          fatsecret_brand_filter: fatsecretName,
        },
      })

      if (error) throw error
      
      Alert.alert('Success', `${displayName} added to Frequent Foods`)
      if (onAdded) onAdded()
      handleClose()
    } catch (error: any) {
      console.error('Error adding brand:', error)
      Alert.alert('Error', error.message || 'Failed to add brand')
    } finally {
      setLoading(false)
    }
  }

  const hideRestaurant = async (restaurantName: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: {
          action: 'hide_restaurant',
          restaurant_name: restaurantName,
        },
      })

      if (error) throw error
      
      // Reload list
      await loadUserData('restaurant')
    } catch (error: any) {
      console.error('Error hiding restaurant:', error)
      Alert.alert('Error', error.message || 'Failed to hide restaurant')
    } finally {
      setLoading(false)
    }
  }

  const hideBrand = async (brandName: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: {
          action: 'hide_brand',
          brand_name: brandName,
        },
      })

      if (error) throw error
      
      // Reload list
      await loadUserData('brand')
    } catch (error: any) {
      console.error('Error hiding brand:', error)
      Alert.alert('Error', error.message || 'Failed to hide brand')
    } finally {
      setLoading(false)
    }
  }

  // Handle ingredient (generic food) selection - load full details and show portion adjustment
  const handleFoodSelect = async (foodItem: any) => {
    console.log('🔍 handleFoodSelect called with:', foodItem)
    
    try {
      setLoading(true)
      console.log('📡 Fetching food details for:', foodItem.food_id)
      
      // Fetch full food details
      const { data, error } = await supabase.functions.invoke('nutrition-food', {
        body: {
          foodId: foodItem.food_id,
          normalize: true,
        },
      })

      console.log('✅ Food details response:', { success: !error, hasData: !!data })
      
      if (error) {
        console.error('❌ Error from nutrition-food:', error)
        throw error
      }
      
      const foodData = data?.data?.food
      if (!foodData) {
        console.error('❌ No food data in response')
        throw new Error('Failed to load food details')
      }

      console.log('🍎 Food data loaded:', foodData.food_name)

      // Prepare food object with normalization
      const servings = foodData.servings?.serving || []
      const firstServing = Array.isArray(servings) ? servings[0] : servings

      console.log('🍽️ First serving:', firstServing?.serving_description)

      // Try to normalize to per-gram
      const GRAMS_PER_OZ = 28.35
      let normalizedData: any = null
      
      if (firstServing) {
        let grams: number | null = null
        
        // Try to extract grams from metric_serving_amount
        if (firstServing.metric_serving_amount && firstServing.metric_serving_unit === 'g') {
          grams = parseFloat(firstServing.metric_serving_amount)
          console.log('📊 Normalized from metric_serving_amount:', grams, 'g')
        } else if (firstServing.serving_description) {
          // Try to parse from description
          const desc = firstServing.serving_description.toLowerCase()
          const ozMatch = desc.match(/([\d.]+)\s*oz/)
          const gMatch = desc.match(/([\d.]+)\s*g/)
          
          if (ozMatch) {
            grams = parseFloat(ozMatch[1]) * GRAMS_PER_OZ
            console.log('📊 Normalized from oz:', grams, 'g')
          } else if (gMatch) {
            grams = parseFloat(gMatch[1])
            console.log('📊 Normalized from description:', grams, 'g')
          }
        }
        
        if (grams && grams > 0) {
          // Successfully normalized
          normalizedData = {
            caloriesPerGram: parseFloat(firstServing.calories || '0') / grams,
            proteinPerGram: parseFloat(firstServing.protein || '0') / grams,
            carbsPerGram: parseFloat(firstServing.carbohydrate || '0') / grams,
            fatPerGram: parseFloat(firstServing.fat || '0') / grams,
            fiberPerGram: parseFloat(firstServing.fiber || '0') / grams,
            sodiumPerGram: parseFloat(firstServing.sodium || '0') / grams,
          }
          console.log('✅ Successfully normalized nutrition data')
        } else {
          console.log('⚠️ Could not normalize, will use raw serving')
        }
      }

      const preparedFood = {
        food_id: foodData.food_id,
        food_name: foodData.food_name,
        name: foodData.food_name, // For PortionAdjustInput
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
        // Store raw serving data for fallback
        raw_serving: normalizedData ? undefined : {
          serving_id: firstServing?.serving_id || '0',
          serving_description: firstServing?.serving_description || '',
          calories: parseFloat(firstServing?.calories || '0'),
          protein: parseFloat(firstServing?.protein || '0'),
          carbohydrate: parseFloat(firstServing?.carbohydrate || '0'),
          fat: parseFloat(firstServing?.fat || '0'),
        },
      }

      console.log('✅ Food prepared, setting state...')
      setSelectedFood(preparedFood)
      setShowPortionInput(true)
      console.log('✅ State updated - should show portion input now')
    } catch (error: any) {
      console.error('❌ Error loading food details:', error)
      Alert.alert('Error', error.message || 'Failed to load food details')
    } finally {
      setLoading(false)
      console.log('🏁 handleFoodSelect complete')
    }
  }

  // Save ingredient to favorites with portion data
  const handleSaveFavorite = async (amount: number, unit: string) => {
    if (!selectedFood) return

    try {
      setLoading(true)

      const payload: any = {
        action: 'add_food',
        food_id: selectedFood.food_id,
        food_name: selectedFood.food_name,
        food_type: 'generic',
        brand_name: selectedFood.brand_name,
        default_amount: amount,
        default_unit: unit,
      }

      // Add normalized data if available
      if (selectedFood.normalized_nutrition) {
        payload.calories_per_gram = selectedFood.normalized_nutrition.calories_per_gram
        payload.protein_per_gram = selectedFood.normalized_nutrition.protein_per_gram
        payload.carbs_per_gram = selectedFood.normalized_nutrition.carbs_per_gram
        payload.fat_per_gram = selectedFood.normalized_nutrition.fat_per_gram
        payload.fiber_per_gram = selectedFood.normalized_nutrition.fiber_per_gram
        payload.sodium_per_gram = selectedFood.normalized_nutrition.sodium_per_gram
      } else if (selectedFood.raw_serving) {
        // Fallback: store raw serving data
        payload.serving_id = selectedFood.raw_serving.serving_id
        payload.serving_description = selectedFood.raw_serving.serving_description
        payload.raw_serving_calories = selectedFood.raw_serving.calories
        payload.raw_serving_protein = selectedFood.raw_serving.protein
        payload.raw_serving_carbs = selectedFood.raw_serving.carbohydrate
        payload.raw_serving_fat = selectedFood.raw_serving.fat
      }

      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: payload,
      })

      if (error) throw error

      Alert.alert('Success', `${selectedFood.food_name} added to Frequent Foods`)
      setShowPortionInput(false)
      setSelectedFood(null)
      if (onAdded) onAdded()
      handleClose()
    } catch (error: any) {
      console.error('Error saving favorite:', error)
      Alert.alert('Error', error.message || 'Failed to save favorite')
    } finally {
      setLoading(false)
    }
  }

  // Restaurant List View
  if (currentView === 'restaurant-list') {
    // Filter to show only restaurants that are NOT in favorites and NOT hidden
    const visibleRestaurants = searchFoodSources(searchQuery, POPULAR_RESTAURANTS)
      .filter(restaurant => 
        !userFavorites.includes(restaurant.fatsecret) && 
        !userHidden.includes(restaurant.fatsecret)
      )
    
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCurrentView('main')}>
              <Ionicons name="arrow-back" size={24} color="#282B34" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Restaurant</Text>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search restaurants..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
            
            <ScrollView style={styles.sourceList}>
              {visibleRestaurants.map((restaurant) => (
                <View
                  key={restaurant.display}
                  style={styles.sourceItemWithButtons}
                >
                  <Text style={styles.sourceEmoji}>{restaurant.emoji}</Text>
                  <Text style={styles.sourceNameWithButtons}>{restaurant.display}</Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => addRestaurant(restaurant.display, restaurant.fatsecret)}
                      disabled={loading}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => hideRestaurant(restaurant.fatsecret)}
                      disabled={loading}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.customButton}
              onPress={() => {
                setCustomName('')
                setCurrentView('restaurant-custom')
              }}
            >
              <Text style={styles.customButtonText}>Not listed? Add custom restaurant</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  // Brand List View
  if (currentView === 'brand-list') {
    // Filter to show only brands that are NOT in favorites and NOT hidden
    const visibleBrands = searchFoodSources(searchQuery, POPULAR_BRANDS)
      .filter(brand => 
        !userFavorites.includes(brand.fatsecret) && 
        !userHidden.includes(brand.fatsecret)
      )
    
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCurrentView('main')}>
              <Ionicons name="arrow-back" size={24} color="#282B34" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Brand</Text>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search brands..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
            
            <ScrollView style={styles.sourceList}>
              {visibleBrands.map((brand) => (
                <View
                  key={brand.display}
                  style={styles.sourceItemWithButtons}
                >
                  <Text style={styles.sourceEmoji}>{brand.emoji}</Text>
                  <Text style={styles.sourceNameWithButtons}>{brand.display}</Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => addBrand(brand.display, brand.fatsecret)}
                      disabled={loading}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => hideBrand(brand.fatsecret)}
                      disabled={loading}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.customButton}
              onPress={() => {
                setCustomName('')
                setCurrentView('brand-custom')
              }}
            >
              <Text style={styles.customButtonText}>Not listed? Add custom brand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  // Custom Restaurant Entry
  if (currentView === 'restaurant-custom') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCurrentView('restaurant-list')}>
              <Ionicons name="arrow-back" size={24} color="#282B34" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Custom Restaurant</Text>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Card style={{ padding: 16 }}>
              <Text style={styles.label}>Restaurant Name</Text>
              <TextInput
                style={styles.input}
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g., Local Pizza Place"
                autoCapitalize="words"
                autoFocus
              />
              <Text style={styles.hint}>
                We'll check if this matches a known restaurant
              </Text>
            </Card>
            
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleCustomRestaurantSubmit}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Adding...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    )
  }

  // Custom Brand Entry
  if (currentView === 'brand-custom') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCurrentView('brand-list')}>
              <Ionicons name="arrow-back" size={24} color="#282B34" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Custom Brand</Text>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Card style={{ padding: 16 }}>
              <Text style={styles.label}>Brand Name</Text>
              <TextInput
                style={styles.input}
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g., Store Brand"
                autoCapitalize="words"
                autoFocus
              />
              <Text style={styles.hint}>
                We'll check if this matches a known brand
              </Text>
            </Card>
            
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleCustomBrandSubmit}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Adding...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    )
  }

  // Restaurant Confirmation
  if (currentView === 'restaurant-confirm') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCurrentView('restaurant-custom')}>
              <Ionicons name="arrow-back" size={24} color="#282B34" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Confirm Restaurant</Text>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Card style={{ padding: 24 }}>
              <Text style={styles.confirmLabel}>You entered:</Text>
              <Text style={styles.userInput}>{customName}</Text>
              
              <Text style={styles.confirmLabel}>Did you mean:</Text>
              <Text style={styles.normalizedName}>{normalizedName}</Text>
              
              <Text style={styles.hint}>
                Using the correct name helps us find menu items
              </Text>
            </Card>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.confirmButtonYes]}
                onPress={() => addRestaurant(normalizedName, normalizedName)}
                disabled={loading}
              >
                <Text style={styles.confirmButtonTextYes}>
                  {loading ? 'Adding...' : `Yes, add ${normalizedName}`}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmButton, styles.confirmButtonNo]}
                onPress={() => addRestaurant(customName.trim(), customName.trim())}
                disabled={loading}
              >
                <Text style={styles.confirmButtonTextNo}>
                  No, use "{customName}"
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    )
  }

  // Brand Confirmation
  if (currentView === 'brand-confirm') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCurrentView('brand-custom')}>
              <Ionicons name="arrow-back" size={24} color="#282B34" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Confirm Brand</Text>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Card style={{ padding: 24 }}>
              <Text style={styles.confirmLabel}>You entered:</Text>
              <Text style={styles.userInput}>{customName}</Text>
              
              <Text style={styles.confirmLabel}>Did you mean:</Text>
              <Text style={styles.normalizedName}>{normalizedName}</Text>
              
              <Text style={styles.hint}>
                Using the correct name helps us find products
              </Text>
            </Card>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.confirmButtonYes]}
                onPress={() => addBrand(normalizedName, normalizedName)}
                disabled={loading}
              >
                <Text style={styles.confirmButtonTextYes}>
                  {loading ? 'Adding...' : `Yes, add ${normalizedName}`}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmButton, styles.confirmButtonNo]}
                onPress={() => addBrand(customName.trim(), customName.trim())}
                disabled={loading}
              >
                <Text style={styles.confirmButtonTextNo}>
                  No, use "{customName}"
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    )
  }

  // Generic Search
  if (currentView === 'generic-search') {
    // If showing portion input, render it
    if (showPortionInput && selectedFood) {
      return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setShowPortionInput(false)
                setSelectedFood(null)
              }}>
                <Ionicons name="arrow-back" size={24} color="#282B34" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Set Default Portion</Text>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FE5858" />
                  <Text style={styles.loadingText}>Saving...</Text>
                </View>
              ) : (
                <PortionAdjustInput
                  food={selectedFood}
                  defaultAmount={1}
                  defaultUnit="oz"
                  showSaveButton={true}
                  onSave={handleSaveFavorite}
                  onCancel={() => {
                    setShowPortionInput(false)
                    setSelectedFood(null)
                  }}
                />
              )}
            </ScrollView>
          </View>
        </Modal>
      )
    }

    // Otherwise show food search
    return (
      <FoodSearchModal
        visible={visible}
        onClose={handleClose}
        filterType="generic"
        onFoodSelected={handleFoodSelect}
      />
    )
  }

  // Main menu
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#282B34" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add to Frequent Foods</Text>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.optionsList}>
            <TouchableOpacity 
              style={styles.option}
              onPress={() => {
                setSearchQuery('')
                setCurrentView('restaurant-list')
              }}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="restaurant" size={32} color="#FE5858" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Add Restaurant</Text>
                <Text style={styles.optionDescription}>
                  Chipotle, Panera, McDonald's, etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.option}
              onPress={() => {
                setSearchQuery('')
                setCurrentView('brand-list')
              }}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="pricetag" size={32} color="#3B82F6" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Add Brand</Text>
                <Text style={styles.optionDescription}>
                  Kirkland, Tyson, Trader Joe's, etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.option}
              onPress={() => setCurrentView('generic-search')}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="nutrition" size={32} color="#10B981" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Add Ingredient</Text>
                <Text style={styles.optionDescription}>
                  Salmon, chicken breast, eggs, rice, etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.comingSoonLabel}>Quick Add Options</Text>

            <TouchableOpacity 
              style={[styles.option, styles.optionDisabled]}
              disabled
            >
              <View style={styles.optionIcon}>
                <Ionicons name="barcode" size={32} color="#9CA3AF" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Scan Barcode</Text>
                <Text style={styles.optionDescription}>
                  Use main screen barcode scanner, then save
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.option, styles.optionDisabled]}
              disabled
            >
              <View style={styles.optionIcon}>
                <Ionicons name="camera" size={32} color="#9CA3AF" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Take Photo</Text>
                <Text style={styles.optionDescription}>
                  Use main screen photo feature, then save
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
  },
  optionsList: {
    padding: 16,
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  comingSoonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    margin: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  sourceList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sourceEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  sourceName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sourceItemWithButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sourceNameWithButtons: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
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
  removeButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  removeButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  customButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  customButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 4,
  },
  userInput: {
    fontSize: 18,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  normalizedName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  confirmButtons: {
    padding: 16,
    gap: 12,
  },
  confirmButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonYes: {
    backgroundColor: '#FE5858',
  },
  confirmButtonNo: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  confirmButtonTextYes: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmButtonTextNo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
})






