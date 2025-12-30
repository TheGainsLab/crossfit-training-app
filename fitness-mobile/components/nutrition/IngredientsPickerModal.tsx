import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '@/lib/supabase/client'

interface Ingredient {
  id: number
  food_id: string
  food_name: string
  default_amount?: number
  default_unit?: string
  log_count?: number
}

interface IngredientsPickerModalProps {
  visible: boolean
  onClose: () => void
  onIngredientSelected: (ingredient: { food_id: string; food_name: string }) => void
}

export default function IngredientsPickerModal({
  visible,
  onClose,
  onIngredientSelected,
}: IngredientsPickerModalProps) {
  const [loading, setLoading] = useState(true)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (visible) {
      loadIngredients()
    }
  }, [visible])

  const loadIngredients = async () => {
    try {
      setLoading(true)
      const { data: favData, error } = await supabase.functions.invoke('favorites-manage', {
        body: { action: 'get_all' },
      })

      if (error) throw error

      // Filter to only get standalone ingredients (not restaurant/brand items)
      const foods = favData?.data?.foods || []
      const standaloneIngredients = foods.filter(
        (f: any) => !f.restaurant_id && !f.brand_id
      )

      // Sort by log_count (most used first), then alphabetically
      standaloneIngredients.sort((a: any, b: any) => {
        if ((b.log_count || 0) !== (a.log_count || 0)) {
          return (b.log_count || 0) - (a.log_count || 0)
        }
        return a.food_name.localeCompare(b.food_name)
      })

      setIngredients(standaloneIngredients)
    } catch (error) {
      console.error('Error loading ingredients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIngredientPress = (ingredient: Ingredient) => {
    onIngredientSelected({
      food_id: ingredient.food_id,
      food_name: ingredient.food_name,
    })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>My Ingredients</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FE5858" />
            <Text style={styles.loadingText}>Loading ingredients...</Text>
          </View>
        ) : ingredients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="nutrition-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Ingredients Yet</Text>
            <Text style={styles.emptyText}>
              Add ingredients via Favorites to see them here for quick logging.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.subtitle}>
              Tap an ingredient to select serving size
            </Text>
            {ingredients.map((ingredient) => (
              <TouchableOpacity
                key={ingredient.id}
                style={styles.ingredientItem}
                onPress={() => handleIngredientPress(ingredient)}
                activeOpacity={0.7}
              >
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{ingredient.food_name}</Text>
                  {ingredient.log_count && ingredient.log_count > 0 ? (
                    <Text style={styles.ingredientMeta}>
                      Logged {ingredient.log_count}x
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  ingredientMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
})
