import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'

const GRAMS_PER_OZ = 28.35

interface PortionAdjustInputProps {
  food: {
    name: string
    brand_name?: string
    normalized_nutrition?: {
      calories_per_gram: number
      protein_per_gram: number
      carbs_per_gram: number
      fat_per_gram: number
      fiber_per_gram?: number
      sodium_per_gram?: number
    }
    raw_serving?: {
      calories: number
      protein: number
      carbohydrate: number
      fat: number
      serving_description?: string
    }
  }
  defaultAmount?: number
  defaultUnit?: 'oz' | 'g' | 'serving'
  onAmountChange?: (amount: number, unit: string, macros: any) => void
  showSaveButton?: boolean
  onSave?: (amount: number, unit: string) => void
  onCancel?: () => void
  // New 2x2 grid button options
  showGridButtons?: boolean
  onLogNow?: (amount: number, unit: string) => void
  onSaveOnly?: (amount: number, unit: string) => void
  onLogAndSave?: (amount: number, unit: string) => void
}

export default function PortionAdjustInput({
  food,
  defaultAmount = 1,
  defaultUnit = 'oz',
  onAmountChange,
  showSaveButton = false,
  onSave,
  onCancel,
  showGridButtons = false,
  onLogNow,
  onSaveOnly,
  onLogAndSave,
}: PortionAdjustInputProps) {
  const [amount, setAmount] = useState(defaultAmount.toString())
  const [unit, setUnit] = useState<'oz' | 'g' | 'serving'>(defaultUnit)
  
  const hasNormalized = !!food.normalized_nutrition
  
  // Calculate macros based on amount
  const calculateMacros = (inputAmount: number, inputUnit: string) => {
    if (hasNormalized) {
      // Use per-gram nutrition
      const grams = inputUnit === 'oz' 
        ? inputAmount * GRAMS_PER_OZ 
        : inputAmount
      
      const n = food.normalized_nutrition!
      return {
        calories: Math.round(n.calories_per_gram * grams),
        protein: Math.round(n.protein_per_gram * grams * 10) / 10,
        carbs: Math.round(n.carbs_per_gram * grams * 10) / 10,
        fat: Math.round(n.fat_per_gram * grams * 10) / 10,
        fiber: n.fiber_per_gram ? Math.round(n.fiber_per_gram * grams * 10) / 10 : 0,
        sodium: n.sodium_per_gram ? Math.round(n.sodium_per_gram * grams) : 0,
      }
    } else if (food.raw_serving) {
      // Use raw serving with multiplier
      const multiplier = inputAmount
      return {
        calories: Math.round(food.raw_serving.calories * multiplier),
        protein: Math.round(food.raw_serving.protein * multiplier * 10) / 10,
        carbs: Math.round(food.raw_serving.carbohydrate * multiplier * 10) / 10,
        fat: Math.round(food.raw_serving.fat * multiplier * 10) / 10,
      }
    }
    return null
  }
  
  const currentMacros = calculateMacros(parseFloat(amount) || 0, unit)
  
  // Convert between oz and g
  const getOzAmount = () => {
    if (unit === 'oz') return parseFloat(amount) || 0
    return Math.round((parseFloat(amount) || 0) / GRAMS_PER_OZ * 10) / 10
  }
  
  const getGramAmount = () => {
    if (unit === 'g') return parseFloat(amount) || 0
    return Math.round((parseFloat(amount) || 0) * GRAMS_PER_OZ)
  }
  
  const handleAmountChange = (value: string) => {
    setAmount(value)
    const numValue = parseFloat(value) || 0
    if (onAmountChange && numValue > 0) {
      const macros = calculateMacros(numValue, unit)
      onAmountChange(numValue, unit, macros)
    }
  }
  
  const handleUnitToggle = () => {
    if (unit === 'oz') {
      // Switch to grams
      const grams = getGramAmount()
      setAmount(grams.toString())
      setUnit('g')
      if (onAmountChange) {
        const macros = calculateMacros(grams, 'g')
        onAmountChange(grams, 'g', macros)
      }
    } else {
      // Switch to oz
      const oz = getOzAmount()
      setAmount(oz.toString())
      setUnit('oz')
      if (onAmountChange) {
        const macros = calculateMacros(oz, 'oz')
        onAmountChange(oz, 'oz', macros)
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Food name */}
      <View style={styles.header}>
        <Text style={styles.foodName}>{food.name}</Text>
        {food.brand_name && (
          <Text style={styles.brandName}>{food.brand_name}</Text>
        )}
      </View>
      
      {/* Default portion indicator */}
      {defaultAmount > 1 && (
        <Text style={styles.defaultHint}>
          Your usual: {defaultAmount} {defaultUnit}
        </Text>
      )}
      
      {/* Portion input */}
      {hasNormalized ? (
        <View style={styles.inputSection}>
          <Text style={styles.label}>How much today?</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={styles.unit}>{unit}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={handleUnitToggle}
            >
              <Text style={styles.toggleText}>
                or {unit === 'oz' ? getGramAmount() + 'g' : getOzAmount() + 'oz'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.inputSection}>
          <Text style={styles.label}>
            Serving: {food.raw_serving?.serving_description || 'Standard'}
          </Text>
          <Text style={styles.sublabel}>How many servings?</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.servingInput]}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="1"
            />
            <Text style={styles.unit}>servings</Text>
          </View>
        </View>
      )}
      
      {/* Nutrition display */}
      {currentMacros && (
        <View style={styles.nutritionDisplay}>
          <Text style={styles.nutritionText}>
            <Text style={styles.caloriesText}>{currentMacros.calories} cal</Text>
            {' • '}
            <Text>{currentMacros.protein}g P</Text>
            {' • '}
            <Text>{currentMacros.carbs}g C</Text>
            {' • '}
            <Text>{currentMacros.fat}g F</Text>
          </Text>
        </View>
      )}
      
      {/* Action buttons */}
      {showGridButtons ? (
        <View style={styles.gridButtons}>
          {/* Top row - Primary actions */}
          <View style={styles.gridRow}>
            {onLogNow && (
              <TouchableOpacity 
                style={[styles.gridButton, styles.logNowButton]}
                onPress={() => onLogNow(parseFloat(amount) || 0, unit)}
              >
                <Text style={styles.logNowButtonText}>Log Now</Text>
              </TouchableOpacity>
            )}
            {onLogAndSave && (
              <TouchableOpacity 
                style={[styles.gridButton, styles.logAndSaveButton]}
                onPress={() => onLogAndSave(parseFloat(amount) || 0, unit)}
              >
                <Text style={styles.logAndSaveButtonText}>Log & Save</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Bottom row - Secondary actions */}
          <View style={styles.gridRow}>
            {onCancel && (
              <TouchableOpacity 
                style={[styles.gridButton, styles.gridCancelButton]}
                onPress={onCancel}
              >
                <Text style={styles.gridCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            {onSaveOnly && (
              <TouchableOpacity 
                style={[styles.gridButton, styles.saveOnlyButton]}
                onPress={() => onSaveOnly(parseFloat(amount) || 0, unit)}
              >
                <Text style={styles.saveOnlyButtonText}>Save Only</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : showSaveButton ? (
        <View style={styles.actions}>
          {onCancel && (
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
          {onSave && (
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]}
              onPress={() => onSave(parseFloat(amount) || 0, unit)}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  foodName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  brandName: {
    fontSize: 14,
    color: '#6B7280',
  },
  defaultHint: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  inputSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  input: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 60,
    textAlign: 'center',
  },
  servingInput: {
    minWidth: 80,
  },
  unit: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  toggleButton: {
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  nutritionDisplay: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  nutritionText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
  },
  caloriesText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
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
  saveButton: {
    backgroundColor: '#FE5858',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // 2x2 Grid button styles
  gridButtons: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  // Top row buttons (primary actions)
  logNowButton: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  logNowButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logAndSaveButton: {
    backgroundColor: '#FE5858',
    borderColor: '#DC2626',
  },
  logAndSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Bottom row buttons (secondary actions)
  gridCancelButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  gridCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveOnlyButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#9CA3AF',
  },
  saveOnlyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
})






