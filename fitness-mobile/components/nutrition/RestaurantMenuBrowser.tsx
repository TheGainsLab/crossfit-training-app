import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import PortionAdjustInput from './PortionAdjustInput'

interface Restaurant {
  id: number
  restaurant_name: string
  fatsecret_brand_filter?: string
  favorites_count: number
}

interface RestaurantMenuBrowserProps {
  restaurant: Restaurant
  onBack: () => void
  onFoodLogged?: () => void
}

export default function RestaurantMenuBrowser({
  restaurant,
  onBack,
  onFoodLogged,
}: RestaurantMenuBrowserProps) {
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [savedItems, setSavedItems] = useState<any[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [selectedFood, setSelectedFood] = useState<any>(null)
  const [showPortionInput, setShowPortionInput] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadSavedItems()
  }, [])

  const loadSavedItems = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('food_favorites')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('log_count', { ascending: false })

      if (error) throw error
      setSavedItems(data || [])
    } catch (error) {
      console.error('Error loading saved items:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchMenu = async (query: string) => {
    if (!query.trim()) {
      setMenuItems([])
      return
    }

    try {
      setSearching(true)
      
      // Combine brand name with search query for better FatSecret results
      const brandName = restaurant.fatsecret_brand_filter || restaurant.restaurant_name
      const searchQuery = `${brandName} ${query.trim()}`
      
      const { data, error } = await supabase.functions.invoke('nutrition-search', {
        body: {
          query: searchQuery,
          filterType: 'brand',
          brandName: brandName,
          maxResults: 50, // FatSecret maximum allowed
        },
      })

      if (error) throw error
      setMenuItems(data?.data?.foods || [])
    } catch (error) {
      console.error('Error searching menu:', error)
      Alert.alert('Error', 'Failed to search menu')
    } finally {
      setSearching(false)
    }
  }

  const handleFoodSelect = async (foodItem: any) => {
    try {
      // Get full food details with normalization attempt
      const { data, error } = await supabase.functions.invoke('nutrition-food', {
        body: {
          foodId: foodItem.food_id,
          normalize: true,
        },
      })

      if (error) throw error
      
      const foodData = data?.data?.food
      if (!foodData) {
        Alert.alert('Error', 'Could not load food details')
        return
      }

      // Prepare food object for portion input
      setSelectedFood({
        name: foodData.food_name,
        brand_name: foodData.brand_name,
        fatsecret_id: foodItem.food_id,
        normalized_nutrition: foodData.normalized_nutrition,
        raw_serving: !foodData.normalized_nutrition && foodData.servings?.serving?.[0] ? {
          calories: parseFloat(foodData.servings.serving[0].calories || 0),
          protein: parseFloat(foodData.servings.serving[0].protein || 0),
          carbohydrate: parseFloat(foodData.servings.serving[0].carbohydrate || 0),
          fat: parseFloat(foodData.servings.serving[0].fat || 0),
          serving_description: foodData.servings.serving[0].serving_description,
        } : null,
        servings: foodData.servings?.serving || [],
      })
      setShowPortionInput(true)
    } catch (error) {
      console.error('Error loading food:', error)
      Alert.alert('Error', 'Failed to load food details')
    }
  }

  const calculateMacros = (amount: number, unit: string) => {
    const GRAMS_PER_OZ = 28.35
    let macros = {
      calories: 0,
      protein: 0,
      carbohydrate: 0,
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
        carbohydrate: Math.round(n.carbs_per_gram * grams * 10) / 10,
        fat: Math.round(n.fat_per_gram * grams * 10) / 10,
        fiber: n.fiber_per_gram ? Math.round(n.fiber_per_gram * grams * 10) / 10 : 0,
        sodium: n.sodium_per_gram ? Math.round(n.sodium_per_gram * grams) : 0,
      }
    } else if (selectedFood.raw_serving) {
      macros = {
        calories: Math.round(selectedFood.raw_serving.calories * amount),
        protein: Math.round(selectedFood.raw_serving.protein * amount * 10) / 10,
        carbohydrate: Math.round(selectedFood.raw_serving.carbohydrate * amount * 10) / 10,
        fat: Math.round(selectedFood.raw_serving.fat * amount * 10) / 10,
        fiber: 0,
        sodium: 0,
      }
    }

    return macros
  }

  const handleLogNow = async (amount: number, unit: string) => {
    try {
      const macros = calculateMacros(amount, unit)
      
      const { error } = await supabase.functions.invoke('food-log', {
        body: {
          food_id: selectedFood.fatsecret_id,
          food_name: selectedFood.name,
          serving_id: selectedFood.servings?.[0]?.serving_id || '0',
          serving_description: `${amount} ${unit}`,
          number_of_units: amount,
          ...macros,
          source: 'restaurant',
        },
      })

      if (error) throw error
      
      Alert.alert('Success', 'Meal logged!')
      setShowPortionInput(false)
      setSelectedFood(null)
      if (onFoodLogged) onFoodLogged()
    } catch (error) {
      console.error('Error logging food:', error)
      Alert.alert('Error', 'Failed to log meal')
    }
  }

  const handleSaveOnly = async (amount: number, unit: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('favorites-manage', {
        body: {
          action: 'add_food',
          food_id: selectedFood.fatsecret_id,
          food_name: selectedFood.name,
          food_type: 'restaurant',
          brand_name: selectedFood.brand_name,
          restaurant_id: restaurant.id,
          default_amount: amount,
          default_unit: unit,
          calories_per_gram: selectedFood.normalized_nutrition?.calories_per_gram,
          protein_per_gram: selectedFood.normalized_nutrition?.protein_per_gram,
          carbs_per_gram: selectedFood.normalized_nutrition?.carbs_per_gram,
          fat_per_gram: selectedFood.normalized_nutrition?.fat_per_gram,
          raw_serving_calories: selectedFood.raw_serving?.calories,
          raw_serving_protein: selectedFood.raw_serving?.protein,
          raw_serving_carbs: selectedFood.raw_serving?.carbohydrate,
          raw_serving_fat: selectedFood.raw_serving?.fat,
          serving_description: selectedFood.raw_serving?.serving_description,
        },
      })

      if (error) throw error
      
      Alert.alert('Success', 'Added to Frequent Foods')
      setShowPortionInput(false)
      setSelectedFood(null)
      loadSavedItems()
    } catch (error) {
      console.error('Error saving favorite:', error)
      Alert.alert('Error', 'Failed to save to favorites')
    }
  }

  const handleLogAndSave = async (amount: number, unit: string) => {
    try {
      const macros = calculateMacros(amount, unit)
      
      // First, log the food
      const { error: logError } = await supabase.functions.invoke('food-log', {
        body: {
          food_id: selectedFood.fatsecret_id,
          food_name: selectedFood.name,
          serving_id: selectedFood.servings?.[0]?.serving_id || '0',
          serving_description: `${amount} ${unit}`,
          number_of_units: amount,
          ...macros,
          source: 'restaurant',
        },
      })

      if (logError) throw logError

      // Then, save to favorites
      const { error: saveError } = await supabase.functions.invoke('favorites-manage', {
        body: {
          action: 'add_food',
          food_id: selectedFood.fatsecret_id,
          food_name: selectedFood.name,
          food_type: 'restaurant',
          brand_name: selectedFood.brand_name,
          restaurant_id: restaurant.id,
          default_amount: amount,
          default_unit: unit,
          calories_per_gram: selectedFood.normalized_nutrition?.calories_per_gram,
          protein_per_gram: selectedFood.normalized_nutrition?.protein_per_gram,
          carbs_per_gram: selectedFood.normalized_nutrition?.carbs_per_gram,
          fat_per_gram: selectedFood.normalized_nutrition?.fat_per_gram,
          raw_serving_calories: selectedFood.raw_serving?.calories,
          raw_serving_protein: selectedFood.raw_serving?.protein,
          raw_serving_carbs: selectedFood.raw_serving?.carbohydrate,
          raw_serving_fat: selectedFood.raw_serving?.fat,
          serving_description: selectedFood.raw_serving?.serving_description,
        },
      })

      if (saveError) throw saveError
      
      Alert.alert('Success', 'Meal logged and saved to Frequent Foods!')
      setShowPortionInput(false)
      setSelectedFood(null)
      loadSavedItems()
      if (onFoodLogged) onFoodLogged()
    } catch (error) {
      console.error('Error logging and saving food:', error)
      Alert.alert('Error', 'Failed to log and save meal')
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
      </View>
    )
  }

  if (showPortionInput && selectedFood) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowPortionInput(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#282B34" />
          </TouchableOpacity>
          <Text style={styles.title}>{restaurant.restaurant_name}</Text>
        </View>
        
        <Card>
          <PortionAdjustInput
            food={selectedFood}
            defaultAmount={1}
            defaultUnit={selectedFood.normalized_nutrition ? 'oz' : 'serving'}
            showGridButtons
            onLogNow={handleLogNow}
            onSaveOnly={handleSaveOnly}
            onLogAndSave={handleLogAndSave}
            onCancel={() => {
              setShowPortionInput(false)
              setSelectedFood(null)
            }}
          />
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#282B34" />
        </TouchableOpacity>
        <Text style={styles.title}>{restaurant.restaurant_name}</Text>
      </View>

      {/* Saved items */}
      {savedItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Favorites</Text>
          <View style={styles.itemsList}>
            {savedItems.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <TouchableOpacity onPress={() => {
                  setSelectedFood({
                    name: item.food_name,
                    brand_name: item.brand_name,
                    fatsecret_id: item.food_id,
                    normalized_nutrition: item.calories_per_gram ? {
                      calories_per_gram: item.calories_per_gram,
                      protein_per_gram: item.protein_per_gram,
                      carbs_per_gram: item.carbs_per_gram,
                      fat_per_gram: item.fat_per_gram,
                    } : null,
                    raw_serving: item.raw_serving_calories ? {
                      calories: item.raw_serving_calories,
                      protein: item.raw_serving_protein,
                      carbohydrate: item.raw_serving_carbs,
                      fat: item.raw_serving_fat,
                      serving_description: item.serving_description,
                    } : null,
                    servings: item.serving_id ? [{ serving_id: item.serving_id }] : [],
                  })
                  setShowPortionInput(true)
                }}>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemName}>{item.food_name}</Text>
                    <Text style={styles.itemDefault}>
                      {item.default_amount} {item.default_unit}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* Browse menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse Menu</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${restaurant.restaurant_name} menu...`}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text)
              searchMenu(text)
            }}
          />
        </View>

        {searching && <ActivityIndicator style={{ marginTop: 16 }} />}

        {menuItems.length > 0 && (
          <View style={styles.itemsList}>
            {menuItems.map((item, index) => (
              <Card key={index} style={styles.itemCard}>
                <TouchableOpacity onPress={() => handleFoodSelect(item)}>
                  <Text style={styles.itemName}>{item.food_name}</Text>
                  {item.brand_name && (
                    <Text style={styles.itemBrand}>{item.brand_name}</Text>
                  )}
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        )}

        {searchQuery && !searching && menuItems.length === 0 && (
          <Text style={styles.noResults}>No items found</Text>
        )}
      </View>
    </ScrollView>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
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
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  itemsList: {
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
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemBrand: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  itemDefault: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 8,
  },
  noResults: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
  },
})






