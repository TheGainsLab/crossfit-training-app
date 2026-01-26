import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '@/lib/supabase/client'

interface FoodSelectionViewProps {
  foodId: string | null
  foodName: string | null
  onBack: () => void
  onAdd: (foodData: {
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
  }) => void
}

interface Serving {
  serving_id: string
  serving_description: string
  calories: string
  protein: string
  carbohydrate: string
  fat: string
  fiber?: string
  sugar?: string
  sodium?: string
  is_default?: string
  metric_serving_amount?: string
  metric_serving_unit?: string
}

interface FoodDetails {
  food_id: string
  food_name: string
  servings: Serving[]
}

// Helper to check if serving is ~1 oz
function isOneOzServing(serving: Serving): boolean {
  const desc = serving.serving_description?.toLowerCase() || ''
  return desc.includes('1 oz') || desc === '1oz'
}

// Helper to check if serving is ~100g
function is100gServing(serving: Serving): boolean {
  const desc = serving.serving_description?.toLowerCase() || ''
  if (desc.match(/\b100\s*g\b/)) return true
  if (serving.metric_serving_amount === '100' && serving.metric_serving_unit === 'g') return true
  return false
}

export default function FoodSelectionView({
  foodId,
  foodName,
  onBack,
  onAdd,
}: FoodSelectionViewProps) {
  const [loading, setLoading] = useState(false)
  const [foodDetails, setFoodDetails] = useState<FoodDetails | null>(null)
  const [selectedServing, setSelectedServing] = useState<Serving | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [showAllServings, setShowAllServings] = useState(false)

  useEffect(() => {
    if (foodId) {
      loadFoodDetails()
    } else {
      setFoodDetails(null)
      setSelectedServing(null)
      setQuantity('1')
      setError(null)
      setShowAllServings(false)
    }
  }, [foodId])

  const { defaultServing, oneOzServing, hundredGServing, otherServings } = useMemo(() => {
    if (!foodDetails?.servings) {
      return { defaultServing: null, oneOzServing: null, hundredGServing: null, otherServings: [] }
    }

    const servings = foodDetails.servings
    const defaultServ = servings.find((s) => s.is_default === '1') || null
    const oneOz = servings.find((s) => isOneOzServing(s)) || null
    const hundredG = servings.find((s) => is100gServing(s)) || null

    const quickIds = new Set([defaultServ?.serving_id, oneOz?.serving_id, hundredG?.serving_id].filter(Boolean))
    const others = servings.filter((s) => !quickIds.has(s.serving_id))

    return {
      defaultServing: defaultServ,
      oneOzServing: oneOz,
      hundredGServing: hundredG,
      otherServings: others,
    }
  }, [foodDetails])

  const loadFoodDetails = async () => {
    if (!foodId) return

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
        body: { foodId },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.success && data?.data?.food) {
        const foodData = data.data.food

        let servings: Serving[] = []
        if (foodData.servings?.serving) {
          servings = Array.isArray(foodData.servings.serving)
            ? foodData.servings.serving
            : [foodData.servings.serving]
        }

        setFoodDetails({
          food_id: foodData.food_id,
          food_name: foodData.food_name,
          servings,
        })

        const defaultServ = servings.find((s: Serving) => s.is_default === '1') || servings[0]
        if (defaultServ) {
          setSelectedServing(defaultServ)
        }
      } else {
        setError('Food details not found')
      }
    } catch (err: any) {
      console.error('Load food details error:', err)
      setError(err.message || 'Failed to load food details')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    if (!selectedServing || !foodDetails) return

    const quantityNum = parseFloat(quantity) || 1
    if (quantityNum <= 0) {
      setError('Quantity must be greater than 0')
      return
    }

    const calories = parseFloat(selectedServing.calories || '0') * quantityNum
    const protein = parseFloat(selectedServing.protein || '0') * quantityNum
    const carbohydrate = parseFloat(selectedServing.carbohydrate || '0') * quantityNum
    const fat = parseFloat(selectedServing.fat || '0') * quantityNum
    const fiber = parseFloat(selectedServing.fiber || '0') * quantityNum
    const sugar = parseFloat(selectedServing.sugar || '0') * quantityNum
    const sodium = parseFloat(selectedServing.sodium || '0') * quantityNum

    onAdd({
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
    })
  }

  const incrementQuantity = () => {
    const current = parseFloat(quantity) || 1
    setQuantity((current + 1).toString())
  }

  const decrementQuantity = () => {
    const current = parseFloat(quantity) || 1
    if (current > 1) {
      setQuantity((current - 1).toString())
    }
  }

  const selectServing = (serving: Serving) => {
    setSelectedServing(serving)
    setQuantity('1')
  }

  const renderDefaultOption = (serving: Serving) => {
    const isSelected = selectedServing?.serving_id === serving.serving_id
    const cal = Math.round(parseFloat(serving.calories || '0'))
    const pro = Math.round(parseFloat(serving.protein || '0'))

    return (
      <TouchableOpacity
        key={serving.serving_id}
        onPress={() => selectServing(serving)}
        style={[styles.defaultOption, isSelected && styles.defaultOptionActive]}
        activeOpacity={0.7}
      >
        <View style={styles.defaultOptionHeader}>
          <Text style={styles.defaultOptionIcon}>🎯</Text>
          <Text style={[styles.defaultOptionLabel, isSelected && styles.defaultOptionLabelActive]}>
            {serving.serving_description}
          </Text>
          {isSelected && <Ionicons name="checkmark-circle" size={22} color="#FE5858" />}
        </View>
        <Text style={[styles.defaultOptionMacros, isSelected && styles.defaultOptionMacrosActive]}>
          {cal} cal · {pro}g protein
        </Text>
      </TouchableOpacity>
    )
  }

  const renderQuickOption = (serving: Serving, label: string) => {
    const isSelected = selectedServing?.serving_id === serving.serving_id
    const cal = Math.round(parseFloat(serving.calories || '0'))

    return (
      <TouchableOpacity
        key={serving.serving_id}
        onPress={() => selectServing(serving)}
        style={[styles.quickOption, isSelected && styles.quickOptionActive]}
        activeOpacity={0.7}
      >
        <Text style={[styles.quickOptionLabel, isSelected && styles.quickOptionLabelActive]}>
          {label}
        </Text>
        <Text style={[styles.quickOptionCalories, isSelected && styles.quickOptionCaloriesActive]}>
          {cal} cal
        </Text>
      </TouchableOpacity>
    )
  }

  const renderExpandedOption = (serving: Serving) => {
    const isSelected = selectedServing?.serving_id === serving.serving_id
    const cal = Math.round(parseFloat(serving.calories || '0'))

    return (
      <TouchableOpacity
        key={serving.serving_id}
        onPress={() => selectServing(serving)}
        style={[styles.expandedOption, isSelected && styles.expandedOptionActive]}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.expandedOptionText, isSelected && styles.expandedOptionTextActive]}
          numberOfLines={2}
        >
          {serving.serving_description}
        </Text>
        <Text style={[styles.expandedOptionCalories, isSelected && styles.expandedOptionCaloriesActive]}>
          {cal} cal
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#282B34" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{foodName || 'Select Food'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#FE5858" />
          <Text style={styles.loadingText}>Loading food details...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorView}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadFoodDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : foodDetails ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.sectionTitle}>How much did you have?</Text>

          {defaultServing && renderDefaultOption(defaultServing)}

          {(oneOzServing || hundredGServing) && (
            <View style={styles.quickOptionsRow}>
              {oneOzServing && renderQuickOption(oneOzServing, '1 oz')}
              {hundredGServing && renderQuickOption(hundredGServing, '100g')}
            </View>
          )}

          <View style={styles.quantitySection}>
            <Text style={styles.quantitySectionTitle}>Quantity</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity style={styles.quantityButton} onPress={decrementQuantity}>
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="1"
              />
              <TouchableOpacity style={styles.quantityButton} onPress={incrementQuantity}>
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {otherServings.length > 0 && (
            <View style={styles.moreServingsSection}>
              <TouchableOpacity
                style={styles.moreServingsHeader}
                onPress={() => setShowAllServings(!showAllServings)}
                activeOpacity={0.7}
              >
                <Text style={styles.moreServingsText}>
                  More serving sizes ({otherServings.length})
                </Text>
                <Ionicons
                  name={showAllServings ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {showAllServings && (
                <View style={styles.moreServingsList}>
                  {otherServings.map((serving) => renderExpandedOption(serving))}
                </View>
              )}
            </View>
          )}

          {selectedServing && (
            <View style={styles.nutritionSummary}>
              <Text style={styles.nutritionSummaryTitle}>Total Nutrition</Text>
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionItemValue}>
                    {Math.round(parseFloat(selectedServing.calories || '0') * (parseFloat(quantity) || 1))}
                  </Text>
                  <Text style={styles.nutritionItemLabel}>Calories</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionItemValue}>
                    {Math.round(parseFloat(selectedServing.protein || '0') * (parseFloat(quantity) || 1))}g
                  </Text>
                  <Text style={styles.nutritionItemLabel}>Protein</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionItemValue}>
                    {Math.round(parseFloat(selectedServing.carbohydrate || '0') * (parseFloat(quantity) || 1))}g
                  </Text>
                  <Text style={styles.nutritionItemLabel}>Carbs</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionItemValue}>
                    {Math.round(parseFloat(selectedServing.fat || '0') * (parseFloat(quantity) || 1))}g
                  </Text>
                  <Text style={styles.nutritionItemLabel}>Fat</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.addButton, (!selectedServing || loading) && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!selectedServing || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>Add to Meal</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    flex: 1,
    marginHorizontal: 12,
  },
  loading: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  errorView: {
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 16,
  },
  defaultOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F6FBFE',
    marginBottom: 12,
  },
  defaultOptionActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  defaultOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  defaultOptionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  defaultOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    flex: 1,
  },
  defaultOptionLabelActive: {
    color: '#FE5858',
  },
  defaultOptionMacros: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 24,
  },
  defaultOptionMacrosActive: {
    color: '#FE5858',
  },
  quickOptionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  quickOptionActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  quickOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 2,
  },
  quickOptionLabelActive: {
    color: '#FE5858',
  },
  quickOptionCalories: {
    fontSize: 13,
    color: '#6B7280',
  },
  quickOptionCaloriesActive: {
    color: '#FE5858',
  },
  moreServingsSection: {
    marginBottom: 20,
  },
  moreServingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  moreServingsText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  moreServingsList: {
    marginTop: 12,
    gap: 8,
  },
  expandedOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  expandedOptionActive: {
    borderColor: '#FE5858',
    backgroundColor: '#FEF2F2',
  },
  expandedOptionText: {
    fontSize: 14,
    color: '#282B34',
    flex: 1,
    marginRight: 8,
  },
  expandedOptionTextActive: {
    color: '#FE5858',
    fontWeight: '500',
  },
  expandedOptionCalories: {
    fontSize: 13,
    color: '#6B7280',
  },
  expandedOptionCaloriesActive: {
    color: '#FE5858',
  },
  quantitySection: {
    marginBottom: 20,
  },
  quantitySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quantityButtonText: {
    fontSize: 24,
    color: '#282B34',
    fontWeight: '600',
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#282B34',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  nutritionSummary: {
    backgroundColor: '#F6FBFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  nutritionSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionItemValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 2,
  },
  nutritionItemLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  addButton: {
    backgroundColor: '#FE5858',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
})
