import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { createClient } from '@/lib/supabase/client'

interface FoodSearchModalProps {
  visible: boolean
  onClose: () => void
  onFoodSelected: (food: { food_id: string; food_name: string }) => void
  preselectedMealType?: string | null
  filterType?: 'generic' | 'brand' | 'all'
}

interface SearchResult {
  food_id: string
  food_name: string
  brand_name?: string
  food_description?: string
}

export default function FoodSearchModal({
  visible,
  onClose,
  onFoodSelected,
  preselectedMealType,
  filterType = 'all',
}: FoodSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (!query) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Please sign in')
        return
      }

      const { data, error: invokeError } = await supabase.functions.invoke('nutrition-search', {
        body: { 
          query, 
          pageNumber: 0, 
          maxResults: 20,
          filterType: filterType,
        },
      })

      if (invokeError) {
        throw invokeError
      }

      if (data?.success && data?.data?.foods) {
        setResults(data.data.foods)
      } else {
        setResults([])
      }
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message || 'Failed to search foods')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectFood = (food: SearchResult) => {
    console.log('🎯 FoodSearchModal: Food selected:', food.food_name, food.food_id)
    onFoodSelected({
      food_id: food.food_id,
      food_name: food.food_name,
    })
    console.log('✅ FoodSearchModal: onFoodSelected callback completed')
  }

  const handleClose = () => {
    setSearchQuery('')
    setResults([])
    setError(null)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Foods</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for food..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus={true}
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.searchButtonDisabled]}
              onPress={handleSearch}
              disabled={loading || !searchQuery.trim()}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.resultsContainer}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={true}
          >
            {loading && results.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FE5858" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : results.length > 0 ? (
              <View style={styles.resultsList}>
                {results.map((food) => (
                  <TouchableOpacity
                    key={food.food_id}
                    style={styles.resultItem}
                    onPress={() => handleSelectFood(food)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultItemContent}>
                      <Text style={styles.resultItemName}>{food.food_name}</Text>
                      {food.brand_name && (
                        <Text style={styles.resultItemBrand}>{food.brand_name}</Text>
                      )}
                      {food.food_description && (
                        <Text style={styles.resultItemDescription} numberOfLines={2}>
                          {food.food_description}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.resultItemArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : searchQuery && !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No foods found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
    flex: 1,
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
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#282B34',
    backgroundColor: '#FFFFFF',
  },
  searchButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#FE5858',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  resultsList: {
    gap: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4FBFE',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultItemContent: {
    flex: 1,
  },
  resultItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 4,
  },
  resultItemBrand: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  resultItemDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  resultItemArrow: {
    fontSize: 24,
    color: '#6B7280',
    marginLeft: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
})
