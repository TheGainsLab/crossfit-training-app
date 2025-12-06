import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  Modal,
  Image,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getMealTemplates, logMealTemplate, MealTemplate } from '@/lib/api/mealTemplates'

const mealTypes = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'pre_workout', label: 'Pre-Workout' },
  { value: 'post_workout', label: 'Post-Workout' },
  { value: 'snack', label: 'Snack' },
  { value: 'other', label: 'Other' },
]

const mealTypeLabels: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  pre_workout: 'Pre-Workout',
  post_workout: 'Post-Workout',
  snack: 'Snack',
  other: 'Other',
}

export default function NutritionTab() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)
  const [dailySummary, setDailySummary] = useState<any>(null)
  const [todayLogs, setTodayLogs] = useState<any[]>([])
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [imageRecognitionLoading, setImageRecognitionLoading] = useState(false)
  const [selectedFood, setSelectedFood] = useState<any>(null)
  const [foodDetailsModalOpen, setFoodDetailsModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadDailyData()
      loadMealTemplates()
    }
  }, [userId, refreshKey])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        setUserId((userData as any).id)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDailyData = async () => {
    if (!userId) return

    try {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]

      // Load daily summary
      const { data: summary } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()

      setDailySummary(summary || null)

      // Load today's food entries
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)

      const { data: logs } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', startOfDay.toISOString())
        .lte('logged_at', endOfDay.toISOString())
        .order('logged_at', { ascending: false })

      setTodayLogs(logs || [])
    } catch (error) {
      console.error('Error loading daily data:', error)
    }
  }

  const loadMealTemplates = async () => {
    if (!userId) return

    setTemplatesLoading(true)
    try {
      const templates = await getMealTemplates(userId)
      setMealTemplates(templates)
    } catch (error) {
      console.error('Error loading meal templates:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleLogTemplate = async (templateId: number) => {
    if (!userId) return

    try {
      const result = await logMealTemplate(userId, templateId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to log meal')
      }

      Alert.alert('Success', 'Meal logged successfully!')
      setRefreshKey(prev => prev + 1) // Trigger refresh of daily data
    } catch (error: any) {
      console.error('Error logging template:', error)
      Alert.alert('Error', error.message || 'Failed to log meal')
    }
  }

  const handleImageRecognition = async () => {
    try {
      // On web, only allow file upload (no camera)
      if (Platform.OS === 'web') {
        pickImage('library')
        return
      }

      // On mobile, request permissions and show options
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos of food.')
        return
      }

      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (mediaStatus.status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required to select food photos.')
        return
      }

      // Show action sheet
      Alert.alert(
        'Select Image Source',
        'Choose how you want to add a food photo',
        [
          { text: 'Camera', onPress: () => pickImage('camera') },
          { text: 'Photo Library', onPress: () => pickImage('library') },
          { text: 'Cancel', style: 'cancel' },
        ]
      )
    } catch (error) {
      console.error('Error requesting permissions:', error)
      Alert.alert('Error', 'Failed to request camera permissions')
    }
  }

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      }

      // On web, library picker works as file upload
      const result = source === 'camera' && Platform.OS !== 'web'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options)

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        if (asset.base64) {
          await recognizeFoodFromImage(asset.base64, asset.uri?.endsWith('.png') ? 'png' : 'jpeg')
        } else {
          // Fallback: try to read file as base64 on web
          if (Platform.OS === 'web' && asset.uri) {
            Alert.alert('Error', 'Could not read image. Please try a different image.')
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to pick image')
    }
  }

  const recognizeFoodFromImage = async (base64: string, imageType: string) => {
    if (!userId) return

    setImageRecognitionLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert('Error', 'Please sign in')
        return
      }

      const { data, error: invokeError } = await supabase.functions.invoke('nutrition-image-recognition', {
        body: { imageBase64: base64, imageType },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.success && data?.data?.foods && data.data.foods.length > 0) {
        // Show results and allow user to search for each food
        const foods = data.data.foods
        if (foods.length === 1) {
          // If only one food, automatically search for it
          await searchFoods(foods[0].food_name)
        } else {
          // If multiple foods, show selection
          const foodNames = foods.map((f: any) => f.food_name).join(', ')
          Alert.alert(
            'Foods Identified',
            `Found: ${foodNames}\n\nSearching for the first item...`,
            [{ text: 'OK', onPress: () => searchFoods(foods[0].food_name) }]
          )
        }
      } else {
        Alert.alert('No Food Found', 'Could not identify any food items in the image. Please try again or search manually.')
      }
    } catch (error: any) {
      console.error('Image recognition error:', error)
      Alert.alert('Error', error.message || 'Failed to recognize food in image')
    } finally {
      setImageRecognitionLoading(false)
    }
  }

  const searchFoods = async (query?: string) => {
    const searchTerm = query || searchQuery.trim()
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
        setShowSearch(true)
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

  const handleFoodSelected = (food: any) => {
    setSelectedFood(food)
    setFoodDetailsModalOpen(true)
  }

  const handleFoodLogged = () => {
    setFoodDetailsModalOpen(false)
    setSelectedFood(null)
    setRefreshKey(prev => prev + 1)
    setShowSearch(false)
    setSelectedMealType(null)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleDeleteEntry = async (entryId: number) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this food entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = createClient()
              const { error } = await supabase
                .from('food_entries')
                .delete()
                .eq('id', entryId)

              if (error) throw error
              setRefreshKey(prev => prev + 1)
            } catch (error) {
              console.error('Error deleting entry:', error)
              Alert.alert('Error', 'Failed to delete entry')
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading nutrition...</Text>
      </View>
    )
  }

  if (!userId) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text style={styles.errorText}>Please sign in to access nutrition tracking.</Text>
        </Card>
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
        <Text style={styles.headerTitle}>Nutrition</Text>

        {/* Daily Summary Card */}
        <DailySummaryCard summary={dailySummary} />

        {/* Quick Log - Meal Templates */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>⭐ Quick Log</Text>
          {templatesLoading ? (
            <ActivityIndicator size="small" color="#FE5858" />
          ) : mealTemplates.length === 0 ? (
            <View style={styles.emptyTemplatesContainer}>
              <Text style={styles.emptyTemplatesText}>
                Set up your favorite meals for one-tap logging!
              </Text>
              <Text style={styles.emptyTemplatesSubtext}>
                Most people eat the same things regularly. Add 3-5 meals and log your day in seconds.
              </Text>
              <TouchableOpacity
                style={styles.emptyTemplatesButton}
                onPress={() => router.push('/profile')}
              >
                <Text style={styles.emptyTemplatesButtonText}>Set Up My Meals</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.templatesList}>
              {mealTemplates.map((template) => (
                <View key={template.id} style={styles.templateItem}>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>
                      {template.meal_type === 'breakfast' ? '☀️' : 
                       template.meal_type === 'lunch' ? '🌮' : 
                       template.meal_type === 'dinner' ? '🍽️' : 
                       template.meal_type === 'pre_workout' ? '💪' :
                       template.meal_type === 'post_workout' ? '🥤' : '🍎'}{' '}
                      {template.template_name}
                    </Text>
                    <Text style={styles.templateDetails}>
                      {Math.round(template.total_calories)} cal • {Math.round(template.total_protein)}g protein
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.logTemplateButton}
                    onPress={() => handleLogTemplate(template.id!)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.logTemplateButtonText}>Log</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Something Else - Photo/Search */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>📸 Something Else?</Text>
          <View style={styles.alternativeButtonsRow}>
            <TouchableOpacity
              style={styles.alternativeButton}
              onPress={handleImageRecognition}
              disabled={imageRecognitionLoading}
              activeOpacity={0.8}
            >
              {imageRecognitionLoading ? (
                <ActivityIndicator size="small" color="#FE5858" />
              ) : (
                <Text style={styles.alternativeButtonText}>📷 Take Photo</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alternativeButton}
              onPress={() => setShowSearch(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.alternativeButtonText}>🔍 Search</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Meal Type Selection */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Select Meal Type</Text>
          <View style={styles.mealTypeContainer}>
            {mealTypes.map((meal) => (
              <TouchableOpacity
                key={meal.value}
                onPress={() => {
                  setSelectedMealType(meal.value)
                  setShowSearch(true)
                }}
                style={[
                  styles.mealTypeButton,
                  selectedMealType === meal.value && styles.mealTypeButtonActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.mealTypeButtonText,
                    selectedMealType === meal.value && styles.mealTypeButtonTextActive,
                  ]}
                >
                  {meal.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Food Search */}
        {showSearch && (
          <Card style={styles.card}>
            <View style={styles.searchHeader}>
              <Text style={styles.sectionTitle}>
                Search Foods
                {selectedMealType && (
                  <Text style={styles.mealTypeHint}> ({mealTypeLabels[selectedMealType]})</Text>
                )}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSearch(false)
                  setSelectedMealType(null)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for food..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => searchFoods()}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => searchFoods()}
                disabled={searchLoading}
                activeOpacity={0.8}
              >
                {searchLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                {searchResults.map((food) => (
                  <TouchableOpacity
                    key={food.food_id}
                    style={styles.foodResultItem}
                    onPress={() => handleFoodSelected(food)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.foodResultName}>{food.food_name}</Text>
                    {food.brand_name && (
                      <Text style={styles.foodResultBrand}>{food.brand_name}</Text>
                    )}
                    {food.food_description && (
                      <Text style={styles.foodResultDescription} numberOfLines={2}>
                        {food.food_description}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* Today's Food Log */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Today's Food Log</Text>
          <FoodLogList logs={todayLogs} onDelete={handleDeleteEntry} />
        </Card>
      </ScrollView>

      {/* Food Details Modal */}
      {selectedFood && (
        <FoodDetailsModal
          food={selectedFood}
          open={foodDetailsModalOpen}
          onClose={() => {
            setFoodDetailsModalOpen(false)
            setSelectedFood(null)
          }}
          onLogged={handleFoodLogged}
          userId={userId}
          preselectedMealType={selectedMealType}
        />
      )}
    </View>
  )
}

// Daily Summary Card Component
function DailySummaryCard({ summary }: { summary: any }) {
  if (!summary) {
    return (
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <Text style={styles.emptyText}>No data for today yet. Log some foods to get started!</Text>
      </Card>
    )
  }

  const calories = summary.total_calories || 0
  const protein = summary.total_protein || 0
  const carbs = summary.total_carbohydrate || 0
  const fat = summary.total_fat || 0
  const surplusDeficit = summary.surplus_deficit || 0
  const tdee = summary.tdee_estimate || 0

  const percentageOfTDEE = tdee > 0 ? Math.round((calories / tdee) * 100) : 0

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>Today's Summary</Text>
      
      {/* TDEE Progress Bar */}
      {tdee > 0 && (
        <View style={styles.tdeeProgressContainer}>
          <View style={styles.tdeeProgressHeader}>
            <Text style={styles.tdeeProgressLabel}>Daily Target: {Math.round(tdee)} cal</Text>
            <Text style={styles.tdeeProgressPercentage}>{percentageOfTDEE}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${Math.min(percentageOfTDEE, 100)}%` }]} />
          </View>
          <Text style={styles.tdeeProgressSubtext}>
            {Math.round(calories)} cal logged
            {percentageOfTDEE < 100 && ` • ${Math.round(tdee - calories)} cal remaining`}
          </Text>
        </View>
      )}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Calories</Text>
          <Text style={styles.summaryValue}>{Math.round(calories)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Protein</Text>
          <Text style={styles.summaryValue}>{Math.round(protein)}g</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Carbs</Text>
          <Text style={styles.summaryValue}>{Math.round(carbs)}g</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Fat</Text>
          <Text style={styles.summaryValue}>{Math.round(fat)}g</Text>
        </View>
      </View>
      {summary.tdee_estimate && (
        <View style={styles.tdeeContainer}>
          <View style={styles.tdeeRow}>
            <Text style={styles.tdeeLabel}>TDEE Estimate</Text>
            <Text style={styles.tdeeValue}>{Math.round(summary.tdee_estimate)} kcal</Text>
          </View>
          {surplusDeficit !== 0 && (
            <View style={styles.tdeeRow}>
              <Text style={styles.tdeeLabel}>Surplus/Deficit</Text>
              <Text style={[styles.tdeeValue, surplusDeficit > 0 ? styles.surplus : styles.deficit]}>
                {surplusDeficit > 0 ? '+' : ''}{Math.round(surplusDeficit)} kcal
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  )
}

// Food Log List Component
function FoodLogList({ logs, onDelete }: { logs: any[]; onDelete: (id: number) => void }) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all')

  const filteredLogs = selectedFilter === 'all'
    ? logs
    : logs.filter(log => (log.meal_type || 'other') === selectedFilter)

  const grouped = filteredLogs.reduce((acc, log) => {
    const mealType = log.meal_type || 'other'
    if (!acc[mealType]) acc[mealType] = []
    acc[mealType].push(log)
    return acc
  }, {} as Record<string, any[]>)

  if (logs.length === 0) {
    return (
      <Text style={styles.emptyText}>
        No foods logged today. Search and log foods above to get started!
      </Text>
    )
  }

  const mealTypes = ['all', 'breakfast', 'lunch', 'dinner', 'pre_workout', 'post_workout', 'snack', 'other']

  return (
    <View style={styles.logListContainer}>
      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
      >
        {mealTypes.map((mealType) => (
          <TouchableOpacity
            key={mealType}
            onPress={() => setSelectedFilter(mealType)}
            style={[
              styles.filterButton,
              selectedFilter === mealType && styles.filterButtonActive,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === mealType && styles.filterButtonTextActive,
              ]}
            >
              {mealType === 'all' ? 'All' : mealTypeLabels[mealType] || mealType}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtered Results */}
      {filteredLogs.length === 0 ? (
        <Text style={styles.emptyText}>No foods found for this filter.</Text>
      ) : (
        <View style={styles.logGroupsContainer}>
          {Object.entries(grouped).map(([mealType, mealLogs]) => {
            const typedMealLogs = mealLogs as any[]
            return (
              <View key={mealType} style={styles.logGroup}>
                <Text style={styles.logGroupTitle}>
                  {mealTypeLabels[mealType] || mealType}
                </Text>
                {typedMealLogs.map((log: any) => (
                <View key={log.id} style={styles.logItem}>
                  <View style={styles.logItemContent}>
                    <Text style={styles.logItemName}>{log.food_name}</Text>
                    <Text style={styles.logItemDetails}>
                      {log.serving_description && `${log.number_of_units} × ${log.serving_description}`}
                      {log.calories && ` • ${Math.round(log.calories)} kcal`}
                      {log.protein && ` • ${Math.round(log.protein)}g protein`}
                    </Text>
                    <Text style={styles.logItemTime}>
                      {new Date(log.logged_at).toLocaleTimeString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onDelete(log.id)}
                    style={styles.deleteButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

// Food Details Modal Component
function FoodDetailsModal({
  food,
  open,
  onClose,
  onLogged,
  userId,
  preselectedMealType,
}: {
  food: any
  open: boolean
  onClose: () => void
  onLogged: () => void
  userId: number
  preselectedMealType?: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [foodDetails, setFoodDetails] = useState<any>(null)
  const [selectedServing, setSelectedServing] = useState<any>(null)
  const [quantity, setQuantity] = useState('1')
  const [mealType, setMealType] = useState<string>('other')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && food?.food_id) {
      loadFoodDetails()
      // Set meal type based on preselected or time of day
      if (preselectedMealType) {
        setMealType(preselectedMealType)
      } else {
        const hour = new Date().getHours()
        if (hour < 11) {
          setMealType('breakfast')
        } else if (hour < 16) {
          setMealType('lunch')
        } else {
          setMealType('dinner')
        }
      }
    }
  }, [open, food?.food_id, preselectedMealType])

  const loadFoodDetails = async () => {
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
        body: { foodId: food.food_id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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

        setFoodDetails({ ...foodData, servings })
        
        // Set default serving
        const defaultServing = servings.find((s: any) => s.is_default === '1') || servings[0]
        if (defaultServing) {
          setSelectedServing(defaultServing)
        }
      }
    } catch (err: any) {
      console.error('Load food details error:', err)
      setError(err.message || 'Failed to load food details')
    } finally {
      setLoading(false)
    }
  }

  const handleLogFood = async () => {
    if (!selectedServing || !foodDetails) return

    const quantityNum = parseFloat(quantity) || 1
    if (quantityNum <= 0) {
      Alert.alert('Error', 'Quantity must be greater than 0')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Calculate nutrition for the quantity
      const calories = parseFloat(selectedServing.calories || '0') * quantityNum
      const protein = parseFloat(selectedServing.protein || '0') * quantityNum
      const carbohydrate = parseFloat(selectedServing.carbohydrate || '0') * quantityNum
      const fat = parseFloat(selectedServing.fat || '0') * quantityNum
      const fiber = parseFloat(selectedServing.fiber || '0') * quantityNum
      const sugar = parseFloat(selectedServing.sugar || '0') * quantityNum
      const sodium = parseFloat(selectedServing.sodium || '0') * quantityNum

      const { error } = await (supabase
        .from('food_entries') as any)
        .insert({
          user_id: userId,
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
          meal_type: mealType,
        })

      if (error) throw error

      onLogged()
    } catch (err: any) {
      console.error('Log food error:', err)
      setError(err.message || 'Failed to log food')
      Alert.alert('Error', err.message || 'Failed to log food')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      visible={open}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{food?.food_name}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading && !foodDetails ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#FE5858" />
              <Text style={styles.modalLoadingText}>Loading food details...</Text>
            </View>
          ) : error ? (
            <View style={styles.modalError}>
              <Text style={styles.modalErrorText}>{error}</Text>
            </View>
          ) : foodDetails ? (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {/* Serving Selection */}
              {foodDetails.servings && foodDetails.servings.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Serving Size</Text>
                  {foodDetails.servings.map((serving: any) => (
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
                <TextInput
                  style={styles.quantityInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="1"
                />
              </View>

              {/* Meal Type Selection */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Meal Type</Text>
                <View style={styles.mealTypeContainer}>
                  {mealTypes.map((meal) => (
                    <TouchableOpacity
                      key={meal.value}
                      onPress={() => setMealType(meal.value)}
                      style={[
                        styles.mealTypeButton,
                        mealType === meal.value && styles.mealTypeButtonActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.mealTypeButtonText,
                          mealType === meal.value && styles.mealTypeButtonTextActive,
                        ]}
                      >
                        {meal.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Nutrition Info Preview */}
              {selectedServing && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Nutrition (per serving)</Text>
                  <View style={styles.nutritionPreview}>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Calories:</Text>
                      <Text style={styles.nutritionValue}>{selectedServing.calories || '0'}</Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Protein:</Text>
                      <Text style={styles.nutritionValue}>{selectedServing.protein || '0'}g</Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Carbs:</Text>
                      <Text style={styles.nutritionValue}>{selectedServing.carbohydrate || '0'}g</Text>
                    </View>
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionLabel}>Fat:</Text>
                      <Text style={styles.nutritionValue}>{selectedServing.fat || '0'}g</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Log Button */}
              <TouchableOpacity
                style={[styles.logButton, loading && styles.logButtonDisabled]}
                onPress={handleLogFood}
                disabled={loading || !selectedServing}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.logButtonText}>Log Food</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#282B34',
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    padding: 20,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 16,
  },
  mealTypeHint: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  imageRecognitionButton: {
    backgroundColor: '#FE5858',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  imageRecognitionIcon: {
    fontSize: 24,
  },
  imageRecognitionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8FBFE',
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  mealTypeButtonActive: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  mealTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  mealTypeButtonTextActive: {
    color: '#FFFFFF',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clearButton: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  searchButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    gap: 8,
  },
  foodResultItem: {
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  foodResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  foodResultBrand: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  foodResultDescription: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    width: '48%',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#282B34',
  },
  tdeeContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tdeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tdeeLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  tdeeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  surplus: {
    color: '#10B981',
  },
  deficit: {
    color: '#EF4444',
  },
  logListContainer: {
    marginTop: 8,
  },
  filterContainer: {
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FBFE',
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  filterButtonActive: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  logGroupsContainer: {
    gap: 16,
  },
  logGroup: {
    marginTop: 8,
  },
  logGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  logItemContent: {
    flex: 1,
  },
  logItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  logItemDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  logItemTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
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
  },
  modalBody: {
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
  quantityInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
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
  logButton: {
    backgroundColor: '#FE5858',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logButtonDisabled: {
    opacity: 0.5,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Quick Log - Meal Templates
  templatesList: {
    gap: 12,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  templateDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  logTemplateButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  logTemplateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Alternative buttons (Photo/Search)
  alternativeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  alternativeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  alternativeButtonText: {
    fontSize: 14,
    color: '#282B34',
    fontWeight: '600',
  },
  // TDEE Progress
  tdeeProgressContainer: {
    marginBottom: 20,
  },
  tdeeProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tdeeProgressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  tdeeProgressPercentage: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FE5858',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FE5858',
    borderRadius: 4,
  },
  tdeeProgressSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  // Empty Templates State
  emptyTemplatesContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTemplatesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyTemplatesSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  emptyTemplatesButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyTemplatesButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
})
