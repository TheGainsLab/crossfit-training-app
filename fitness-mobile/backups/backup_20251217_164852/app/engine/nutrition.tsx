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
  Platform,
  TextInput,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { getMealTemplates, logMealTemplate, MealTemplate, deleteMealTemplate, getMealTemplateWithItems, createMealTemplate } from '@/lib/api/mealTemplates'
import MealBuilder from '@/components/nutrition/MealBuilder'
import FoodSelectionModal from '@/components/nutrition/FoodSelectionModal'
import FoodSearchModal from '@/components/nutrition/FoodSearchModal'

// TypeScript interfaces
interface FoodEntry {
  id: number
  user_id: number
  food_id: string
  food_name: string
  serving_id: string
  serving_description: string | null
  number_of_units: number
  calories: number | null
  protein: number | null
  carbohydrate: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  sodium: number | null
  meal_type: string | null
  notes: string | null
  logged_at: string
  created_at: string
  updated_at: string
}

interface DailySummary {
  id: number
  user_id: number
  date: string
  total_calories: number | null
  total_protein: number | null
  total_carbohydrate: number | null
  total_fat: number | null
  total_fiber: number | null
  total_sugar: number | null
  total_sodium: number | null
  tdee_estimate: number | null
  bmr_estimate: number | null
  bmr?: number | null
  tdee?: number | null
  surplus_deficit: number | null
  exercise_calories_burned: number | null
  adjusted_tdee: number | null
  net_calories: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface ProfileData {
  profile_data: {
    bmr?: number | null
    user_summary?: {
      bmr?: number | null
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface UserProfile {
  id: number
  user_id: number
  profile_data: {
    bmr?: number | null
    user_summary?: {
      bmr?: number | null
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  generated_at: string
  [key: string]: unknown
}

// Food object from various sources (image recognition, barcode, search)
interface FoodSelection {
  food_id?: string
  food_name?: string
  _completeNutritionData?: {
    entry_data?: {
      food_id?: string
      food_name?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

// Image recognition API response structure
interface ImageRecognitionFood {
  found: boolean
  entry_data: {
    food_id: string
    food_name: string
    [key: string]: unknown
  }
  cache_data?: {
    nutrition_data?: unknown
    [key: string]: unknown
  }
  matched_serving?: unknown
  available_servings?: unknown[]
  alternatives?: unknown[]
  [key: string]: unknown
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', emoji: '☀️' },
  { value: 'lunch', label: 'Lunch', emoji: '🌮' },
  { value: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { value: 'pre_workout', label: 'Pre-Workout', emoji: '💪' },
  { value: 'post_workout', label: 'Post-Workout', emoji: '🥤' },
  { value: 'snack', label: 'Snack', emoji: '🍎' },
  { value: 'other', label: 'Other', emoji: '🍽️' },
]

export default function NutritionTab() {
  const params = useLocalSearchParams()

  // Core state
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)

  // Favorite builder state
  const [showMealBuilder, setShowMealBuilder] = useState(false)
  const [currentMeal, setCurrentMeal] = useState<MealTemplate | null>(null)
  const [favoritesExpanded, setFavoritesExpanded] = useState(false)

  // Data
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [todayLogs, setTodayLogs] = useState<FoodEntry[]>([])
  const [bmr, setBmr] = useState<number | null>(null)

  // UI state
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null)
  const [showFoodSelector, setShowFoodSelector] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [selectedFoodForDetails, setSelectedFoodForDetails] = useState<{foodId: string | null, foodName: string | null}>({ foodId: null, foodName: null })
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false)
  const [barcodeScanning, setBarcodeScanning] = useState(false)
  const [imageRecognitionLoading, setImageRecognitionLoading] = useState(false)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    visible: boolean
    entryId: number | null
    entryName: string | null
  }>({ visible: false, entryId: null, entryName: null })
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{
    visible: boolean
    templateId: number | null
    templateName: string | null
  }>({ visible: false, templateId: null, templateName: null })

  // Search and food queue state
  const [foodQueue, setFoodQueue] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Camera and permissions
  const [permission, requestPermission] = useCameraPermissions()

  // Load user and handle URL parameters
  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadDailyData()
      loadMealTemplates()
    }
  }, [userId])

  // Refresh data when refreshKey changes
  useEffect(() => {
    if (userId && refreshKey > 0) {
      loadDailyData()
    }
  }, [refreshKey, userId])

  // Handle navigation from profile/other tabs
  useEffect(() => {
    // Handle deep links for editing templates
    if (params.editTemplate) {
      const templateId = parseInt(params.editTemplate as string)
      const template = mealTemplates.find(t => t.id === templateId)
      if (template) {
        setCurrentMeal(template)
        setShowMealBuilder(true)
      }
    }
  }, [params, mealTemplates])

  const handleMealTypeSelect = (mealType: string) => {
    console.log('🍽️ Meal type selected:', mealType)
    setSelectedMealType(mealType)
    console.log('✅ Meal type set to:', mealType)
  }

  const handleLogTemplate = async (templateId: number) => {
    console.log('📝 Log template clicked:', templateId)
    if (!userId) {
      console.log('❌ No userId, aborting')
      return
    }

    if (!selectedMealType) {
      Alert.alert('Error', 'Please select a meal type first')
      return
    }

    try {
      console.log('🔄 Logging template...')
      const result = await logMealTemplate(userId, templateId, selectedMealType)
      if (!result.success) {
        throw new Error(result.error || 'Failed to log meal')
      }

      console.log('✅ Template logged successfully')
      Alert.alert('Success', 'Meal logged successfully!')
      // Refresh daily data
      await loadDailyData()
    } catch (error) {
      console.error('❌ Error logging template:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to log meal'
      Alert.alert('Error', errorMessage)
    }
  }

  const handleEditTemplate = async (templateId: number) => {
    try {
      // Fetch the complete template with items
      const fullTemplate = await getMealTemplateWithItems(templateId)
      if (fullTemplate) {
        setCurrentMeal(fullTemplate)
        setShowMealBuilder(true)
      } else {
        Alert.alert('Error', 'Could not load favorite for editing')
      }
    } catch (error) {
      console.error('Error loading template for edit:', error)
      Alert.alert('Error', 'Failed to load favorite for editing')
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    const template = mealTemplates.find(t => t.id === templateId)
    if (!template) return
    
    setDeleteTemplateModal({
      visible: true,
      templateId: templateId,
      templateName: template.template_name
    })
  }

  const executeDeleteTemplate = async (templateId: number) => {
    try {
      const { success, error } = await deleteMealTemplate(templateId)
      if (success) {
        await loadMealTemplates()
      } else {
        Alert.alert('Error', error || 'Failed to delete favorite')
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete favorite')
    }
  }

  const handleDuplicateTemplate = async (templateId: number) => {
    try {
      // Fetch the complete template with items
      const fullTemplate = await getMealTemplateWithItems(templateId)
      if (!fullTemplate || !fullTemplate.items || fullTemplate.items.length === 0) {
        Alert.alert('Error', 'Could not load meal for duplicating')
        return
      }

      // Create a duplicate with a new name
      const duplicateName = `${fullTemplate.template_name} Copy`
      const items = fullTemplate.items.map(item => ({
        food_id: item.food_id,
        food_name: item.food_name,
        serving_id: item.serving_id || '',
        serving_description: item.serving_description || undefined,
        number_of_units: item.number_of_units,
        calories: item.calories,
        protein: item.protein,
        carbohydrate: item.carbohydrate,
        fat: item.fat,
        fiber: item.fiber || 0,
        sugar: item.sugar || 0,
        sodium: item.sodium || 0,
        sort_order: item.sort_order,
      }))

      if (!userId) {
        Alert.alert('Error', 'Please sign in to duplicate meals')
        return
      }

      const { success, error } = await createMealTemplate(
        userId,
        duplicateName,
        null, // Favorites don't need a meal type
        items
      )

      if (success) {
        await loadMealTemplates()
        // Open the duplicated template for editing
        const updatedTemplates = await getMealTemplates(userId)
        const newTemplate = updatedTemplates.find(t => t.template_name === duplicateName)
        if (newTemplate) {
          const fullNewTemplate = await getMealTemplateWithItems(newTemplate.id!)
          if (fullNewTemplate) {
            setCurrentMeal(fullNewTemplate)
            setShowMealBuilder(true) // Opens builder for editing
          }
        }
      } else {
        Alert.alert('Error', error || 'Failed to duplicate meal')
      }
    } catch (error) {
      console.error('Error duplicating template:', error)
      Alert.alert('Error', 'Failed to duplicate meal')
    }
  }

  const handleTemplateSaved = (updatedTemplate: MealTemplate) => {
    loadMealTemplates() // Refresh templates list
    setShowMealBuilder(false) // Close builder modal
    setCurrentMeal(null)
  }

  const handleAddFood = () => {
    setShowFoodSelector(true)
  }

  const handleFoodSelected = (food: FoodSelection) => {
    // Extract food_id and food_name from food object
    // Handle different formats from image recognition, barcode, etc.
    const foodId = food.food_id || food._completeNutritionData?.entry_data?.food_id
    const foodName = food.food_name || food._completeNutritionData?.entry_data?.food_name
    
    if (!foodId || !foodName) {
      console.error('Invalid food object:', food)
      Alert.alert('Error', 'Invalid food data')
      return
    }

    // Use the same flow as search - set selectedFoodForDetails and open FoodSelectionModal
    setSelectedFoodForDetails({ foodId, foodName })
    setShowFoodSelector(true)
  }

  // Process next food in queue
  const processNextFoodInQueue = () => {
    if (foodQueue.length > 0) {
      const nextFood = foodQueue[0]
      setFoodQueue(prev => prev.slice(1)) // Remove first item from queue
      handleFoodSelected(nextFood)
    } else {
      // All foods processed, return to main screen
      setShowFoodSelector(false)
      setSelectedFoodForDetails({ foodId: null, foodName: null })
      setRefreshKey(prev => prev + 1)
      setShowSearch(false)
      setSelectedMealType(null)
      setSearchQuery('')
      setSearchResults([])
    }
  }

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
        .select('id, height, age')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        setUserId((userData as any).id)
        
        // Fetch profile data to calculate BMR
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('profile_data')
          .eq('user_id', (userData as any).id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Type assertion to fix TypeScript inference issue
        const typedProfileData = profileData as UserProfile | null

        if (typedProfileData?.profile_data) {
          const profile = typedProfileData.profile_data

          // Read stored BMR from profile data
          const storedBmr = profile.bmr || profile.user_summary?.bmr
          if (storedBmr) {
            setBmr(Math.round(storedBmr))
          }
        }
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
      console.log('Loaded templates:', templates)
      console.log('First template sample:', templates[0])
      setMealTemplates(templates)
    } catch (error) {
      console.error('Error loading meal templates:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleImageRecognition = async () => {
    console.log('📷 Take photo clicked')
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

      const { data, error: invokeError } = await supabase.functions.invoke('nutrition-image-complete', {
        body: { imageBase64: base64, imageType },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.success && data?.data?.foods && data.data.foods.length > 0) {
        const foods = data.data.foods as ImageRecognitionFood[]
        const foundFoods = foods.filter((f) => f.found)
        
        if (foundFoods.length === 0) {
          Alert.alert('No Food Found', 'Could not find matching foods in the database. Please try again or search manually.')
          return
        }

        // Transform all found foods for selection
        const foodsForModal: FoodSelection[] = foundFoods.map((foodResult) => ({
          food_id: foodResult.entry_data.food_id,
          food_name: foodResult.entry_data.food_name,
          _completeNutritionData: {
            food: foodResult.cache_data?.nutrition_data,
            entry_data: foodResult.entry_data,
            matched_serving: foodResult.matched_serving,
            available_servings: foodResult.available_servings,
            alternatives: foodResult.alternatives,
          }
        }))

        if (foodsForModal.length === 1) {
          // Single food found - show it directly
          handleFoodSelected(foodsForModal[0])
        } else {
          // Multiple foods found - queue them all and show first one
          const foodNames = foodsForModal.map((f) => f.food_name).join(', ')
          Alert.alert(
            'Foods Identified',
            `Found ${foodsForModal.length} items: ${foodNames}\n\nYou'll log each item one by one.`,
            [
              { 
                text: 'OK', 
                onPress: () => {
                  // Queue all foods except the first one, then show the first
                  setFoodQueue(foodsForModal.slice(1))
                  handleFoodSelected(foodsForModal[0])
                }
              }
            ]
          )
        }
      } else {
        Alert.alert('No Food Found', 'Could not identify any food items in the image. Please try again or search manually.')
      }
    } catch (error) {
      console.error('Image recognition error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to recognize food in image'
      Alert.alert('Error', errorMessage)
    } finally {
      setImageRecognitionLoading(false)
    }
  }

  const handleBarcodeScan = async () => {
    console.log('📱 Scan barcode clicked')
    try {
      if (!permission) {
        // Permission is still being requested
        return
      }
      
      if (!permission.granted) {
        const { granted } = await requestPermission()
        if (!granted) {
          Alert.alert('Permission needed', 'Camera permission is required to scan barcodes.')
          return
        }
      }
      setBarcodeScannerVisible(true)
    } catch (error) {
      console.error('Error requesting barcode permissions:', error)
      Alert.alert('Error', 'Failed to request camera permissions')
    }
  }

  const handleBarcodeScanned = async ({ type, data }: BarcodeScanningResult) => {
    if (barcodeScanning) return
    setBarcodeScanning(true)
    setBarcodeScannerVisible(false)
    
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        Alert.alert('Error', 'Please sign in')
        return
      }
      
      // Map scanner type to FatSecret barcode type format
      const typeMap: Record<string, string> = {
        'ean13': 'EAN_13',
        'ean8': 'EAN_8',
        'upc_a': 'UPC_A',
        'upc_e': 'UPC_E',
      }
      
      const barcodeType = typeMap[type] || 'UPC_A'
      
      const { data: barcodeData, error: barcodeError } = await supabase.functions.invoke('nutrition-barcode', {
        body: { 
          barcode: data, 
          barcodeType: barcodeType 
        },
      })
      
      if (barcodeError) throw barcodeError
      
      if (barcodeData?.success && barcodeData?.data?.found) {
        // Create a food object for selection
        const foodData = {
          food_id: barcodeData.data.cache_data.fatsecret_id,
          food_name: barcodeData.data.cache_data.name,
          brand_name: barcodeData.data.cache_data.brand_name,
          food_type: barcodeData.data.cache_data.food_type,
          _completeNutritionData: barcodeData.data.cache_data.nutrition_data,
          _entryData: barcodeData.data.entry_data,
          _matchedServing: barcodeData.data.entry_data,
          _availableServings: barcodeData.data.available_servings,
        }
        handleFoodSelected(foodData)
      } else {
        Alert.alert('Not Found', `Could not find product with barcode: ${data}\n\nTry searching manually.`)
      }
    } catch (error) {
      console.error('Barcode scan error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to look up barcode'
      Alert.alert('Error', errorMessage)
    } finally {
      setBarcodeScanning(false)
    }
  }


  const handleLogFoodEntry = async (foodData: {
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
    if (!userId) {
      Alert.alert('Error', 'Please sign in to log food')
      return
    }

    try {
      const supabase = createClient()
      const mealType = selectedMealType || 'other'

      const { error: insertError } = await supabase
        .from('food_entries')
        .insert({
          user_id: userId,
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
          meal_type: mealType,
          logged_at: new Date().toISOString(),
        } as any)

      if (insertError) {
        throw insertError
      }

      Alert.alert('Success', 'Food logged successfully!')
      await loadDailyData()
      
      // If there are more foods in queue, process next one
      // Otherwise close the modal
      if (foodQueue.length > 0) {
        processNextFoodInQueue()
      } else {
        setShowFoodSelector(false)
        setSelectedFoodForDetails({ foodId: null, foodName: null })
      }
    } catch (error) {
      console.error('Error logging food:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to log food'
      Alert.alert('Error', errorMessage)
    }
  }

  const handleDeleteEntry = async (entryId: number) => {
    console.log('[DELETE] handleDeleteEntry called with entryId:', entryId)
    
    if (!userId) {
      Alert.alert('Error', 'Please sign in to delete entries.')
      return
    }

    const toDelete = todayLogs.find(log => log.id === entryId)
    
    if (!toDelete) {
      console.log('[DELETE] ❌ Entry not found in todayLogs')
      return
    }

    // Show custom confirmation modal instead of Alert.alert
    setDeleteConfirmModal({
      visible: true,
      entryId: entryId,
      entryName: toDelete.food_name
    })
  }

  const executeDelete = async (entryId: number) => {
    console.log('[DELETE] ✅✅✅ User confirmed deletion - executing delete!')
    console.log('[DELETE] Entry to delete:', entryId)
    
    if (!userId || !entryId) return

    const toDelete = todayLogs.find(log => log.id === entryId)
    if (!toDelete) {
      console.log('[DELETE] ❌ Entry not found in todayLogs')
      return
    }

    // Optimistic update
    console.log('[DELETE] Applying optimistic update')
    setTodayLogs(prev => prev.filter(log => log.id !== entryId))
    setDailySummary((prevSummary: DailySummary | null) => {
      if (!prevSummary) return prevSummary
      return {
        ...prevSummary,
        total_calories: (prevSummary.total_calories || 0) - (toDelete.calories || 0),
        total_protein: (prevSummary.total_protein || 0) - (toDelete.protein || 0),
        total_carbohydrate: (prevSummary.total_carbohydrate || 0) - (toDelete.carbohydrate || 0),
        total_fat: (prevSummary.total_fat || 0) - (toDelete.fat || 0),
      }
    })

    try {
      console.log('[DELETE] Calling Supabase delete for entryId:', entryId, 'userId:', userId)
      const supabase = createClient()
      const { error, data } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId)
        .select()

      console.log('[DELETE] Supabase response - data:', data, 'error:', error)

      if (error) throw error
      
      console.log('[DELETE] ✅ Success! Triggering refresh')
      await loadDailyData()
      console.log('[DELETE] ========== DELETE FLOW COMPLETE ==========')
    } catch (error) {
      console.error('[DELETE] ❌ Error deleting entry:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      Alert.alert('Error', `Failed to delete entry: ${errorMessage}`)
      // Re-fetch to restore state if optimistic update was applied
      await loadDailyData()
    }
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
      {/* Daily Summary Card */}
      <DailySummaryCard
        summary={dailySummary}
        logs={todayLogs}
        onDelete={handleDeleteEntry}
        bmr={bmr}
      />

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        <LoggingInterface
          selectedMealType={selectedMealType}
          mealTemplates={mealTemplates}
          templatesLoading={templatesLoading}
          onMealTypeSelect={handleMealTypeSelect}
          onLogTemplate={handleLogTemplate}
          onTakePhoto={handleImageRecognition}
          onScanBarcode={handleBarcodeScan}
          onSearchFood={() => {
            console.log('🔍 Search food clicked')
            setShowSearchModal(true)
          }}
          onShowFavorites={() => {
            setFavoritesExpanded(!favoritesExpanded)
          }}
          favoritesExpanded={favoritesExpanded}
          onCreateFavorite={() => {
            console.log('➕ Create favorite clicked')
            setCurrentMeal(null)
            setShowMealBuilder(true)
          }}
          onEditTemplate={handleEditTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onDuplicateTemplate={handleDuplicateTemplate}
        />
      </View>

      {/* Meal Builder Modal */}
      {showMealBuilder && (
        <Modal
          visible={showMealBuilder}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowMealBuilder(false)
            setCurrentMeal(null)
          }}
        >
          <MealBuilder
            userId={userId!}
            initialTemplate={currentMeal}
            selectedMealType={selectedMealType}
            onSave={handleTemplateSaved}
            onCancel={() => {
              setShowMealBuilder(false)
              setCurrentMeal(null)
            }}
            onAddFood={handleAddFood}
          />
        </Modal>
      )}

      {/* Food Search Modal */}
      {showSearchModal && (
        <FoodSearchModal
          visible={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onFoodSelected={(food) => {
            // Close search modal
            setShowSearchModal(false)
            // Open FoodSelectionModal with selected food
            setSelectedFoodForDetails({ foodId: food.food_id, foodName: food.food_name })
            setShowFoodSelector(true)
          }}
          preselectedMealType={selectedMealType}
        />
      )}

      {/* Food Selection Modal */}
      {showFoodSelector && (
        <FoodSelectionModal
          visible={showFoodSelector}
          foodId={selectedFoodForDetails.foodId}
          foodName={selectedFoodForDetails.foodName}
          onClose={() => {
            setShowFoodSelector(false)
            setSelectedFoodForDetails({ foodId: null, foodName: null })
          }}
          onAdd={handleLogFoodEntry}
          preselectedMealType={selectedMealType}
        />
      )}

      {/* Delete Template Confirmation Modal */}
      <Modal
        visible={deleteTemplateModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteTemplateModal({ visible: false, templateId: null, templateName: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Favorite</Text>
              <TouchableOpacity
                onPress={() => setDeleteTemplateModal({ visible: false, templateId: null, templateName: null })}
                activeOpacity={0.7}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalBodyText}>
                Are you sure you want to delete "{deleteTemplateModal.templateName}"?
              </Text>
              <Text style={styles.modalBodySubtext}>
                This action cannot be undone.
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setDeleteTemplateModal({ visible: false, templateId: null, templateName: null })
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={async () => {
                  const templateId = deleteTemplateModal.templateId
                  setDeleteTemplateModal({ visible: false, templateId: null, templateName: null })
                  if (templateId) {
                    await executeDeleteTemplate(templateId)
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextDelete]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmModal({ visible: false, entryId: null, entryName: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Entry</Text>
              <TouchableOpacity
                onPress={() => setDeleteConfirmModal({ visible: false, entryId: null, entryName: null })}
                activeOpacity={0.7}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalBodyText}>
                Are you sure you want to delete "{deleteConfirmModal.entryName}"?
              </Text>
              <Text style={styles.modalBodySubtext}>
                This action cannot be undone.
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  console.log('[DELETE] ✅ User clicked Cancel')
                  setDeleteConfirmModal({ visible: false, entryId: null, entryName: null })
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={async () => {
                  const entryId = deleteConfirmModal.entryId
                  setDeleteConfirmModal({ visible: false, entryId: null, entryName: null })
                  if (entryId) {
                    await executeDelete(entryId)
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextDelete]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={barcodeScannerVisible}
        animationType="slide"
        onRequestClose={() => setBarcodeScannerVisible(false)}
      >
        <View style={styles.barcodeScannerContainer}>
          {permission && permission.granted ? (
            <CameraView
              style={styles.barcodeCamera}
              facing="back"
              onBarcodeScanned={barcodeScanning ? undefined : handleBarcodeScanned}
            >
              <View style={styles.barcodeScannerOverlay}>
                <TouchableOpacity
                  style={styles.barcodeScannerClose}
                  onPress={() => setBarcodeScannerVisible(false)}
                >
                  <Text style={styles.barcodeScannerCloseText}>✕</Text>
                </TouchableOpacity>

                <View style={styles.barcodeScannerFrame}>
                  <Text style={styles.barcodeScannerHint}>
                    Position the barcode within the frame
                  </Text>
                </View>

                <View style={styles.barcodeScannerControls}>
                  <TouchableOpacity
                    style={styles.barcodeScannerButton}
                    onPress={() => setBarcodeScannerVisible(false)}
                  >
                    <Text style={styles.barcodeScannerButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={styles.barcodeScannerPermission}>
              <Text style={styles.barcodeScannerPermissionText}>
                Camera permission is required to scan barcodes
              </Text>
              <TouchableOpacity
                style={styles.barcodeScannerPermissionButton}
                onPress={requestPermission}
              >
                <Text style={styles.barcodeScannerPermissionButtonText}>
                  Grant Permission
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

    </View>
  )
}

// DailySummaryCard Component
function DailySummaryCard({ summary, logs, onDelete, bmr }: { summary: DailySummary | null; logs: FoodEntry[]; onDelete: (id: number) => void; bmr?: number | null }) {
  const [expanded, setExpanded] = useState(false)

  // Derive totals from summary if present, otherwise from logs
  const calories = (summary?.total_calories ?? 0) || logs.reduce((sum, log) => sum + (log.calories || 0), 0)
  const protein = (summary?.total_protein ?? 0) || logs.reduce((sum, log) => sum + (log.protein || 0), 0)
  const carbs = (summary?.total_carbohydrate ?? 0) || logs.reduce((sum, log) => sum + (log.carbohydrate || 0), 0)
  const fat = (summary?.total_fat ?? 0) || logs.reduce((sum, log) => sum + (log.fat || 0), 0)
  const tdee = bmr || summary?.bmr || null

  return (
    <Card style={styles.card}>
      <View style={styles.summaryHeaderRow}>
        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandButton}>
          <Text style={styles.expandText}>{expanded ? '−' : '+'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{Math.round(calories)}</Text>
          <Text style={styles.summaryLabel}>Calories</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{Math.round(protein)}g</Text>
          <Text style={styles.summaryLabel}>Protein</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{Math.round(carbs)}g</Text>
          <Text style={styles.summaryLabel}>Carbs</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{Math.round(fat)}g</Text>
          <Text style={styles.summaryLabel}>Fat</Text>
        </View>
      </View>

      {tdee && (
        <View style={styles.tdeeContainer}>
          <Text style={styles.tdeeLabel}>Daily Calorie Goal</Text>
          <Text style={styles.tdeeValue}>{Math.round(tdee)} kcal</Text>
          <View style={styles.tdeeProgressContainer}>
            <View style={[styles.tdeeProgressBar, { width: `${Math.min(100, (calories / tdee) * 100)}%` }]} />
          </View>
          <Text style={styles.tdeeProgressText}>
            {calories >= tdee ? 'Goal reached! 🎉' : `${Math.round(tdee - calories)} kcal remaining`}
          </Text>
        </View>
      )}

      {expanded && (
        <FoodLogList logs={logs} onDelete={onDelete} dailySummary={summary} />
      )}
    </Card>
  )
}

// FoodLogList Component
function FoodLogList({ logs, onDelete, dailySummary }: { logs: FoodEntry[]; onDelete: (id: number) => void; dailySummary: DailySummary | null }) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (mealType: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [mealType]: !prev[mealType]
    }))
  }

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {mealTypes.map((mealType) => (
          <TouchableOpacity
            key={mealType}
            style={[styles.filterButton, selectedFilter === mealType && styles.filterButtonActive]}
            onPress={() => setSelectedFilter(mealType)}
          >
            <Text style={[styles.filterButtonText, selectedFilter === mealType && styles.filterButtonTextActive]}>
              {mealType === 'all' ? 'All' : mealType.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Meal Groups */}
      {Object.entries(
        logs
          .filter(log => selectedFilter === 'all' || log.meal_type === selectedFilter)
          .reduce((acc: Record<string, FoodEntry[]>, log) => {
            const mealType = log.meal_type || 'other'
            if (!acc[mealType]) acc[mealType] = []
            acc[mealType].push(log)
            return acc
          }, {})
      ).map(([mealType, typedMealLogs]) => {
        // Type assertion: Object.entries returns [string, unknown][], but we know it's FoodEntry[]
        const mealLogs = typedMealLogs as FoodEntry[]
        const calories = mealLogs.reduce((sum, log) => sum + (log.calories || 0), 0)
        const protein = mealLogs.reduce((sum, log) => sum + (log.protein || 0), 0)

        return (
          <View key={mealType} style={styles.logGroup}>
            <TouchableOpacity
              onPress={() => toggleSection(mealType)}
              style={styles.logGroupHeader}
              activeOpacity={0.7}
            >
              <View style={styles.logGroupInfo}>
                <Text style={styles.logGroupTitle}>
                  {mealType.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.logGroupSummary}>
                  {mealLogs.length} items • {Math.round(calories)} cal • {Math.round(protein)}g protein
                </Text>
              </View>
              <Text style={styles.logGroupToggle}>
                {expandedSections[mealType] ? '−' : '+'}
              </Text>
            </TouchableOpacity>

            {expandedSections[mealType] && (
              <View style={styles.logGroupItems}>
                {mealLogs.map((log) => (
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
            )}
          </View>
        )
      })}
    </View>
  )
}

// LoggingInterface Component
interface LoggingInterfaceProps {
  selectedMealType: string | null
  mealTemplates: MealTemplate[]
  templatesLoading: boolean
  onMealTypeSelect: (type: string) => void
  onLogTemplate: (templateId: number) => void
  onTakePhoto: () => void
  onScanBarcode: () => void
  onSearchFood: () => void
  onShowFavorites: () => void
  favoritesExpanded: boolean
  onCreateFavorite: () => void
  onEditTemplate: (templateId: number) => void
  onDeleteTemplate: (templateId: number) => void
  onDuplicateTemplate: (templateId: number) => void
}

function LoggingInterface({
  selectedMealType,
  mealTemplates,
  templatesLoading,
  onMealTypeSelect,
  onLogTemplate,
  onTakePhoto,
  onScanBarcode,
  onSearchFood,
  onShowFavorites,
  favoritesExpanded,
  onCreateFavorite,
  onEditTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
}: LoggingInterfaceProps) {
  console.log('🍽️ LoggingInterface rendered:', { selectedMealType, templatesCount: mealTemplates.length })
  // Show all favorites - user selects meal type when logging
  const filteredTemplates = mealTemplates

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Meal Type Selection */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Log Food</Text>
        <View style={styles.mealTypeContainer}>
          {MEAL_TYPES.map((meal) => (
            <TouchableOpacity
              key={meal.value}
              onPress={() => {
                console.log('☀️ Meal type button pressed:', meal.value)
                onMealTypeSelect(meal.value)
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

      {/* Quick Actions - Only show when meal type selected */}
      {selectedMealType && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>How are we logging it?</Text>
          <View style={styles.alternativeButtonsRow}>
            <TouchableOpacity
              style={styles.alternativeButton}
              onPress={onTakePhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.alternativeButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alternativeButton}
              onPress={onScanBarcode}
              activeOpacity={0.8}
            >
              <Text style={styles.alternativeButtonText}>📱 Scan Barcode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alternativeButton}
              onPress={onSearchFood}
              activeOpacity={0.8}
            >
              <Text style={styles.alternativeButtonText}>🔍 Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alternativeButton}
              onPress={onShowFavorites}
              activeOpacity={0.8}
            >
              <Text style={styles.alternativeButtonText}>⭐ Favorites</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Favorites Section */}
      <Card style={styles.card}>
        <TouchableOpacity
          style={styles.templatesHeader}
          onPress={onShowFavorites}
          activeOpacity={0.7}
        >
          <Text style={styles.favoritesHeaderTitle}>My Favorites ({mealTemplates.length})</Text>
          <Text style={styles.expandIcon}>{favoritesExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {favoritesExpanded && (
          <>
            {templatesLoading ? (
              <ActivityIndicator size="small" color="#FE5858" />
            ) : filteredTemplates.length === 0 ? (
              <View style={styles.emptyTemplatesContainer}>
                <Text style={styles.emptyTemplatesText}>
                  {selectedMealType
                    ? `No favorites for ${MEAL_TYPES.find(m => m.value === selectedMealType)?.label}.`
                    : 'Set up your favorites for one-tap logging!'
                  }
                </Text>
                <TouchableOpacity
                  style={styles.emptyTemplatesButton}
                  onPress={onCreateFavorite}
                >
                  <Text style={styles.emptyTemplatesButtonText}>Create Your First Favorite</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.templatesList}>
            {filteredTemplates.map((template) => (
              <View key={template.id || template.template_name} style={styles.templateItem}>
                <TouchableOpacity
                  style={styles.templateContent}
                  onPress={() => {
                    console.log('🍽️ Template log button pressed:', template.template_name)
                    onLogTemplate(template.id!)
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>
                      {template.template_name}
                    </Text>
                    <Text style={styles.templateDetails}>
                      {Math.round(template.total_calories)} cal • {Math.round(template.total_protein)}g protein
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.templateActions}>
                  <TouchableOpacity
                    style={[styles.templateActionButton, styles.logButton]}
                    onPress={() => onLogTemplate(template.id!)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.logButtonText}>✓ Log</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.templateActionButton}
                    onPress={() => onEditTemplate(template.id!)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.templateActionText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.templateActionButton}
                    onPress={() => onDuplicateTemplate(template.id!)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.templateActionText}>📋</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.templateActionButton}
                    onPress={() => onDeleteTemplate(template.id!)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.templateActionText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
              </View>
            )}
            {!selectedMealType && (
              <TouchableOpacity
                style={styles.addFavoriteButtonInline}
                onPress={onCreateFavorite}
                activeOpacity={0.7}
              >
                <Text style={styles.addFavoriteButtonText}>+ Add Favorite</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  contentArea: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mealTypeButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  mealTypeButtonActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  mealTypeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  mealTypeButtonTextActive: {
    color: '#FE5858',
    fontWeight: '600',
  },
  alternativeButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  alternativeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  alternativeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  templatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  favoritesHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 0,
  },
  expandIcon: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  addFavoriteButtonInline: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FE5858',
    borderRadius: 6,
    alignItems: 'center',
  },
  addFavoriteButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addFavoriteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  templatesList: {
    gap: 8,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FBFE',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  templateContent: {
    flex: 1,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  templateDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  templateActionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateActionText: {
    fontSize: 16,
  },
  actionButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  editIcon: {
    fontSize: 14,
  },
  deleteIcon: {
    fontSize: 14,
  },
  emptyTemplatesContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyTemplatesText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyTemplatesButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  emptyTemplatesButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expandButton: {
    padding: 4,
  },
  expandText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FE5858',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  tdeeContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tdeeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  tdeeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  tdeeProgressContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  tdeeProgressBar: {
    height: '100%',
    backgroundColor: '#FE5858',
    borderRadius: 4,
  },
  tdeeProgressText: {
    fontSize: 12,
    color: '#6B7280',
  },
  logListContainer: {
    marginTop: 8,
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterButtonActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FE5858',
  },
  logGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  logGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  logGroupInfo: {
    flex: 1,
  },
  logGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  logGroupSummary: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logGroupToggle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  logGroupItems: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logItemContent: {
    flex: 1,
  },
  logItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  logItemDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logItemTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalClose: {
    fontSize: 20,
    color: '#6B7280',
  },
  modalBody: {
    padding: 16,
  },
  modalBodyText: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  modalBodySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonDelete: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonTextDelete: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  mealTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  mealTypeOption: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  mealTypeOptionActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  mealTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  mealTypeTextActive: {
    color: '#FE5858',
  },
  logButton: {
    backgroundColor: '#FE5858',
  },
  logButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  barcodeScannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  barcodeCamera: {
    flex: 1,
  },
  barcodeScannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeScannerClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
  },
  barcodeScannerCloseText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  barcodeScannerHint: {
    marginTop: 30,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 8,
  },
  barcodeScannerControls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  barcodeScannerButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  barcodeScannerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  barcodeScannerPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  barcodeScannerPermissionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  barcodeScannerPermissionButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  barcodeScannerPermissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  barcodeScannerFrame: {
    flex: 1,
    backgroundColor: '#000',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
})
