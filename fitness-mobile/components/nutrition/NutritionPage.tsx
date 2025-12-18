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
  [key: string]: unknown
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

interface FoodSelection {
  food_id?: string
  food_name?: string
  _completeNutritionData?: {
    food?: unknown
    entry_data?: {
      food_id?: string
      food_name?: string
      [key: string]: unknown
    }
    matched_serving?: unknown
    available_servings?: unknown[]
    alternatives?: unknown[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

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

export default function NutritionPage() {
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
    setSelectedMealType(mealType)
  }

  const handleLogTemplate = async (templateId: number) => {
    if (!userId) return
    if (!selectedMealType) {
      Alert.alert('Error', 'Please select a meal type first')
      return
    }

    try {
      const result = await logMealTemplate(userId, templateId, selectedMealType)
      if (!result.success) throw new Error(result.error || 'Failed to log meal')
      Alert.alert('Success', 'Meal logged successfully!')
      await loadDailyData()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to log meal'
      Alert.alert('Error', errorMessage)
    }
  }

  const handleEditTemplate = async (templateId: number) => {
    try {
      const fullTemplate = await getMealTemplateWithItems(templateId)
      if (fullTemplate) {
        setCurrentMeal(fullTemplate)
        setShowMealBuilder(true)
      } else {
        Alert.alert('Error', 'Could not load favorite for editing')
      }
    } catch (error) {
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
      if (success) await loadMealTemplates()
      else Alert.alert('Error', error || 'Failed to delete favorite')
    } catch (error) {
      Alert.alert('Error', 'Failed to delete favorite')
    }
  }

  const handleDuplicateTemplate = async (templateId: number) => {
    try {
      const fullTemplate = await getMealTemplateWithItems(templateId)
      if (!fullTemplate || !fullTemplate.items || fullTemplate.items.length === 0) {
        Alert.alert('Error', 'Could not load meal for duplicating')
        return
      }

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

      if (!userId) return

      const { success, error } = await createMealTemplate(userId, duplicateName, null, items)
      if (success) {
        await loadMealTemplates()
        const updatedTemplates = await getMealTemplates(userId)
        const newTemplate = updatedTemplates.find(t => t.template_name === duplicateName)
        if (newTemplate) {
          const fullNewTemplate = await getMealTemplateWithItems(newTemplate.id!)
          if (fullNewTemplate) {
            setCurrentMeal(fullNewTemplate)
            setShowMealBuilder(true)
          }
        }
      } else {
        Alert.alert('Error', error || 'Failed to duplicate meal')
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate meal')
    }
  }

  const handleTemplateSaved = (updatedTemplate: MealTemplate) => {
    loadMealTemplates()
    setShowMealBuilder(false)
    setCurrentMeal(null)
  }

  const handleAddFood = () => {
    setShowFoodSelector(true)
  }

  const handleFoodSelected = (food: FoodSelection) => {
    const foodId = food.food_id || food._completeNutritionData?.entry_data?.food_id
    const foodName = food.food_name || food._completeNutritionData?.entry_data?.food_name
    if (!foodId || !foodName) {
      Alert.alert('Error', 'Invalid food data')
      return
    }
    setSelectedFoodForDetails({ foodId, foodName })
    setShowFoodSelector(true)
  }

  const processNextFoodInQueue = () => {
    if (foodQueue.length > 0) {
      const nextFood = foodQueue[0]
      setFoodQueue(prev => prev.slice(1))
      handleFoodSelected(nextFood)
    } else {
      setShowFoodSelector(false)
      setSelectedFoodForDetails({ foodId: null, foodName: null })
      setRefreshKey(prev => prev + 1)
      setSelectedMealType(null)
    }
  }

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (userData) {
        setUserId((userData as any).id)
        const { data: profileData } = await supabase.from('user_profiles').select('profile_data').eq('user_id', (userData as any).id).order('generated_at', { ascending: false }).limit(1).maybeSingle()
        const typedProfileData = profileData as UserProfile | null
        if (typedProfileData?.profile_data) {
          const profile = typedProfileData.profile_data
          const storedBmr = profile.bmr || profile.user_summary?.bmr
          if (storedBmr) setBmr(Math.round(storedBmr))
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
      const { data: summary } = await supabase.from('daily_nutrition').select('*').eq('user_id', userId).eq('date', today).maybeSingle()
      setDailySummary(summary || null)
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
      const { data: logs } = await supabase.from('food_entries').select('*').eq('user_id', userId).gte('logged_at', startOfDay.toISOString()).lte('logged_at', endOfDay.toISOString()).order('logged_at', { ascending: false })
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

  const handleImageRecognition = async () => {
    try {
      if (Platform.OS === 'web') { pickImage('library'); return }
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permission needed', 'Camera permission is required.'); return }
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (mediaStatus.status !== 'granted') { Alert.alert('Permission needed', 'Photo library permission is required.'); return }
      Alert.alert('Select Image Source', 'Choose how you want to add a food photo', [
        { text: 'Camera', onPress: () => pickImage('camera') },
        { text: 'Photo Library', onPress: () => pickImage('library') },
        { text: 'Cancel', style: 'cancel' },
      ])
    } catch (error) {
      Alert.alert('Error', 'Failed to request permissions')
    }
  }

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true }
      const result = source === 'camera' && Platform.OS !== 'web' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        if (asset.base64) await recognizeFoodFromImage(asset.base64, asset.uri?.endsWith('.png') ? 'png' : 'jpeg')
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image')
    }
  }

  const recognizeFoodFromImage = async (base64: string, imageType: string) => {
    if (!userId) return
    setImageRecognitionLoading(true)
    try {
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke('nutrition-image-complete', { body: { imageBase64: base64, imageType } })
      if (invokeError) throw invokeError
      if (data?.success && data?.data?.foods && data.data.foods.length > 0) {
        const foods = data.data.foods as ImageRecognitionFood[]
        const foundFoods = foods.filter((f) => f.found)
        if (foundFoods.length === 0) { Alert.alert('No Food Found', 'Try searching manually.'); return }
        const foodsForModal: FoodSelection[] = foundFoods.map((f) => ({
          food_id: f.entry_data.food_id, food_name: f.entry_data.food_name,
          _completeNutritionData: { food: f.cache_data?.nutrition_data, entry_data: f.entry_data, matched_serving: f.matched_serving, available_servings: f.available_servings, alternatives: f.alternatives }
        }))
        if (foodsForModal.length === 1) handleFoodSelected(foodsForModal[0])
        else {
          const foodNames = foodsForModal.map((f) => f.food_name).join(', ')
          Alert.alert('Foods Identified', `Found ${foodsForModal.length} items: ${foodNames}`, [
            { text: 'OK', onPress: () => { setFoodQueue(foodsForModal.slice(1)); handleFoodSelected(foodsForModal[0]) } }
          ])
        }
      } else Alert.alert('No Food Found', 'Try again or search manually.')
    } catch (error) {
      Alert.alert('Error', 'Failed to recognize food')
    } finally {
      setImageRecognitionLoading(false)
    }
  }

  const handleBarcodeScan = async () => {
    if (!permission) return
    if (!permission.granted) {
      const { granted } = await requestPermission()
      if (!granted) { Alert.alert('Permission needed', 'Camera permission is required.'); return }
    }
    setBarcodeScannerVisible(true)
  }

  const handleBarcodeScanned = async ({ type, data }: BarcodeScanningResult) => {
    if (barcodeScanning) return
    setBarcodeScanning(true); setBarcodeScannerVisible(false)
    try {
      const supabase = createClient()
      const typeMap: Record<string, string> = { 'ean13': 'EAN_13', 'ean8': 'EAN_8', 'upc_a': 'UPC_A', 'upc_e': 'UPC_E' }
      const { data: barcodeData, error: barcodeError } = await supabase.functions.invoke('nutrition-barcode', { body: { barcode: data, barcodeType: typeMap[type] || 'UPC_A' } })
      if (barcodeError) throw barcodeError
      if (barcodeData?.success && barcodeData?.data?.found) {
        handleFoodSelected({
          food_id: barcodeData.data.cache_data.fatsecret_id, food_name: barcodeData.data.cache_data.name, brand_name: barcodeData.data.cache_data.brand_name, food_type: barcodeData.data.cache_data.food_type,
          _completeNutritionData: barcodeData.data.cache_data.nutrition_data, _entryData: barcodeData.data.entry_data, _matchedServing: barcodeData.data.entry_data, _availableServings: barcodeData.data.available_servings,
        })
      } else Alert.alert('Not Found', `Could not find product with barcode: ${data}`)
    } catch (error) {
      Alert.alert('Error', 'Failed to look up barcode')
    } finally {
      setBarcodeScanning(false)
    }
  }

  const handleLogFoodEntry = async (foodData: any) => {
    if (!userId) return
    try {
      const supabase = createClient()
      const mealType = selectedMealType || 'other'
      const { error: insertError } = await supabase.from('food_entries').insert({
        user_id: userId, food_id: foodData.food_id, food_name: foodData.food_name, serving_id: foodData.serving_id, serving_description: foodData.serving_description, number_of_units: foodData.number_of_units,
        calories: foodData.calories, protein: foodData.protein, carbohydrate: foodData.carbohydrate, fat: foodData.fat, fiber: foodData.fiber || 0, sugar: foodData.sugar || 0, sodium: foodData.sodium || 0,
        meal_type: mealType, logged_at: new Date().toISOString(),
      } as any)
      if (insertError) throw insertError
      Alert.alert('Success', 'Food logged successfully!')
      await loadDailyData()
      if (foodQueue.length > 0) processNextFoodInQueue()
      else { setShowFoodSelector(false); setSelectedFoodForDetails({ foodId: null, foodName: null }) }
    } catch (error) {
      Alert.alert('Error', 'Failed to log food')
    }
  }

  const executeDelete = async (entryId: number) => {
    if (!userId || !entryId) return
    const toDelete = todayLogs.find(log => log.id === entryId)
    if (!toDelete) return
    setTodayLogs(prev => prev.filter(log => log.id !== entryId))
    setDailySummary((prevSummary: DailySummary | null) => {
      if (!prevSummary) return prevSummary
      return { ...prevSummary, total_calories: (prevSummary.total_calories || 0) - (toDelete.calories || 0), total_protein: (prevSummary.total_protein || 0) - (toDelete.protein || 0), total_carbohydrate: (prevSummary.total_carbohydrate || 0) - (toDelete.carbohydrate || 0), total_fat: (prevSummary.total_fat || 0) - (toDelete.fat || 0) }
    })
    try {
      const supabase = createClient()
      const { error } = await supabase.from('food_entries').delete().eq('id', entryId).eq('user_id', userId)
      if (error) throw error
      await loadDailyData()
    } catch (error) {
      Alert.alert('Error', `Failed to delete entry`)
      await loadDailyData()
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" /><Text style={styles.loadingText}>Loading nutrition...</Text>
      </View>
    )
  }

  if (!userId) return <View style={styles.container}><Card style={styles.card}><Text style={styles.errorText}>Please sign in.</Text></Card></View>

  return (
    <View style={styles.container}>
      <DailySummaryCard summary={dailySummary} logs={todayLogs} onDelete={(id) => setDeleteConfirmModal({ visible: true, entryId: id, entryName: todayLogs.find(l => l.id === id)?.food_name || '' })} bmr={bmr} />
      <View style={styles.contentArea}>
        <LoggingInterface
          selectedMealType={selectedMealType} mealTemplates={mealTemplates} templatesLoading={templatesLoading}
          onMealTypeSelect={handleMealTypeSelect} onLogTemplate={handleLogTemplate} onTakePhoto={handleImageRecognition}
          onScanBarcode={handleBarcodeScan} onSearchFood={() => setShowSearchModal(true)} onShowFavorites={() => setFavoritesExpanded(!favoritesExpanded)}
          favoritesExpanded={favoritesExpanded} onCreateFavorite={() => { setCurrentMeal(null); setShowMealBuilder(true) }}
          onEditTemplate={handleEditTemplate} onDeleteTemplate={handleDeleteTemplate} onDuplicateTemplate={handleDuplicateTemplate}
        />
      </View>

      {showMealBuilder && <Modal visible={showMealBuilder} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowMealBuilder(false); setCurrentMeal(null) }}>
        <MealBuilder userId={userId!} initialTemplate={currentMeal} selectedMealType={selectedMealType} onSave={handleTemplateSaved} onCancel={() => { setShowMealBuilder(false); setCurrentMeal(null) }} onAddFood={handleAddFood} />
      </Modal>}

      {showSearchModal && <FoodSearchModal visible={showSearchModal} onClose={() => setShowSearchModal(false)} onFoodSelected={(food) => { setShowSearchModal(false); setSelectedFoodForDetails({ foodId: food.food_id, foodName: food.food_name }); setShowFoodSelector(true) }} preselectedMealType={selectedMealType} />}
      {showFoodSelector && <FoodSelectionModal visible={showFoodSelector} foodId={selectedFoodForDetails.foodId} foodName={selectedFoodForDetails.foodName} onClose={() => { setShowFoodSelector(false); setSelectedFoodForDetails({ foodId: null, foodName: null }) }} onAdd={handleLogFoodEntry} preselectedMealType={selectedMealType} />}

      <Modal visible={deleteTemplateModal.visible} transparent={true} animationType="fade" onRequestClose={() => setDeleteTemplateModal({ visible: false, templateId: null, templateName: null })}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Delete Favorite</Text></View><View style={styles.modalBody}><Text style={styles.modalBodyText}>Are you sure you want to delete "{deleteTemplateModal.templateName}"?</Text></View><View style={styles.modalButtons}><TouchableOpacity style={styles.modalButton} onPress={() => setDeleteTemplateModal({ visible: false, templateId: null, templateName: null })}><Text>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton, styles.modalButtonDelete]} onPress={async () => { const id = deleteTemplateModal.templateId; setDeleteTemplateModal({ visible: false, templateId: null, templateName: null }); if (id) await executeDeleteTemplate(id) }}><Text style={{ color: '#FFF' }}>Delete</Text></TouchableOpacity></View></View></View>
      </Modal>

      <Modal visible={deleteConfirmModal.visible} transparent={true} animationType="fade" onRequestClose={() => setDeleteConfirmModal({ visible: false, entryId: null, entryName: null })}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Delete Entry</Text></View><View style={styles.modalBody}><Text style={styles.modalBodyText}>Are you sure you want to delete "{deleteConfirmModal.entryName}"?</Text></View><View style={styles.modalButtons}><TouchableOpacity style={styles.modalButton} onPress={() => setDeleteConfirmModal({ visible: false, entryId: null, entryName: null })}><Text>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton, styles.modalButtonDelete]} onPress={async () => { const id = deleteConfirmModal.entryId; setDeleteConfirmModal({ visible: false, entryId: null, entryName: null }); if (id) await executeDelete(id) }}><Text style={{ color: '#FFF' }}>Delete</Text></TouchableOpacity></View></View></View>
      </Modal>

      <Modal visible={barcodeScannerVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setBarcodeScannerVisible(false)}>
        <View style={styles.barcodeScannerContainer}>
          {permission?.granted ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "code128"],
                }}
                onBarcodeScanned={barcodeScanning ? undefined : handleBarcodeScanned}
              />
              <View style={styles.barcodeScannerOverlay} pointerEvents="box-none">
                <TouchableOpacity style={styles.barcodeScannerClose} onPress={() => setBarcodeScannerVisible(false)}>
                  <Text style={styles.barcodeScannerCloseText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.barcodeScannerFrame} pointerEvents="box-none">
                  <View style={styles.barcodeScannerCutout} />
                  <Text style={styles.barcodeScannerHint}>
                    Position the barcode within the frame
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.barcodeScannerPermission}>
              <Text style={styles.barcodeScannerPermissionText}>Camera permission needed</Text>
              <TouchableOpacity style={styles.barcodeScannerPermissionButton} onPress={requestPermission}>
                <Text style={styles.barcodeScannerPermissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

function DailySummaryCard({ summary, logs, onDelete, bmr }: { summary: DailySummary | null; logs: FoodEntry[]; onDelete: (id: number) => void; bmr?: number | null }) {
  const [expanded, setExpanded] = useState(false)
  const calories = (summary?.total_calories ?? 0) || logs.reduce((sum, log) => sum + (log.calories || 0), 0)
  const protein = (summary?.total_protein ?? 0) || logs.reduce((sum, log) => sum + (log.protein || 0), 0)
  const carbs = (summary?.total_carbohydrate ?? 0) || logs.reduce((sum, log) => sum + (log.carbohydrate || 0), 0)
  const fat = (summary?.total_fat ?? 0) || logs.reduce((sum, log) => sum + (log.fat || 0), 0)
  const tdee = bmr || summary?.bmr || null
  return (
    <Card style={styles.card}>
      <View style={styles.summaryHeaderRow}><Text style={styles.sectionTitle}>Today's Summary</Text><TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandButton}><Text style={styles.expandText}>{expanded ? '−' : '+'}</Text></TouchableOpacity></View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}><Text style={styles.summaryValue}>{Math.round(calories)}</Text><Text style={styles.summaryLabel}>Calories</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryValue}>{Math.round(protein)}g</Text><Text style={styles.summaryLabel}>Protein</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryValue}>{Math.round(carbs)}g</Text><Text style={styles.summaryLabel}>Carbs</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryValue}>{Math.round(fat)}g</Text><Text style={styles.summaryLabel}>Fat</Text></View>
      </View>
      {tdee && <View style={styles.tdeeContainer}><Text style={styles.tdeeLabel}>Daily Calorie Goal</Text><Text style={styles.tdeeValue}>{Math.round(tdee)} kcal</Text><View style={styles.tdeeProgressContainer}><View style={[styles.tdeeProgressBar, { width: `${Math.min(100, (calories / tdee) * 100)}%` }]} /></View></View>}
      {expanded && <FoodLogList logs={logs} onDelete={onDelete} dailySummary={summary} />}
    </Card>
  )
}

function FoodLogList({ logs, onDelete, dailySummary }: { logs: FoodEntry[]; onDelete: (id: number) => void; dailySummary: DailySummary | null }) {
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  if (logs.length === 0) return <Text style={styles.emptyText}>No foods logged today.</Text>
  const mealTypes = ['all', 'breakfast', 'lunch', 'dinner', 'pre_workout', 'post_workout', 'snack', 'other']
  return (
    <View style={styles.logListContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {mealTypes.map((m) => (<TouchableOpacity key={m} style={[styles.filterButton, selectedFilter === m && styles.filterButtonActive]} onPress={() => setSelectedFilter(m)}><Text style={[styles.filterButtonText, selectedFilter === m && styles.filterButtonTextActive]}>{m.toUpperCase()}</Text></TouchableOpacity>))}
      </ScrollView>
      {Object.entries(logs.filter(l => selectedFilter === 'all' || l.meal_type === selectedFilter).reduce((acc: any, l) => { const mt = l.meal_type || 'other'; if (!acc[mt]) acc[mt] = []; acc[mt].push(l); return acc }, {})).map(([mt, typedLogs]) => {
        const mealLogs = typedLogs as FoodEntry[]
        return (
          <View key={mt} style={styles.logGroup}>
            <TouchableOpacity onPress={() => setExpandedSections(prev => ({ ...prev, [mt]: !prev[mt] }))} style={styles.logGroupHeader}><Text style={styles.logGroupTitle}>{mt.toUpperCase()}</Text><Text>{mealLogs.length} items</Text></TouchableOpacity>
            {expandedSections[mt] && <View style={styles.logGroupItems}>{mealLogs.map((l) => (<View key={l.id} style={styles.logItem}><View style={styles.logItemContent}><Text style={styles.logItemName}>{l.food_name}</Text><Text style={styles.logItemDetails}>{Math.round(l.calories || 0)} kcal</Text></View><TouchableOpacity onPress={() => onDelete(l.id)}><Text style={{ color: '#EF4444' }}>Delete</Text></TouchableOpacity></View>))}</View>}
          </View>
        )
      })}
    </View>
  )
}

function LoggingInterface({ selectedMealType, mealTemplates, onMealTypeSelect, onLogTemplate, onTakePhoto, onScanBarcode, onSearchFood, onShowFavorites, favoritesExpanded, onCreateFavorite, onEditTemplate, onDeleteTemplate, onDuplicateTemplate }: any) {
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Log Food</Text>
        <View style={styles.mealTypeContainer}>{MEAL_TYPES.map((m) => (<TouchableOpacity key={m.value} onPress={() => onMealTypeSelect(m.value)} style={[styles.mealTypeButton, selectedMealType === m.value && styles.mealTypeButtonActive]}><Text style={[styles.mealTypeButtonText, selectedMealType === m.value && styles.mealTypeButtonTextActive]}>{m.label}</Text></TouchableOpacity>))}</View>
      </Card>
      {selectedMealType && <Card style={styles.card}>
        <Text style={styles.sectionTitle}>How are we logging it?</Text>
        <View style={styles.alternativeButtonsRow}>
          <TouchableOpacity style={styles.alternativeButton} onPress={onTakePhoto}><Text>📷 Photo</Text></TouchableOpacity>
          <TouchableOpacity style={styles.alternativeButton} onPress={onScanBarcode}><Text>📱 Barcode</Text></TouchableOpacity>
          <TouchableOpacity style={styles.alternativeButton} onPress={onSearchFood}><Text>🔍 Search</Text></TouchableOpacity>
          <TouchableOpacity style={styles.alternativeButton} onPress={onShowFavorites}><Text>⭐ Favorites</Text></TouchableOpacity>
        </View>
      </Card>}
      <Card style={styles.card}>
        <TouchableOpacity style={styles.templatesHeader} onPress={onShowFavorites}><Text style={styles.favoritesHeaderTitle}>My Favorites ({mealTemplates.length})</Text></TouchableOpacity>
        {favoritesExpanded && <View style={styles.templatesList}>{mealTemplates.map((t: any) => (<View key={t.id} style={styles.templateItem}><TouchableOpacity style={styles.templateContent} onPress={() => onLogTemplate(t.id)}><Text style={styles.templateName}>{t.template_name}</Text><Text style={styles.templateDetails}>{Math.round(t.total_calories)} cal</Text></TouchableOpacity><View style={styles.templateActions}><TouchableOpacity onPress={() => onEditTemplate(t.id)}><Text>✏️</Text></TouchableOpacity><TouchableOpacity onPress={() => onDeleteTemplate(t.id)}><Text>🗑️</Text></TouchableOpacity></View></View>))}</View>}
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FBFE' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  contentArea: { flex: 1 },
  errorText: { fontSize: 16, color: '#DC2626', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginHorizontal: 16, marginVertical: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  mealTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mealTypeButton: { flex: 1, minWidth: '45%', paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  mealTypeButtonActive: { borderColor: '#FE5858', backgroundColor: '#FEF2F2' },
  mealTypeButtonText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  mealTypeButtonTextActive: { color: '#FE5858', fontWeight: '600' },
  alternativeButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alternativeButton: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', flex: 1, minWidth: '45%', alignItems: 'center' },
  templatesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  favoritesHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  templatesList: { gap: 8 },
  templateItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FBFE', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  templateContent: { flex: 1 },
  templateName: { fontSize: 16, fontWeight: '500', color: '#1F2937' },
  templateDetails: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  templateActions: { flexDirection: 'row', gap: 8 },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  expandButton: { padding: 4 },
  expandText: { fontSize: 16, fontWeight: 'bold', color: '#6B7280' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#FE5858' },
  summaryLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  tdeeContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  tdeeLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  tdeeValue: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  tdeeProgressContainer: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, marginTop: 8 },
  tdeeProgressBar: { height: '100%', backgroundColor: '#FE5858', borderRadius: 4 },
  logListContainer: { marginTop: 8 },
  filterContainer: { marginBottom: 12 },
  filterButton: { paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB' },
  filterButtonActive: { borderColor: '#FE5858', backgroundColor: '#FEF2F2' },
  filterButtonText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  filterButtonTextActive: { color: '#FE5858' },
  logGroup: { backgroundColor: '#FFFFFF', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  logGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB' },
  logGroupTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  logGroupItems: { paddingHorizontal: 12, paddingBottom: 12 },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  logItemContent: { flex: 1 },
  logItemName: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  logItemDetails: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '90%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  modalBody: { padding: 16 },
  modalBodyText: { fontSize: 16, color: '#1F2937', marginBottom: 8 },
  modalButtons: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6' },
  modalButtonDelete: { backgroundColor: '#EF4444' },
  barcodeScannerContainer: { flex: 1, backgroundColor: '#000' },
  barcodeScannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  barcodeScannerClose: { position: 'absolute', top: 60, right: 20, padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 20, zIndex: 10 },
  barcodeScannerCloseText: { fontSize: 24, color: '#FFFFFF' },
  barcodeScannerFrame: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  barcodeScannerCutout: { width: 250, height: 250, borderWidth: 2, borderColor: '#FE5858', borderRadius: 12, backgroundColor: 'transparent' },
  barcodeScannerHint: { marginTop: 24, fontSize: 16, color: '#FFFFFF', textAlign: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: 12, borderRadius: 8, overflow: 'hidden' },
  barcodeScannerPermission: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#000' },
  barcodeScannerPermissionText: { color: '#FFF', fontSize: 18, textAlign: 'center', marginBottom: 24 },
  barcodeScannerPermissionButton: { backgroundColor: '#FE5858', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  barcodeScannerPermissionButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 20 },
})
