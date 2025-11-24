'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FoodSearchProps {
  onFoodSelected: (food: any) => void
}

export default function FoodSearch({ onFoodSelected }: FoodSearchProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

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

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map((food) => (
            <button
              key={food.food_id}
              onClick={() => onFoodSelected(food)}
              className="p-4 border border-gray-200 rounded-md bg-white hover:bg-gray-50 text-left transition-colors"
            >
              <div className="font-medium text-gray-900 mb-1">{food.food_name}</div>
              {food.brand_name && (
                <div className="text-sm text-gray-600 mb-2">{food.brand_name}</div>
              )}
              {food.food_description && (
                <div className="text-xs text-gray-500">{food.food_description}</div>
              )}
            </button>
          ))}
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

