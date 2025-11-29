'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FoodSearchProps {
  onFoodSelected: (food: any) => void
  userId: number
}

export default function FoodSearch({ onFoodSelected, userId }: FoodSearchProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<any[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Please sign in to search foods')
        return
      }

      const { data, error: invokeError } = await supabase.functions.invoke('nutrition-search', {
        body: { query: query.trim(), pageNumber: 0, maxResults: 20 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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

  // Load favorites on mount
  useEffect(() => {
    loadFavorites()
  }, [userId])

  const loadFavorites = async () => {
    setFavoritesLoading(true)
    try {
      const response = await fetch('/api/nutrition/favorites')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setFavorites(data.favorites || [])
        }
      }
    } catch (err) {
      console.error('Error loading favorites:', err)
    } finally {
      setFavoritesLoading(false)
    }
  }

  const isFavorite = (foodId: string) => {
    return favorites.some(fav => fav.food_id === foodId)
  }

  const toggleFavorite = async (e: React.MouseEvent, food: any) => {
    e.stopPropagation()
    setTogglingFavorite(food.food_id)
    
    try {
      const isCurrentlyFavorite = isFavorite(food.food_id)
      const response = await fetch('/api/nutrition/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isCurrentlyFavorite ? 'remove' : 'add',
          foodId: food.food_id,
          foodName: food.food_name,
          servingId: null,
          servingDescription: null,
        }),
      })

      if (response.ok) {
        await loadFavorites() // Refresh favorites list
      }
    } catch (err) {
      console.error('Error toggling favorite:', err)
    } finally {
      setTogglingFavorite(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for food..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Favorites Section */}
      {!favoritesLoading && favorites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Favorites</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {favorites.map((fav) => (
              <button
                key={fav.food_id}
                onClick={() => onFoodSelected({
                  food_id: fav.food_id,
                  food_name: fav.food_name,
                  brand_name: null,
                  food_description: null,
                })}
                className="p-4 border border-gray-200 rounded-md bg-white hover:bg-gray-50 text-left transition-colors relative"
              >
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-[#FE5858]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="font-medium text-gray-900 mb-1 pr-6">{fav.food_name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {favorites.length > 0 && <h3 className="text-sm font-semibold text-gray-700">Search Results</h3>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((food) => {
              const isFav = isFavorite(food.food_id)
              return (
                <button
                  key={food.food_id}
                  onClick={() => onFoodSelected(food)}
                  className="p-4 border border-gray-200 rounded-md bg-white hover:bg-gray-50 text-left transition-colors relative"
                >
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => toggleFavorite(e, food)}
                      disabled={togglingFavorite === food.food_id}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {togglingFavorite === food.food_id ? (
                        <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className={`w-5 h-5 ${isFav ? 'text-[#FE5858]' : 'text-gray-400'}`} fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="font-medium text-gray-900 mb-1 pr-10">{food.food_name}</div>
                  {food.brand_name && (
                    <div className="text-sm text-gray-600 mb-2">{food.brand_name}</div>
                  )}
                  {food.food_description && (
                    <div className="text-xs text-gray-500">{food.food_description}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!loading && query && results.length === 0 && !error && (
        <div className="text-sm text-gray-500 text-center py-4">
          No foods found. Try a different search term.
        </div>
      )}
    </div>
  )
}

