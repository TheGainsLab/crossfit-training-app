// API functions to fetch default food sources from database
import { createClient } from '@/lib/supabase/client'

export interface DefaultIngredient {
  id: number
  name: string
  emoji: string | null
  search_term: string
  category: string
  sort_order: number
  is_active: boolean
  usage_count: number
}

export interface DefaultRestaurant {
  id: number
  name: string
  emoji: string | null
  fatsecret_name: string
  aliases: string[] | null
  sort_order: number
  is_active: boolean
  usage_count: number
}

export interface DefaultBrand {
  id: number
  name: string
  emoji: string | null
  fatsecret_name: string
  aliases: string[] | null
  sort_order: number
  is_active: boolean
  usage_count: number
}

// Cache to avoid repeated database calls
let ingredientsCache: DefaultIngredient[] | null = null
let restaurantsCache: DefaultRestaurant[] | null = null
let brandsCache: DefaultBrand[] | null = null

/**
 * Fetch default ingredients from database
 * Returns cached data if available
 */
export async function getDefaultIngredients(): Promise<DefaultIngredient[]> {
  if (ingredientsCache) return ingredientsCache

  const supabase = createClient()
  const { data, error } = await supabase
    .from('default_ingredients')
    .select('*')
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching default ingredients:', error)
    return []
  }

  ingredientsCache = data || []
  return ingredientsCache
}

/**
 * Fetch default restaurants from database
 * Returns cached data if available
 */
export async function getDefaultRestaurants(): Promise<DefaultRestaurant[]> {
  if (restaurantsCache) return restaurantsCache

  const supabase = createClient()
  const { data, error } = await supabase
    .from('default_restaurants')
    .select('*')
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching default restaurants:', error)
    return []
  }

  restaurantsCache = data || []
  return restaurantsCache
}

/**
 * Fetch default brands from database
 * Returns cached data if available
 */
export async function getDefaultBrands(): Promise<DefaultBrand[]> {
  if (brandsCache) return brandsCache

  const supabase = createClient()
  const { data, error } = await supabase
    .from('default_brands')
    .select('*')
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching default brands:', error)
    return []
  }

  brandsCache = data || []
  return brandsCache
}

/**
 * Get ingredients grouped by category
 */
export async function getIngredientsByCategory(): Promise<Record<string, DefaultIngredient[]>> {
  const ingredients = await getDefaultIngredients()

  const grouped: Record<string, DefaultIngredient[]> = {}
  for (const ingredient of ingredients) {
    if (!grouped[ingredient.category]) {
      grouped[ingredient.category] = []
    }
    grouped[ingredient.category].push(ingredient)
  }

  return grouped
}

/**
 * Search/filter restaurants by query
 */
export function searchRestaurants(query: string, restaurants: DefaultRestaurant[]): DefaultRestaurant[] {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return restaurants

  return restaurants.filter(restaurant => {
    if (restaurant.name.toLowerCase().includes(normalized)) return true
    if (restaurant.fatsecret_name.toLowerCase().includes(normalized)) return true
    if (restaurant.aliases?.some(alias => alias.toLowerCase().includes(normalized))) return true
    return false
  })
}

/**
 * Search/filter brands by query
 */
export function searchBrands(query: string, brands: DefaultBrand[]): DefaultBrand[] {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return brands

  return brands.filter(brand => {
    if (brand.name.toLowerCase().includes(normalized)) return true
    if (brand.fatsecret_name.toLowerCase().includes(normalized)) return true
    if (brand.aliases?.some(alias => alias.toLowerCase().includes(normalized))) return true
    return false
  })
}

/**
 * Search/filter ingredients by query
 */
export function searchIngredients(query: string, ingredients: DefaultIngredient[]): DefaultIngredient[] {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return ingredients

  return ingredients.filter(ingredient => {
    if (ingredient.name.toLowerCase().includes(normalized)) return true
    if (ingredient.search_term.toLowerCase().includes(normalized)) return true
    return false
  })
}

/**
 * Try to normalize a restaurant name to its FatSecret equivalent
 */
export function normalizeRestaurantName(input: string, restaurants: DefaultRestaurant[]): string | null {
  const normalized = input.toLowerCase().trim()

  for (const restaurant of restaurants) {
    if (restaurant.name.toLowerCase() === normalized) {
      return restaurant.fatsecret_name
    }
    if (restaurant.fatsecret_name.toLowerCase() === normalized) {
      return restaurant.fatsecret_name
    }
    if (restaurant.aliases?.some(alias => alias.toLowerCase() === normalized)) {
      return restaurant.fatsecret_name
    }
  }

  return null
}

/**
 * Try to normalize a brand name to its FatSecret equivalent
 */
export function normalizeBrandName(input: string, brands: DefaultBrand[]): string | null {
  const normalized = input.toLowerCase().trim()

  for (const brand of brands) {
    if (brand.name.toLowerCase() === normalized) {
      return brand.fatsecret_name
    }
    if (brand.fatsecret_name.toLowerCase() === normalized) {
      return brand.fatsecret_name
    }
    if (brand.aliases?.some(alias => alias.toLowerCase() === normalized)) {
      return brand.fatsecret_name
    }
  }

  return null
}

/**
 * Increment usage count for an ingredient (call when user selects it)
 */
export async function incrementIngredientUsage(ingredientId: number): Promise<void> {
  const supabase = createClient()
  await supabase.rpc('increment_ingredient_usage', { ingredient_id: ingredientId })
    .then(() => {
      // Invalidate cache so next fetch gets updated counts
      ingredientsCache = null
    })
    .catch(err => console.error('Error incrementing usage:', err))
}

/**
 * Increment usage count for a restaurant
 */
export async function incrementRestaurantUsage(restaurantId: number): Promise<void> {
  const supabase = createClient()
  await supabase.rpc('increment_restaurant_usage', { restaurant_id: restaurantId })
    .then(() => {
      restaurantsCache = null
    })
    .catch(err => console.error('Error incrementing usage:', err))
}

/**
 * Increment usage count for a brand
 */
export async function incrementBrandUsage(brandId: number): Promise<void> {
  const supabase = createClient()
  await supabase.rpc('increment_brand_usage', { brand_id: brandId })
    .then(() => {
      brandsCache = null
    })
    .catch(err => console.error('Error incrementing usage:', err))
}

/**
 * Clear all caches (useful after admin updates)
 */
export function clearDefaultsCache(): void {
  ingredientsCache = null
  restaurantsCache = null
  brandsCache = null
}

/**
 * Category display names and order
 */
export const CATEGORY_INFO: Record<string, { label: string; emoji: string; order: number }> = {
  protein: { label: 'Proteins', emoji: '🍗', order: 1 },
  carb: { label: 'Carbs', emoji: '🍚', order: 2 },
  vegetable: { label: 'Vegetables', emoji: '🥦', order: 3 },
  fat: { label: 'Fats', emoji: '🥑', order: 4 },
  fruit: { label: 'Fruits', emoji: '🍎', order: 5 },
  dairy: { label: 'Dairy', emoji: '🥛', order: 6 },
  other: { label: 'Other', emoji: '🍽️', order: 7 },
}

/**
 * Get sorted category keys
 */
export function getSortedCategories(): string[] {
  return Object.keys(CATEGORY_INFO).sort(
    (a, b) => CATEGORY_INFO[a].order - CATEGORY_INFO[b].order
  )
}
