import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native'
import { createClient } from '@/lib/supabase/client'
import { createMealTemplate, MealTemplateItem, getMealTemplates } from '@/lib/api/mealTemplates'
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

type SetupStep = 'intro' | 'menu' | 'breakfast' | 'lunch' | 'dinner' | 'pre_workout' | 'post_workout' | 'snack' | 'other' | 'complete'

interface TempFoodItem extends Omit<MealTemplateItem, 'id' | 'meal_template_id'> {
  tempId: string
}

export default function MealSetupWizard({ userId, onComplete, onSkip }: MealSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('intro')
  const [currentItems, setCurrentItems] = useState<TempFoodItem[]>([])
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [totalFavorites, setTotalFavorites] = useState(0)
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [searchModalVisible, setSearchModalVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [foodTypeChoiceVisible, setFoodTypeChoiceVisible] = useState(false)
  const [pendingFood, setPendingFood] = useState<CommonFood | null>(null)
  const [brandInputVisible, setBrandInputVisible] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [foodListModalVisible, setFoodListModalVisible] = useState(false)
  const [selectedFoodForModal, setSelectedFoodForModal] = useState<{
    foodId: string
    foodName: string
  } | null>(null)

  // Load favorites count when entering menu or after saving
  const loadFavoritesCount = async () => {
    setLoadingFavorites(true)
    try {
      const templates = await getMealTemplates(userId)
      setTotalFavorites(templates.length)
    } catch (error) {
      console.error('Error loading favorites count:', error)
    } finally {
      setLoadingFavorites(false)
    }
  }

  useEffect(() => {
    if (currentStep === 'menu') {
      loadFavoritesCount()
    }
  }, [currentStep])

  const getMealTypeLabel = (step: SetupStep): string => {
    const labels: Record<string, string> = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      pre_workout: 'Pre-Workout',
      post_workout: 'Post-Workout',
      snack: 'Snack',
      other: 'Other',
    }
    return labels[step] || ''
  }

  const handleMealTypeSelected = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'pre_workout' | 'post_workout' | 'snack' | 'other') => {
    setCurrentStep(mealType)
    setTemplateName(getDefaultTemplateName(mealType))
    setCurrentItems([])
  }

  const getDefaultTemplateName = (step: SetupStep): string => {
    const names: Record<string, string> = {
      breakfast: 'My Regular Breakfast',
      lunch: 'My Regular Lunch',
      dinner: 'My Regular Dinner',
      pre_workout: 'My Pre-Workout',
      post_workout: 'My Post-Workout',
      snack: 'My Snack',
      other: 'My Other Meal',
    }
    return names[step] || 'My Meal'
  }

  const handleAddCommonFood = (food: CommonFood) => {
    // Show food type choice modal
    setPendingFood(food)
    setFoodTypeChoiceVisible(true)
  }

  const handleFoodTypeSelected = async (foodType: 'generic' | 'brand') => {
    if (!pendingFood) return

    setFoodTypeChoiceVisible(false)

    // If brand selected, ask for brand name first
    if (foodType === 'brand') {
      setBrandInputVisible(true)
      return
    }

    // For generic, proceed directly to search
    await searchFoodsByType('generic', '')
  }

  const handleBrandSubmit = async () => {
    const brand = brandName.trim()
    if (!brand) {
      Alert.alert('Required', 'Please enter a brand name')
      return
    }

    setBrandInputVisible(false)
    await searchFoodsByType('brand', brand)
    setBrandName('')
  }

  const searchFoodsByType = async (foodType: 'generic' | 'brand', brand: string) => {
    if (!pendingFood) return

    setSearchLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert('Error', 'Please sign in')
        setPendingFood(null)
        return
      }

      // Build search query - include brand name if provided
      const searchQuery = brand 
        ? `${brand} ${pendingFood.searchTerm}`
        : pendingFood.searchTerm

      const { data, error } = await supabase.functions.invoke('nutrition-search', {
        body: { query: searchQuery, pageNumber: 0, maxResults: 20 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error || !data?.success || !data?.data?.foods || data.data.foods.length === 0) {
        Alert.alert('Not Found', `Could not find "${pendingFood.label}". Try searching manually.`)
        setPendingFood(null)
        return
      }

      // Filter results by food type
      const filteredFoods = data.data.foods.filter((food: any) => {
        if (foodType === 'generic') {
          return food.food_type === 'Generic'
        } else {
          return food.food_type === 'Brand'
        }
      })

      if (filteredFoods.length === 0) {
        Alert.alert('No Results', `No ${foodType} foods found for "${pendingFood.label}".`)
        setPendingFood(null)
        return
      }

      setSearchResults(filteredFoods)
      setFoodListModalVisible(true)
    } catch (error) {
      console.error('Error searching food:', error)
      Alert.alert('Error', 'Failed to search food')
      setPendingFood(null)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleFoodListItemSelected = (food: any) => {
    setSelectedFoodForModal({
      foodId: food.food_id,
      foodName: food.food_name,
    })
    setFoodListModalVisible(false)
    setSearchResults([])
    setPendingFood(null)
  }

  const searchFoods = async () => {
    const searchTerm = searchQuery.trim()
    if (!searchTerm) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert('Error', 'Please sign in')
        return
      }

      const { data, error: invokeError } = await supabase.functions.invoke('nutrition-search', {
        body: { query: searchTerm, pageNumber: 0, maxResults: 20 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.success && data?.data?.foods) {
        setSearchResults(data.data.foods)
      } else {
        setSearchResults([])
      }
    } catch (error: any) {
      console.error('Search error:', error)
      Alert.alert('Error', error.message || 'Failed to search foods')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchResultSelected = (food: any) => {
    setSelectedFoodForModal({
      foodId: food.food_id,
      foodName: food.food_name,
    })
    setSearchModalVisible(false)
    setSearchQuery('')
    setSearchResults([])
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

      // Clear current items and return to menu
      setCurrentItems([])
      setTemplateName('')
      
      // Return to menu and reload favorites count
      setCurrentStep('menu')
      await loadFavoritesCount()
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
    setCurrentStep('menu')
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
              setCurrentStep('menu')
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

  // Menu Screen
  if (currentStep === 'menu') {
    const menuMealTypes = [
      { value: 'breakfast', label: 'Breakfast' },
      { value: 'lunch', label: 'Lunch' },
      { value: 'dinner', label: 'Dinner' },
      { value: 'pre_workout', label: 'Pre-Workout' },
      { value: 'post_workout', label: 'Post-Workout' },
      { value: 'snack', label: 'Snack' },
      { value: 'other', label: 'Other' },
    ]

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Add Your Favorite Meals</Text>
          <Text style={styles.description}>
            Select a meal type to add a favorite. You can add as many as you like!
          </Text>

          {/* Favorites Count */}
          {loadingFavorites ? (
            <View style={styles.favoritesCountContainer}>
              <ActivityIndicator size="small" color="#FE5858" />
            </View>
          ) : (
            <View style={styles.favoritesCountContainer}>
              <Text style={styles.favoritesCountText}>
                {totalFavorites} {totalFavorites === 1 ? 'favorite' : 'favorites'} saved
              </Text>
            </View>
          )}

          {/* Meal Type Buttons - Same style as Nutrition tab */}
          <View style={styles.mealTypeContainer}>
            {menuMealTypes.map((meal) => (
              <TouchableOpacity
                key={meal.value}
                style={styles.mealTypeButton}
                onPress={() => handleMealTypeSelected(meal.value as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.mealTypeButtonText}>
                  {meal.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Skip Button */}
          <TouchableOpacity style={styles.secondaryButton} onPress={onSkip}>
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // Complete Screen
  if (currentStep === 'complete') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.title}>Great Work!</Text>
          <Text style={styles.subtitle}>
            You've set up {totalFavorites} {totalFavorites === 1 ? 'favorite' : 'favorites'}.
          </Text>
          <Text style={styles.description}>
            You can log these in one tap from the Nutrition tab.
          </Text>

          {totalFavorites < 3 && (
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
          {currentStep === 'breakfast' ? '☀️' : 
           currentStep === 'lunch' ? '🌮' : 
           currentStep === 'dinner' ? '🍽️' : 
           currentStep === 'pre_workout' ? '💪' :
           currentStep === 'post_workout' ? '🥤' : 
           currentStep === 'snack' ? '🍎' : '🍎'}{' '}
          {getMealTypeLabel(currentStep)}
        </Text>
        <Text style={styles.subtitle}>What do you usually eat?</Text>

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
                <Text style={styles.primaryButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Back to Menu Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkipMeal}>
          <Text style={styles.skipButtonText}>
            ← Back to Menu
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Search Modal */}
      <Modal
        visible={searchModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setSearchModalVisible(false)
          setSearchQuery('')
          setSearchResults([])
        }}
      >
        <View style={styles.searchModalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>Search Foods</Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchModalVisible(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.searchModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for food..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchFoods}
                returnKeyType="search"
                autoFocus={true}
              />
              <TouchableOpacity
                style={styles.searchSubmitButton}
                onPress={searchFoods}
                disabled={searchLoading || !searchQuery.trim()}
                activeOpacity={0.8}
              >
                {searchLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchSubmitButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <ScrollView style={styles.searchResultsContainer}>
                {searchResults.map((food) => (
                  <TouchableOpacity
                    key={food.food_id}
                    style={styles.searchResultItem}
                    onPress={() => handleSearchResultSelected(food)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.searchResultName}>{food.food_name}</Text>
                    {food.brand_name && (
                      <Text style={styles.searchResultBrand}>{food.brand_name}</Text>
                    )}
                    {food.food_description && (
                      <Text style={styles.searchResultDescription} numberOfLines={2}>
                        {food.food_description}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {searchQuery.trim() && searchResults.length === 0 && !searchLoading && (
              <View style={styles.searchEmptyContainer}>
                <Text style={styles.searchEmptyText}>No results found</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Food Type Choice Modal */}
      <Modal
        visible={foodTypeChoiceVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setFoodTypeChoiceVisible(false)
          setPendingFood(null)
        }}
      >
        <View style={styles.choiceModalOverlay}>
          <View style={styles.choiceModalContent}>
            <Text style={styles.choiceModalTitle}>
              Select Food Type
            </Text>
            <Text style={styles.choiceModalSubtitle}>
              {pendingFood?.label}
            </Text>
            
            <TouchableOpacity
              style={styles.choiceButton}
              onPress={() => handleFoodTypeSelected('generic')}
              activeOpacity={0.8}
            >
              <Text style={styles.choiceButtonText}>🥗 Generic Food</Text>
              <Text style={styles.choiceButtonDescription}>
                Fresh, home-cooked items
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.choiceButton}
              onPress={() => handleFoodTypeSelected('brand')}
              activeOpacity={0.8}
            >
              <Text style={styles.choiceButtonText}>🏷️ Brand</Text>
              <Text style={styles.choiceButtonDescription}>
                Packaged, branded products
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.choiceCancelButton}
              onPress={() => {
                setFoodTypeChoiceVisible(false)
                setPendingFood(null)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.choiceCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Brand Name Input Modal */}
      <Modal
        visible={brandInputVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setBrandInputVisible(false)
          setBrandName('')
          setPendingFood(null)
        }}
      >
        <View style={styles.choiceModalOverlay}>
          <View style={styles.choiceModalContent}>
            <Text style={styles.choiceModalTitle}>
              Enter Brand Name
            </Text>
            <Text style={styles.choiceModalSubtitle}>
              {pendingFood?.label}
            </Text>
            
            <TextInput
              style={styles.brandInput}
              placeholder="e.g., Chobani, Perdue, Kirkland"
              value={brandName}
              onChangeText={setBrandName}
              onSubmitEditing={handleBrandSubmit}
              returnKeyType="search"
              autoFocus={true}
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={[styles.choiceButton, !brandName.trim() && styles.choiceButtonDisabled]}
              onPress={handleBrandSubmit}
              disabled={!brandName.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.choiceButtonText}>Search</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.choiceCancelButton}
              onPress={() => {
                setBrandInputVisible(false)
                setBrandName('')
                setPendingFood(null)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.choiceCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Food List Modal */}
      <Modal
        visible={foodListModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setFoodListModalVisible(false)
          setSearchResults([])
          setPendingFood(null)
        }}
      >
        <View style={styles.searchModalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>
                {pendingFood?.label}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setFoodListModalVisible(false)
                  setSearchResults([])
                  setPendingFood(null)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.searchModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Food List Results */}
            {searchResults.length > 0 && (
              <ScrollView style={styles.searchResultsContainer}>
                {searchResults.map((food) => (
                  <TouchableOpacity
                    key={food.food_id}
                    style={styles.searchResultItem}
                    onPress={() => handleFoodListItemSelected(food)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.searchResultName}>{food.food_name}</Text>
                    {food.brand_name && (
                      <Text style={styles.searchResultBrand}>{food.brand_name}</Text>
                    )}
                    {food.food_description && (
                      <Text style={styles.searchResultDescription} numberOfLines={2}>
                        {food.food_description}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
  favoritesCountContainer: {
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'center',
  },
  favoritesCountText: {
    fontSize: 16,
    color: '#0369A1',
    fontWeight: '600',
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  mealTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8FBFE',
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  mealTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  searchModalClose: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '300',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#282B34',
    backgroundColor: '#FFFFFF',
  },
  searchSubmitButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchResultItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  searchResultBrand: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  searchResultDescription: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  searchEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  choiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  choiceModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  choiceModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
    marginBottom: 8,
  },
  choiceModalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  choiceButton: {
    backgroundColor: '#F8FBFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FE5858',
  },
  choiceButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  choiceButtonDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  choiceButtonDisabled: {
    opacity: 0.5,
  },
  brandInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#282B34',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  choiceCancelButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  choiceCancelButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '600',
  },
})

